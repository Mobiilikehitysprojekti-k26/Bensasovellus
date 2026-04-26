import { useEffect, useMemo, useState, type RefObject } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import MapView, {
  Callout,
  Marker,
  Polyline,
  UrlTile,
  type LatLng,
} from 'react-native-maps';
import type { RecommendedFuelStop } from '../services/fuelRouting';
import { brandColors } from '../theme';
import { Image } from 'react-native';
import { getStationLogo } from '../utils/getStationLogo';

type GasStation = {
  fuel_type?: string | null;
  station_id?: string;
  station_name?: string;
  lat: number;
  lon: number;
  price?: number | null;
  updated_text?: string | null;
};

type StationPrice = {
  fuelType: string;
  price: number | null;
  updatedText?: string | null;
};

type GasStationGroup = {
  coordinate: LatLng;
  id: string;
  prices: StationPrice[];
  stationName: string;
};

type NavigationInstruction = {
  distanceLabel: string;
  instruction: string;
  type: number;
};

interface MapProps {
  address: string;
  currentHeading: number | null;
  currentLocation: LatLng | null;
  destination: LatLng | null;
  destinationLabel: string;
  distanceLabel: string;
  durationLabel: string;
  fuelStopRecommendation: RecommendedFuelStop | null;
  fuelStopSummary: string | null;
  hasVisitedFuelStop: boolean;
  initialCenter: LatLng;
  isFindingFuelStop: boolean;
  isFollowing: boolean;
  isLoadingRoute: boolean;
  isNavigating: boolean;
  locationError: string | null;
  mapRef: RefObject<MapView | null>;
  navigationInstruction: NavigationInstruction | null;
  navigationTargetLabel: string;
  onAddressChange: (value: string) => void;
  onLongPressMap: (coordinate: LatLng) => void;
  onPanMap: () => void;
  onRecenter: () => void;
  onSearchRoute: () => void;
  onSelectGasStation: (coordinate: LatLng, stationName: string) => void;
  onToggleNavigation: () => Promise<void> | void;
  routeBannerSubtitle: string;
  routeBannerTitle: string;
  routeCoords: LatLng[];
  gasStations: GasStation[];
}

const initialDelta = {
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

const floatingRestoreBottom = 8;
const recenterTopOffset = 98;

function getFuelSortOrder(fuelType: string): number {
  const normalizedFuelType = fuelType.toLowerCase();

  if (normalizedFuelType === '95') return 0;
  if (normalizedFuelType === '98') return 1;
  if (normalizedFuelType === 'diesel') return 2;

  return 999;
}

function formatStationPrice(price: number | null): string {
  return typeof price === 'number' && Number.isFinite(price) ? `${price.toFixed(3)} EUR` : 'Ei hintaa';
}

function createStationGroupKey(station: GasStation): string {
  const stationName = station.station_name?.trim().toLowerCase() ?? 'asema';
  return `${stationName}/${station.lat.toFixed(5)}/${station.lon.toFixed(5)}`;
}

function groupGasStations(stations: GasStation[]): GasStationGroup[] {
  const groupedStations = new globalThis.Map<string, GasStationGroup>();

  for (const station of stations) {
    if (
      typeof station.lat !== 'number' ||
      typeof station.lon !== 'number' ||
      !Number.isFinite(station.lat) ||
      !Number.isFinite(station.lon)
    ) {
      continue;
    }

    const key = createStationGroupKey(station);
    const existingGroup = groupedStations.get(key);
    const stationName = station.station_name?.trim() || 'Huoltoasema';
    const group =
      existingGroup ??
      {
        coordinate: {
          latitude: station.lat,
          longitude: station.lon,
        },
        id: station.station_id ?? key,
        prices: [],
        stationName,
      };

    const fuelType = station.fuel_type?.trim();

    if (fuelType) {
      const price = typeof station.price === 'number' && Number.isFinite(station.price) ? station.price : null;
      const existingPrice = group.prices.find((item) => item.fuelType === fuelType);

      if (!existingPrice) {
        group.prices.push({
          fuelType,
          price,
          updatedText: station.updated_text,
        });
      } else if (
        price !== null &&
        (existingPrice.price === null || price < existingPrice.price)
      ) {
        existingPrice.price = price;
        existingPrice.updatedText = station.updated_text;
      }
    }

    groupedStations.set(key, group);
  }

  return [...groupedStations.values()].map((station) => ({
    ...station,
    prices: [...station.prices].sort(
      (left, right) => getFuelSortOrder(left.fuelType) - getFuelSortOrder(right.fuelType)
    ),
  }));
}

function getInstructionIconName(
  instructionType: number | null | undefined
): keyof typeof MaterialCommunityIcons.glyphMap {
  switch (instructionType) {
    case 0:
    case 2:
    case 4:
    case 7:
      return 'arrow-top-left';
    case 1:
    case 3:
    case 5:
    case 8:
      return 'arrow-top-right';
    case 9:
      return 'undo-variant';
    case 10:
      return 'flag-checkered';
    case 12:
    case 13:
      return 'rotate-right';
    default:
      return 'arrow-up';
  }
}

export default function Map({
  address,
  currentHeading,
  currentLocation,
  destination,
  destinationLabel,
  distanceLabel,
  durationLabel,
  fuelStopRecommendation,
  fuelStopSummary,
  hasVisitedFuelStop,
  initialCenter,
  isFindingFuelStop,
  isFollowing,
  isLoadingRoute,
  isNavigating,
  locationError,
  mapRef,
  navigationInstruction,
  navigationTargetLabel,
  onAddressChange,
  onLongPressMap,
  onPanMap,
  onRecenter,
  onSearchRoute,
  onSelectGasStation,
  onToggleNavigation,
  routeBannerSubtitle,
  routeBannerTitle,
  routeCoords,
  gasStations = []
}: MapProps) {
  const [isNavigationPanelHidden, setIsNavigationPanelHidden] = useState(false);

  useEffect(() => {
    setIsNavigationPanelHidden(isNavigating);
  }, [isNavigating]);

  const hasRoute = routeCoords.length > 1;
  const canSearch = address.trim().length > 0 && !isLoadingRoute;
  const showFuelStopMarker = Boolean(fuelStopRecommendation) && !hasVisitedFuelStop;
  const userMarkerRotation = typeof currentHeading === 'number' ? currentHeading : 0;
  const navigationIconName = getInstructionIconName(navigationInstruction?.type);
  const shouldShowBottomCard = !isNavigating || !isNavigationPanelHidden;
  const shouldShowRestoreButton = isNavigating && isNavigationPanelHidden;
  const stationGroups = useMemo(() => groupGasStations(gasStations ?? []), [gasStations]);
  const [mapReady, setMapReady] = useState<boolean>(false);
  const [regionReady, setRegionReady] = useState<boolean>(false);
  const [freezeMarkers, setFreezeMarkers] = useState<boolean>(false);

  useEffect(() => {
    if (stationGroups.length > 0) {
      const timer = setTimeout(() => {
        setFreezeMarkers(true);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [stationGroups.length]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        initialRegion={{
          latitude: initialCenter.latitude,
          longitude: initialCenter.longitude,
          ...initialDelta,
        }}
        loadingEnabled
        mapType={Platform.OS === 'android' ? 'none' : 'standard'}
        moveOnMarkerPress={false}
        onLongPress={(event) => onLongPressMap(event.nativeEvent.coordinate)}
        onPanDrag={onPanMap}
        pitchEnabled
        rotateEnabled
        showsCompass={false}
        style={styles.map}
        toolbarEnabled={false}
        onMapReady={() => setMapReady(true)}
        onRegionChangeComplete={() => setRegionReady(true)}
      >
        <UrlTile
          maximumZ={19}
          shouldReplaceMapContent={Platform.OS === 'ios'}
          tileSize={256}
          urlTemplate="https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
        />

        {currentLocation ? (
          <Marker
            anchor={{ x: 0.5, y: 0.5 }}
            coordinate={currentLocation}
            flat
            rotation={userMarkerRotation}
            title="Sina"
          >
            <View style={styles.userMarkerHalo}>
              <View style={styles.userMarkerBody}>
                <MaterialCommunityIcons color="#FFFFFF" name="navigation" size={22} />
              </View>
            </View>
          </Marker>
        ) : null}

        {destination ? (
          <Marker coordinate={destination} title={destinationLabel} tracksViewChanges={false}>
            <View style={styles.destinationMarkerOuter}>
              <MaterialCommunityIcons color="#FFFFFF" name="map-marker" size={16} />
            </View>
          </Marker>
        ) : null}

        {showFuelStopMarker && fuelStopRecommendation ? (
          <Marker
            coordinate={fuelStopRecommendation.coordinate}
            description={fuelStopSummary ?? undefined}
            title={fuelStopRecommendation.stationName}
            tracksViewChanges={false}
          >
            <View style={styles.fuelMarkerOuter}>
              <MaterialCommunityIcons color="#FFFFFF" name="gas-station" size={16} />
            </View>
          </Marker>
        ) : null}

        {stationGroups.map((station) => (
          <Marker
            key={station.id}
            coordinate={station.coordinate}
            tracksViewChanges={!freezeMarkers}
          >
            <View style={styles.gasStationMarkerOuter}>
              <Image 
                source={getStationLogo(station.stationName)}
                style={{ width: 22, height: 22 }}
                resizeMode='contain'
              />
            </View>
            <Callout
              onPress={() => onSelectGasStation(station.coordinate, station.stationName)}
              tooltip
            >
              <View style={styles.stationCallout}>
                <Text numberOfLines={2} style={styles.stationCalloutTitle}>
                  {station.stationName}
                </Text>

                {station.prices.length > 0 ? (
                  station.prices.map((price) => (
                    <View key={price.fuelType} style={styles.stationPriceRow}>
                      <Text style={styles.stationFuelType}>{price.fuelType}</Text>
                      <Text style={styles.stationFuelPrice}>{formatStationPrice(price.price)}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.stationNoPrices}>Hintoja ei saatavilla</Text>
                )}

                <View style={styles.stationCalloutFooter}>
                  {station.prices[0]?.updatedText ? (
                    <Text numberOfLines={1} style={styles.stationUpdatedText}>
                      Päivitetty: {station.prices[0].updatedText}
                    </Text>
                  ) : null}

                  <View style={styles.stationNavigateButton}>
                    <Text style={styles.stationNavigateButtonText}>Tankkaa täällä</Text>
                  </View>
                </View>
              </View>
            </Callout>
          </Marker>
        ))}

        {hasRoute ? (
          <>
            <Polyline
              coordinates={routeCoords}
              lineCap="round"
              lineJoin="round"
              strokeColor="rgba(255, 255, 255, 0.95)"
              strokeWidth={11}
            />
            <Polyline
              coordinates={routeCoords}
              lineCap="round"
              lineJoin="round"
              strokeColor="#1ED35B"
              strokeWidth={5}
            />
          </>
        ) : null}
      </MapView>

      <View pointerEvents="box-none" style={styles.overlay}>
        {isNavigating ? (
          <View style={styles.navigationTopBar}>
            <View style={styles.navigationTopIcon}>
              <MaterialCommunityIcons color="#FFFFFF" name={navigationIconName} size={20} />
            </View>
            <View style={styles.navigationTopContent}>
              {navigationInstruction ? (
                <Text style={styles.navigationDistanceText}>{navigationInstruction.distanceLabel}</Text>
              ) : null}
              <Text numberOfLines={2} style={styles.navigationTopText}>
                {navigationInstruction?.instruction ?? navigationTargetLabel}
              </Text>
              {navigationInstruction ? (
                <Text numberOfLines={1} style={styles.navigationTopSubtext}>
                  {navigationTargetLabel}
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          <View style={styles.topBar}>
            <View style={styles.searchWrapper}>
              <MaterialCommunityIcons color="#6B7280" name="magnify" size={20} />
              <TextInput
                autoCapitalize="words"
                autoCorrect={false}
                onChangeText={onAddressChange}
                onSubmitEditing={onSearchRoute}
                placeholder="Minne matka?"
                placeholderTextColor="#94A3B8"
                returnKeyType="search"
                style={styles.searchInput}
                value={address}
              />
            </View>

            <Pressable
              disabled={!canSearch}
              onPress={onSearchRoute}
              style={({ pressed }) => [
                styles.searchButton,
                !canSearch && styles.searchButtonDisabled,
                pressed && canSearch && styles.searchButtonPressed,
              ]}
            >
              {isLoadingRoute ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.searchButtonText}>Hae</Text>
              )}
            </Pressable>
          </View>
        )}

        {!isNavigating && isFindingFuelStop ? (
          <View style={[styles.routeBanner, styles.searchingBanner]}>
            <View style={[styles.routeBannerIcon, styles.searchingBannerIcon]}>
              <ActivityIndicator color="#FFFFFF" />
            </View>
            <View style={styles.routeBannerContent}>
              <Text numberOfLines={1} style={styles.routeBannerTitle}>
                Etsitaan fiksuinta bensa-asemaa
              </Text>
              <Text style={styles.routeBannerSubtitle}>Vertaillaan hintaa ja ajomatkaa reitilla.</Text>
            </View>
          </View>
        ) : hasRoute && !isNavigating ? (
          <View style={styles.routeBanner}>
            <View style={styles.routeBannerIcon}>
              <MaterialCommunityIcons color="#FFFFFF" name="directions" size={18} />
            </View>
            <View style={styles.routeBannerContent}>
              <Text numberOfLines={1} style={styles.routeBannerTitle}>
                {routeBannerTitle}
              </Text>
              <Text style={styles.routeBannerSubtitle}>{routeBannerSubtitle}</Text>
            </View>
          </View>
        ) : null}

        {isNavigating && !isFollowing ? (
          <Pressable onPress={onRecenter} style={styles.recenterButton}>
            <MaterialCommunityIcons color="#FFFFFF" name="crosshairs-gps" size={18} />
            <Text style={styles.recenterButtonText}>Keskita</Text>
          </Pressable>
        ) : null}

        {shouldShowRestoreButton ? (
          <Pressable
            onPress={() => setIsNavigationPanelHidden(false)}
            style={styles.navigationPanelRestoreButton}
          >
            <MaterialCommunityIcons color="#FFFFFF" name="chevron-down" size={26} />
          </Pressable>
        ) : null}

        {shouldShowBottomCard ? (
          <View style={[styles.bottomCard, isNavigating && styles.bottomCardNavigation]}>
            {isNavigating ? (
              <Pressable
                hitSlop={10}
                onPress={() => setIsNavigationPanelHidden(true)}
                style={styles.navigationPanelHandle}
              >
                <View style={styles.navigationPanelHandleBar} />
                <MaterialCommunityIcons color="#475569" name="chevron-down" size={18} />
              </Pressable>
            ) : null}

            <View style={styles.metricsRow}>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Matka</Text>
                <Text style={styles.metricValue}>{distanceLabel}</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Ajoaika</Text>
                <Text style={styles.metricValue}>{durationLabel}</Text>
              </View>
            </View>

            {isFindingFuelStop ? (
              <View style={styles.fuelInfoRow}>
                <ActivityIndicator color={brandColors.forest} size="small" />
                <Text style={styles.fuelInfoText}>Etsitaan fiksuinta bensa-asemaa...</Text>
              </View>
            ) : fuelStopSummary ? (
              <Text style={[styles.fuelInfoText, styles.fuelInfoSummary]}>{fuelStopSummary}</Text>
            ) : null}

            <Pressable
              disabled={!hasRoute || isLoadingRoute}
              onPress={onToggleNavigation}
              style={({ pressed }) => [
                styles.navButton,
                isNavigating && styles.navButtonActive,
                (!hasRoute || isLoadingRoute) && styles.navButtonDisabled,
                pressed && hasRoute && !isLoadingRoute && styles.navButtonPressed,
              ]}
            >
              <Text style={styles.navButtonText}>
                {isNavigating ? 'Lopeta navigointi' : 'Aloita navigointi'}
              </Text>
            </Pressable>

            {locationError ? <Text style={styles.errorText}>{locationError}</Text> : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.97)',
    borderRadius: 22,
    bottom: 14,
    left: 12,
    paddingBottom: 12,
    paddingHorizontal: 14,
    paddingTop: 14,
    position: 'absolute',
    right: 12,
  },
  bottomCardNavigation: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    bottom: 0,
    left: 0,
    paddingBottom: 14,
    paddingTop: 30,
    right: 0,
  },
  container: {
    backgroundColor: '#EEF2F0',
    flex: 1,
  },
  destinationMarkerOuter: {
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    marginTop: 8,
  },
  fuelInfoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  fuelInfoText: {
    color: brandColors.forestSoft,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  fuelInfoSummary: {
    marginTop: 8,
  },
  fuelMarkerOuter: {
    alignItems: 'center',
    backgroundColor: '#0F766E',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  map: {
    flex: 1,
  },
  metricBox: {
    flex: 1,
  },
  metricDivider: {
    backgroundColor: '#E2E8F0',
    marginHorizontal: 12,
    width: 1,
  },
  metricLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: '#0F172A',
    fontSize: 21,
    fontWeight: '800',
    marginTop: 4,
  },
  metricsRow: {
    flexDirection: 'row',
  },
  navButton: {
    alignItems: 'center',
    backgroundColor: '#1ED35B',
    borderRadius: 14,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 52,
  },
  navButtonActive: {
    backgroundColor: '#DC2626',
  },
  navButtonDisabled: {
    opacity: 0.55,
  },
  navButtonPressed: {
    opacity: 0.9,
  },
  navButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  navigationPanelHandle: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 6,
  },
  navigationPanelHandleBar: {
    backgroundColor: '#CBD5E1',
    borderRadius: 999,
    height: 4,
    marginBottom: 4,
    width: 46,
  },
  navigationPanelRestoreButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderRadius: 18,
    bottom: floatingRestoreBottom,
    height: 38,
    justifyContent: 'center',
    position: 'absolute',
    width: 56,
  },
  navigationTopBar: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderRadius: 16,
    flexDirection: 'row',
    left: 12,
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: 'absolute',
    right: 12,
    top: 12,
  },
  navigationTopContent: {
    flex: 1,
    marginLeft: 12,
  },
  navigationDistanceText: {
    color: '#86EFAC',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  navigationTopIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  navigationTopSubtext: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  navigationTopText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  recenterButton: {
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 18,
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: 'absolute',
    right: 12,
    top: recenterTopOffset,
  },
  recenterButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
  },
  routeBanner: {
    alignItems: 'center',
    backgroundColor: 'rgba(236, 252, 242, 0.97)',
    borderRadius: 16,
    flexDirection: 'row',
    left: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    position: 'absolute',
    right: 12,
    top: 60,
  },
  routeBannerContent: {
    flex: 1,
    marginLeft: 10,
  },
  routeBannerIcon: {
    alignItems: 'center',
    backgroundColor: brandColors.forest,
    borderRadius: 12,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  routeBannerSubtitle: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  routeBannerTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },
  searchButton: {
    alignItems: 'center',
    backgroundColor: '#1ED35B',
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 58,
    minWidth: 88,
    paddingHorizontal: 18,
  },
  searchButtonDisabled: {
    opacity: 0.55,
  },
  searchButtonPressed: {
    opacity: 0.9,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  searchingBanner: {
    backgroundColor: 'rgba(240, 253, 244, 0.98)',
  },
  searchingBannerIcon: {
    backgroundColor: '#1F513F',
  },
  searchInput: {
    color: '#0F172A',
    flex: 1,
    fontSize: 16,
    marginLeft: 10,
    paddingVertical: 0,
  },
  searchWrapper: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 16,
    flex: 1,
    flexDirection: 'row',
    minHeight: 58,
    paddingHorizontal: 16,
  },
  topBar: {
    flexDirection: 'row',
    gap: 8,
    left: 12,
    position: 'absolute',
    right: 12,
    top: 12,
  },
  userMarkerBody: {
    alignItems: 'center',
    backgroundColor: '#153B30',
    borderColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 2,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  userMarkerHalo: {
    alignItems: 'center',
    backgroundColor: 'rgba(30, 211, 91, 0.16)',
    borderRadius: 28,
    justifyContent: 'center',
    padding: 6,
  },
  gasStationMarkerOuter: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    height: 30,
    width: 30,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#000000'
  },
  stationCallout: {
    backgroundColor: '#FFFFFF',
    borderColor: brandColors.lightMint,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 190,
    padding: 12,
  },
  stationCalloutTitle: {
    color: brandColors.forest,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 8,
  },
  stationCalloutFooter: {
    marginTop: 8,
  },
  stationFuelPrice: {
    color: brandColors.forest,
    fontSize: 14,
    fontWeight: '800',
  },
  stationFuelType: {
    color: brandColors.forestSoft,
    fontSize: 14,
    fontWeight: '700',
  },
  stationNoPrices: {
    color: brandColors.forestSoft,
    fontSize: 13,
    lineHeight: 18,
  },
  stationNavigateButton: {
    alignItems: 'center',
    backgroundColor: '#1ED35B',
    borderRadius: 10,
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 38,
    paddingHorizontal: 12,
  },
  stationNavigateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  stationPriceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  stationUpdatedText: {
    color: '#64748B',
    fontSize: 11,
  },
});
