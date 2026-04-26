import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  InputAccessoryView,
  Keyboard,
  Platform,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Button,
  HelperText,
  IconButton,
  Modal,
  Portal,
  SegmentedButtons,
  Text,
  TextInput,
} from "react-native-paper";
import * as Location from "expo-location";
import {
  getRefuelHistory,
  saveRefuel,
  updateRefuel,
  type RefuelEconomics,
  type RefuelEntry,
} from "../storage/refuelStorage";
import { getRegisteredUser } from "../storage/authStorage";
import { getProfilePreferences } from "../storage/profileStorage";
import {
  calculateRefuelEconomics,
  type RefuelEconomicsFuelType,
} from "../services/refuelEconomics";
import { brandColors } from "../theme";

const STATION_API_URL = "http://204.168.156.110:3000/api/all";
const FALLBACK_STATIONS = [
  "ABC Kaakkuri",
  "Neste Limingantulli",
  "Teboil Oulu",
  "St1 Hiironen",
  "Shell Oulu",
];
const NUMERIC_KEYBOARD_ACCESSORY_ID = "add-refuel-numeric-keyboard";

type StationApiItem = {
  station_name?: string | null;
};

function normalizeFuelType(value: string): RefuelEconomicsFuelType | null {
  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === "95") {
    return "95";
  }

  if (normalizedValue === "98") {
    return "98";
  }

  if (normalizedValue === "diesel") {
    return "diesel";
  }

  return null;
}

function parseCombinedConsumption(value: string): number | null {
  const normalizedValue = value.trim().replace(",", ".");
  const parsedValue = Number.parseFloat(normalizedValue);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return parsedValue;
}

function createEconomicsFallback(status: RefuelEconomics["status"]): RefuelEconomics {
  return {
    evaluatedAt: new Date().toISOString(),
    status,
    version: 1,
  };
}

async function resolveRefuelEconomics(params: {
  actualPricePerLiter: number;
  fuelType: string;
  liters: number;
  station: string;
}): Promise<RefuelEconomics> {
  const normalizedFuelType = normalizeFuelType(params.fuelType);
  if (!normalizedFuelType) {
    return createEconomicsFallback("network_error");
  }

  const user = await getRegisteredUser();
  if (!user?.email) {
    return createEconomicsFallback("missing_consumption");
  }

  const preferences = await getProfilePreferences(user.email);
  const combinedConsumption = preferences
    ? parseCombinedConsumption(preferences.combinedConsumption)
    : null;

  if (combinedConsumption === null) {
    return createEconomicsFallback("missing_consumption");
  }

  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      return await calculateRefuelEconomics({
        actualPricePerLiter: params.actualPricePerLiter,
        combinedConsumption,
        fuelType: normalizedFuelType,
        liters: params.liters,
        selectedStationName: params.station,
      });
    }

    const currentPosition = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return await calculateRefuelEconomics({
      actualPricePerLiter: params.actualPricePerLiter,
      combinedConsumption,
      fuelType: normalizedFuelType,
      liters: params.liters,
      origin: {
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
      },
      selectedStationName: params.station,
    });
  } catch (error) {
    console.error("Failed to resolve location for refuel economics", error);
    return await calculateRefuelEconomics({
      actualPricePerLiter: params.actualPricePerLiter,
      combinedConsumption,
      fuelType: normalizedFuelType,
      liters: params.liters,
      selectedStationName: params.station,
    });
  }
}

export default function AddRefuel({ navigation, route }: any) {
  const [station, setStation] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [liters, setLiters] = useState("");
  const [pricePerLiter, setPricePerLiter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<string>(new Date().toISOString());

  const [stationPickerVisible, setStationPickerVisible] = useState(false);
  const [stationSearch, setStationSearch] = useState("");
  const [stationOptions, setStationOptions] = useState<string[]>([]);
  const [isLoadingStations, setIsLoadingStations] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [isManualStationMode, setIsManualStationMode] = useState(false);
  const [manualStationInput, setManualStationInput] = useState("");
  const [manualStationError, setManualStationError] = useState<string | null>(null);

  const isEditing = route?.params?.entry !== undefined;
  const entry = route?.params?.entry as RefuelEntry | undefined;

  useEffect(() => {
    if (!entry) {
      return;
    }

    setEditingId(entry.id);
    setStation(entry.station);
    setFuelType(entry.fuelType);
    setLiters(entry.liters.toString());
    setPricePerLiter(entry.pricePerLiter.toString());
    setEditingDate(entry.date);
  }, [entry]);

  useEffect(() => {
    let isMounted = true;

    const loadStationOptions = async () => {
      setIsLoadingStations(true);

      try {
        const [history, apiStations] = await Promise.all([getRefuelHistory(), fetchStationsFromApi()]);

        if (!isMounted) {
          return;
        }

        const historyStations = history
          .map((item) => item.station.trim())
          .filter((item) => item.length > 0);

        const combined = Array.from(new Set([...apiStations, ...historyStations, ...FALLBACK_STATIONS])).sort(
          (first, second) => first.localeCompare(second, "fi")
        );

        setStationOptions(combined);
      } catch {
        if (!isMounted) {
          return;
        }

        const fallback = Array.from(new Set(FALLBACK_STATIONS)).sort((first, second) =>
          first.localeCompare(second, "fi")
        );
        setStationOptions(fallback);
      } finally {
        if (isMounted) {
          setIsLoadingStations(false);
        }
      }
    };

    void loadStationOptions();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!entry?.station) {
      return;
    }

    setStationOptions((current) => {
      if (current.includes(entry.station)) {
        return current;
      }

      return [...current, entry.station].sort((first, second) => first.localeCompare(second, "fi"));
    });
  }, [entry?.station]);

  const filteredStationOptions = useMemo(() => {
    const query = stationSearch.trim().toLowerCase();

    if (!query) {
      return stationOptions;
    }

    return stationOptions.filter((item) => item.toLowerCase().includes(query));
  }, [stationOptions, stationSearch]);

  const formattedDate = new Date(editingDate).toLocaleDateString("fi-FI");

  const closeStationPicker = () => {
    setStationPickerVisible(false);
    setStationSearch("");
    setIsManualStationMode(false);
    setManualStationInput("");
    setManualStationError(null);
  };

  const handleDateChange = (offset: number) => {
    const nextDate = new Date(editingDate);
    nextDate.setDate(nextDate.getDate() + offset);
    setEditingDate(nextDate.toISOString());
  };

  const handleSelectStation = (selectedStation: string) => {
    setStation(selectedStation);
    setFormError(null);
    closeStationPicker();
  };

  const handleUseManualStation = () => {
    const trimmedStation = manualStationInput.trim();

    if (trimmedStation.length < 2) {
      setManualStationError("Anna aseman nimi.");
      return;
    }

    setStation(trimmedStation);
    setStationOptions((current) => {
      if (current.includes(trimmedStation)) {
        return current;
      }

      return [...current, trimmedStation].sort((first, second) => first.localeCompare(second, "fi"));
    });
    setFormError(null);
    closeStationPicker();
  };

  const handleSave = async () => {
    if (!station) {
      setFormError("Valitse tankkausasema listasta.");
      return;
    }

    if (!fuelType) {
      setFormError("Valitse polttoaine.");
      return;
    }

    if (!liters || !pricePerLiter) {
      setFormError("Täytä litrat ja hinta.");
      return;
    }

    const litersValue = Number.parseFloat(liters.replace(",", "."));
    const priceValue = Number.parseFloat(pricePerLiter.replace(",", "."));

    if (!Number.isFinite(litersValue) || litersValue <= 0) {
      setFormError("Litrojen pitää olla positiivinen numero.");
      return;
    }

    if (!Number.isFinite(priceValue) || priceValue <= 0) {
      setFormError("Hinnan pitää olla positiivinen numero.");
      return;
    }

    setFormError(null);

    const economics = await resolveRefuelEconomics({
      actualPricePerLiter: priceValue,
      fuelType,
      liters: litersValue,
      station,
    });

    const entryData: RefuelEntry = {
      id: editingId || Date.now().toString(),
      date: editingDate,
      station,
      fuelType,
      liters: litersValue,
      pricePerLiter: priceValue,
      totalPrice: litersValue * priceValue,
      economics,
    };

    if (isEditing && editingId) {
      await updateRefuel(editingId, entryData);
    } else {
      await saveRefuel(entryData);
    }

    navigation.navigate("RefuelHistory");
  };

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
        <Text style={styles.headerTitle}>{isEditing ? "Muokkaa tankkausta" : "Lisää tankkaus"}</Text>
      </View>

      <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
        <View style={styles.content}>
          <View style={styles.formCard}>
          <Text style={styles.fieldLabel}>PÄIVÄMÄÄRÄ</Text>
          <View style={styles.dateButtonRow}>
            <IconButton
              icon="chevron-left"
              size={24}
              iconColor={brandColors.forest}
              onPress={() => handleDateChange(-1)}
              style={styles.dateArrow}
            />
            <Text style={styles.dateLargeText}>{formattedDate}</Text>
            <IconButton
              icon="chevron-right"
              size={24}
              iconColor={brandColors.forest}
              onPress={() => handleDateChange(1)}
              style={styles.dateArrow}
            />
          </View>

          <Text style={styles.fieldLabel}>TANKKAUSASEMA</Text>
          <TouchableOpacity activeOpacity={0.85} onPress={() => setStationPickerVisible(true)} style={styles.stationSelector}>
            <View style={styles.stationSelectorLeft}>
              <MaterialCommunityIcons color={brandColors.forestSoft} name="map-marker-outline" size={20} />
              <Text style={station ? styles.stationValue : styles.stationPlaceholder}>{station || "Valitse asema"}</Text>
            </View>
            <MaterialCommunityIcons color="#9A9A93" name="chevron-down" size={22} />
          </TouchableOpacity>

          <Text style={styles.fieldLabel}>POLTTOAINE</Text>
          <SegmentedButtons
            buttons={[
              { value: "95", label: "95" },
              { value: "98", label: "98" },
              { value: "Diesel", label: "Diesel" },
            ]}
            onValueChange={(value) => {
              setFuelType(value);
              setFormError(null);
            }}
            style={styles.segmentedButtons}
            value={fuelType}
          />

            <TextInput
              blurOnSubmit
              inputAccessoryViewID={Platform.OS === "ios" ? NUMERIC_KEYBOARD_ACCESSORY_ID : undefined}
              keyboardType="decimal-pad"
              label="Litrat"
              mode="outlined"
              onChangeText={(value) => {
                setLiters(value);
                setFormError(null);
              }}
              onSubmitEditing={Keyboard.dismiss}
              outlineStyle={styles.inputOutline}
              returnKeyType="done"
              style={styles.inputSpacing}
              value={liters}
            />

            <TextInput
              blurOnSubmit
              inputAccessoryViewID={Platform.OS === "ios" ? NUMERIC_KEYBOARD_ACCESSORY_ID : undefined}
              keyboardType="decimal-pad"
              label="€/litra"
              mode="outlined"
              onChangeText={(value) => {
                setPricePerLiter(value);
                setFormError(null);
              }}
              onSubmitEditing={Keyboard.dismiss}
              outlineStyle={styles.inputOutline}
              returnKeyType="done"
              style={styles.inputSpacing}
              value={pricePerLiter}
            />

            <HelperText type="error" visible={Boolean(formError)}>
              {formError ?? " "}
            </HelperText>

            <Button
              mode="contained"
              onPress={() => {
                void handleSave();
              }}
              style={styles.primaryButton}
              buttonColor={brandColors.forest}
              textColor="#FFFFFF"
            >
              {isEditing ? "Päivitä tankkaus" : "Tallenna tankkaus"}
            </Button>
          </View>
        </View>
      </TouchableWithoutFeedback>

      {Platform.OS === "ios" ? (
        <InputAccessoryView nativeID={NUMERIC_KEYBOARD_ACCESSORY_ID}>
          <View style={styles.keyboardAccessory}>
            <TouchableOpacity onPress={Keyboard.dismiss} style={styles.keyboardDoneButton}>
              <Text style={styles.keyboardDoneText}>Valmis</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      ) : null}

      <Portal>
        <Modal contentContainerStyle={styles.modalContainer} onDismiss={closeStationPicker} visible={stationPickerVisible}>
          <Text style={styles.modalTitle}>Valitse tankkausasema</Text>

          <TextInput
            left={<TextInput.Icon icon="magnify" />}
            mode="outlined"
            onChangeText={setStationSearch}
            outlineStyle={styles.inputOutline}
            placeholder="Hae asemaa"
            style={styles.searchInput}
            value={stationSearch}
          />

          {isLoadingStations ? (
            <View style={styles.loaderRow}>
              <ActivityIndicator animating color={brandColors.forest} />
            </View>
          ) : (
            <FlatList
              data={filteredStationOptions}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.emptySearchText}>Ei osumia haulla.</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => handleSelectStation(item)}
                  style={[styles.stationRow, item === station ? styles.stationRowSelected : null]}
                >
                  <Text style={styles.stationRowText}>{item}</Text>
                  {item === station ? <MaterialCommunityIcons color={brandColors.forest} name="check" size={18} /> : null}
                </TouchableOpacity>
              )}
              style={styles.stationList}
            />
          )}

          {!isManualStationMode ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                setIsManualStationMode(true);
                setManualStationError(null);
              }}
              style={styles.manualPromptButton}
            >
              <Text style={styles.manualPromptText}>Etkö löytänyt asemaa? Lisää manuaalisesti</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.manualSection}>
              <TextInput
                label="Aseman nimi"
                mode="outlined"
                onChangeText={(value) => {
                  setManualStationInput(value);
                  setManualStationError(null);
                }}
                outlineStyle={styles.inputOutline}
                value={manualStationInput}
              />

              <HelperText type="error" visible={Boolean(manualStationError)}>
                {manualStationError ?? " "}
              </HelperText>

              <View style={styles.manualButtonsRow}>
                <Button
                  mode="outlined"
                  onPress={() => {
                    setIsManualStationMode(false);
                    setManualStationInput("");
                    setManualStationError(null);
                  }}
                  style={styles.manualButton}
                >
                  Peruuta
                </Button>

                <Button mode="contained" onPress={handleUseManualStation} style={styles.manualButton}>
                  Käytä asemaa
                </Button>
              </View>
            </View>
          )}

          <Button mode="text" onPress={closeStationPicker}>
            Sulje
          </Button>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
}

async function fetchStationsFromApi(): Promise<string[]> {
  const apiKey = process.env.EXPO_PUBLIC_DATABASE_API_KEY;
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  const response = await fetch(STATION_API_URL, { headers });

  if (!response.ok) {
    throw new Error("Asemien haku epäonnistui.");
  }

  const data = (await response.json()) as StationApiItem[];

  if (!Array.isArray(data)) {
    return [];
  }

  return Array.from(
    new Set(
      data
        .map((item) => item.station_name?.trim() ?? "")
        .filter((item) => item.length > 0)
    )
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
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#EBEBE6",
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  fieldLabel: {
    color: "#686860",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
  },
  dateButtonRow: {
    alignItems: "center",
    backgroundColor: "#F7F7F2",
    borderColor: "#E5E5DF",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  dateArrow: {
    margin: 0,
  },
  dateLargeText: {
    color: brandColors.forest,
    fontSize: 17,
    fontWeight: "700",
  },
  stationSelector: {
    alignItems: "center",
    backgroundColor: "#F7F7F2",
    borderColor: "#E5E5DF",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  stationSelectorLeft: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 1,
    marginRight: 8,
  },
  stationPlaceholder: {
    color: "#8E8E86",
    fontSize: 15,
    marginLeft: 8,
  },
  stationValue: {
    color: "#20201D",
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 8,
  },
  segmentedButtons: {
    marginBottom: 12,
  },
  inputSpacing: {
    marginBottom: 10,
  },
  inputOutline: {
    borderRadius: 14,
  },
  primaryButton: {
    borderRadius: 14,
    marginTop: 4,
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    marginHorizontal: 16,
    padding: 16,
  },
  modalTitle: {
    color: "#20201D",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
  },
  searchInput: {
    marginBottom: 10,
  },
  stationList: {
    marginBottom: 8,
    maxHeight: 260,
  },
  stationRow: {
    alignItems: "center",
    borderBottomColor: "#ECECE6",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  stationRowSelected: {
    backgroundColor: "#F4FAF7",
  },
  stationRowText: {
    color: "#222222",
    fontSize: 15,
    fontWeight: "600",
  },
  emptySearchText: {
    color: "#7E7E77",
    paddingVertical: 12,
    textAlign: "center",
  },
  manualPromptButton: {
    borderTopColor: "#ECECE6",
    borderTopWidth: 1,
    paddingVertical: 12,
  },
  manualPromptText: {
    color: brandColors.forestSoft,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  manualSection: {
    borderTopColor: "#ECECE6",
    borderTopWidth: 1,
    marginBottom: 8,
    paddingTop: 10,
  },
  manualButtonsRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  manualButton: {
    flex: 1,
  },
  loaderRow: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  keyboardAccessory: {
    alignItems: "flex-end",
    backgroundColor: "#F4F4F1",
    borderTopColor: "#DADAD4",
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  keyboardDoneButton: {
    backgroundColor: "#FFFFFF",
    borderColor: "#DADAD4",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  keyboardDoneText: {
    color: brandColors.forest,
    fontSize: 14,
    fontWeight: "700",
  },
});
