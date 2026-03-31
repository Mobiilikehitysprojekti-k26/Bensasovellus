import { useState, type ReactNode } from 'react';
import { Alert, Platform, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { Button, Card, Divider, Text } from 'react-native-paper';
import type { RegisteredUser } from '../storage/authStorage';
import { brandColors } from '../theme';

interface ProfileScreenProps {
  onDeleteAccount: () => Promise<void> | void;
  onSignOut: () => Promise<void> | void;
  user: RegisteredUser | null;
}

type ActivePage = 'history' | 'info' | 'main';
const topSpacing = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 12 : 44;
const mainBottomSpacing = 32;
const subPageBottomSpacing = 28;

interface SubPageLayoutProps {
  children: ReactNode;
  onBack: () => void;
  title: string;
}

function getDisplayValue(value: string): string {
  return value.trim().length > 0 ? value : 'Ei saatavilla';
}

function getDisplayName(user: RegisteredUser): string {
  const fullName = `${user.firstName} ${user.lastName}`.trim();
  return fullName.length > 0 ? fullName : 'Ei saatavilla';
}

function SubPageLayout({ children, onBack, title }: SubPageLayoutProps) {
  return (
    <ScrollView contentContainerStyle={styles.subPageContent} showsVerticalScrollIndicator={false}>
      <Button
        icon="arrow-left"
        mode="text"
        onPress={onBack}
        style={styles.backButton}
        textColor={brandColors.forest}
      >
        Takaisin
      </Button>

      <Card mode="contained" style={styles.detailCard}>
        <Card.Content>
          <Text style={styles.sectionTitle} variant="titleMedium">
            {title}
          </Text>
          {children}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

export default function ProfileScreen({
  onDeleteAccount,
  onSignOut,
  user,
}: ProfileScreenProps) {
  const [activePage, setActivePage] = useState<ActivePage>('main');

  const handleDeletePress = () => {
    if (!user) {
      Alert.alert(
        'Tili\u00E4 ei ole',
        'Tallennettua k\u00E4ytt\u00E4j\u00E4tili\u00E4 ei l\u00F6ytynyt poistettavaksi.'
      );
      return;
    }

    Alert.alert(
      'Poista tili',
      'Haluatko varmasti poistaa tallennetun tilin t\u00E4st\u00E4 laitteesta?',
      [
        {
          text: 'Peruuta',
          style: 'cancel',
        },
        {
          text: 'Poista',
          style: 'destructive',
          onPress: () => {
            void onDeleteAccount();
          },
        },
      ]
    );
  };

  const handleSignOutPress = () => {
    Alert.alert('Kirjaudu ulos', 'Haluatko varmasti kirjautua ulos?', [
      {
        text: 'Peruuta',
        style: 'cancel',
      },
      {
        text: 'Kirjaudu ulos',
        onPress: () => {
          void onSignOut();
        },
      },
    ]);
  };

  if (activePage === 'info') {
    return (
      <SubPageLayout onBack={() => setActivePage('main')} title={'Omat tiedot'}>
        {user ? (
          <>
            <View style={styles.detailRow}>
              <Text style={styles.label} variant="labelLarge">
                Nimi
              </Text>
              <Text style={styles.value} variant="bodyLarge">
                {getDisplayName(user)}
              </Text>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.detailRow}>
              <Text style={styles.label} variant="labelLarge">
                {'K\u00E4ytt\u00E4j\u00E4nimi'}
              </Text>
              <Text style={styles.value} variant="bodyLarge">
                {getDisplayValue(user.username)}
              </Text>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.detailRow}>
              <Text style={styles.label} variant="labelLarge">
                {'S\u00E4hk\u00F6posti'}
              </Text>
              <Text style={styles.value} variant="bodyLarge">
                {getDisplayValue(user.email)}
              </Text>
            </View>

            <Divider style={styles.divider} />
          </>
        ) : (
          <Text style={styles.emptyText} variant="bodyMedium">
            {'Tallennettuja k\u00E4ytt\u00E4j\u00E4tietoja ei l\u00F6ytynyt viel\u00E4.'}
          </Text>
        )}

        <Button
          buttonColor="#C94F4F"
          mode="contained"
          onPress={handleDeletePress}
          style={styles.detailDeleteButton}
          textColor="#FFFFFF"
        >
          Poista tili
        </Button>
      </SubPageLayout>
    );
  }

  if (activePage === 'history') {
    return (
      <SubPageLayout onBack={() => setActivePage('main')} title={'Tankkaushistoria'}>
        <Text style={styles.emptyText} variant="bodyMedium">
          {
            'Tankkaushistoria lis\u00E4t\u00E4\u00E4n seuraavaksi. T\u00E4h\u00E4n n\u00E4kym\u00E4\u00E4n tulee my\u00F6hemmin listaus tankkaustapahtumista.'
          }
        </Text>
      </SubPageLayout>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.mainContent} showsVerticalScrollIndicator={false}>
      <Card mode="contained" style={styles.topCard}>
        <Card.Content>
          <Text style={styles.sectionTitle} variant="titleLarge">
            {'Ajoneuvon tiedot'}
          </Text>

          <View style={styles.detailRow}>
            <Text style={styles.label} variant="labelLarge">
              {'Auton nimi'}
            </Text>
            <Text style={styles.value} variant="bodyLarge">
              {'Ei asetettu'}
            </Text>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.label} variant="labelLarge">
              {'Kulutus'}
            </Text>
            <Text style={styles.value} variant="bodyLarge">
              {'Ei asetettu'}
            </Text>
          </View>
        </Card.Content>
      </Card>

      <Card mode="contained" style={styles.savingsCard}>
        <Card.Content>
          <Text style={styles.sectionTitle} variant="titleMedium">
            {'Olet s\u00E4\u00E4st\u00E4nyt'}
          </Text>

          <View style={styles.savingsRow}>
            <Text style={styles.savingsValue} variant="headlineMedium">
              {'44 \u20AC'}
            </Text>
            <Text style={styles.savingsLabel} variant="bodyMedium">
              {'t\u00E4ss\u00E4 kuussa'}
            </Text>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.savingsRow}>
            <Text style={styles.savingsValue} variant="headlineMedium">
              {'255,5 \u20AC'}
            </Text>
            <Text style={styles.savingsLabel} variant="bodyMedium">
              {'yhteens\u00E4'}
            </Text>
          </View>
        </Card.Content>
      </Card>

      <Card mode="contained" style={styles.menuCard}>
        <Card.Content>

          <Button
            buttonColor={brandColors.mint}
            mode="contained"
            onPress={() => setActivePage('info')}
            style={styles.actionButton}
            textColor={brandColors.forest}
          >
            {'Omat tiedot'}
          </Button>

          <Button
            buttonColor={brandColors.softMint}
            mode="contained"
            onPress={() => setActivePage('history')}
            style={styles.actionButton}
            textColor={brandColors.forest}
          >
            {'Tankkaushistoria'}
          </Button>

          <Button
            buttonColor="#7A9D8A"
            mode="contained"
            onPress={handleSignOutPress}
            style={styles.actionButton}
            textColor="#FFFFFF"
          >
            {'Kirjaudu ulos'}
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  mainContent: {
    paddingHorizontal: 16,
    paddingBottom: mainBottomSpacing,
    paddingTop: topSpacing,
  },
  subPageContent: {
    paddingHorizontal: 16,
    paddingBottom: subPageBottomSpacing,
    paddingTop: topSpacing,
  },
  topCard: {
    backgroundColor: '#F9FFFC',
    borderRadius: 28,
  },
  menuCard: {
    backgroundColor: '#F9FFFC',
    borderRadius: 28,
    marginTop: 16,
  },
  savingsCard: {
    backgroundColor: '#F9FFFC',
    borderRadius: 28,
    marginTop: 16,
  },
  detailCard: {
    backgroundColor: '#F9FFFC',
    borderRadius: 28,
  },
  sectionTitle: {
    color: brandColors.forest,
    fontWeight: '700',
    marginBottom: 6,
  },
  detailRow: {
    paddingVertical: 12,
  },
  label: {
    color: brandColors.forestSoft,
    marginBottom: 4,
  },
  value: {
    color: brandColors.forest,
  },
  savingsRow: {
    paddingVertical: 12,
  },
  savingsValue: {
    color: brandColors.forest,
    fontWeight: '700',
  },
  savingsLabel: {
    color: brandColors.forestSoft,
    marginTop: 4,
  },
  divider: {
    backgroundColor: brandColors.lightMint,
  },
  actionButton: {
    borderRadius: 16,
    marginTop: 12,
  },
  detailDeleteButton: {
    borderRadius: 16,
    marginTop: 20,
  },
  emptyText: {
    color: brandColors.forestSoft,
    lineHeight: 22,
    marginTop: 10,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 12,
    marginLeft: -8,
  },
});
