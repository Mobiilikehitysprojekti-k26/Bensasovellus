import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = "refuelHistory";

export const saveRefuel = async (entry) => {
  const existing = await AsyncStorage.getItem(KEY);
  const history = existing ? JSON.parse(existing) : [];
  history.push(entry);
  await AsyncStorage.setItem(KEY, JSON.stringify(history));
};

export const getRefuelHistory = async () => {
  const existing = await AsyncStorage.getItem(KEY);
  return existing ? JSON.parse(existing) : [];
};
