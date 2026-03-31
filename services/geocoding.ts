import type { LatLng } from 'react-native-maps';

type NominatimResult = {
  lat: string;
  lon: string;
};

export async function geocodeAddress(address: string): Promise<LatLng> {
  const encodedAddress = encodeURIComponent(address.trim());
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodedAddress}`;

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Geokoodaus epäonnistui. Yritä hetken kuluttua uudelleen.');
  }

  const results = (await response.json()) as NominatimResult[];

  if (!results.length) {
    throw new Error('Osoitetta ei löytynyt. Tarkista syöte.');
  }

  const firstResult = results[0];

  return {
    latitude: Number(firstResult.lat),
    longitude: Number(firstResult.lon),
  };
}
