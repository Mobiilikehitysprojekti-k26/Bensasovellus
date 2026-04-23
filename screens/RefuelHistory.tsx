import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { FAB, IconButton } from "react-native-paper";
import { deleteRefuel, getRefuelHistory, type RefuelEntry } from "../storage/refuelStorage";
import { brandColors } from "../theme";

const INITIAL_VISIBLE_ITEMS = 4;

interface RefuelHistoryProps {
  navigation: {
    goBack: () => void;
    navigate: (screen: "AddRefuel", params?: { entry?: RefuelEntry }) => void;
  };
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("fi-FI");
}

export default function RefuelHistory({ navigation }: RefuelHistoryProps) {
  const [history, setHistory] = useState<RefuelEntry[]>([]);
  const [showAll, setShowAll] = useState(false);

  const loadHistory = useCallback(async () => {
    const data = await getRefuelHistory();
    const sortedHistory = [...data].sort(
      (first, second) => new Date(second.date).getTime() - new Date(first.date).getTime()
    );
    setHistory(sortedHistory);
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory])
  );

  const handleDelete = (entry: RefuelEntry) => {
    Alert.alert(
      "Poista tankkaus",
      `Poistetaanko tankkaus ${entry.station}:sta (${formatDate(entry.date)})?`,
      [
        {
          text: "Peruuta",
          style: "cancel",
        },
        {
          text: "Poista",
          style: "destructive",
          onPress: async () => {
            await deleteRefuel(entry.id);
            await loadHistory();
          },
        },
      ]
    );
  };

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthEntries = useMemo(
    () =>
      history.filter((entry) => {
        const entryDate = new Date(entry.date);
        return entryDate.getMonth() === currentMonth && entryDate.getFullYear() === currentYear;
      }),
    [currentMonth, currentYear, history]
  );

  const totalSpent = monthEntries.reduce((sum, entry) => sum + entry.totalPrice, 0);
  const totalLiters = monthEntries.reduce((sum, entry) => sum + entry.liters, 0);
  const avgPrice = totalLiters > 0 ? totalSpent / totalLiters : 0;

  const visibleHistory = showAll ? history : history.slice(0, INITIAL_VISIBLE_ITEMS);
  const hasMoreHistory = history.length > INITIAL_VISIBLE_ITEMS;
  const hiddenItemsCount = Math.max(0, history.length - INITIAL_VISIBLE_ITEMS);
  const showToggleLabel = showAll
    ? "Näytä vähemmän"
    : `Näytä enemmän (${hiddenItemsCount})`;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
      <View style={styles.headerRow}>
        <IconButton
          icon="chevron-left"
          iconColor="#222222"
          onPress={() => navigation.goBack()}
          size={28}
          style={styles.backButton}
        />
        <Text style={styles.headerTitle}>Tankkaushistoria</Text>
      </View>

      <FlatList
        contentContainerStyle={styles.listContent}
        data={visibleHistory}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Ei vielä tankkauksia</Text>
            <Text style={styles.emptyText}>Lisää ensimmäinen tankkaus oikean alakulman plus-painikkeesta.</Text>
          </View>
        }
        ListHeaderComponent={
          <View>
            <View style={styles.summaryCard}>
              <View style={styles.summaryAccentLine} />

              <View style={styles.summaryTop}>
                <View>
                  <Text style={styles.summaryTitle}>TÄMÄ KUUKAUSI</Text>
                  <Text style={styles.summaryTotal}>{totalSpent.toFixed(0)}€</Text>
                </View>

                <View style={styles.summaryTrendCircle}>
                  <MaterialCommunityIcons color={brandColors.forestSoft} name="trending-up" size={30} />
                </View>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryBottom}>
                <View style={styles.summaryStatBlock}>
                  <View style={styles.summaryIconCircle}>
                    <MaterialCommunityIcons color={brandColors.forestSoft} name="water-outline" size={21} />
                  </View>

                  <View>
                    <Text style={styles.summaryStatLabel}>Yhteensä</Text>
                    <Text style={styles.summaryStatValue}>{totalLiters.toFixed(0)} L</Text>
                  </View>
                </View>

                <View style={styles.summaryStatBlock}>
                  <View style={styles.summaryIconCircle}>
                    <MaterialCommunityIcons color={brandColors.forestSoft} name="gas-station-outline" size={21} />
                  </View>

                  <View>
                    <Text style={styles.summaryStatLabel}>Keskihinta</Text>
                    <Text style={styles.summaryStatValue}>{avgPrice.toFixed(2)} €/l</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>VIIMEISIMMÄT TAPAHTUMAT</Text>

            </View>
            {hasMoreHistory ? (
              <TouchableOpacity
                activeOpacity={0.86}
                onPress={() => setShowAll((current) => !current)}
                style={[
                  styles.showToggleButton,
                  showAll ? styles.showToggleButtonExpanded : null,
                ]}
              >
                <MaterialCommunityIcons
                  color={showAll ? brandColors.forest : "#FFFFFF"}
                  name={showAll ? "chevron-up" : "chevron-down"}
                  size={18}
                />
                <Text
                  style={[
                    styles.showToggleText,
                    showAll ? styles.showToggleTextExpanded : null,
                  ]}
                >
                  {showToggleLabel}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.9}
            onLongPress={() => handleDelete(item)}
            onPress={() => navigation.navigate("AddRefuel", { entry: item })}
            style={styles.entryCard}
          >
            <View style={styles.entryHeaderRow}>
              <View style={styles.entryMain}>
                <View style={styles.stationCircle}>
                  <MaterialCommunityIcons color={brandColors.forestSoft} name="map-marker-outline" size={20} />
                </View>

                <View style={styles.entryMainText}>
                  <Text style={styles.stationName}>{item.station}</Text>

                  <View style={styles.dateRow}>
                    <MaterialCommunityIcons color="#7B7B73" name="calendar-blank-outline" size={16} />
                    <Text style={styles.dateText}>{formatDate(item.date)}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.entrySideColumn}>
                <View style={styles.priceBadge}>
                  <Text style={styles.priceBadgeText}>{item.totalPrice.toFixed(0)}€</Text>
                </View>
                <MaterialCommunityIcons color="#B7B7AF" name="chevron-right" size={24} />
              </View>
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metricBlock}>
                <Text style={styles.metricLabel}>MÄÄRÄ</Text>
                <Text style={styles.metricValue}>{item.liters.toFixed(0)} L</Text>
              </View>

              <View style={styles.metricBlock}>
                <Text style={styles.metricLabel}>HINTA/L</Text>
                <Text style={styles.metricValue}>{item.pricePerLiter.toFixed(2)} €/l</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />

      <FAB color="#FFFFFF" icon="plus" onPress={() => navigation.navigate("AddRefuel")} style={styles.fab} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#F7F7F2",
    flex: 1,
  },
  headerRow: {
    alignItems: "center",
    borderBottomColor: "#DADAD4",
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingBottom: 12,
    paddingHorizontal: 14,
    paddingTop: 6,
  },
  backButton: {
    margin: 0,
  },
  headerTitle: {
    color: brandColors.forest,
    fontSize: 20,
    fontWeight: "800",
    marginLeft: 8,
  },
  listContent: {
    paddingBottom: 120,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#EBEBE6",
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 28,
    overflow: "hidden",
    padding: 20,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  summaryAccentLine: {
    backgroundColor: brandColors.mint,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: 6,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  summaryTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryTitle: {
    color: brandColors.forestSoft,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  summaryTotal: {
    color: brandColors.forest,
    fontSize: 26,
    fontWeight: "900",
    marginTop: 4,
  },
  summaryTrendCircle: {
    alignItems: "center",
    backgroundColor: "#E8F8EF",
    borderRadius: 40,
    height: 80,
    justifyContent: "center",
    width: 80,
  },
  summaryDivider: {
    backgroundColor: "#E8E8E3",
    height: 1,
    marginVertical: 16,
  },
  summaryBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryStatBlock: {
    alignItems: "center",
    flexDirection: "row",
    width: "47%",
  },
  summaryIconCircle: {
    alignItems: "center",
    backgroundColor: "#F2F2EF",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    marginRight: 10,
    width: 36,
  },
  summaryStatLabel: {
    color: "#7A7A73",
    fontSize: 14,
    fontWeight: "500",
  },
  summaryStatValue: {
    color: brandColors.forest,
    fontSize: 19,
    fontWeight: "700",
    marginTop: 1,
  },
  sectionHeaderRow: {
    marginBottom: 10,
  },
  sectionTitle: {
    color: "#686860",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  showToggleButton: {
    alignSelf: "flex-start",
    alignItems: "center",
    backgroundColor: brandColors.forest,
    borderRadius: 999,
    flexDirection: "row",
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  showToggleButtonExpanded: {
    backgroundColor: "#E8F8EF",
    borderColor: brandColors.forestSoft,
    borderWidth: 1,
  },
  showToggleText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    marginLeft: 4,
  },
  showToggleTextExpanded: {
    color: brandColors.forest,
  },
  entryCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#EBEBE6",
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  entryHeaderRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  entryMain: {
    flexDirection: "row",
    flexShrink: 1,
  },
  stationCircle: {
    alignItems: "center",
    backgroundColor: "#EDFAF1",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  entryMainText: {
    marginLeft: 10,
  },
  stationName: {
    color: "#20201D",
    fontSize: 16,
    fontWeight: "800",
    maxWidth: 190,
  },
  dateRow: {
    alignItems: "center",
    flexDirection: "row",
    marginTop: 2,
  },
  dateText: {
    color: "#7B7B73",
    fontSize: 14,
    marginLeft: 5,
  },
  entrySideColumn: {
    alignItems: "flex-end",
    justifyContent: "space-between",
    minHeight: 66,
  },
  priceBadge: {
    backgroundColor: "#DFF4E8",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  priceBadgeText: {
    color: brandColors.forest,
    fontSize: 15,
    fontWeight: "800",
  },
  metricsRow: {
    flexDirection: "row",
    marginLeft: 54,
    marginTop: 10,
  },
  metricBlock: {
    marginRight: 20,
  },
  metricLabel: {
    color: "#7B7B73",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  metricValue: {
    color: "#222222",
    fontSize: 17,
    fontWeight: "700",
    marginTop: 1,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#EBEBE6",
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 10,
    padding: 18,
  },
  emptyTitle: {
    color: "#222222",
    fontSize: 18,
    fontWeight: "700",
  },
  emptyText: {
    color: "#6F6F67",
    fontSize: 15,
    marginTop: 6,
  },
  fab: {
    backgroundColor: brandColors.forest,
    borderRadius: 34,
    bottom: 24,
    position: "absolute",
    right: 24,
  },
});
