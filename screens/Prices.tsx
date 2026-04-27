import { ActivityIndicator, FlatList, StyleSheet, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Text, Button, Modal, Portal } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { brandColors } from '../theme';
import { useEffect, useState, useCallback } from 'react';
import type { LatLng } from 'react-native-maps';
import { getRefuelHistory, type RefuelEntry } from '../storage/refuelStorage';

type FuelPrice = {
  station_name: string
  fuel_type: string
  matched_station_name?: string | null
  price: number
  reported_at?: string | null
  scraped_at?: string | null
  updated_text: string
  lat?: number | null
  lon?: number | null
}

type StationGroup = {
  station_name: string
  fuels: FuelPrice[]
}

type Filters = {
  fuelTypes: string[];
  sortBy: 'none' | 'latest' | 'cheapest' | 'nearest';
}

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

function formatDistance(distanceMeters: number): string {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters / 100) * 0.1} km`;
  }
  return `${(distanceMeters / 1000).toFixed(1)} km`;
}

function getFuelSortOrder(fuelType: string | null | undefined): number {
  const fuelLower = normalizeFuelType(fuelType);
  if (fuelLower === '95') return 0;
  if (fuelLower === '98') return 1;
  if (fuelLower === 'diesel') return 2;
  return 999; // unknown fuels at the end
}

function normalizeFuelType(fuelType: string | null | undefined): string {
  return fuelType?.trim().toLowerCase() ?? '';
}

function formatFuelType(fuelType: string | null | undefined): string {
  const normalizedFuelType = normalizeFuelType(fuelType);

  if (normalizedFuelType === 'diesel') {
    return 'Diesel';
  }

  return fuelType?.trim() || 'N/A';
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isUserRefuelText(value: string | null | undefined): boolean {
  return normalizeText(value).includes('kayttajan tankkaus');
}

function getStationDisplayName(fuel: FuelPrice): string {
  const stationName = fuel.station_name?.trim();
  const matchedStationName = fuel.matched_station_name?.trim();

  if (stationName && !isUserRefuelText(stationName)) {
    return stationName;
  }

  return matchedStationName || stationName || 'Nimeton asema';
}

function getFuelTimestamp(fuel: FuelPrice): number {
  const timestampCandidates = [fuel.reported_at, fuel.scraped_at, fuel.updated_text];

  for (const value of timestampCandidates) {
    if (!value || isUserRefuelText(value)) {
      continue;
    }

    const timestamp = new Date(value).getTime();
    if (Number.isFinite(timestamp)) {
      return timestamp;
    }
  }

  return 0;
}

function getFuelGroupingKey(fuel: FuelPrice): string {
  return normalizeFuelType(fuel.fuel_type) || fuel.fuel_type?.trim() || 'unknown';
}

function pickNewestFuel(current: FuelPrice, next: FuelPrice): FuelPrice {
  const currentTimestamp = getFuelTimestamp(current);
  const nextTimestamp = getFuelTimestamp(next);

  if (nextTimestamp >= currentTimestamp) {
    return next;
  }

  return current;
}

function groupLatestFuelPrices(fuels: FuelPrice[]): FuelPrice[] {
  const latestByFuelType = new Map<string, FuelPrice>();

  fuels.forEach((fuel) => {
    const key = getFuelGroupingKey(fuel);
    const current = latestByFuelType.get(key);
    latestByFuelType.set(key, current ? pickNewestFuel(current, fuel) : fuel);
  });

  return Array.from(latestByFuelType.values());
}

function getLatestFuel(fuels: FuelPrice[] | undefined): FuelPrice | undefined {
  if (!fuels || fuels.length === 0) {
    return undefined;
  }

  return [...fuels].sort((first, second) => getFuelTimestamp(second) - getFuelTimestamp(first))[0];
}

function createFuelPriceFromRefuel(entry: RefuelEntry): FuelPrice {
  return {
    fuel_type: entry.fuelType,
    matched_station_name: entry.station,
    price: entry.pricePerLiter,
    reported_at: entry.date,
    scraped_at: null,
    station_name: entry.station,
    updated_text: 'Käyttäjän tankkaus',
  };
}

function formatStoredTimestamp(value: string): string {
  return new Date(value).toLocaleString('fi-FI', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getUpdatedText(fuel: FuelPrice | undefined): string {
  if (!fuel) {
    return 'N/A';
  }

  if (fuel.updated_text && !isUserRefuelText(fuel.updated_text)) {
    return fuel.updated_text;
  }

  const timestampSource = fuel.reported_at ?? fuel.scraped_at;
  if (timestampSource) {
    const timestamp = new Date(timestampSource).getTime();
    if (Number.isFinite(timestamp)) {
      return formatStoredTimestamp(timestampSource);
    }
  }

  return 'N/A';
}

export default function PricesScreen() {
  const [data, setData] = useState<StationGroup[]>([]);
  const [filteredData, setFilteredData] = useState<StationGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<Filters>({ fuelTypes: [], sortBy: 'latest' });
  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showBonuses, setShowBonuses] = useState(false);
  const navigation = useNavigation();

  const API_KEY = process.env.EXPO_PUBLIC_DATABASE_API_KEY
  const API_URL = 'http://204.168.156.110:3000/api/all'

  const loadPrices = useCallback(async (showInitialLoader: boolean = false) => {
    if (showInitialLoader) {
      setLoading(true);
    }

    try {
      const [response, refuelHistory] = await Promise.all([
        fetch(API_URL, {
          headers: {
            'x-api-key': API_KEY,
          },
        }),
        getRefuelHistory(),
      ]);
      const json = (await response.json()) as FuelPrice[];
      const localFuelPrices = refuelHistory.map(createFuelPriceFromRefuel);
      const grouped: { [key: string]: FuelPrice[] } = {};

      [...json, ...localFuelPrices].forEach(item => {
        const stationName = getStationDisplayName(item);

        if (stationName) {
          if (!grouped[stationName]) grouped[stationName] = [];
          grouped[stationName].push(item);
        }
      });

      const result: StationGroup[] = Object.keys(grouped).map(station => ({
        station_name: station,
        fuels: groupLatestFuelPrices(grouped[station]),
      }));

      setData(result);
    } catch (error) {
      console.error(error);
    } finally {
      if (showInitialLoader) {
        setLoading(false);
      }
    }
  }, [API_KEY, API_URL]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);

    try {
      await loadPrices(false);
    } finally {
      setRefreshing(false);
    }
  }, [loadPrices]);

  // Get current location
  useEffect(() => {
    const getLocation = async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.granted) {
          const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setCurrentLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
          setLocationError(null);
        } else {
          setLocationError('Sijaintilupa evätty');
        }
      } catch (error) {
        setLocationError('Sijainnin hakeminen epäonnistui');
        console.error(error);
      }
    };

    getLocation();
  }, []);

  useEffect(() => {
    void loadPrices(true);
  }, [loadPrices]);

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const stored = await AsyncStorage.getItem('priceFilters');
        if (stored) {
          setFilters(JSON.parse(stored));
        }
      } catch (error) {
        console.error('Error loading filters:', error);
      }
    };
    loadFilters();
  }, []);

  useFocusEffect(
    useCallback(() => {
      const loadFilters = async () => {
        try {
          const stored = await AsyncStorage.getItem('priceFilters');
          if (stored) {
            setFilters(JSON.parse(stored));
          }
        } catch (error) {
          console.error('Error loading filters:', error);
        }
      };
      loadFilters();
      void loadPrices(false);
    }, [loadPrices])
  );

  useEffect(() => {
    let filtered = data.map(station => ({
      ...station,
      fuels: [...station.fuels],
    }));

    // Filter by fuel types - show station only if it has at least one selected fuel type
    if (filters.fuelTypes.length > 0) {
      const selectedFuelTypes = new Set(filters.fuelTypes.map(normalizeFuelType));

      filtered = filtered.map(station => ({
        ...station,
        fuels: station.fuels.filter(fuel => selectedFuelTypes.has(normalizeFuelType(fuel.fuel_type)))
      })).filter(station => station.fuels && station.fuels.length > 0);
    }

    // Sort stations
    if (filters.sortBy === 'latest') {
      filtered = [...filtered].sort((a, b) => {
        const latestA = a.fuels && a.fuels.length > 0 ? Math.max(...a.fuels.map(getFuelTimestamp)) : 0;
        const latestB = b.fuels && b.fuels.length > 0 ? Math.max(...b.fuels.map(getFuelTimestamp)) : 0;
        return latestB - latestA;
      });
    } else if (filters.sortBy === 'cheapest') {
      filtered = [...filtered].sort((a, b) => {
        const avgPriceA = a.fuels && a.fuels.length > 0 ? a.fuels.reduce((sum, f) => sum + (f.price || 0), 0) / a.fuels.length : 0;
        const avgPriceB = b.fuels && b.fuels.length > 0 ? b.fuels.reduce((sum, f) => sum + (f.price || 0), 0) / b.fuels.length : 0;
        return avgPriceA - avgPriceB;
      });
    } else if (filters.sortBy === 'nearest' && currentLocation) {
      filtered = [...filtered].sort((a, b) => {
        const distanceA = a.fuels?.[0]?.lat && a.fuels?.[0]?.lon
          ? haversineMeters(currentLocation, {
              latitude: a.fuels[0].lat,
              longitude: a.fuels[0].lon,
            })
          : Infinity;
        const distanceB = b.fuels?.[0]?.lat && b.fuels?.[0]?.lon
          ? haversineMeters(currentLocation, {
              latitude: b.fuels[0].lat,
              longitude: b.fuels[0].lon,
            })
          : Infinity;
        return distanceA - distanceB;
      });
    }

    // Sort fuels within each station (always in order: 95, 98, Diesel)
    filtered = filtered.map(station => ({
      ...station,
      fuels: station.fuels ? [...station.fuels].sort((a, b) => {
        return getFuelSortOrder(a.fuel_type) - getFuelSortOrder(b.fuel_type);
      }) : []
    }));

    setFilteredData(filtered);
  }, [data, filters, currentLocation]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title} variant="headlineSmall">
          Hinnat
        </Text>
        <View style={styles.buttonRow}>
          <Button mode="contained" onPress={() => navigation.getParent()?.navigate('Filter')}>
            Suodata
          </Button>
          <Button 
            mode="contained" 
            onPress={() => setShowBonuses(true)}
            buttonColor="#FFD700"
          >
            Bonukset
          </Button>
        </View>
      </View>

      <Portal>
        <Modal
          visible={showBonuses}
          onDismiss={() => setShowBonuses(false)}
          contentContainerStyle={styles.modalContent}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Bonukset ja tarjoukset</Text>
            <Button onPress={() => setShowBonuses(false)} buttonColor={brandColors.forestSoft} textColor="#FFFFFF">Sulje</Button>
          </View>

          <ScrollView style={styles.bonusesContainer}>
            <View style={styles.bonusCard}>
              <Text style={styles.bonusStation}>ABC</Text>
              <Text style={styles.bonusPrice}>S-etukortilla tankkausbonus jopa 5 snt/l</Text>
              <Text style={styles.bonusDescription}>S-etukortilla S-ryhmän bonustaulukon mukaan (0,5 % - 5 %).</Text>
            </View>

            <View style={styles.bonusCard}>
              <Text style={styles.bonusStation}>Neste</Text>
              <Text style={styles.bonusPrice}>2 snt/l alennus</Text>
              <Text style={styles.bonusDescription}>Vaatii Neste app sovelluksen</Text>
            </View>

            <View style={styles.bonusCard}>
              <Text style={styles.bonusStation}>St1</Text>
              <Text style={styles.bonusPrice}>2 snt/l alennus</Text>
              <Text style={styles.bonusDescription}>Vaatii St1 Way -sovelluksen</Text>
            </View>
          </ScrollView>
        </Modal>
      </Portal>

      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={item => item.station_name}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          renderItem={({ item }) => {
            const distance = currentLocation && item.fuels?.[0]?.lat && item.fuels?.[0]?.lon
              ? haversineMeters(currentLocation, {
                  latitude: item.fuels[0].lat,
                  longitude: item.fuels[0].lon,
                })
              : null;

            return (
              <Card mode="contained" style={styles.card}>
                <Card.Content>
                  <View style={styles.stationHeader}>
                    <Text style={styles.station}>{item.station_name}</Text>
                    {distance !== null && (
                      <Text style={styles.distance}>{formatDistance(distance)}</Text>
                    )}
                  </View>

                  {item.fuels && item.fuels.map(fuel => (
                    <View key={getFuelGroupingKey(fuel)} style={styles.fuelRow}>
                      <Text style={styles.fuelType}>{formatFuelType(fuel.fuel_type)}</Text>
                      <Text style={styles.price}>{fuel.price ? Number(fuel.price).toFixed(3) : 'N/A'} €</Text>
                    </View>
                  ))}

                  <Text style={styles.updated}>
                    Päivitetty: {getUpdatedText(getLatestFuel(item.fuels))}
                  </Text>
                </Card.Content>
              </Card>
            );
          }}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#EAF7F1',
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  header: {
    flexDirection: 'column',
    marginBottom: 12,
  },

  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },

  title: {
    color: brandColors.forest,
    fontWeight: '700',
  },

  modalContent: {
    backgroundColor: '#F9FFFC',
    margin: 16,
    borderRadius: 16,
    padding: 0,
    maxHeight: '80%',
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: brandColors.forestSoft,
  },

  bonusesContainer: {
    padding: 16,
  },

  bonusCard: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },

  bonusStation: {
    fontSize: 16,
    fontWeight: '700',
    color: brandColors.forest,
    marginBottom: 4,
  },

  bonusPrice: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },

  bonusDescription: {
    fontSize: 13,
    color: brandColors.forestSoft,
    lineHeight: 19,
  },

  card: {
    backgroundColor: '#F9FFFC',
    borderRadius: 20,
    marginBottom: 10,
  },

  stationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },

  station: {
    fontWeight: '700',
    color: brandColors.forest,
    fontSize: 16,
    flex: 1,
  },

  distance: {
    fontWeight: '600',
    color: brandColors.forestSoft,
    fontSize: 14,
    marginLeft: 8,
  },

  fuelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },

  fuelType: {
    fontWeight: '600',
    color: brandColors.forestSoft,
  },

  price: {
    fontWeight: '600',
    color: brandColors.forest,
  },

  updated: {
    color: brandColors.forestSoft,
    fontSize: 12,
    marginTop: 6,
  },
});
