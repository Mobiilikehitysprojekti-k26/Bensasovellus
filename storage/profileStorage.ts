import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ProfilePreferences {
  combinedConsumption: string;
  fuelType: '' | '95' | '98' | 'diesel';
  profileImage: string | null;
  vehicleName: string;
}

const PROFILE_STORAGE_PREFIX = '@bensasovellus/profile_preferences';

export function createDefaultProfilePreferences(): ProfilePreferences {
  return {
    combinedConsumption: '',
    fuelType: '',
    profileImage: null,
    vehicleName: '',
  };
}

function getProfileStorageKey(userIdentifier: string): string {
  return `${PROFILE_STORAGE_PREFIX}/${encodeURIComponent(userIdentifier.trim().toLowerCase())}`;
}

export async function saveProfilePreferences(
  userIdentifier: string,
  preferences: ProfilePreferences
): Promise<void> {
  await AsyncStorage.setItem(getProfileStorageKey(userIdentifier), JSON.stringify(preferences));
}

export async function getProfilePreferences(
  userIdentifier: string
): Promise<ProfilePreferences | null> {
  const value = await AsyncStorage.getItem(getProfileStorageKey(userIdentifier));

  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<ProfilePreferences>;
    return {
      combinedConsumption:
        typeof parsed.combinedConsumption === 'string' ? parsed.combinedConsumption : '',
      fuelType:
        parsed.fuelType === '95' || parsed.fuelType === '98' || parsed.fuelType === 'diesel'
          ? parsed.fuelType
          : '',
      profileImage: typeof parsed.profileImage === 'string' ? parsed.profileImage : null,
      vehicleName: typeof parsed.vehicleName === 'string' ? parsed.vehicleName : '',
    };
  } catch (error) {
    console.error('Failed to parse stored profile preferences', error);
    return null;
  }
}

export async function clearProfilePreferences(userIdentifier: string): Promise<void> {
  await AsyncStorage.removeItem(getProfileStorageKey(userIdentifier));
}
