import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
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
} from '../services/routing';
import { brandColors } from '../theme';
import Map from './Map';

interface MapScreenProps {
  user: RegisteredUser | null;
}

const fallbackCenter = {
  latitude: 60.1699,
  longitude: 24.9384,
};

const cameraUpdateMs = 700;
const routeRefreshMs = 9000;
const maxRouteStaleMs = 18000;
const offRouteThresholdM = 45;
const navigationZoom = 19;
const navigationPitch = 58;
const stationarySpeedMps = 0.8;
const minJitterThresholdM = 4;
const maxJitterThresholdM = 12;

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

function simplifyPolylineForRender(points: LatLng[]): LatLng[] {
  if (points.length < 3) {
    return points;
  }

  const minDistanceMeters =
    points.length > 3000 ? 20 : points.length > 1500 ? 12 : points.length > 800 ? 8 : 4;

  const simplified: LatLng[] = [points[0]];
  let lastKeptPoint = points[0];

  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];

    if (haversineMeters(lastKeptPoint, point) >= minDistanceMeters) {
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

  return `${recommendedFuelStop.stationName} • ${formatFuelPrice(
    recommendedFuelStop.price
  )} • ${formatExtraDistance(recommendedFuelStop.detourDistanceMeters)} • sitten ${destinationLabel}`;
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

  const lastCameraAtRef = useRef(0);
  const lastRouteRefreshAtRef = useRef(0);
  const routeFetchInFlightRef = useRef(false);
  const navigationCameraLockedRef = useRef(false);
  const routeRequestIdRef = useRef(0);

  const [address, setAddress] = useState('');
  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(null);
  const [destination, setDestination] = useState<LatLng | null>(null);
  const [destinationLabel, setDestinationLabel] = useState('Maaranpaa');
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [speedKmh, setSpeedKmh] = useState(0);
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

  const routeRenderCoords = useMemo(() => simplifyPolylineForRender(routeCoords), [routeCoords]);

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

  const applyRoute = (route: DrivingRoute, fitOnMap: boolean = true) => {
    setRouteCoords(route.geometry);
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
    const staleMs = now - lastRouteRefreshAtRef.current;
    const offRouteDistance = distanceToRouteMeters(userPoint, routeRef.current);
    const mustRefresh =
      routeRef.current.length < 2 ||
      staleMs > maxRouteStaleMs ||
      (isNavigatingRef.current && offRouteDistance > offRouteThresholdM) ||
      (isNavigatingRef.current && staleMs > routeRefreshMs);

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
      `Saavuit asemalle ${activeFuelStop.stationName}. Reitti jatkuu maaranpaahan.`
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
          setLocationError('Sijaintilupaa ei myonnetty.');
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
        setSpeedKmh(Math.max(0, (initialPosition.coords.speed ?? 0) * 3.6));
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

            setSpeedKmh(shouldFreeze ? 0 : speedMps * 3.6);

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
              mapRef.current.animateCamera(
                {
                  center: userPoint,
                  heading: headingRef.current ?? position.coords.heading ?? 0,
                },
                { duration: 500 }
              );
              lastCameraAtRef.current = Date.now();
            }

            if (isNavigatingRef.current && destinationRef.current) {
              const arrivalDistance = haversineMeters(userPoint, destinationRef.current);

              if (arrivalDistance < 20) {
                setIsNavigating(false);
                setIsFollowing(true);
                navigationCameraLockedRef.current = false;
                Alert.alert('Perilla', 'Saavuit maaranpaahan.');
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
        setLocationError('Sijainnin haku epaonnistui.');
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
        zoom: 15,
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
      Alert.alert('Sijainti puuttuu', 'Odota hetki, kayttajan sijaintia haetaan.');
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
      const message = error instanceof Error ? error.message : 'Reitin haku epaonnistui.';
      setLocationError(message);
      Alert.alert('Virhe', message);
      setRouteCoords([]);
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
      const message = error instanceof Error ? error.message : 'Reitin haku epaonnistui.';
      setLocationError(message);
      Alert.alert('Virhe', message);
      setRouteCoords([]);
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
      mapRef.current.setCamera({
        center: currentLocationRef.current,
        heading: heading ?? 0,
        pitch: navigationPitch,
        zoom: navigationZoom,
      });
      lastCameraAtRef.current = Date.now();
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
      mapRef.current.setCamera({
        center: currentLocationRef.current,
        heading: heading ?? 0,
        pitch: navigationPitch,
        zoom: navigationZoom,
      });
      lastCameraAtRef.current = Date.now();
      return;
    }

    mapRef.current.animateCamera(
      {
        center: currentLocationRef.current,
        heading: 0,
        pitch: 0,
        zoom: 15,
      },
      { duration: 450 }
    );
  };

  const distanceLabel = formatDistanceLabel(distanceMeters);
  const durationLabel = formatDurationLabel(durationSeconds);
  const speedLabel = Math.round(speedKmh).toString();
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
    fuelStopSummary ?? `${distanceLabel} · ${durationLabel}`;

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
          speedLabel={speedLabel}
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
