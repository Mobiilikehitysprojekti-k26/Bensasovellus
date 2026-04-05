import type { LatLng } from 'react-native-maps';
import { createOpenRouteServiceGeocodeUrl } from './openRouteService';

type OpenRouteServiceGeocodeResponse = {
  features?: Array<{
    geometry?: {
      coordinates?: [number, number];
    };
  }>;
};

export async function geocodeAddress(address: string): Promise<LatLng> {
  const url = createOpenRouteServiceGeocodeUrl({
    boundaryCountry: 'FI',
    size: 1,
    text: address.trim(),
  });

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Geokoodaus epäonnistui. Yritä hetken kuluttua uudelleen.');
  }

  const data = (await response.json()) as OpenRouteServiceGeocodeResponse;
  const coordinates = data.features?.[0]?.geometry?.coordinates;

  if (!coordinates || coordinates.length < 2) {
    throw new Error('Osoitetta ei löytynyt. Tarkista syöte.');
  }

  return {
    latitude: coordinates[1],
    longitude: coordinates[0],
  };
}
