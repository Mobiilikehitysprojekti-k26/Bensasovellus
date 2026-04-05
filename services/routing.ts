import type { LatLng } from 'react-native-maps';
import { createOpenRouteServiceHeaders } from './openRouteService';

type OpenRouteServiceRouteResponse = {
  features?: Array<{
    geometry?: {
      coordinates?: [number, number][];
      type?: string;
    };
    properties?: {
      summary?: {
        distance?: number;
        duration?: number;
      };
    };
  }>;
};

export type DrivingRoute = {
  geometry: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
};

export async function fetchDrivingRouteWithWaypoints(points: LatLng[]): Promise<DrivingRoute> {
  if (points.length < 2) {
    throw new Error('Reitin hakuun tarvitaan vähintään alku- ja loppupiste.');
  }

  const response = await fetch(
    'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
    {
      method: 'POST',
      headers: createOpenRouteServiceHeaders(),
      body: JSON.stringify({
        coordinates: points.map((point) => [point.longitude, point.latitude]),
      }),
    }
  );

  if (!response.ok) {
    throw new Error('Reitin haku epäonnistui. Yritä uudelleen.');
  }

  const data = (await response.json()) as OpenRouteServiceRouteResponse;
  const routeFeature = data.features?.[0];
  const geometryCoordinates = routeFeature?.geometry?.coordinates;
  const summary = routeFeature?.properties?.summary;

  if (!geometryCoordinates?.length || !summary) {
    throw new Error('Reittiä ei löytynyt.');
  }

  const geometry = geometryCoordinates.map(([longitude, latitude]) => ({
    latitude,
    longitude,
  }));

  return {
    geometry,
    distanceMeters: summary.distance ?? 0,
    durationSeconds: summary.duration ?? 0,
  };
}

export async function fetchDrivingRoute(start: LatLng, end: LatLng): Promise<DrivingRoute> {
  return fetchDrivingRouteWithWaypoints([start, end]);
}
