import { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FAB } from "react-native-paper";
import { getRefuelHistory } from "../storage/refuelStorage";
import { brandColors } from "../theme";

interface RefuelEntry {
  id: string;
  date: string;
  station: string;
  fuelType: string;
  liters: number;
  pricePerLiter: number;
  totalPrice: number;
}

interface RefuelHistoryProps {
  navigation: {
    navigate: (screen: "AddRefuel") => void;
  };
}

export default function RefuelHistory({ navigation }: RefuelHistoryProps) {
  const [history, setHistory] = useState<RefuelEntry[]>([]);

  useEffect(() => {
    const load = async () => {
      const data = await getRefuelHistory();
      setHistory(data.reverse());
    };
    load();
  }, []);

  const thisMonth = new Date().getMonth();
  const monthEntries = history.filter(
    (e) => new Date(e.date).getMonth() === thisMonth
  );

  const totalSpent = monthEntries.reduce((sum, e) => sum + e.totalPrice, 0);
  const totalLiters = monthEntries.reduce((sum, e) => sum + e.liters, 0);
  const avgPrice = totalLiters > 0 ? totalSpent / totalLiters : 0;

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={styles.container}>
        <Text style={styles.header}>Tankkaushistoria</Text>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Tämä kuukausi</Text>

          <Text style={styles.summaryMoney}>{totalSpent.toFixed(0)}€</Text>
          <Text style={styles.summarySub}>Yhteensä {totalLiters.toFixed(0)} L</Text>
          <Text style={styles.summarySub}>Keskihinta {avgPrice.toFixed(2)} €/l</Text>
        </View>

        <View style={styles.listHeaderRow}>
          <Text style={styles.listHeader}>Viimeisimmät tapahtumat</Text>
          <TouchableOpacity>
            <Text style={styles.showAll}>Näytä kaikki</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={history.slice(0, 10)}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.entryCard}>
              <Text style={styles.station}>{item.station}</Text>
              <Text style={styles.date}>
                {new Date(item.date).toLocaleDateString("fi-FI")}
              </Text>

              <Text style={styles.detail}>Määrä {item.liters} L</Text>
              <Text style={styles.detail}>Hinta {item.pricePerLiter.toFixed(2)} €/l</Text>

              <Text style={styles.totalPrice}>{item.totalPrice.toFixed(0)}€</Text>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 120 }}
        />

        <FAB
          icon="plus"
          style={styles.fab}
          onPress={() => navigation.navigate("AddRefuel")}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#EAF7F1",
    padding: 16,
  },
  header: {
    fontSize: 24,
    fontWeight: "700",
    color: brandColors.forest,
    marginBottom: 16,
  },
  summaryCard: {
    backgroundColor: "#F9FFFC",
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: brandColors.forestSoft,
  },
  summaryMoney: {
    fontSize: 32,
    fontWeight: "700",
    color: brandColors.forest,
    marginTop: 4,
  },
  summarySub: {
    fontSize: 14,
    color: brandColors.forestSoft,
  },
  listHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  listHeader: {
    fontSize: 18,
    fontWeight: "700",
    color: brandColors.forest,
  },
  showAll: {
    color: brandColors.forestSoft,
    fontWeight: "600",
  },
  entryCard: {
    backgroundColor: "#F9FFFC",
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
  },
  station: {
    fontSize: 16,
    fontWeight: "700",
    color: brandColors.forest,
  },
  date: {
    color: brandColors.forestSoft,
    marginBottom: 6,
  },
  detail: {
    color: brandColors.forestSoft,
  },
  totalPrice: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: "700",
    color: brandColors.forest,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    backgroundColor: brandColors.forest,
  },
});
