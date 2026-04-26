import AsyncStorage from '@react-native-async-storage/async-storage';

export interface RegisteredUser {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
}

const REGISTERED_USER_KEY = '@bensasovellus/registered_user';
const SESSION_ACTIVE_KEY = '@bensasovellus/session_active';
const AUTH_TOKEN_KEY = '@bensasovellus/auth_token';

export async function saveRegisteredUser(user: RegisteredUser): Promise<void> {
  await AsyncStorage.setItem(REGISTERED_USER_KEY, JSON.stringify(user));
}

export async function clearRegisteredUser(): Promise<void> {
  await AsyncStorage.removeItem(REGISTERED_USER_KEY);
}

export async function saveAuthToken(token: string): Promise<void> {
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
}

export async function clearAuthToken(): Promise<void> {
  await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
}

export async function getAuthToken(): Promise<string | null> {
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  return token && token.trim().length > 0 ? token : null;
}

export async function setSessionActive(isActive: boolean): Promise<void> {
  await AsyncStorage.setItem(SESSION_ACTIVE_KEY, isActive ? 'true' : 'false');
}

export async function getSessionActive(): Promise<boolean> {
  const value = await AsyncStorage.getItem(SESSION_ACTIVE_KEY);
  return value === 'true';
}

export async function getRegisteredUser(): Promise<RegisteredUser | null> {
  const value = await AsyncStorage.getItem(REGISTERED_USER_KEY);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as RegisteredUser;
  } catch (error) {
    console.error('Failed to parse stored user', error);
    return null;
  }
}
