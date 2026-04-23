import AsyncStorage from '@react-native-async-storage/async-storage';

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

const KEY = "refuelHistory";

export const saveRefuel = async (entry: RefuelEntry): Promise<void> => {
  const existing = await AsyncStorage.getItem(KEY);
  const history: RefuelEntry[] = existing ? JSON.parse(existing) : [];
  history.push(entry);
  await AsyncStorage.setItem(KEY, JSON.stringify(history));
};

export const getRefuelHistory = async (): Promise<RefuelEntry[]> => {
  const existing = await AsyncStorage.getItem(KEY);
  return existing ? JSON.parse(existing) : [];
};

export const deleteRefuel = async (id: string): Promise<void> => {
  const existing = await AsyncStorage.getItem(KEY);
  const history: RefuelEntry[] = existing ? JSON.parse(existing) : [];
  const filtered = history.filter(entry => entry.id !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(filtered));
};

export const updateRefuel = async (id: string, entry: RefuelEntry): Promise<void> => {
  const existing = await AsyncStorage.getItem(KEY);
  const history: RefuelEntry[] = existing ? JSON.parse(existing) : [];
  const index = history.findIndex(e => e.id === id);
  if (index !== -1) {
    history[index] = entry;
    await AsyncStorage.setItem(KEY, JSON.stringify(history));
  }
};
