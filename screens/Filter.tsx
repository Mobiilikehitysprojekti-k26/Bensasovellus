import { useEffect, useState } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Text, Checkbox, Menu, Divider } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { brandColors } from '../theme';

interface FilterProps {
  navigation: any; // Type this properly if needed
}

type SortOption = 'none' | 'latest' | 'cheapest' | 'nearest';

interface Filters {
  fuelTypes: string[];
  sortBy: SortOption;
}

const FUEL_TYPES = ['95', '98', 'Diesel'];

export default function FilterScreen({ navigation }: FilterProps) {
  const [filters, setFilters] = useState<Filters>({ fuelTypes: [], sortBy: 'latest' });
  const [menuVisible, setMenuVisible] = useState(false);

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

  const toggleFuelType = (fuelType: string) => {
    setFilters(prev => ({
      ...prev,
      fuelTypes: prev.fuelTypes.includes(fuelType)
        ? prev.fuelTypes.filter(f => f !== fuelType)
        : [...prev.fuelTypes, fuelType]
    }));
  };

  const handleApply = async () => {
    try {
      await AsyncStorage.setItem('priceFilters', JSON.stringify(filters));
      navigation.goBack();
    } catch (error) {
      console.error('Error saving filters:', error);
    }
  };

  const handleClear = async () => {
const defaultFilters = { fuelTypes: [], sortBy: 'none' as SortOption };
    setFilters(defaultFilters);
    try {
      await AsyncStorage.removeItem('priceFilters');
    } catch (error) {
      console.error('Error clearing filters:', error);
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <Text style={styles.title} variant="headlineSmall">
        Suodatus
      </Text>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Polttoaineet</Text>
        {FUEL_TYPES.map(fuel => (
          <View key={fuel} style={styles.checkboxRow}>
            <Checkbox
              status={filters.fuelTypes.includes(fuel) ? 'checked' : 'unchecked'}
              onPress={() => toggleFuelType(fuel)}
            />
            <Text style={styles.checkboxLabel}>{fuel}</Text>
          </View>
        ))}

        <Divider style={styles.divider} />

        <Text style={styles.sectionTitle}>Järjestys</Text>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <Button
              mode="outlined"
              onPress={() => setMenuVisible(true)}
              style={styles.menuButton}
            >
              {filters.sortBy === 'none' ? 'Ei valinta' :
               filters.sortBy === 'latest' ? 'Uusin ensin' : 
               filters.sortBy === 'cheapest' ? 'Halvin ensin' : 'Lähimpänä ensin'}
            </Button>
          }
        >
          <Menu.Item
            onPress={() => {
              setFilters(prev => ({ ...prev, sortBy: 'none' }));
              setMenuVisible(false);
            }}
            title="Ei valinta"
          />
          <Menu.Item
            onPress={() => {
              setFilters(prev => ({ ...prev, sortBy: 'latest' }));
              setMenuVisible(false);
            }}
            title="Uusin ensin"
          />
          <Menu.Item
            onPress={() => {
              setFilters(prev => ({ ...prev, sortBy: 'cheapest' }));
              setMenuVisible(false);
            }}
            title="Halvin ensin"
          />
          <Menu.Item
            onPress={() => {
              setFilters(prev => ({ ...prev, sortBy: 'nearest' }));
              setMenuVisible(false);
            }}
            title="Lähimpänä ensin"
          />
        </Menu>
      </ScrollView>

      <View style={styles.buttonContainer}>
        <Button mode="outlined" onPress={handleClear} style={styles.clearButton}>
          Tyhjennä
        </Button>
        <Button mode="contained" onPress={handleApply}>
          Käytä
        </Button>
      </View>
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
  content: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: brandColors.forest,
    marginBottom: 8,
    marginTop: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkboxLabel: {
    marginLeft: 8,
    fontSize: 16,
    color: brandColors.forest,
  },
  divider: {
    marginVertical: 16,
  },
  menuButton: {
    marginTop: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  clearButton: {
    flex: 1,
    marginRight: 8,
  },
});