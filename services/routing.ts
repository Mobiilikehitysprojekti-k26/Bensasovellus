import type { LatLng } from 'react-native-maps';

type OsrmRouteResponse = {
  code: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: {
      coordinates: [number, number][];
      type: string;
    };
  }>;
};

export type DrivingRoute = {
  geometry: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
};

export async function fetchDrivingRoute(start: LatLng, end: LatLng): Promise<DrivingRoute> {
  const url = `https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Reitin haku epäonnistui. Yritä uudelleen.');
  }

  const data = (await response.json()) as OsrmRouteResponse;

  if (data.code !== 'Ok' || !data.routes?.length) {
    throw new Error('Reittiä ei löytynyt.');
  }

  const route = data.routes[0];
  const geometry = route.geometry.coordinates.map(([longitude, latitude]) => ({
    latitude,
    longitude,
  }));

  return {
    geometry,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
  };
}
