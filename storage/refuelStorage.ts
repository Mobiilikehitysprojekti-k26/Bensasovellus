import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRegisteredUser } from './authStorage';

export type RefuelEconomicsStatus =
  | 'missing_consumption'
  | 'missing_location'
  | 'network_error'
  | 'ok'
  | 'station_not_matched';

export interface RefuelEconomics {
  actualTotalCost?: number;
  benchmarkStationName?: string;
  evaluatedAt: string;
  naiveCheapestPumpTotalCost?: number;
  origin?: {
    latitude: number;
    longitude: number;
  };
  selectedStationDistanceMeters?: number;
  status: RefuelEconomicsStatus;
  userSavingsEuro?: number;
  version: 1;
}

export interface RefuelEntry {
  id: string;
  date: string;
  station: string;
  fuelType: string;
  liters: number;
  pricePerLiter: number;
  totalPrice: number;
  economics?: RefuelEconomics;
}

const LEGACY_KEY = "refuelHistory";
const KEY_PREFIX = "@bensasovellus/refuel_history";

function getRefuelStorageKey(userIdentifier: string): string {
  return `${KEY_PREFIX}/${encodeURIComponent(userIdentifier.trim().toLowerCase())}`;
}

async function getCurrentRefuelStorageKey(): Promise<string> {
  const user = await getRegisteredUser();

  if (!user?.email) {
    return `${KEY_PREFIX}/anonymous`;
  }

  return getRefuelStorageKey(user.email);
}

async function migrateLegacyHistoryIfNeeded(key: string): Promise<void> {
  if (key.endsWith('/anonymous')) {
    return;
  }

  const existingUserHistory = await AsyncStorage.getItem(key);
  const legacyHistory = await AsyncStorage.getItem(LEGACY_KEY);

  if (!existingUserHistory && legacyHistory) {
    await AsyncStorage.setItem(key, legacyHistory);
    await AsyncStorage.removeItem(LEGACY_KEY);
  }
}

export const saveRefuel = async (entry: RefuelEntry): Promise<void> => {
  const key = await getCurrentRefuelStorageKey();
  await migrateLegacyHistoryIfNeeded(key);
  const existing = await AsyncStorage.getItem(key);
  const history: RefuelEntry[] = existing ? JSON.parse(existing) : [];
  history.push(entry);
  await AsyncStorage.setItem(key, JSON.stringify(history));
};

export const getRefuelHistory = async (): Promise<RefuelEntry[]> => {
  const key = await getCurrentRefuelStorageKey();
  await migrateLegacyHistoryIfNeeded(key);
  const existing = await AsyncStorage.getItem(key);
  return existing ? JSON.parse(existing) : [];
};

export const deleteRefuel = async (id: string): Promise<void> => {
  const key = await getCurrentRefuelStorageKey();
  await migrateLegacyHistoryIfNeeded(key);
  const existing = await AsyncStorage.getItem(key);
  const history: RefuelEntry[] = existing ? JSON.parse(existing) : [];
  const filtered = history.filter(entry => entry.id !== id);
  await AsyncStorage.setItem(key, JSON.stringify(filtered));
};

export const updateRefuel = async (id: string, entry: RefuelEntry): Promise<void> => {
  const key = await getCurrentRefuelStorageKey();
  await migrateLegacyHistoryIfNeeded(key);
  const existing = await AsyncStorage.getItem(key);
  const history: RefuelEntry[] = existing ? JSON.parse(existing) : [];
  const index = history.findIndex(e => e.id === id);
  if (index !== -1) {
    history[index] = entry;
    await AsyncStorage.setItem(key, JSON.stringify(history));
  }
};

export const clearRefuelHistory = async (userIdentifier: string): Promise<void> => {
  await AsyncStorage.removeItem(getRefuelStorageKey(userIdentifier));
};
