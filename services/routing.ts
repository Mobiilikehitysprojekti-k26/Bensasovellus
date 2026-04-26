import type { LatLng } from 'react-native-maps';
import { createOpenRouteServiceHeaders } from './openRouteService';

const SNAP_RADIUS_METERS = 120;
const MAX_TRUSTED_SNAP_DISTANCE_METERS = 80;

type OpenRouteServiceStep = {
  distance?: number;
  duration?: number;
  instruction?: string;
  maneuver?: {
    bearing_after?: number;
    bearing_before?: number;
    location?: [number, number];
  };
  name?: string;
  type?: number;
  way_points?: [number, number];
};

type OpenRouteServiceSegment = {
  steps?: OpenRouteServiceStep[];
};

type OpenRouteServiceRouteResponse = {
  features?: Array<{
    geometry?: {
      coordinates?: [number, number][];
      type?: string;
    };
    properties?: {
      segments?: OpenRouteServiceSegment[];
      summary?: {
        distance?: number;
        duration?: number;
      };
    };
  }>;
};

type OpenRouteServiceSnapResponse = {
  locations?: Array<OpenRouteServiceSnapLocation | null>;
};

type OpenRouteServiceSnapLocation = {
  location?: [number, number];
  name?: string;
  snapped_distance?: number;
};

export class RouteRequestError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'RouteRequestError';
    this.statusCode = statusCode;
  }
}

export type DrivingRouteStep = {
  distanceMeters: number;
  durationSeconds: number;
  instruction: string;
  maneuver?: {
    bearingAfter: number | null;
    bearingBefore: number | null;
    coordinate?: LatLng;
  };
  name: string;
  type: number;
  wayPointEndIndex: number;
  wayPointStartIndex: number;
};

export type DrivingRoute = {
  distanceMeters: number;
  durationSeconds: number;
  geometry: LatLng[];
  steps: DrivingRouteStep[];
};

function createDrivingRouteSteps(segments: OpenRouteServiceSegment[] | undefined): DrivingRouteStep[] {
  if (!segments?.length) {
    return [];
  }

  const steps: DrivingRouteStep[] = [];

  for (const segment of segments) {
    for (const step of segment.steps ?? []) {
      const maneuverLocation = step.maneuver?.location;

      steps.push({
        distanceMeters: step.distance ?? 0,
        durationSeconds: step.duration ?? 0,
        instruction: step.instruction?.trim() || 'Jatka reittiä pitkin.',
        maneuver: maneuverLocation
          ? {
              bearingAfter:
                typeof step.maneuver?.bearing_after === 'number'
                  ? step.maneuver.bearing_after
                  : null,
              bearingBefore:
                typeof step.maneuver?.bearing_before === 'number'
                  ? step.maneuver.bearing_before
                  : null,
              coordinate: {
                latitude: maneuverLocation[1],
                longitude: maneuverLocation[0],
              },
            }
          : undefined,
        name: step.name ?? '',
        type: typeof step.type === 'number' ? step.type : 6,
        wayPointEndIndex: step.way_points?.[1] ?? 0,
        wayPointStartIndex: step.way_points?.[0] ?? 0,
      });
    }
  }

  return steps;
}

async function readRouteApiErrorMessage(response: Response): Promise<string | null> {
  try {
    const rawPayload = await response.text();

    if (!rawPayload.trim()) {
      return null;
    }

    const parsedPayload = JSON.parse(rawPayload) as {
      error?: string;
      message?: string | string[];
    };

    if (typeof parsedPayload.message === 'string' && parsedPayload.message.trim().length > 0) {
      return parsedPayload.message.trim();
    }

    if (Array.isArray(parsedPayload.message)) {
      const firstMessage = parsedPayload.message.find(
        (item): item is string => typeof item === 'string' && item.trim().length > 0
      );

      if (firstMessage) {
        return firstMessage.trim();
      }
    }

    if (typeof parsedPayload.error === 'string' && parsedPayload.error.trim().length > 0) {
      return parsedPayload.error.trim();
    }

    return null;
  } catch {
    return null;
  }
}

function shouldUseSnappedPoint(
  snappedPoint: OpenRouteServiceSnapLocation | null | undefined
): snappedPoint is OpenRouteServiceSnapLocation & {
  location: [number, number];
  snapped_distance: number;
} {
  return Boolean(
    snappedPoint?.location &&
      typeof snappedPoint.snapped_distance === 'number' &&
      snappedPoint.snapped_distance <= MAX_TRUSTED_SNAP_DISTANCE_METERS
  );
}

async function snapRouteEndpoints(points: LatLng[]): Promise<LatLng[]> {
  if (points.length < 2) {
    return points;
  }

  const endpointIndexes =
    points.length === 2 ? [0, 1] : [0, points.length - 1];
  const endpointLocations = endpointIndexes.map((index) => [
    points[index].longitude,
    points[index].latitude,
  ]);

  try {
    const response = await fetch('https://api.openrouteservice.org/v2/snap/driving-car/json', {
      method: 'POST',
      headers: createOpenRouteServiceHeaders(),
      body: JSON.stringify({
        locations: endpointLocations,
        radius: SNAP_RADIUS_METERS,
      }),
    });

    if (!response.ok) {
      return points;
    }

    const data = (await response.json()) as OpenRouteServiceSnapResponse;
    const snappedEndpoints = data.locations ?? [];
    const nextPoints = [...points];

    endpointIndexes.forEach((pointIndex, snappedIndex) => {
      const snappedPoint = snappedEndpoints[snappedIndex];

      if (!shouldUseSnappedPoint(snappedPoint)) {
        return;
      }

      nextPoints[pointIndex] = {
        latitude: snappedPoint.location[1],
        longitude: snappedPoint.location[0],
      };
    });

    return nextPoints;
  } catch (error) {
    console.error('Failed to snap route endpoints', error);
    return points;
  }
}

export async function fetchDrivingRouteWithWaypoints(points: LatLng[]): Promise<DrivingRoute> {
  if (points.length < 2) {
    throw new Error('Reitin hakuun tarvitaan vähintään alku- ja loppupiste.');
  }

  const snappedPoints = await snapRouteEndpoints(points);

  const response = await fetch(
    'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
    {
      method: 'POST',
      headers: createOpenRouteServiceHeaders(),
      body: JSON.stringify({
        coordinates: snappedPoints.map((point) => [point.longitude, point.latitude]),
        instructions: true,
        language: 'fi',
        maneuvers: true,
      }),
    }
  );

  if (!response.ok) {
    const apiErrorMessage = await readRouteApiErrorMessage(response);
    const fallbackMessage =
      response.status === 429
        ? 'Reittipalvelu on ruuhkautunut (HTTP 429). Yritä hetken päästä uudelleen.'
        : `Reitin haku epäonnistui (HTTP ${response.status}). Yritä uudelleen.`;

    throw new RouteRequestError(apiErrorMessage ?? fallbackMessage, response.status);
  }

  const data = (await response.json()) as OpenRouteServiceRouteResponse;
  const routeFeature = data.features?.[0];
  const geometryCoordinates = routeFeature?.geometry?.coordinates;
  const properties = routeFeature?.properties;
  const summary = properties?.summary;

  if (!geometryCoordinates?.length || !summary) {
    throw new Error('Reittiä ei löytynyt.');
  }

  const geometry = geometryCoordinates.map(([longitude, latitude]) => ({
    latitude,
    longitude,
  }));

  return {
    distanceMeters: summary.distance ?? 0,
    durationSeconds: summary.duration ?? 0,
    geometry,
    steps: createDrivingRouteSteps(properties?.segments),
  };
}

export async function fetchDrivingRoute(start: LatLng, end: LatLng): Promise<DrivingRoute> {
  return fetchDrivingRouteWithWaypoints([start, end]);
}
