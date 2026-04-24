import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, View } from 'react-native';
import type { LatLng } from 'react-native-maps';
import MapView from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Text } from 'react-native-paper';
import type { RegisteredUser } from '../storage/authStorage';
import {
  createDefaultProfilePreferences,
  getProfilePreferences,
  type ProfilePreferences,
} from '../storage/profileStorage';
import {
  findBestFuelStop,
  formatExtraDistance,
  formatFuelPrice,
  isArrivedAtFuelStop,
  type RecommendedFuelStop,
} from '../services/fuelRouting';
import { geocodeAddress } from '../services/geocode';
import {
  fetchDrivingRoute,
  fetchDrivingRouteWithWaypoints,
  type DrivingRoute,
  type DrivingRouteStep,
} from '../services/routing';
import { brandColors } from '../theme';
import Map from '../components/Map';

interface MapScreenProps {
  user: RegisteredUser | null;
}

const fallbackCenter = {
  latitude: 60.1699,
  longitude: 24.9384,
};

const cameraUpdateMs = 700;
const minRouteRefreshIntervalMs = 15000;
const offRouteThresholdM = 110;
const navigationZoom = 20.4;
const navigationPitch = 26;
const navigationLookAheadMeters = 70;
const navigationStartLatitudeDelta = 0.0035;
const navigationStartLongitudeDelta = 0.0035;
const defaultMapZoom = 15;
const stationarySpeedMps = 0.8;
const minJitterThresholdM = 4;
const maxJitterThresholdM = 12;
const headingRefreshThresholdDegrees = 6;

type NavigationInstruction = {
  distanceLabel: string;
  instruction: string;
  type: number;
};

type GasStation = {
  station_id?: string;
  station_name?: string;
  lat: number;
  lon: number;
};

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineMeters(a: LatLng, b: LatLng): number {
  const earthRadius = 6371000;
  const latitudeDelta = toRadians(b.latitude - a.latitude);
  const longitudeDelta = toRadians(b.longitude - a.longitude);
  const latitude1 = toRadians(a.latitude);
  const latitude2 = toRadians(b.latitude);

  const value =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.sin(longitudeDelta / 2) *
    Math.sin(longitudeDelta / 2) *
    Math.cos(latitude1) *
    Math.cos(latitude2);

  return 2 * earthRadius * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function smoothHeading(previousHeading: number | null, nextHeading: number): number {
  if (previousHeading === null) {
    return nextHeading;
  }

  const difference = ((((nextHeading - previousHeading) % 360) + 540) % 360) - 180;

  return (previousHeading + difference * 0.25 + 360) % 360;
}

function calculateBearingDegrees(start: LatLng, end: LatLng): number {
  const startLatitude = toRadians(start.latitude);
  const endLatitude = toRadians(end.latitude);
  const longitudeDelta = toRadians(end.longitude - start.longitude);
  const y = Math.sin(longitudeDelta) * Math.cos(endLatitude);
  const x =
    Math.cos(startLatitude) * Math.sin(endLatitude) -
    Math.sin(startLatitude) * Math.cos(endLatitude) * Math.cos(longitudeDelta);

  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

function getHeadingDeltaDegrees(fromHeading: number, toHeading: number): number {
  return Math.abs((((toHeading - fromHeading) % 360) + 540) % 360 - 180);
}

function resolveCameraHeading(primaryHeading: number | null, fallbackHeading?: number | null): number {
  if (typeof primaryHeading === 'number' && Number.isFinite(primaryHeading)) {
    return (primaryHeading + 360) % 360;
  }

  if (typeof fallbackHeading === 'number' && Number.isFinite(fallbackHeading)) {
    return (fallbackHeading + 360) % 360;
  }

  return 0;
}

function offsetCoordinateByMeters(origin: LatLng, headingDegrees: number, distanceMeters: number): LatLng {
  const earthRadius = 6378137;
  const angularDistance = distanceMeters / earthRadius;
  const headingRadians = toRadians(headingDegrees);
  const latitudeRadians = toRadians(origin.latitude);
  const longitudeRadians = toRadians(origin.longitude);

  const destinationLatitude = Math.asin(
    Math.sin(latitudeRadians) * Math.cos(angularDistance) +
    Math.cos(latitudeRadians) * Math.sin(angularDistance) * Math.cos(headingRadians)
  );
  const destinationLongitude =
    longitudeRadians +
    Math.atan2(
      Math.sin(headingRadians) * Math.sin(angularDistance) * Math.cos(latitudeRadians),
      Math.cos(angularDistance) - Math.sin(latitudeRadians) * Math.sin(destinationLatitude)
    );

  return {
    latitude: (destinationLatitude * 180) / Math.PI,
    longitude: (destinationLongitude * 180) / Math.PI,
  };
}

function formatNavigationDistanceLabel(distanceMeters: number): string {
  if (distanceMeters <= 20) {
    return 'Heti';
  }

  if (distanceMeters < 1000) {
    return `${Math.max(10, Math.round(distanceMeters / 10) * 10)} m`;
  }

  return `${(distanceMeters / 1000).toFixed(1)} km`;
}

function isActionableStepType(stepType: number): boolean {
  return [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 12, 13].includes(stepType);
}

function distancePointToSegmentMeters(point: LatLng, start: LatLng, end: LatLng): number {
  const latitudeScale = 111320;
  const longitudeScale = Math.cos(toRadians(point.latitude)) * 111320;

  const pointX = point.longitude * longitudeScale;
  const pointY = point.latitude * latitudeScale;
  const startX = start.longitude * longitudeScale;
  const startY = start.latitude * latitudeScale;
  const endX = end.longitude * longitudeScale;
  const endY = end.latitude * latitudeScale;

  const segmentX = endX - startX;
  const segmentY = endY - startY;
  const relativeX = pointX - startX;
  const relativeY = pointY - startY;
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;

  if (segmentLengthSquared === 0) {
    return Math.hypot(pointX - startX, pointY - startY);
  }

  const position = Math.max(
    0,
    Math.min(1, (relativeX * segmentX + relativeY * segmentY) / segmentLengthSquared)
  );
  const closestX = startX + position * segmentX;
  const closestY = startY + position * segmentY;

  return Math.hypot(pointX - closestX, pointY - closestY);
}

function distanceToRouteMeters(point: LatLng, route: LatLng[]): number {
  if (route.length < 2) {
    return Infinity;
  }

  let minimumDistance = Infinity;

  for (let index = 0; index < route.length - 1; index += 1) {
    const distance = distancePointToSegmentMeters(point, route[index], route[index + 1]);
    if (distance < minimumDistance) {
      minimumDistance = distance;
    }
  }

  return minimumDistance;
}

function findNearestRoutePointIndex(point: LatLng, route: LatLng[]): number {
  if (route.length === 0) {
    return 0;
  }

  let nearestIndex = 0;
  let nearestDistance = Infinity;

  for (let index = 0; index < route.length; index += 1) {
    const distance = haversineMeters(point, route[index]);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  }

  return nearestIndex;
}

function measureRouteDistanceBetweenIndices(
  route: LatLng[],
  startIndex: number,
  endIndex: number
): number {
  if (route.length < 2 || endIndex <= startIndex) {
    return 0;
  }

  const safeStartIndex = Math.max(0, Math.min(route.length - 1, startIndex));
  const safeEndIndex = Math.max(safeStartIndex, Math.min(route.length - 1, endIndex));
  let totalDistance = 0;

  for (let index = safeStartIndex; index < safeEndIndex; index += 1) {
    totalDistance += haversineMeters(route[index], route[index + 1]);
  }

  return totalDistance;
}

function buildNavigationInstruction(
  currentLocation: LatLng,
  route: LatLng[],
  steps: DrivingRouteStep[]
): NavigationInstruction | null {
  if (route.length < 2 || steps.length === 0) {
    return null;
  }

  const nearestRouteIndex = findNearestRoutePointIndex(currentLocation, route);
  const upcomingActionStep = steps.find(
    (step) => isActionableStepType(step.type) && step.wayPointStartIndex > nearestRouteIndex + 1
  );

  if (upcomingActionStep) {
    return {
      distanceLabel: formatNavigationDistanceLabel(
        measureRouteDistanceBetweenIndices(route, nearestRouteIndex, upcomingActionStep.wayPointStartIndex)
      ),
      instruction: upcomingActionStep.instruction,
      type: upcomingActionStep.type,
    };
  }

  const currentStep = steps.find((step) => step.wayPointEndIndex >= nearestRouteIndex);

  if (!currentStep) {
    return null;
  }

  return {
    distanceLabel:
      currentStep.type === 10
        ? 'Perillä'
        : formatNavigationDistanceLabel(
          measureRouteDistanceBetweenIndices(route, nearestRouteIndex, currentStep.wayPointEndIndex)
        ),
    instruction: currentStep.instruction,
    type: currentStep.type,
  };
}

function simplifyPolylineForRender(points: LatLng[]): LatLng[] {
  if (points.length < 3) {
    return points;
  }

  const minDistanceMeters =
    points.length > 4500 ? 12 : points.length > 2500 ? 8 : points.length > 1200 ? 4 : 2;
  const turnThresholdDegrees = 14;

  const simplified: LatLng[] = [points[0]];
  let lastKeptPoint = points[0];

  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    const nextPoint = points[index + 1];
    const previousBearing = calculateBearingDegrees(lastKeptPoint, point);
    const nextBearing = calculateBearingDegrees(point, nextPoint);
    const turnAmount = getHeadingDeltaDegrees(previousBearing, nextBearing);

    if (haversineMeters(lastKeptPoint, point) >= minDistanceMeters || turnAmount >= turnThresholdDegrees) {
      simplified.push(point);
      lastKeptPoint = point;
    }
  }

  simplified.push(points[points.length - 1]);

  return simplified;
}

function formatDistanceLabel(distanceMeters: number | null): string {
  if (distanceMeters === null) {
    return '-';
  }

  return `${(distanceMeters / 1000).toFixed(2)} km`;
}

function formatDurationLabel(durationSeconds: number | null): string {
  if (durationSeconds === null) {
    return '-';
  }

  return `${Math.round(durationSeconds / 60)} min`;
}

function formatSavingsLabel(value: number): string {
  return `${value.toFixed(2)} EUR`;
}

function getCombinedConsumptionValue(preferences: ProfilePreferences): number | null {
  const normalizedValue = preferences.combinedConsumption.trim().replace(',', '.');
  const parsedValue = Number(normalizedValue);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return parsedValue;
}

function createNavigationTargetLabel(
  destinationLabel: string,
  recommendedFuelStop: RecommendedFuelStop | null,
  hasVisitedFuelStop: boolean
): string {
  if (recommendedFuelStop && !hasVisitedFuelStop) {
    return `Tankkaa: ${recommendedFuelStop.stationName}`;
  }

  return destinationLabel;
}

function createFuelStopSummary(
  destinationLabel: string,
  recommendedFuelStop: RecommendedFuelStop | null,
  hasVisitedFuelStop: boolean,
  isFindingFuelStop: boolean
): string | null {
  if (isFindingFuelStop) {
    return 'Lasketaan paras tankkausasema reitille...';
  }

  if (!recommendedFuelStop || hasVisitedFuelStop) {
    return null;
  }

  return `${recommendedFuelStop.stationName} | ${formatFuelPrice(
    recommendedFuelStop.price
  )} | ${formatExtraDistance(
    recommendedFuelStop.detourDistanceMeters
  )} | Arvioitu säästö ${formatSavingsLabel(recommendedFuelStop.estimatedNetSavingsEuro)} | sitten ${destinationLabel}`;
}

export default function MapScreen({ user }: MapScreenProps) {
  const mapRef = useRef<MapView | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const headingWatchRef = useRef<Location.LocationSubscription | null>(null);
  const hasCenteredInitiallyRef = useRef(false);

  const destinationRef = useRef<LatLng | null>(null);
  const routeRef = useRef<LatLng[]>([]);
  const isNavigatingRef = useRef(false);
  const isFollowingRef = useRef(true);
  const headingRef = useRef<number | null>(null);
  const currentLocationRef = useRef<LatLng | null>(null);
  const recommendedFuelStopRef = useRef<RecommendedFuelStop | null>(null);
  const hasVisitedFuelStopRef = useRef(false);
  const lastCameraHeadingRef = useRef<number | null>(null);

  const lastCameraAtRef = useRef(0);
  const lastRouteRefreshAtRef = useRef(0);
  const routeFetchInFlightRef = useRef(false);
  const navigationCameraLockedRef = useRef(false);
  const routeRequestIdRef = useRef(0);

  const [address, setAddress] = useState('');
  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(null);
  const [destination, setDestination] = useState<LatLng | null>(null);
  const [destinationLabel, setDestinationLabel] = useState('Määränpää');
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [routeSteps, setRouteSteps] = useState<DrivingRouteStep[]>([]);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isFollowing, setIsFollowing] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(true);
  const [profilePreferences, setProfilePreferences] = useState<ProfilePreferences>(
    createDefaultProfilePreferences()
  );
  const [recommendedFuelStop, setRecommendedFuelStop] = useState<RecommendedFuelStop | null>(null);
  const [hasVisitedFuelStop, setHasVisitedFuelStop] = useState(false);
  const [isFindingFuelStop, setIsFindingFuelStop] = useState(false);

  const [gasStations, setGasStations] = useState<GasStation[]>([]);

  const routeRenderCoords = useMemo(() => simplifyPolylineForRender(routeCoords), [routeCoords]);
  const navigationInstruction = useMemo(
    () =>
      isNavigating && currentLocation
        ? buildNavigationInstruction(currentLocation, routeCoords, routeSteps)
        : null,
    [currentLocation, isNavigating, routeCoords, routeSteps]
  );

  useEffect(() => {
    destinationRef.current = destination;
  }, [destination]);

  useEffect(() => {
    routeRef.current = routeCoords;
  }, [routeCoords]);

  useEffect(() => {
    isNavigatingRef.current = isNavigating;
  }, [isNavigating]);

  useEffect(() => {
    isFollowingRef.current = isFollowing;
  }, [isFollowing]);

  useEffect(() => {
    headingRef.current = heading;
  }, [heading]);

  useEffect(() => {
    currentLocationRef.current = currentLocation;
  }, [currentLocation]);

  useEffect(() => {
    recommendedFuelStopRef.current = recommendedFuelStop;
  }, [recommendedFuelStop]);

  useEffect(() => {
    hasVisitedFuelStopRef.current = hasVisitedFuelStop;
  }, [hasVisitedFuelStop]);

  useEffect(() => {
    let isMounted = true;

    const loadProfilePreferences = async () => {
      if (!user?.email) {
        if (isMounted) {
          setProfilePreferences(createDefaultProfilePreferences());
        }
        return;
      }

      try {
        const storedPreferences = await getProfilePreferences(user.email);

        if (!isMounted) {
          return;
        }

        setProfilePreferences(storedPreferences ?? createDefaultProfilePreferences());
      } catch (error) {
        console.error('Failed to load stored profile preferences', error);

        if (isMounted) {
          setProfilePreferences(createDefaultProfilePreferences());
        }
      }
    };

    void loadProfilePreferences();

    return () => {
      isMounted = false;
    };
  }, [user?.email]);

  useEffect(() => {
    if (!isNavigating || !isFollowing || !currentLocationRef.current) {
      return;
    }

    const nextHeading = resolveCameraHeading(heading, null);
    const previousHeading = lastCameraHeadingRef.current;

    if (
      previousHeading !== null &&
      getHeadingDeltaDegrees(previousHeading, nextHeading) < headingRefreshThresholdDegrees
    ) {
      return;
    }

    focusNavigationCamera(currentLocationRef.current, nextHeading);
  }, [heading, isFollowing, isNavigating]);

  const API_KEY = process.env.EXPO_PUBLIC_DATABASE_API_KEY

  useEffect(() => {
    if (!currentLocation) return;

    const fetchStations = async () => {
      try {
        const res = await fetch(
          `http://204.168.156.110:3000/api/all?lat=${currentLocation.latitude}&lon=${currentLocation.longitude}`,
          {
            headers: {
              'x-api-key': API_KEY
            }
          }
        );

        const data = await res.json();

        setGasStations(data);
        //console.log('Fetched stations:', data);
      } catch (err) {
        console.error('Failed to fetch gas stations', err);
      }
    };

    fetchStations();
  }, [currentLocation]);

  const focusNavigationCamera = (point: LatLng, headingOverride?: number | null) => {
    if (!mapRef.current) {
      return;
    }

    const resolvedHeading = resolveCameraHeading(headingOverride ?? null, headingRef.current);
    const cameraCenter =
      typeof headingOverride === 'number' || headingRef.current !== null
        ? offsetCoordinateByMeters(point, resolvedHeading, navigationLookAheadMeters)
        : point;

    mapRef.current.animateCamera(
      {
        center: cameraCenter,
        heading: resolvedHeading,
        pitch: navigationPitch,
        zoom: navigationZoom,
      },
      { duration: 450 }
    );
    lastCameraAtRef.current = Date.now();
    lastCameraHeadingRef.current = resolvedHeading;
  };

  const applyRoute = (route: DrivingRoute, fitOnMap: boolean = true) => {
    setRouteCoords(route.geometry);
    setRouteSteps(route.steps);
    setDistanceMeters(route.distanceMeters);
    setDurationSeconds(route.durationSeconds);
    lastRouteRefreshAtRef.current = Date.now();

    if (fitOnMap && mapRef.current && route.geometry.length > 1) {
      mapRef.current.fitToCoordinates(route.geometry, {
        animated: true,
        edgePadding: { top: 100, right: 32, bottom: 190, left: 32 },
      });
    }
  };

  const updateRoute = async (
    from: LatLng,
    to: LatLng,
    fitOnMap: boolean = true,
    overrideFuelStop: RecommendedFuelStop | null = recommendedFuelStopRef.current,
    overrideHasVisitedFuelStop: boolean = hasVisitedFuelStopRef.current
  ) => {
    const routePoints =
      overrideFuelStop && !overrideHasVisitedFuelStop
        ? [from, overrideFuelStop.coordinate, to]
        : [from, to];

    const route = await fetchDrivingRouteWithWaypoints(routePoints);
    applyRoute(route, fitOnMap);
    return route;
  };

  const maybeRefreshRoute = async (userPoint: LatLng) => {
    const target = destinationRef.current;

    if (!target || routeFetchInFlightRef.current) {
      return;
    }

    const now = Date.now();
    const sinceLastRefreshMs = now - lastRouteRefreshAtRef.current;
    const offRouteDistance = distanceToRouteMeters(userPoint, routeRef.current);
    const mustRefresh =
      routeRef.current.length < 2 ||
      (isNavigatingRef.current &&
        offRouteDistance > offRouteThresholdM &&
        sinceLastRefreshMs > minRouteRefreshIntervalMs);

    if (!mustRefresh) {
      return;
    }

    try {
      routeFetchInFlightRef.current = true;
      await updateRoute(userPoint, target, false);
    } catch (error) {
      console.error('Route refresh failed', error);
    } finally {
      routeFetchInFlightRef.current = false;
    }
  };

  const handleFuelStopArrival = async (userPoint: LatLng) => {
    const activeFuelStop = recommendedFuelStopRef.current;

    if (!activeFuelStop || hasVisitedFuelStopRef.current || !destinationRef.current) {
      return false;
    }

    if (!isArrivedAtFuelStop(userPoint, activeFuelStop.coordinate)) {
      return false;
    }

    hasVisitedFuelStopRef.current = true;
    setHasVisitedFuelStop(true);

    Alert.alert(
      'Tankkausasema saavutettu',
      `Saavuit asemalle ${activeFuelStop.stationName}. Reitti jatkuu määränpäähän.`
    );

    try {
      routeFetchInFlightRef.current = true;
      await updateRoute(userPoint, destinationRef.current, false, activeFuelStop, true);
    } catch (error) {
      console.error('Failed to continue route after fuel stop', error);
    } finally {
      routeFetchInFlightRef.current = false;
    }

    return true;
  };

  const planRouteWithOptionalFuelStop = async (
    from: LatLng,
    to: LatLng,
    fitOnMap: boolean = true
  ) => {
    const requestId = routeRequestIdRef.current + 1;
    routeRequestIdRef.current = requestId;

    setRecommendedFuelStop(null);
    recommendedFuelStopRef.current = null;
    setHasVisitedFuelStop(false);
    hasVisitedFuelStopRef.current = false;
    setIsFindingFuelStop(false);

    const directRoute = await fetchDrivingRoute(from, to);

    if (requestId !== routeRequestIdRef.current) {
      return;
    }

    applyRoute(directRoute, fitOnMap);

    const combinedConsumption = getCombinedConsumptionValue(profilePreferences);

    if (!profilePreferences.fuelType || combinedConsumption === null) {
      return;
    }

    setIsFindingFuelStop(true);

    try {
      const bestFuelStop = await findBestFuelStop({
        baseRoute: directRoute,
        combinedConsumption,
        currentLocation: from,
        destination: to,
        fuelType: profilePreferences.fuelType,
      });

      if (requestId !== routeRequestIdRef.current || !bestFuelStop) {
        return;
      }

      setRecommendedFuelStop(bestFuelStop);
      recommendedFuelStopRef.current = bestFuelStop;
      applyRoute(bestFuelStop.route, fitOnMap);
    } catch (error) {
      console.error('Failed to calculate best fuel stop', error);
    } finally {
      if (requestId === routeRequestIdRef.current) {
        setIsFindingFuelStop(false);
      }
    }
  };

  useEffect(() => {
    const startTracking = async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();

        if (permission.status !== 'granted') {
          setLocationError('Sijaintilupaa ei myönnetty.');
          setIsLocating(false);
          return;
        }

        const initialPosition = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
        });

        const initialPoint: LatLng = {
          latitude: initialPosition.coords.latitude,
          longitude: initialPosition.coords.longitude,
        };

        setCurrentLocation(initialPoint);
        setLocationError(null);
        setIsLocating(false);

        watchRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 800,
            distanceInterval: 1,
          },
          async (position) => {
            const rawPoint: LatLng = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };
            const previousPoint = currentLocationRef.current;
            const speedMps = Math.max(0, position.coords.speed ?? 0);
            const accuracyMeters = Math.max(0, position.coords.accuracy ?? maxJitterThresholdM);
            const movedMeters = previousPoint ? haversineMeters(previousPoint, rawPoint) : Infinity;
            const jitterThreshold = Math.max(
              minJitterThresholdM,
              Math.min(maxJitterThresholdM, accuracyMeters * 0.6)
            );
            const shouldFreeze =
              Boolean(previousPoint) &&
              speedMps < stationarySpeedMps &&
              movedMeters < jitterThreshold;
            const userPoint = shouldFreeze && previousPoint ? previousPoint : rawPoint;

            if (!shouldFreeze) {
              setCurrentLocation(userPoint);
            }

            if (destinationRef.current) {
              const handledFuelStopArrival = await handleFuelStopArrival(userPoint);

              if (!handledFuelStopArrival) {
                await maybeRefreshRoute(userPoint);
              }
            }

            if (
              isNavigatingRef.current &&
              isFollowingRef.current &&
              mapRef.current &&
              Date.now() - lastCameraAtRef.current > cameraUpdateMs
            ) {
              focusNavigationCamera(userPoint, headingRef.current ?? position.coords.heading ?? null);
            }

            if (isNavigatingRef.current && destinationRef.current) {
              const arrivalDistance = haversineMeters(userPoint, destinationRef.current);

              if (arrivalDistance < 20) {
                setIsNavigating(false);
                setIsFollowing(true);
                navigationCameraLockedRef.current = false;
                Alert.alert('Perillä', 'Saavuit määränpäähän.');
              }
            }
          }
        );

        headingWatchRef.current = await Location.watchHeadingAsync((result) => {
          const nextHeading = Number.isFinite(result.trueHeading)
            ? result.trueHeading
            : result.magHeading;

          if (nextHeading >= 0) {
            setHeading((previousHeading) => smoothHeading(previousHeading, nextHeading));
          }
        });
      } catch (error) {
        console.error('Location setup failed', error);
        setLocationError('Sijainnin haku epäonnistui.');
        setIsLocating(false);
      }
    };

    void startTracking();

    return () => {
      watchRef.current?.remove();
      watchRef.current = null;
      headingWatchRef.current?.remove();
      headingWatchRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!currentLocation || !mapRef.current || hasCenteredInitiallyRef.current || destinationRef.current) {
      return;
    }

    mapRef.current.animateCamera(
      {
        center: currentLocation,
        heading: 0,
        pitch: 0,
        zoom: defaultMapZoom,
      },
      { duration: 450 }
    );
    hasCenteredInitiallyRef.current = true;
  }, [currentLocation]);

  const handleSearchRoute = async () => {
    if (!address.trim()) {
      Alert.alert('Puuttuva osoite', 'Kirjoita osoite ennen reittihaun aloittamista.');
      return;
    }

    if (!currentLocationRef.current) {
      Alert.alert('Sijainti puuttuu', 'Odota hetki, käyttäjän sijaintia haetaan.');
      return;
    }

    setIsLoadingRoute(true);
    setIsNavigating(false);
    setIsFollowing(true);
    setLocationError(null);

    try {
      const destinationCoords = await geocodeAddress(address);
      setDestination(destinationCoords);
      setDestinationLabel(address.trim());
      await planRouteWithOptionalFuelStop(currentLocationRef.current, destinationCoords, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Reitin haku epäonnistui.';
      setLocationError(message);
      Alert.alert('Virhe', message);
      setRouteCoords([]);
      setRouteSteps([]);
      setDistanceMeters(null);
      setDurationSeconds(null);
      setDestination(null);
      setRecommendedFuelStop(null);
      setHasVisitedFuelStop(false);
      setIsNavigating(false);
    } finally {
      setIsLoadingRoute(false);
    }
  };

  const handleSelectDestination = async (coordinate: LatLng) => {
    if (!currentLocationRef.current || isLoadingRoute) {
      return;
    }

    setIsLoadingRoute(true);
    setIsNavigating(false);
    setIsFollowing(true);
    setLocationError(null);
    setDestination(coordinate);
    setDestinationLabel('Valittu kohde');

    try {
      await planRouteWithOptionalFuelStop(currentLocationRef.current, coordinate, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Reitin haku epäonnistui.';
      setLocationError(message);
      Alert.alert('Virhe', message);
      setRouteCoords([]);
      setRouteSteps([]);
      setDistanceMeters(null);
      setDurationSeconds(null);
      setDestination(null);
      setRecommendedFuelStop(null);
      setHasVisitedFuelStop(false);
    } finally {
      setIsLoadingRoute(false);
    }
  };

  const handleToggleNavigation = () => {
    if (!destination || routeCoords.length < 2) {
      Alert.alert('Reitti puuttuu', 'Hae reitti ennen navigoinnin aloitusta.');
      return;
    }

    const nextValue = !isNavigating;
    setIsNavigating(nextValue);
    setIsFollowing(true);

    if (nextValue && currentLocationRef.current && mapRef.current) {
      navigationCameraLockedRef.current = true;
      focusNavigationCamera(currentLocationRef.current, heading);

      if (Platform.OS === 'ios') {
        const resolvedHeading = resolveCameraHeading(heading, headingRef.current);
        const regionCenter = offsetCoordinateByMeters(
          currentLocationRef.current,
          resolvedHeading,
          navigationLookAheadMeters
        );

        mapRef.current.animateToRegion(
          {
            latitude: regionCenter.latitude,
            longitude: regionCenter.longitude,
            latitudeDelta: navigationStartLatitudeDelta,
            longitudeDelta: navigationStartLongitudeDelta,
          },
          450
        );
      }
      return;
    }

    navigationCameraLockedRef.current = false;

    if (!nextValue && mapRef.current && routeCoords.length > 1) {
      mapRef.current.fitToCoordinates(routeCoords, {
        animated: true,
        edgePadding: { top: 100, right: 32, bottom: 190, left: 32 },
      });
    }
  };

  const handleRecenter = () => {
    if (!currentLocationRef.current || !mapRef.current) {
      return;
    }

    setIsFollowing(true);

    if (isNavigating) {
      navigationCameraLockedRef.current = true;
      focusNavigationCamera(currentLocationRef.current, heading);
      return;
    }

    mapRef.current.animateCamera(
      {
        center: currentLocationRef.current,
        heading: 0,
        pitch: 0,
        zoom: defaultMapZoom,
      },
      { duration: 450 }
    );
  };

  const distanceLabel = formatDistanceLabel(distanceMeters);
  const durationLabel = formatDurationLabel(durationSeconds);
  const initialCenter = currentLocation ?? fallbackCenter;
  const navigationTargetLabel = createNavigationTargetLabel(
    destinationLabel,
    recommendedFuelStop,
    hasVisitedFuelStop
  );
  const fuelStopSummary = createFuelStopSummary(
    destinationLabel,
    recommendedFuelStop,
    hasVisitedFuelStop,
    isFindingFuelStop
  );
  const routeBannerTitle =
    recommendedFuelStop && !hasVisitedFuelStop ? recommendedFuelStop.stationName : destinationLabel;
  const routeBannerSubtitle =
    fuelStopSummary ?? `${distanceLabel} | ${durationLabel}`;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <StatusBar style="dark" />

      {isLocating && !currentLocation ? (
        <View style={styles.centerState}>
          <ActivityIndicator animating color={brandColors.forest} size="large" />
          <Text style={styles.stateText} variant="bodyLarge">
            Haetaan sijaintia...
          </Text>
        </View>
      ) : (
        <Map
          address={address}
          currentHeading={heading}
          currentLocation={currentLocation}
          destination={destination}
          destinationLabel={destinationLabel}
          distanceLabel={distanceLabel}
          durationLabel={durationLabel}
          fuelStopRecommendation={recommendedFuelStop}
          fuelStopSummary={fuelStopSummary}
          hasVisitedFuelStop={hasVisitedFuelStop}
          initialCenter={initialCenter}
          isFindingFuelStop={isFindingFuelStop}
          isFollowing={isFollowing}
          isLoadingRoute={isLoadingRoute}
          isNavigating={isNavigating}
          locationError={locationError}
          mapRef={mapRef}
          navigationInstruction={navigationInstruction}
          navigationTargetLabel={navigationTargetLabel}
          onAddressChange={setAddress}
          onLongPressMap={(coordinate) => {
            void handleSelectDestination(coordinate);
          }}
          onPanMap={() => {
            if (isNavigatingRef.current) {
              setIsFollowing(false);
            }
          }}
          onRecenter={handleRecenter}
          onSearchRoute={() => {
            void handleSearchRoute();
          }}
          onToggleNavigation={handleToggleNavigation}
          routeBannerSubtitle={routeBannerSubtitle}
          routeBannerTitle={routeBannerTitle}
          routeCoords={routeRenderCoords}
          gasStations={gasStations}
        />
      )}

      {!currentLocation && !isLocating ? (
        <View style={styles.errorOverlay}>
          <Card mode="contained" style={styles.errorCard}>
            <Card.Content>
              <Text style={styles.errorTitle} variant="titleMedium">
                Sijaintia ei saatu
              </Text>
              <Text style={styles.errorBody} variant="bodyMedium">
                {locationError ?? 'Sijainti ei ole viela saatavilla.'}
              </Text>
            </Card.Content>
          </Card>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centerState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  container: {
    backgroundColor: '#EEF2F0',
    flex: 1,
  },
  errorBody: {
    color: brandColors.forestSoft,
    lineHeight: 22,
    marginTop: 8,
  },
  errorCard: {
    backgroundColor: '#F9FFFC',
    borderRadius: 20,
  },
  errorOverlay: {
    bottom: 24,
    left: 12,
    position: 'absolute',
    right: 12,
  },
  errorTitle: {
    color: brandColors.forest,
    fontWeight: '700',
  },
  stateText: {
    color: brandColors.forestSoft,
    marginTop: 14,
  },
});
