import { useState } from "react";
import { View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, TextInput, Button, Menu } from "react-native-paper";
import { saveRefuel } from "../storage/refuelStorage";
import { brandColors } from "../theme";

export default function AddRefuel({ navigation }: any) {
  const [station, setStation] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [liters, setLiters] = useState("");
  const [pricePerLiter, setPricePerLiter] = useState("");
  const [menuVisible, setMenuVisible] = useState(false);

  const formattedDate = new Date().toLocaleDateString("fi-FI");

  const handleSave = async () => {
    if (!station || !fuelType || !liters || !pricePerLiter) return;

    const litersValue = parseFloat(liters.replace(",", "."));
    const priceValue = parseFloat(pricePerLiter.replace(",", "."));

    const entry = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      station,
      fuelType,
      liters: litersValue,
      pricePerLiter: priceValue,
      totalPrice: litersValue * priceValue,
    };

    await saveRefuel(entry);
    navigation.navigate("RefuelHistory");
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={styles.container}>
        <Text style={styles.title} variant="headlineSmall">
          Lisää tankkaus
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
        >
          Tallenna tankkaus
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
