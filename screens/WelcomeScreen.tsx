import { Platform, StatusBar, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Surface, Text } from 'react-native-paper';
import { brandColors } from '../theme';

const welcomeTitle = 'Tervetuloa k\u00E4ytt\u00E4m\u00E4\u00E4n Tankwise sovellusta!';
const topSpacing = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 24 : 72;

interface WelcomeScreenProps {
  onLogin: () => void;
  onRegister: () => void;
}

export default function WelcomeScreen({ onLogin, onRegister }: WelcomeScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.topSection}>
          <Text style={styles.title} variant="displaySmall">
            {welcomeTitle}
          </Text>
        </View>

        <View style={styles.middleSection}>
          <Surface style={styles.logoSurface} elevation={2}>
            <MaterialCommunityIcons
              color={brandColors.forestSoft}
              name="gas-station-outline"
              size={88}
            />
          </Surface>
        </View>

        <View style={styles.bottomSection}>
          <Button
            buttonColor={brandColors.mint}
            contentStyle={styles.primaryButtonContent}
            icon="login"
            mode="contained"
            onPress={onLogin}
            style={styles.primaryButton}
            textColor={brandColors.forest}
          >
            Kirjaudu
          </Button>

          <Button
            buttonColor={brandColors.forest}
            contentStyle={styles.secondaryButtonContent}
            icon="account-plus-outline"
            mode="contained"
            onPress={onRegister}
            style={styles.secondaryButton}
            textColor={brandColors.whisperMint}
          >
            {'Rekister\u00F6idy'}
          </Button>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandColors.whisperMint,
  },
  content: {
    flex: 1,
    padding: 24,
    paddingBottom: 36,
    paddingTop: topSpacing,
  },
  topSection: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  middleSection: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  bottomSection: {
    justifyContent: 'flex-end',
  },
  title: {
    color: brandColors.forest,
    fontWeight: '700',
    textAlign: 'center',
  },
  logoSurface: {
    alignItems: 'center',
    backgroundColor: '#F9FFFC',
    borderColor: brandColors.softMint,
    borderRadius: 36,
    borderWidth: 1,
    paddingHorizontal: 36,
    paddingVertical: 36,
  },
  primaryButton: {
    borderRadius: 18,
  },
  primaryButtonContent: {
    minHeight: 58,
  },
  secondaryButton: {
    borderRadius: 18,
    marginTop: 14,
  },
  secondaryButtonContent: {
    minHeight: 56,
  },
});
