import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Text } from 'react-native-paper';
import { brandColors } from '../theme';

export default function PricesScreen() {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <Card mode="contained" style={styles.card}>
        <Card.Content>
          <Text style={styles.title} variant="headlineSmall">
            Hinnat
          </Text>
          <Text style={styles.body} variant="bodyLarge">
            Polttoainehintojen näkymä voidaan liittää seuraavaksi tähän välilehteen.
          </Text>
        </Card.Content>
      </Card>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: {
    color: brandColors.forestSoft,
    lineHeight: 24,
  },
  card: {
    backgroundColor: '#F9FFFC',
    borderRadius: 28,
  },
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
});
