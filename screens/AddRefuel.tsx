import { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, TextInput, Button, Menu, IconButton } from "react-native-paper";
import { saveRefuel, updateRefuel } from "../storage/refuelStorage";
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

export default function AddRefuel({ navigation, route }: any) {
  const [station, setStation] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [liters, setLiters] = useState("");
  const [pricePerLiter, setPricePerLiter] = useState("");
  const [menuVisible, setMenuVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<string>(new Date().toISOString());

  const isEditing = route?.params?.entry !== undefined;
  const entry = route?.params?.entry as RefuelEntry | undefined;

  useEffect(() => {
    if (entry) {
      setEditingId(entry.id);
      setStation(entry.station);
      setFuelType(entry.fuelType);
      setLiters(entry.liters.toString());
      setPricePerLiter(entry.pricePerLiter.toString());
      setEditingDate(entry.date);
    }
  }, [entry]);

  const formattedDate = new Date(editingDate).toLocaleDateString("fi-FI");

  const handleDateChange = (offset: number) => {
    const newDate = new Date(editingDate);
    newDate.setDate(newDate.getDate() + offset);
    setEditingDate(newDate.toISOString());
  };

  const handleSave = async () => {
    if (!station || !fuelType || !liters || !pricePerLiter) return;

    const litersValue = parseFloat(liters.replace(",", "."));
    const priceValue = parseFloat(pricePerLiter.replace(",", "."));

    const entryData = {
      id: editingId || Date.now().toString(),
      date: editingDate,
      station,
      fuelType,
      liters: litersValue,
      pricePerLiter: priceValue,
      totalPrice: litersValue * priceValue,
    };

    if (isEditing && editingId) {
      await updateRefuel(editingId, entryData);
    } else {
      await saveRefuel(entryData);
    }
    navigation.navigate("RefuelHistory");
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={styles.container}>
        <View style={styles.dateButtonRow}>
          <IconButton
            icon="chevron-left"
            size={24}
            iconColor={brandColors.forest}
            onPress={() => handleDateChange(-1)}
          />
          <Text style={styles.dateLargeText}>{formattedDate}</Text>
          <IconButton
            icon="chevron-right"
            size={24}
            iconColor={brandColors.forest}
            onPress={() => handleDateChange(1)}
          />
        </View>

        <Text style={styles.title} variant="headlineSmall">
          {isEditing ? "Muokkaa tankkaus" : "Lisää tankkaus"}
        </Text>

        <Text style={styles.dateLabel}>Päivämäärä: {formattedDate}</Text>

        <TextInput
          label="Asema"
          mode="outlined"
          value={station}
          onChangeText={setStation}
          style={styles.input}
        />

        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <TextInput
              label="Polttoainetyyppi"
              mode="outlined"
              value={fuelType}
              style={styles.input}
              onFocus={() => setMenuVisible(true)}
            />
          }
        >
          <Menu.Item onPress={() => { setFuelType("Diesel"); setMenuVisible(false); }} title="Diesel" />
          <Menu.Item onPress={() => { setFuelType("95"); setMenuVisible(false); }} title="95" />
          <Menu.Item onPress={() => { setFuelType("98"); setMenuVisible(false); }} title="98" />
        </Menu>

        <TextInput
          label="Litrat"
          mode="outlined"
          value={liters}
          onChangeText={setLiters}
          keyboardType="numeric"
          style={styles.input}
        />

        <TextInput
          label="€/litra"
          mode="outlined"
          value={pricePerLiter}
          onChangeText={setPricePerLiter}
          keyboardType="numeric"
          style={styles.input}
        />

        <Button
          mode="contained"
          onPress={handleSave}
          style={styles.button}
          buttonColor={brandColors.forest}
          textColor="#FFFFFF"
        >
          {isEditing ? "Päivitä tankkaus" : "Lisää tankkaus"}
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#EAF7F1",
    flex: 1,
    padding: 20,
  },
  title: {
    color: brandColors.forest,
    fontWeight: "700",
    marginBottom: 20,
  },
  dateLabel: {
    color: brandColors.forestSoft,
    marginBottom: 16,
    fontSize: 14,
  },
  dateButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    backgroundColor: "#F9FFFC",
    borderRadius: 8,
    paddingVertical: 8,
  },
  dateLargeText: {
    fontSize: 18,
    fontWeight: "600",
    color: brandColors.forest,
    marginHorizontal: 16,
  },
  input: {
    marginBottom: 14,
    backgroundColor: "#F9FFFC",
  },
  button: {
    marginTop: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
});
