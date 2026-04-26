import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Checkbox, Text } from 'react-native-paper';
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

const FUEL_TYPES = [
  { label: '95', value: '95' },
  { label: '98', value: '98' },
  { label: 'Diesel', value: 'diesel' },
];

const SORT_OPTIONS: Array<{ label: string; value: SortOption }> = [
  { label: 'Ei valintaa', value: 'none' },
  { label: 'Uusin ensin', value: 'latest' },
  { label: 'Halvin ensin', value: 'cheapest' },
  { label: 'Lähimpänä ensin', value: 'nearest' },
];

export default function FilterScreen({ navigation }: FilterProps) {
  const [filters, setFilters] = useState<Filters>({ fuelTypes: [], sortBy: 'latest' });
  const { width } = useWindowDimensions();
  const isNarrow = width < 380;

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
        : [...prev.fuelTypes, fuelType],
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

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Polttoaineet</Text>
            <Text style={styles.sectionHint}>
              {filters.fuelTypes.length > 0 ? `${filters.fuelTypes.length} valittu` : 'Kaikki mukana'}
            </Text>
          </View>

          <View style={[styles.fuelGrid, isNarrow && styles.fuelGridNarrow]}>
            {FUEL_TYPES.map(fuel => {
              const selected = filters.fuelTypes.includes(fuel.value);

              return (
                <Pressable
                  key={fuel.value}
                  onPress={() => toggleFuelType(fuel.value)}
                  style={[styles.choiceTile, selected && styles.choiceTileSelected]}
                >
                  <View pointerEvents="none">
                    <Checkbox status={selected ? 'checked' : 'unchecked'} />
                  </View>
                  <Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>
                    {fuel.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Järjestys</Text>
          <View style={styles.sortOptions}>
            {SORT_OPTIONS.map(option => {
              const selected = filters.sortBy === option.value;

              return (
                <Pressable
                  key={option.value}
                  onPress={() => setFilters(prev => ({ ...prev, sortBy: option.value }))}
                  style={[styles.sortOption, selected && styles.sortOptionSelected]}
                >
                  <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                    {selected && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[styles.sortLabel, selected && styles.choiceLabelSelected]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.buttonContainer, isNarrow && styles.buttonContainerNarrow]}>
          <Button
            mode="outlined"
            onPress={handleClear}
            style={styles.actionButton}
            contentStyle={styles.actionButtonContent}
          >
            Tyhjennä
          </Button>
          <Button
            mode="contained"
            onPress={handleApply}
            style={styles.actionButton}
            contentStyle={styles.actionButtonContent}
          >
            Käytä
          </Button>
        </View>
      </ScrollView>
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
  contentContainer: {
    paddingBottom: 24,
  },
  section: {
    backgroundColor: '#F9FFFC',
    borderColor: brandColors.lightMint,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    padding: 14,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: brandColors.forest,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionHint: {
    color: brandColors.forestSoft,
    fontSize: 13,
    fontWeight: '600',
  },
  fuelGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  fuelGridNarrow: {
    flexDirection: 'column',
  },
  choiceTile: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: brandColors.lightMint,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    minHeight: 50,
    paddingRight: 12,
  },
  choiceTileSelected: {
    backgroundColor: brandColors.whisperMint,
    borderColor: brandColors.forestSoft,
  },
  choiceLabel: {
    color: brandColors.forest,
    fontSize: 16,
    fontWeight: '600',
  },
  choiceLabelSelected: {
    color: brandColors.forest,
    fontWeight: '700',
  },
  sortOptions: {
    gap: 10,
    marginTop: 12,
  },
  sortOption: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: brandColors.lightMint,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 50,
    paddingHorizontal: 14,
  },
  sortOptionSelected: {
    backgroundColor: brandColors.whisperMint,
    borderColor: brandColors.forestSoft,
  },
  radioOuter: {
    alignItems: 'center',
    borderColor: brandColors.outline,
    borderRadius: 10,
    borderWidth: 2,
    height: 20,
    justifyContent: 'center',
    marginRight: 12,
    width: 20,
  },
  radioOuterSelected: {
    borderColor: brandColors.forest,
  },
  radioInner: {
    backgroundColor: brandColors.forest,
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  sortLabel: {
    color: brandColors.forest,
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  buttonContainerNarrow: {
    flexDirection: 'column-reverse',
  },
  actionButton: {
    flex: 1,
  },
  actionButtonContent: {
    minHeight: 46,
  },
});
