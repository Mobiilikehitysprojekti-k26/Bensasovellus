import type { RefuelEconomics } from '../storage/refuelStorage';

const FUEL_API_BASE_URL = 'http://204.168.156.110:3000/api/fuel';
const FALLBACK_API_KEY = '01102FFA595F2B91';
const MAX_RADIUS_METERS = 20000;
const MIN_RADIUS_CANDIDATE_COUNT = 4;
const FALLBACK_CLOSEST_COUNT = 20;

type FuelApiStation = {
  fuel_type?: string;
  lat?: number | null;
  lon?: number | null;
  matched_station_name?: string | null;
  price?: number;
  station_name?: string;
};

type RefuelCandidate = {
  distanceMeters: number;
  displayName: string;
  normalizedDisplayName: string;
  normalizedStationName: string;
  pricePerLiter: number;
};

export type RefuelEconomicsFuelType = '95' | '98' | 'diesel';

export interface CalculateRefuelEconomicsInput {
  actualPricePerLiter: number;
  combinedConsumption: number;
  fuelType: RefuelEconomicsFuelType;
  liters: number;
  origin?: {
    latitude: number;
    longitude: number;
  };
  selectedStationName: string;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineMeters(
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number }
): number {
  const earthRadius = 6371000;
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const latitude1 = toRadians(first.latitude);
  const latitude2 = toRadians(second.latitude);
  const value =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2) *
      Math.cos(latitude1) *
      Math.cos(latitude2);

  return 2 * earthRadius * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function normalizeStationName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function stationNamesMatch(selectedName: string, candidateName: string): boolean {
  if (!selectedName || !candidateName) {
    return false;
  }

  if (selectedName === candidateName) {
    return true;
  }

  if (selectedName.length >= 5 && candidateName.includes(selectedName)) {
    return true;
  }

  if (candidateName.length >= 5 && selectedName.includes(candidateName)) {
    return true;
  }

  const selectedTokens = selectedName.split(' ').filter((token) => token.length > 1);
  const candidateTokens = new Set(candidateName.split(' ').filter((token) => token.length > 1));

  if (selectedTokens.length < 2) {
    return false;
  }

  return selectedTokens.every((token) => candidateTokens.has(token));
}

function calculateTravelCost(
  distanceMeters: number,
  combinedConsumption: number,
  pricePerLiter: number
): number {
  const distanceKm = distanceMeters / 1000;
  return (distanceKm * combinedConsumption * pricePerLiter) / 100;
}

function createFallbackEconomics(
  status: RefuelEconomics['status'],
  origin?: RefuelEconomics['origin']
): RefuelEconomics {
  return {
    evaluatedAt: new Date().toISOString(),
    origin,
    status,
    version: 1,
  };
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

function hasValidPrice(station: FuelApiStation): station is FuelApiStation & { price: number } {
  return typeof station.price === 'number' && Number.isFinite(station.price) && station.price > 0;
}

function createDistanceCandidate(
  origin: { latitude: number; longitude: number },
  station: FuelApiStation
): RefuelCandidate | null {
  if (!hasValidCoordinate(station) || !hasValidPrice(station)) {
    return null;
  }

  const stationName = station.station_name?.trim();
  if (!stationName) {
    return null;
  }

  const matchedStationName = station.matched_station_name?.trim();
  const displayName = matchedStationName || stationName;

  return {
    distanceMeters: haversineMeters(origin, {
      latitude: station.lat,
      longitude: station.lon,
    }),
    displayName,
    normalizedDisplayName: normalizeStationName(displayName),
    normalizedStationName: normalizeStationName(stationName),
    pricePerLiter: station.price,
  };
}

function createPriceOnlyCandidate(station: FuelApiStation): RefuelCandidate | null {
  if (!hasValidPrice(station)) {
    return null;
  }

  const stationName = station.station_name?.trim();
  if (!stationName) {
    return null;
  }

  const matchedStationName = station.matched_station_name?.trim();
  const displayName = matchedStationName || stationName;

  return {
    distanceMeters: 0,
    displayName,
    normalizedDisplayName: normalizeStationName(displayName),
    normalizedStationName: normalizeStationName(stationName),
    pricePerLiter: station.price,
  };
}

function pickCandidatePool(candidates: RefuelCandidate[]): RefuelCandidate[] {
  if (candidates.length === 0) {
    return [];
  }

  const withinRadius = candidates.filter((candidate) => candidate.distanceMeters <= MAX_RADIUS_METERS);
  if (withinRadius.length >= MIN_RADIUS_CANDIDATE_COUNT) {
    return withinRadius;
  }

  return [...candidates]
    .sort((first, second) => first.distanceMeters - second.distanceMeters)
    .slice(0, FALLBACK_CLOSEST_COUNT);
}

function findSelectedStationCandidate(
  candidates: RefuelCandidate[],
  selectedStationName: string
): RefuelCandidate | null {
  const normalizedSelectedName = normalizeStationName(selectedStationName);

  const matches = candidates.filter(
    (candidate) =>
      stationNamesMatch(normalizedSelectedName, candidate.normalizedDisplayName) ||
      stationNamesMatch(normalizedSelectedName, candidate.normalizedStationName)
  );

  if (matches.length === 0) {
    return null;
  }

  return matches.sort((first, second) => first.distanceMeters - second.distanceMeters)[0];
}

function createManualSelectedCandidate(input: CalculateRefuelEconomicsInput): RefuelCandidate {
  const displayName = input.selectedStationName.trim() || 'Valittu asema';

  return {
    distanceMeters: 0,
    displayName,
    normalizedDisplayName: normalizeStationName(displayName),
    normalizedStationName: normalizeStationName(displayName),
    pricePerLiter: input.actualPricePerLiter,
  };
}

async function fetchFuelStations(fuelType: RefuelEconomicsFuelType): Promise<FuelApiStation[]> {
  const apiKey = process.env.EXPO_PUBLIC_DATABASE_API_KEY?.trim() || FALLBACK_API_KEY;
  const response = await fetch(`${FUEL_API_BASE_URL}/${fuelType}`, {
    headers: {
      Accept: 'application/json',
      'x-api-key': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error('Fuel station request failed');
  }

  const parsed = (await response.json()) as FuelApiStation[];

  if (!Array.isArray(parsed)) {
    throw new Error('Fuel station response is invalid');
  }

  return parsed;
}

export async function calculateRefuelEconomics(
  input: CalculateRefuelEconomicsInput
): Promise<RefuelEconomics> {
  try {
    const stations = await fetchFuelStations(input.fuelType);
    const allPriceCandidates = stations
      .map((station) => createPriceOnlyCandidate(station))
      .filter((candidate): candidate is RefuelCandidate => Boolean(candidate));

    if (allPriceCandidates.length === 0) {
      return createFallbackEconomics('network_error', input.origin);
    }

    const allDistanceCandidates = input.origin
      ? stations
          .map((station) => createDistanceCandidate(input.origin!, station))
          .filter((candidate): candidate is RefuelCandidate => Boolean(candidate))
      : [];
    const candidatePool = pickCandidatePool(allDistanceCandidates);
    const selectedDistanceCandidate = findSelectedStationCandidate(
      candidatePool,
      input.selectedStationName
    );
    const selectedPriceOnlyCandidate = findSelectedStationCandidate(
      allPriceCandidates,
      input.selectedStationName
    );

    const useDistanceAwareMode = Boolean(input.origin && selectedDistanceCandidate);
    const selectedCandidate = useDistanceAwareMode
      ? selectedDistanceCandidate!
      : selectedPriceOnlyCandidate ?? createManualSelectedCandidate(input);
    const benchmarkSource = useDistanceAwareMode ? candidatePool : allPriceCandidates;
    const benchmarkCandidate = [...benchmarkSource].sort(
      (first, second) => first.pricePerLiter - second.pricePerLiter
    )[0];
    const actualTravelCost = calculateTravelCost(
      useDistanceAwareMode ? selectedCandidate.distanceMeters : 0,
      input.combinedConsumption,
      input.actualPricePerLiter
    );
    const benchmarkTravelCost = calculateTravelCost(
      useDistanceAwareMode ? benchmarkCandidate.distanceMeters : 0,
      input.combinedConsumption,
      benchmarkCandidate.pricePerLiter
    );
    const actualTotalCost = input.liters * input.actualPricePerLiter + actualTravelCost;
    const naiveCheapestPumpTotalCost =
      input.liters * benchmarkCandidate.pricePerLiter + benchmarkTravelCost;

    return {
      actualTotalCost,
      benchmarkStationName: benchmarkCandidate.displayName,
      evaluatedAt: new Date().toISOString(),
      naiveCheapestPumpTotalCost,
      origin: useDistanceAwareMode ? input.origin : undefined,
      selectedStationDistanceMeters: useDistanceAwareMode ? selectedCandidate.distanceMeters : undefined,
      status: 'ok',
      userSavingsEuro: naiveCheapestPumpTotalCost - actualTotalCost,
      version: 1,
    };
  } catch (error) {
    console.error('Failed to calculate refuel economics', error);
    return createFallbackEconomics('network_error', input.origin);
  }
}
