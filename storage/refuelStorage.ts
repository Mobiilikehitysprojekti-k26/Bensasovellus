import AsyncStorage from '@react-native-async-storage/async-storage';

export interface RefuelEntry {
  id: string;
  date: string;
  station: string;
  fuelType: string;
  liters: number;
  pricePerLiter: number;
  totalPrice: number;
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
