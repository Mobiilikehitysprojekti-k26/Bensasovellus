const OPENROUTESERVICE_BASE_URL = 'https://api.openrouteservice.org';

export function getOpenRouteServiceApiKey(): string {
  const apiKey = process.env.EXPO_PUBLIC_OPENROUTESERVICE_API_KEY?.trim() ?? '';

  if (!apiKey) {
    throw new Error(
      'OpenRouteService API-avain puuttuu. Lisää EXPO_PUBLIC_OPENROUTESERVICE_API_KEY .env-tiedostoon.'
    );
  }

  return apiKey;
}

export function createOpenRouteServiceGeocodeUrl(params: {
  boundaryCountry?: string;
  size?: number;
  text: string;
}): string {
  const searchParams = new URLSearchParams({
    api_key: getOpenRouteServiceApiKey(),
    size: String(params.size ?? 1),
    text: params.text,
  });

  if (params.boundaryCountry) {
    searchParams.set('boundary.country', params.boundaryCountry);
  }

  return `${OPENROUTESERVICE_BASE_URL}/geocode/search?${searchParams.toString()}`;
}

export function createOpenRouteServiceHeaders(): Record<string, string> {
  return {
    Accept: 'application/json, application/geo+json',
    Authorization: getOpenRouteServiceApiKey(),
    'Content-Type': 'application/json',
  };
}
