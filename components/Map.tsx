import type { RefObject } from 'react';
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
import MapView, { Marker, Polyline, UrlTile, type LatLng } from 'react-native-maps';
import type { RecommendedFuelStop } from '../services/fuelRouting';
import { brandColors } from '../theme';

interface MapProps {
  address: string;
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
  navigationTargetLabel: string;
  onAddressChange: (value: string) => void;
  onLongPressMap: (coordinate: LatLng) => void;
  onPanMap: () => void;
  onRecenter: () => void;
  onSearchRoute: () => void;
  onToggleNavigation: () => void;
  routeBannerSubtitle: string;
  routeBannerTitle: string;
  routeCoords: LatLng[];
  speedLabel: string;
}

const initialDelta = {
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

export default function Map({
  address,
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
  navigationTargetLabel,
  onAddressChange,
  onLongPressMap,
  onPanMap,
  onRecenter,
  onSearchRoute,
  onToggleNavigation,
  routeBannerSubtitle,
  routeBannerTitle,
  routeCoords,
  speedLabel,
}: MapProps) {
  const hasRoute = routeCoords.length > 1;
  const canSearch = address.trim().length > 0 && !isLoadingRoute;
  const showFuelStopMarker = Boolean(fuelStopRecommendation) && !hasVisitedFuelStop;

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
        rotateEnabled={false}
        showsCompass={false}
        style={styles.map}
        toolbarEnabled={false}
      >
        <UrlTile
          maximumZ={19}
          shouldReplaceMapContent={Platform.OS === 'ios'}
          tileSize={256}
          urlTemplate="https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
        />

        {currentLocation ? (
          <Marker coordinate={currentLocation} title="Sina" tracksViewChanges={false}>
            <View style={styles.userMarkerOuter}>
              <View style={styles.userMarkerInner} />
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

        {hasRoute ? (
          <>
            <Polyline
              coordinates={routeCoords}
              lineCap="round"
              lineJoin="round"
              strokeColor="rgba(15, 23, 42, 0.18)"
              strokeWidth={10}
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
              <MaterialCommunityIcons color="#FFFFFF" name="navigation-variant" size={18} />
            </View>
            <Text numberOfLines={1} style={styles.navigationTopText}>
              {navigationTargetLabel}
            </Text>
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

        {hasRoute && !isNavigating ? (
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
            <Text style={styles.recenterButtonText}>Keskitä</Text>
          </Pressable>
        ) : null}

        <View style={styles.bottomCard}>
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

          <Text style={styles.subMetrics}>Nopeus: {speedLabel} km/h</Text>

          {isFindingFuelStop ? (
            <Text style={styles.fuelInfoText}>Etsitaan paras tankkausasema...</Text>
          ) : fuelStopSummary ? (
            <Text style={styles.fuelInfoText}>{fuelStopSummary}</Text>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.97)',
    borderRadius: 20,
    bottom: 14,
    left: 12,
    paddingBottom: 12,
    paddingHorizontal: 14,
    paddingTop: 14,
    position: 'absolute',
    right: 12,
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
  fuelInfoText: {
    color: brandColors.forestSoft,
    fontSize: 13,
    lineHeight: 18,
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
  navigationTopBar: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderRadius: 16,
    flexDirection: 'row',
    left: 12,
    minHeight: 58,
    paddingHorizontal: 14,
    position: 'absolute',
    right: 12,
    top: 12,
  },
  navigationTopIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 12,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  navigationTopText: {
    color: '#FFFFFF',
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 12,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  recenterButton: {
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 18,
    bottom: 164,
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: 'absolute',
    right: 12,
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
  subMetrics: {
    color: '#475569',
    fontSize: 13,
    marginTop: 8,
  },
  topBar: {
    flexDirection: 'row',
    gap: 8,
    left: 12,
    position: 'absolute',
    right: 12,
    top: 12,
  },
  userMarkerInner: {
    backgroundColor: '#1ED35B',
    borderColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 3,
    height: 20,
    width: 20,
  },
  userMarkerOuter: {
    backgroundColor: 'rgba(30, 211, 91, 0.16)',
    borderRadius: 18,
    padding: 6,
  },
});
