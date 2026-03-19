import { StyleSheet, Text, View } from 'react-native';

export default function PricesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hinnat</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginTop: 10,
    color: '#555',
  },
  value: {
    fontSize: 18,
  },
});
