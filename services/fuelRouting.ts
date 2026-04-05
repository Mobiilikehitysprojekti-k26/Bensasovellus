import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LatLng } from 'react-native-maps';
import { createOpenRouteServiceGeocodeUrl } from './openRouteService';
import { fetchDrivingRouteWithWaypoints, type DrivingRoute } from './routing';

const FUEL_API_BASE_URL = 'http://204.168.156.110:3000/api/fuel';
const FUEL_API_KEY = '01102FFA595F2B91';
const STATION_COORDINATE_CACHE_KEY = '@bensasovellus/fuel_station_coordinates_v1';
const GEOCODE_CONCURRENCY = 4;
const EXACT_ROUTE_CONCURRENCY = 3;
const MAX_EXACT_CANDIDATES = 6;
const MAX_CORRIDOR_DISTANCE_METERS = 18000;

export type FuelType = '95' | '98' | 'diesel';

type FuelApiStation = {
  fuel_type: string;
  price: number;
  scraped_at: string;
  station_name: string;
  updated_text: string;
};

type OpenRouteServiceGeocodeResponse = {
  features?: Array<{
    geometry?: {
      coordinates?: [number, number];
    };
    properties?: {
      label?: string;
    };
  }>;
};

type StationCoordinateCacheEntry = {
  latitude: number;
  longitude: number;
  resolvedName?: string;
};

type StationCoordinateCache = Record<string, StationCoordinateCacheEntry>;

type StationCandidate = {
  coordinate: LatLng;
  corridorDistanceMeters: number;
  fuelType: FuelType;
  price: number;
  resolvedName?: string;
  scrapedAt: string;
  stationName: string;
  updatedText: string;
};

export interface RecommendedFuelStop {
  coordinate: LatLng;
  detourDistanceMeters: number;
  estimatedTripFuelCost: number;
  fuelType: FuelType;
  price: number;
  resolvedName?: string;
  route: DrivingRoute;
  scrapedAt: string;
  stationName: string;
  totalRouteDistanceMeters: number;
  totalRouteDurationSeconds: number;
  updatedText: string;
}

let stationCoordinateCache: StationCoordinateCache | null = null;

function normalizeStationKey(stationName: string): string {
  return stationName.trim().toLowerCase();
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineMeters(a: LatLng, b: LatLng): number {
  const earthRadius = 6371000;
  const latitudeDelta = toRadians(b.latitude - a.latitude);
  const longitudeDelta = toRadians(b.longitude - a.longitude);
  const latitude1 = toRadians(a.latitude);
  const latitude2 = toRadians(b.latitude);

  const value =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2) *
      Math.cos(latitude1) *
      Math.cos(latitude2);

  return 2 * earthRadius * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function distancePointToSegmentMeters(point: LatLng, start: LatLng, end: LatLng): number {
  const latitudeScale = 111320;
  const longitudeScale = Math.cos(toRadians(point.latitude)) * 111320;

  const pointX = point.longitude * longitudeScale;
  const pointY = point.latitude * latitudeScale;
  const startX = start.longitude * longitudeScale;
  const startY = start.latitude * latitudeScale;
  const endX = end.longitude * longitudeScale;
  const endY = end.latitude * latitudeScale;

  const segmentX = endX - startX;
  const segmentY = endY - startY;
  const relativeX = pointX - startX;
  const relativeY = pointY - startY;
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;

  if (segmentLengthSquared === 0) {
    return Math.hypot(pointX - startX, pointY - startY);
  }

  const position = Math.max(
    0,
    Math.min(1, (relativeX * segmentX + relativeY * segmentY) / segmentLengthSquared)
  );
  const closestX = startX + position * segmentX;
  const closestY = startY + position * segmentY;

  return Math.hypot(pointX - closestX, pointY - closestY);
}

function distanceToRouteMeters(point: LatLng, route: LatLng[]): number {
  if (route.length < 2) {
    return Infinity;
  }

  let minimumDistance = Infinity;

  for (let index = 0; index < route.length - 1; index += 1) {
    const distance = distancePointToSegmentMeters(point, route[index], route[index + 1]);

    if (distance < minimumDistance) {
      minimumDistance = distance;
    }
  }

  return minimumDistance;
}

function calculateTripFuelCost(
  distanceMeters: number,
  combinedConsumption: number,
  pricePerLiter: number
): number {
  const litersConsumed = (distanceMeters / 1000) * (combinedConsumption / 100);
  return litersConsumed * pricePerLiter;
}

async function getStationCoordinateCache(): Promise<StationCoordinateCache> {
  if (stationCoordinateCache) {
    return stationCoordinateCache;
  }

  try {
    const rawValue = await AsyncStorage.getItem(STATION_COORDINATE_CACHE_KEY);

    if (!rawValue) {
      stationCoordinateCache = {};
      return stationCoordinateCache;
    }

    const parsedValue = JSON.parse(rawValue) as StationCoordinateCache;
    stationCoordinateCache = parsedValue ?? {};
    return stationCoordinateCache;
  } catch (error) {
    console.error('Failed to load station coordinate cache', error);
    stationCoordinateCache = {};
    return stationCoordinateCache;
  }
}

async function saveStationCoordinateCache(cache: StationCoordinateCache): Promise<void> {
  stationCoordinateCache = cache;

  try {
    await AsyncStorage.setItem(STATION_COORDINATE_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('Failed to save station coordinate cache', error);
  }
}

async function fetchFuelStations(fuelType: FuelType): Promise<FuelApiStation[]> {
  const response = await fetch(`${FUEL_API_BASE_URL}/${fuelType}`, {
    headers: {
      Accept: 'application/json',
      'x-api-key': FUEL_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error('Polttoainehintojen haku epäonnistui.');
  }

  const data = (await response.json()) as FuelApiStation[];

  if (!Array.isArray(data)) {
    throw new Error('Polttoainehinnat palautuivat odottamattomassa muodossa.');
  }

  return data;
}

async function geocodeFuelStation(stationName: string): Promise<StationCoordinateCacheEntry | null> {
  const url = createOpenRouteServiceGeocodeUrl({
    boundaryCountry: 'FI',
    size: 1,
    text: `${stationName}, Finland`,
  });

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as OpenRouteServiceGeocodeResponse;
  const feature = data.features?.[0];
  const coordinates = feature?.geometry?.coordinates;

  if (!coordinates || coordinates.length < 2) {
    return null;
  }

  return {
    latitude: coordinates[1],
    longitude: coordinates[0],
    resolvedName: feature?.properties?.label,
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<R>(items.length);
  let currentIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (currentIndex < items.length) {
      const itemIndex = currentIndex;
      currentIndex += 1;
      results[itemIndex] = await mapper(items[itemIndex]);
    }
  });

  await Promise.all(workers);
  return results;
}

async function resolveStationCandidates(
  stations: FuelApiStation[],
  baseRouteGeometry: LatLng[]
): Promise<StationCandidate[]> {
  const cache = await getStationCoordinateCache();
  const nextCache: StationCoordinateCache = { ...cache };
  const stationsToGeocode = stations.filter(
    (station) => !nextCache[normalizeStationKey(station.station_name)]
  );

  if (stationsToGeocode.length > 0) {
    const geocodedStations = await mapWithConcurrency(
      stationsToGeocode,
      GEOCODE_CONCURRENCY,
      async (station) => ({
        coordinate: await geocodeFuelStation(station.station_name),
        stationName: station.station_name,
      })
    );

    for (const geocodedStation of geocodedStations) {
      if (!geocodedStation.coordinate) {
        continue;
      }

      nextCache[normalizeStationKey(geocodedStation.stationName)] = geocodedStation.coordinate;
    }

    await saveStationCoordinateCache(nextCache);
  }

  const resolvedStations: StationCandidate[] = [];

  for (const station of stations) {
    const cachedCoordinate = nextCache[normalizeStationKey(station.station_name)];

    if (!cachedCoordinate) {
      continue;
    }

    const coordinate = {
      latitude: cachedCoordinate.latitude,
      longitude: cachedCoordinate.longitude,
    };

    resolvedStations.push({
      coordinate,
      corridorDistanceMeters: distanceToRouteMeters(coordinate, baseRouteGeometry),
      fuelType: station.fuel_type as FuelType,
      price: station.price,
      resolvedName: cachedCoordinate.resolvedName,
      scrapedAt: station.scraped_at,
      stationName: station.station_name,
      updatedText: station.updated_text,
    });
  }

  return resolvedStations;
}

export async function findBestFuelStop(params: {
  baseRoute: DrivingRoute;
  combinedConsumption: number;
  currentLocation: LatLng;
  destination: LatLng;
  fuelType: FuelType;
}): Promise<RecommendedFuelStop | null> {
  const stations = await fetchFuelStations(params.fuelType);
  const stationCandidates = await resolveStationCandidates(stations, params.baseRoute.geometry);

  if (stationCandidates.length === 0) {
    return null;
  }

  const approximatedCandidates = stationCandidates
    .map((station) => {
      const estimatedDistanceMeters =
        params.baseRoute.distanceMeters + station.corridorDistanceMeters * 2.2;

      return {
        ...station,
        approximateTripFuelCost: calculateTripFuelCost(
          estimatedDistanceMeters,
          params.combinedConsumption,
          station.price
        ),
      };
    })
    .sort((left, right) => {
      if (left.approximateTripFuelCost !== right.approximateTripFuelCost) {
        return left.approximateTripFuelCost - right.approximateTripFuelCost;
      }

      if (left.price !== right.price) {
        return left.price - right.price;
      }

      return left.corridorDistanceMeters - right.corridorDistanceMeters;
    });

  const nearbyCandidates = approximatedCandidates.filter(
    (station) => station.corridorDistanceMeters <= MAX_CORRIDOR_DISTANCE_METERS
  );
  const exactCandidates = (nearbyCandidates.length > 0 ? nearbyCandidates : approximatedCandidates)
    .slice(0, MAX_EXACT_CANDIDATES);

  const evaluatedCandidates = await mapWithConcurrency(
    exactCandidates,
    EXACT_ROUTE_CONCURRENCY,
    async (station) => {
      try {
        const route = await fetchDrivingRouteWithWaypoints([
          params.currentLocation,
          station.coordinate,
          params.destination,
        ]);

        return {
          coordinate: station.coordinate,
          detourDistanceMeters: Math.max(0, route.distanceMeters - params.baseRoute.distanceMeters),
          estimatedTripFuelCost: calculateTripFuelCost(
            route.distanceMeters,
            params.combinedConsumption,
            station.price
          ),
          fuelType: station.fuelType,
          price: station.price,
          resolvedName: station.resolvedName,
          route,
          scrapedAt: station.scrapedAt,
          stationName: station.stationName,
          totalRouteDistanceMeters: route.distanceMeters,
          totalRouteDurationSeconds: route.durationSeconds,
          updatedText: station.updatedText,
        } satisfies RecommendedFuelStop;
      } catch (error) {
        console.error(`Failed to evaluate fuel station ${station.stationName}`, error);
        return null;
      }
    }
  );

  const validCandidates: RecommendedFuelStop[] = [];

  for (const station of evaluatedCandidates) {
    if (station) {
      validCandidates.push(station);
    }
  }

  const bestStation = validCandidates.sort((left, right) => {
    if (left.estimatedTripFuelCost !== right.estimatedTripFuelCost) {
      return left.estimatedTripFuelCost - right.estimatedTripFuelCost;
    }

    if (left.detourDistanceMeters !== right.detourDistanceMeters) {
      return left.detourDistanceMeters - right.detourDistanceMeters;
    }

    return left.price - right.price;
  })[0];

  return bestStation ?? null;
}

export function formatFuelPrice(price: number): string {
  return `${price.toFixed(3)} €/l`;
}

export function formatExtraDistance(detourDistanceMeters: number): string {
  if (detourDistanceMeters < 1000) {
    return `+${Math.round(detourDistanceMeters)} m`;
  }

  return `+${(detourDistanceMeters / 1000).toFixed(1)} km`;
}

export function isArrivedAtFuelStop(
  currentLocation: LatLng,
  fuelStopLocation: LatLng,
  thresholdMeters: number = 35
): boolean {
  return haversineMeters(currentLocation, fuelStopLocation) <= thresholdMeters;
}
