import type { LatLng } from 'react-native-maps';
import {
  fetchDrivingRouteWithWaypoints,
  RouteRequestError,
  type DrivingRoute,
} from './routing';

const FUEL_API_BASE_URL = 'http://204.168.156.110:3000/api/fuel';
const FUEL_API_KEY = '01102FFA595F2B91';
const EXACT_ROUTE_CONCURRENCY = 2;
const MAX_EXACT_CANDIDATES = 12;
const MAX_CORRIDOR_DISTANCE_METERS = 2500;
const BASELINE_CORRIDOR_DISTANCE_METERS = 900;
const ROAD_DISTANCE_ESTIMATE_FACTOR = 1.18;
const MIN_ALLOWED_DETOUR_METERS = 1200;
const MAX_ALLOWED_DETOUR_METERS = 3500;
const ALLOWED_DETOUR_SHARE = 0.12;
const ASSUMED_REFUEL_LITERS = 40;
const MIN_NET_SAVINGS_EURO = 0.2;

export type FuelType = '95' | '98' | 'diesel';

type FuelApiStation = {
  fuel_type: string;
  lat?: number | null;
  lon?: number | null;
  matched_station_name?: string | null;
  price: number;
  reported_at?: string;
  scraped_at: string;
  station_name: string;
  updated_text: string;
};

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
  estimatedNetSavingsEuro: number;
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

function estimateRoadDistanceMeters(start: LatLng, end: LatLng): number {
  return haversineMeters(start, end) * ROAD_DISTANCE_ESTIMATE_FACTOR;
}

function hasValidCoordinate(station: FuelApiStation): station is FuelApiStation & {
  lat: number;
  lon: number;
} {
  return (
    typeof station.lat === 'number' &&
    Number.isFinite(station.lat) &&
    typeof station.lon === 'number' &&
    Number.isFinite(station.lon)
  );
}

function isValidPrice(price: number): boolean {
  return Number.isFinite(price) && price > 0;
}

function getMatchedStationName(station: Pick<FuelApiStation, 'matched_station_name'>): string | undefined {
  const normalizedName = station.matched_station_name?.trim();
  return normalizedName ? normalizedName : undefined;
}

function getStationDisplayName(
  station: Pick<FuelApiStation, 'matched_station_name' | 'station_name'>
): string {
  return getMatchedStationName(station) ?? station.station_name;
}

function createStationCandidate(
  station: FuelApiStation,
  baseRouteGeometry: LatLng[]
): StationCandidate | null {
  if (!hasValidCoordinate(station) || !isValidPrice(station.price)) {
    return null;
  }

  const coordinate = {
    latitude: station.lat,
    longitude: station.lon,
  };

  return {
    coordinate,
    corridorDistanceMeters: distanceToRouteMeters(coordinate, baseRouteGeometry),
    fuelType: station.fuel_type as FuelType,
    price: station.price,
    resolvedName: getMatchedStationName(station),
    scrapedAt: station.scraped_at,
    stationName: getStationDisplayName(station),
    updatedText: station.updated_text,
  };
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

function resolveStationCandidates(
  stations: FuelApiStation[],
  baseRouteGeometry: LatLng[]
): StationCandidate[] {
  const resolvedStations: StationCandidate[] = [];

  for (const station of stations) {
    const resolvedStation = createStationCandidate(station, baseRouteGeometry);

    if (resolvedStation) {
      resolvedStations.push(resolvedStation);
    }
  }

  return resolvedStations;
}

function compareEvaluatedFuelStops(
  left: Pick<
    RecommendedFuelStop,
    'detourDistanceMeters' | 'estimatedNetSavingsEuro' | 'estimatedTripFuelCost' | 'price'
  >,
  right: Pick<
    RecommendedFuelStop,
    'detourDistanceMeters' | 'estimatedNetSavingsEuro' | 'estimatedTripFuelCost' | 'price'
  >
): number {
  if (left.estimatedNetSavingsEuro !== right.estimatedNetSavingsEuro) {
    return right.estimatedNetSavingsEuro - left.estimatedNetSavingsEuro;
  }

  if (left.price !== right.price) {
    return left.price - right.price;
  }

  if (left.detourDistanceMeters !== right.detourDistanceMeters) {
    return left.detourDistanceMeters - right.detourDistanceMeters;
  }

  return left.estimatedTripFuelCost - right.estimatedTripFuelCost;
}

export async function findBestFuelStop(params: {
  baseRoute: DrivingRoute;
  combinedConsumption: number;
  currentLocation: LatLng;
  destination: LatLng;
  fuelType: FuelType;
}): Promise<RecommendedFuelStop | null> {
  type EvaluatedFuelStop = RecommendedFuelStop & { corridorDistanceMeters: number };

  const stations = await fetchFuelStations(params.fuelType);
  const stationCandidates = resolveStationCandidates(stations, params.baseRoute.geometry);

  if (stationCandidates.length === 0) {
    return null;
  }

  const directRoadEstimateMeters = estimateRoadDistanceMeters(
    params.currentLocation,
    params.destination
  );

  const approximatedCandidates = stationCandidates
    .map((station) => {
      const approximateViaStationDistanceMeters = Math.max(
        params.baseRoute.distanceMeters,
        estimateRoadDistanceMeters(params.currentLocation, station.coordinate) +
          estimateRoadDistanceMeters(station.coordinate, params.destination)
      );

      return {
        ...station,
        approximateDetourMeters: Math.max(
          0,
          approximateViaStationDistanceMeters -
            Math.max(params.baseRoute.distanceMeters, directRoadEstimateMeters)
        ),
        approximateTripFuelCost: calculateTripFuelCost(
          approximateViaStationDistanceMeters,
          params.combinedConsumption,
          station.price
        ),
      };
    })
    .sort((left, right) => {
      if (left.approximateTripFuelCost !== right.approximateTripFuelCost) {
        return left.approximateTripFuelCost - right.approximateTripFuelCost;
      }

      if (left.approximateDetourMeters !== right.approximateDetourMeters) {
        return left.approximateDetourMeters - right.approximateDetourMeters;
      }

      if (left.price !== right.price) {
        return left.price - right.price;
      }

      return left.corridorDistanceMeters - right.corridorDistanceMeters;
    });

  const nearbyCandidates = approximatedCandidates.filter(
    (station) => station.corridorDistanceMeters <= MAX_CORRIDOR_DISTANCE_METERS
  );
  const candidatePool = nearbyCandidates.length > 0 ? nearbyCandidates : approximatedCandidates;
  const selectionBucketSize = Math.max(4, Math.floor(MAX_EXACT_CANDIDATES / 2));
  const exactCandidates = Array.from(
    new Set([
      ...candidatePool.slice(0, selectionBucketSize),
      ...[...candidatePool]
        .sort((left, right) => {
          if (left.price !== right.price) {
            return left.price - right.price;
          }

          if (left.approximateDetourMeters !== right.approximateDetourMeters) {
            return left.approximateDetourMeters - right.approximateDetourMeters;
          }

          return left.corridorDistanceMeters - right.corridorDistanceMeters;
        })
        .slice(0, selectionBucketSize),
      ...[...candidatePool]
        .sort((left, right) => {
          if (left.corridorDistanceMeters !== right.corridorDistanceMeters) {
            return left.corridorDistanceMeters - right.corridorDistanceMeters;
          }

          return left.price - right.price;
        })
        .slice(0, selectionBucketSize),
    ])
  ).slice(0, MAX_EXACT_CANDIDATES);
  let failedRouteEvaluations = 0;
  const failedStationSamples: string[] = [];
  let unexpectedEvaluationError: unknown = null;

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
          corridorDistanceMeters: station.corridorDistanceMeters,
          estimatedNetSavingsEuro: 0,
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
        } satisfies EvaluatedFuelStop;
      } catch (error) {
        failedRouteEvaluations += 1;
        if (failedStationSamples.length < 3) {
          failedStationSamples.push(station.stationName);
        }

        if (!(error instanceof RouteRequestError) && !unexpectedEvaluationError) {
          unexpectedEvaluationError = error;
        }

        return null;
      }
    }
  );

  if (failedRouteEvaluations > 0) {
    const sampleLabel =
      failedStationSamples.length > 0 ? ` Esim: ${failedStationSamples.join(', ')}.` : '';
    console.warn(
      `Polttoaineasemien reittiarviointi epäonnistui ${failedRouteEvaluations} asemalle.${sampleLabel}`
    );
  }

  if (unexpectedEvaluationError) {
    console.warn('Polttoaineasemien reittiarvioinnissa tuli odottamaton virhe.', unexpectedEvaluationError);
  }

  const validCandidates: EvaluatedFuelStop[] = [];

  for (const station of evaluatedCandidates) {
    if (station) {
      validCandidates.push(station);
    }
  }

  if (validCandidates.length === 0) {
    return null;
  }

  const allowedDetourMeters = Math.max(
    MIN_ALLOWED_DETOUR_METERS,
    Math.min(MAX_ALLOWED_DETOUR_METERS, params.baseRoute.distanceMeters * ALLOWED_DETOUR_SHARE)
  );
  const reasonableDetourStations = validCandidates.filter(
    (station) => station.detourDistanceMeters <= allowedDetourMeters
  );
  const detourFilteredCandidates =
    reasonableDetourStations.length > 0 ? reasonableDetourStations : validCandidates;

  const directRouteReferenceStations = stationCandidates.filter(
    (station) => station.corridorDistanceMeters <= BASELINE_CORRIDOR_DISTANCE_METERS
  );
  const baselineStations =
    directRouteReferenceStations.length > 0
      ? directRouteReferenceStations
      : [...stationCandidates]
          .sort((left, right) => left.corridorDistanceMeters - right.corridorDistanceMeters)
          .slice(0, Math.min(12, stationCandidates.length));
  const baselinePricePerLiter = baselineStations.reduce(
    (lowestPrice, station) => Math.min(lowestPrice, station.price),
    Number.POSITIVE_INFINITY
  );

  if (!Number.isFinite(baselinePricePerLiter)) {
    return null;
  }

  const rankedStations = detourFilteredCandidates
    .map((station) => {
      const expectedPumpSavingsEuro = Math.max(
        0,
        (baselinePricePerLiter - station.price) * ASSUMED_REFUEL_LITERS
      );
      const detourFuelCostEuro = calculateTripFuelCost(
        station.detourDistanceMeters,
        params.combinedConsumption,
        station.price
      );
      const estimatedNetSavingsEuro = expectedPumpSavingsEuro - detourFuelCostEuro;

      return {
        ...station,
        estimatedNetSavingsEuro,
      } satisfies EvaluatedFuelStop;
    })
    .sort(compareEvaluatedFuelStops);
  const savingStations = rankedStations.filter(
    (station) => station.estimatedNetSavingsEuro >= MIN_NET_SAVINGS_EURO
  );

  return savingStations[0] ?? rankedStations[0] ?? null;
}

export function getFuelStopDisplayName(
  fuelStop: Pick<RecommendedFuelStop, 'resolvedName' | 'stationName'>
): string {
  const resolvedName = fuelStop.resolvedName?.trim();
  return resolvedName ? resolvedName : fuelStop.stationName;
}

export function formatFuelPrice(price: number): string {
  return `${price.toFixed(3)} EUR/l`;
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
