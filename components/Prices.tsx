import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Text, Button } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { brandColors } from '../theme';
import { useEffect, useState, useCallback } from 'react';

type FuelPrice = {
  station_name: string
  fuel_type: string
  price: number
  updated_text: string
}

type StationGroup = {
  station_name: string
  fuels: FuelPrice[]
}

type Filters = {
  fuelTypes: string[];
  sortBy: 'latest' | 'oldest' | 'cheapest' | 'mostExpensive';
}

export default function PricesScreen() {
  const [data, setData] = useState<StationGroup[]>([]);
  const [filteredData, setFilteredData] = useState<StationGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({ fuelTypes: [], sortBy: 'latest' });
  const navigation = useNavigation();

  const API_KEY = process.env.EXPO_PUBLIC_DATABASE_API_KEY
  const API_URL = 'http://204.168.156.110:3000/api/all';

  useEffect(() => {
    fetch(API_URL, {
      headers: {
        'x-api-key': API_KEY,
      },
    })
      .then(res => res.json())
      .then((json: FuelPrice[]) => {
        const grouped: { [key: string]: FuelPrice[] } = {};
        json.forEach(item => {
          if (item.station_name) {
            if (!grouped[item.station_name]) grouped[item.station_name] = [];
            grouped[item.station_name].push(item);
          }
        });

        const result: StationGroup[] = Object.keys(grouped).map(station => ({
          station_name: station,
          fuels: grouped[station],
        }));

        setData(result);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

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
    }, [])
  );

  useEffect(() => {
    let filtered = data;

    // Filter by fuel types
    if (filters.fuelTypes.length > 0) {
      filtered = filtered.map(station => ({
        ...station,
        fuels: station.fuels.filter(fuel => fuel.fuel_type && filters.fuelTypes.includes(fuel.fuel_type))
      })).filter(station => station.fuels && station.fuels.length > 0);
    }

    // Sort stations
    if (filters.sortBy === 'latest' || filters.sortBy === 'oldest') {
      filtered = filtered.sort((a, b) => {
        const latestA = a.fuels && a.fuels.length > 0 ? Math.max(...a.fuels.map(f => f.updated_text ? new Date(f.updated_text).getTime() : 0)) : 0;
        const latestB = b.fuels && b.fuels.length > 0 ? Math.max(...b.fuels.map(f => f.updated_text ? new Date(f.updated_text).getTime() : 0)) : 0;
        return filters.sortBy === 'latest' ? latestB - latestA : latestA - latestB;
      });
    } else if (filters.sortBy === 'cheapest' || filters.sortBy === 'mostExpensive') {
      filtered = filtered.sort((a, b) => {
        const avgPriceA = a.fuels && a.fuels.length > 0 ? a.fuels.reduce((sum, f) => sum + (f.price || 0), 0) / a.fuels.length : 0;
        const avgPriceB = b.fuels && b.fuels.length > 0 ? b.fuels.reduce((sum, f) => sum + (f.price || 0), 0) / b.fuels.length : 0;
        return filters.sortBy === 'cheapest' ? avgPriceA - avgPriceB : avgPriceB - avgPriceA;
      });
    }

    // Sort fuels within each station
    filtered = filtered.map(station => ({
      ...station,
      fuels: station.fuels ? [...station.fuels].sort((a, b) => {
        if (filters.sortBy === 'latest' || filters.sortBy === 'oldest') {
          const dateA = a.updated_text ? new Date(a.updated_text).getTime() : 0;
          const dateB = b.updated_text ? new Date(b.updated_text).getTime() : 0;
          return filters.sortBy === 'latest' ? dateB - dateA : dateA - dateB;
        } else {
          const priceA = a.price || 0;
          const priceB = b.price || 0;
          return filters.sortBy === 'cheapest' ? priceA - priceB : priceB - priceA;
        }
      }) : []
    }));

    setFilteredData(filtered);
  }, [data, filters]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title} variant="headlineSmall">
          Hinnat
        </Text>
        <Button mode="contained" onPress={() => navigation.getParent()?.navigate('Filter')}>
          Suodata
        </Button>
      </View>

      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={item => item.station_name}
          renderItem={({ item }) => (
            <Card mode="contained" style={styles.card}>
              <Card.Content>
                <Text style={styles.station}>{item.station_name}</Text>

                {item.fuels && item.fuels.map(fuel => (
                  <View key={fuel.fuel_type} style={styles.fuelRow}>
                    <Text style={styles.fuelType}>{fuel.fuel_type}</Text>
                    <Text style={styles.price}>{fuel.price ? Number(fuel.price).toFixed(3) : 'N/A'} €</Text>
                  </View>
                ))}

                <Text style={styles.updated}>
                  Päivitetty: {item.fuels && item.fuels[0] ? item.fuels[0].updated_text : 'N/A'}
                </Text>
              </Card.Content>
            </Card>
          )}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  title: {
    color: brandColors.forest,
    fontWeight: '700',
  },

  card: {
    backgroundColor: '#F9FFFC',
    borderRadius: 20,
    marginBottom: 10,
  },

  station: {
    fontWeight: '700',
    color: brandColors.forest,
    fontSize: 16,
    marginBottom: 8,
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
