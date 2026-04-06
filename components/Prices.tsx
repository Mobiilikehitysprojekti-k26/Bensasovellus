import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Text } from 'react-native-paper';
import { brandColors } from '../theme';
import { useEffect, useState } from 'react';

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

export default function PricesScreen() {
  const [data, setData] = useState<StationGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const API_KEY = 'key here';
  const API_URL = `url here`;

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
          if (!grouped[item.station_name]) grouped[item.station_name] = [];
          grouped[item.station_name].push(item);
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

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <Text style={styles.title} variant="headlineSmall">
        Hinnat
      </Text>

      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <FlatList
          data={data}
          keyExtractor={item => item.station_name}
          renderItem={({ item }) => (
            <Card mode="contained" style={styles.card}>
              <Card.Content>
                <Text style={styles.station}>{item.station_name}</Text>

                {item.fuels.map(fuel => (
                  <View key={fuel.fuel_type} style={styles.fuelRow}>
                    <Text style={styles.fuelType}>{fuel.fuel_type}</Text>
                    <Text style={styles.price}>{Number(fuel.price).toFixed(3)} €</Text>
                  </View>
                ))}

                <Text style={styles.updated}>
                  Päivitetty: {item.fuels[0]?.updated_text}
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

  title: {
    color: brandColors.forest,
    fontWeight: '700',
    marginBottom: 12,
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
