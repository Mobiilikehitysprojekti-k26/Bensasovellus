import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Image, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Button,
  Card,
  Divider,
  HelperText,
  SegmentedButtons,
  Text,
  TextInput,
} from 'react-native-paper';
import type { RegisteredUser } from '../storage/authStorage';
import {
  createDefaultProfilePreferences,
  getProfilePreferences,
  saveProfilePreferences,
  type ProfilePreferences,
} from '../storage/profileStorage';
import { brandColors } from '../theme';

interface ProfileScreenProps {
  onDeleteAccount: () => Promise<void> | void;
  onSignOut: () => Promise<void> | void;
  user: RegisteredUser | null;
}

type ActivePage = 'history' | 'info' | 'main' | 'vehicle';

interface MenuRowProps {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  onPress: () => void;
  title: string;
}

interface SubPageLayoutProps {
  children: ReactNode;
  onBack: () => void;
  title: string;
}

type FuelType = ProfilePreferences['fuelType'];

function getDisplayValue(value: string): string {
  return value.trim().length > 0 ? value : 'Ei saatavilla';
}

function getDisplayName(user: RegisteredUser): string {
  const fullName = `${user.firstName} ${user.lastName}`.trim();
  return fullName.length > 0 ? fullName : 'Ei saatavilla';
}

function getUserInitials(user: RegisteredUser | null): string {
  if (!user) {
    return '?';
  }

  const firstInitial = user.firstName.charAt(0);
  const lastInitial = user.lastName.charAt(0);
  const initials = `${firstInitial}${lastInitial}`.trim().toUpperCase();

  if (initials.length > 0) {
    return initials;
  }

  return user.username.charAt(0).toUpperCase() || '?';
}

function getVehicleSubtitle(preferences: ProfilePreferences): string {
  const details: string[] = [];

  if (preferences.fuelType) {
    details.push(getFuelTypeLabel(preferences.fuelType));
  }

  if (preferences.combinedConsumption.trim().length > 0) {
    details.push(`Yhdistetty kulutus: ${preferences.combinedConsumption} L / 100 km`);
  }

  if (details.length === 0) {
    return 'Lisää polttoaine ja kulutus';
  }

  return details.join(' • ');
}

function getFuelTypeLabel(fuelType: FuelType): string {
  switch (fuelType) {
    case '95':
      return 'Bensa 95';
    case '98':
      return 'Bensa 98';
    case 'diesel':
      return 'Diesel';
    default:
      return 'Ei valittu';
  }
}

function MenuRow({ icon, onPress, title }: MenuRowProps) {
  return (
    <Card mode="contained" onPress={onPress} style={styles.menuRowCard}>
      <Card.Content style={styles.menuRowContent}>
        <View style={styles.menuRowLeading}>
          <View style={styles.menuIconCircle}>
            <MaterialCommunityIcons color={brandColors.forestSoft} name={icon} size={22} />
          </View>
          <Text style={styles.menuRowTitle} variant="titleMedium">
            {title}
          </Text>
        </View>

        <MaterialCommunityIcons color="#C9CEC9" name="chevron-right" size={26} />
      </Card.Content>
    </Card>
  );
}

function SubPageLayout({ children, onBack, title }: SubPageLayoutProps) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
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

        <Text style={styles.pageTitle} variant="headlineMedium">
          {title}
        </Text>

        <Card mode="contained" style={styles.detailCard}>
          <Card.Content>{children}</Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function ProfileScreen({
  onDeleteAccount,
  onSignOut,
  user,
}: ProfileScreenProps) {
  const [activePage, setActivePage] = useState<ActivePage>('main');
  const [preferences, setPreferences] = useState<ProfilePreferences>(createDefaultProfilePreferences());
  const [vehicleNameInput, setVehicleNameInput] = useState('');
  const [combinedConsumptionInput, setCombinedConsumptionInput] = useState('');
  const [fuelTypeInput, setFuelTypeInput] = useState<FuelType>('');
  const [vehicleError, setVehicleError] = useState<string | null>(null);
  const [isPreferencesLoading, setIsPreferencesLoading] = useState(true);
  const [isSavingVehicle, setIsSavingVehicle] = useState(false);
  const [isUpdatingImage, setIsUpdatingImage] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadStoredPreferences = async () => {
      if (!user?.email) {
        if (isMounted) {
          setPreferences(createDefaultProfilePreferences());
          setIsPreferencesLoading(false);
        }
        return;
      }

      setIsPreferencesLoading(true);

      try {
        const storedPreferences = await getProfilePreferences(user.email);

        if (!isMounted) {
          return;
        }

        setPreferences(storedPreferences ?? createDefaultProfilePreferences());
      } catch (error) {
        console.error('Failed to load profile preferences', error);

        if (isMounted) {
          setPreferences(createDefaultProfilePreferences());
        }
      } finally {
        if (isMounted) {
          setIsPreferencesLoading(false);
        }
      }
    };

    void loadStoredPreferences();

    return () => {
      isMounted = false;
    };
  }, [user?.email]);

  useEffect(() => {
    setVehicleNameInput(preferences.vehicleName);
    setCombinedConsumptionInput(preferences.combinedConsumption);
    setFuelTypeInput(preferences.fuelType);
  }, [preferences.combinedConsumption, preferences.fuelType, preferences.vehicleName]);

  const savePreferences = async (
    nextPreferences: ProfilePreferences,
    successMessage?: string
  ): Promise<boolean> => {
    if (!user?.email) {
      Alert.alert('Tallennus ei onnistu', 'Kirjautunutta käyttäjää ei löytynyt.');
      return false;
    }

    try {
      await saveProfilePreferences(user.email, nextPreferences);
      setPreferences(nextPreferences);

      if (successMessage) {
        Alert.alert('Tallennettu', successMessage);
      }

      return true;
    } catch (error) {
      console.error('Failed to save profile preferences', error);
      Alert.alert('Tallennus epäonnistui', 'Tietoja ei voitu tallentaa tämän laitteen muistiin.');
      return false;
    }
  };

  const handleDeletePress = () => {
    if (!user) {
      Alert.alert(
        'Tiliä ei ole',
        'Tallennettua käyttäjätiliä ei löytynyt poistettavaksi.'
      );
      return;
    }

    Alert.alert(
      'Poista tili',
      'Haluatko varmasti poistaa tallennetun tilin tästä laitteesta?',
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

  const handleSaveVehicleSettings = async () => {
    const trimmedVehicleName = vehicleNameInput.trim();
    const trimmedConsumption = combinedConsumptionInput.trim().replace(',', '.');

    if (trimmedVehicleName.length === 0) {
      setVehicleError('Anna ajoneuvolle nimi.');
      return;
    }

    if (trimmedConsumption.length === 0) {
      setVehicleError('Anna yhdistetty kulutus.');
      return;
    }

    if (!fuelTypeInput) {
      setVehicleError('Valitse polttoainetyyppi.');
      return;
    }

    const parsedConsumption = Number(trimmedConsumption);

    if (!Number.isFinite(parsedConsumption) || parsedConsumption <= 0) {
      setVehicleError('Anna kulutus muodossa 6.5.');
      return;
    }

    setVehicleError(null);
    setIsSavingVehicle(true);

    try {
      const didSave = await savePreferences(
        {
          ...preferences,
          combinedConsumption: parsedConsumption.toString(),
          fuelType: fuelTypeInput,
          vehicleName: trimmedVehicleName,
        },
        'Ajoneuvon tiedot tallennettiin puhelimen muistiin.'
      );

      if (didSave) {
        setActivePage('main');
      }
    } finally {
      setIsSavingVehicle(false);
    }
  };

  const clearVehicleSettings = async () => {
    setVehicleError(null);
    setIsSavingVehicle(true);

    try {
      const didSave = await savePreferences(
        {
          ...preferences,
          combinedConsumption: '',
          fuelType: '',
          vehicleName: '',
        },
        'Ajoneuvon tiedot poistettiin tämän laitteen muistista.'
      );

      if (didSave) {
        setActivePage('main');
      }
    } finally {
      setIsSavingVehicle(false);
    }
  };

  const handleClearVehicleSettings = () => {
    Alert.alert(
      'Tyhjennä ajoneuvon tiedot',
      'Poistetaanko ajoneuvon nimi ja yhdistetty kulutus tältä laitteelta?',
      [
        {
          text: 'Peruuta',
          style: 'cancel',
        },
        {
          text: 'Poista',
          style: 'destructive',
          onPress: () => {
            void clearVehicleSettings();
          },
        },
      ]
    );
  };

  const handlePickProfileImage = async () => {
    if (!user?.email) {
      Alert.alert('Kuvan valinta ei onnistu', 'Kirjautunutta käyttäjää ei löytynyt.');
      return;
    }

    setIsUpdatingImage(true);

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Lupa puuttuu',
          'Anna sovellukselle lupa kuviin, jotta profiilikuva voidaan tallentaa.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        base64: true,
        mediaTypes: ['images'],
        quality: 0.4,
      });

      if (result.canceled) {
        return;
      }

      const [asset] = result.assets;

      if (!asset?.base64) {
        Alert.alert('Kuvan käsittely epäonnistui', 'Valittua kuvaa ei voitu tallentaa.');
        return;
      }

      const nextPreferences = {
        ...preferences,
        profileImage: `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`,
      };

      await savePreferences(nextPreferences, 'Profiilikuva tallennettiin puhelimen muistiin.');
    } catch (error) {
      console.error('Failed to update profile image', error);
      Alert.alert('Kuvan valinta epäonnistui', 'Profiilikuvaa ei voitu päivittää.');
    } finally {
      setIsUpdatingImage(false);
    }
  };

  if (isPreferencesLoading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator animating color={brandColors.forest} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (activePage === 'info') {
    return (
      <SubPageLayout onBack={() => setActivePage('main')} title="Omat tiedot">
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
                Käyttäjänimi
              </Text>
              <Text style={styles.value} variant="bodyLarge">
                {getDisplayValue(user.username)}
              </Text>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.detailRow}>
              <Text style={styles.label} variant="labelLarge">
                Sähköposti
              </Text>
              <Text style={styles.value} variant="bodyLarge">
                {getDisplayValue(user.email)}
              </Text>
            </View>
          </>
        ) : (
          <Text style={styles.emptyText} variant="bodyMedium">
            Tallennettuja käyttäjätietoja ei löytynyt vielä.
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
      <SubPageLayout onBack={() => setActivePage('main')} title="Tankkaushistoria">
        <Text style={styles.emptyText} variant="bodyMedium">
          Tankkaushistoria lisätään seuraavaksi. Tähän näkymään tulee myöhemmin listaus
          tankkaustapahtumista.
        </Text>
      </SubPageLayout>
    );
  }

  if (activePage === 'vehicle') {
    return (
      <SubPageLayout onBack={() => setActivePage('main')} title="Ajoneuvon asetukset">
        <TextInput
          autoCapitalize="words"
          label="Ajoneuvon nimi"
          mode="outlined"
          onChangeText={(value) => {
            setVehicleError(null);
            setVehicleNameInput(value);
          }}
          outlineStyle={styles.inputOutline}
          placeholder="Esim. Audi A3"
          value={vehicleNameInput}
        />

        <TextInput
          keyboardType="decimal-pad"
          label="Yhdistetty kulutus"
          mode="outlined"
          onChangeText={(value) => {
            setVehicleError(null);
            setCombinedConsumptionInput(value);
          }}
          outlineStyle={styles.inputOutline}
          placeholder="Esim. 6.5"
          right={<TextInput.Affix text="L / 100 km" />}
          style={styles.inputSpacing}
          value={combinedConsumptionInput}
        />

        <Text style={styles.fuelTypeLabel} variant="labelLarge">
          Polttoaine
        </Text>

        <SegmentedButtons
          buttons={[
            {
              label: '95',
              value: '95',
            },
            {
              label: '98',
              value: '98',
            },
            {
              label: 'Diesel',
              value: 'diesel',
            },
          ]}
          onValueChange={(value) => {
            setVehicleError(null);
            setFuelTypeInput(value as FuelType);
          }}
          style={styles.fuelTypeButtons}
          value={fuelTypeInput}
        />

        <HelperText style={styles.helperText} type="error" visible={Boolean(vehicleError)}>
          {vehicleError ?? ' '}
        </HelperText>

        <Text style={styles.storageNote} variant="bodyMedium">
          Tiedot tallennetaan tämän laitteen muistiin.
        </Text>

        <Button
          buttonColor={brandColors.forest}
          loading={isSavingVehicle}
          mode="contained"
          onPress={() => {
            void handleSaveVehicleSettings();
          }}
          style={styles.primaryActionButton}
          textColor="#FFFFFF"
        >
          Tallenna ajoneuvo
        </Button>

        <Button
          mode="text"
          onPress={handleClearVehicleSettings}
          style={styles.secondaryActionButton}
          textColor="#C94F4F"
        >
          Tyhjennä tiedot
        </Button>
      </SubPageLayout>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.mainContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle} variant="headlineMedium">
          Profiili
        </Text>

        <Card mode="contained" style={styles.userCard}>
          <Card.Content style={styles.userCardContent}>
            <View style={styles.avatarContainer}>
              {preferences.profileImage ? (
                <Image source={{ uri: preferences.profileImage }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitials} variant="headlineSmall">
                    {getUserInitials(user)}
                  </Text>
                </View>
              )}
              <View style={styles.avatarStatusDot} />
            </View>

            <View style={styles.userTextContent}>
              <Text style={styles.userName} variant="headlineSmall">
                {user ? getDisplayName(user) : 'Esimerkkikäyttäjä'}
              </Text>
              <Text style={styles.userEmail} variant="bodyLarge">
                {user?.email ?? 'esimerkki@esimerkki.com'}
              </Text>

              <Button
                compact
                icon="camera-outline"
                loading={isUpdatingImage}
                mode="text"
                onPress={() => {
                  void handlePickProfileImage();
                }}
                style={styles.changePhotoButton}
                textColor={brandColors.forestSoft}
              >
                {preferences.profileImage ? 'Vaihda kuva' : 'Lisää kuva'}
              </Button>
            </View>
          </Card.Content>
        </Card>

        <Text style={styles.sectionLabel} variant="labelLarge">
          AJONEUVO
        </Text>

        <Card mode="contained" onPress={() => setActivePage('vehicle')} style={styles.vehicleCard}>
          <Card.Content style={styles.vehicleCardContent}>
            <View style={styles.vehicleCardLeading}>
              <View style={[styles.menuIconCircle, styles.vehicleIconCircle]}>
                <MaterialCommunityIcons color="#27BF62" name="car-outline" size={24} />
              </View>

              <View style={styles.vehicleTextContent}>
                <Text style={styles.vehicleName} variant="titleLarge">
                  {preferences.vehicleName.trim().length > 0 ? preferences.vehicleName : 'Lisää ajoneuvo'}
                </Text>
                <Text style={styles.vehicleMeta} variant="bodyLarge">
                  {getVehicleSubtitle(preferences)}
                </Text>
              </View>
            </View>

            <MaterialCommunityIcons color="#C9CEC9" name="chevron-right" size={26} />
          </Card.Content>
        </Card>

        <Text style={styles.sectionLabel} variant="labelLarge">
          SÄÄSTÖ
        </Text>

        <View style={styles.statsRow}>
          <Card mode="contained" style={[styles.statCard, styles.statCardMint]}>
            <Card.Content style={styles.statCardContent}>
              <View style={[styles.statIconCircle, styles.statIconMint]}>
                <MaterialCommunityIcons color="#27BF62" name="trending-down" size={20} />
              </View>

              <Text style={styles.statLabel} variant="labelLarge">
                SÄÄSTÖ TÄNÄÄN
              </Text>
              <Text style={styles.statValueMint} variant="displaySmall">
                44€
              </Text>
              <Text style={styles.statDescription} variant="bodyMedium">
                tässä kuussa
              </Text>
            </Card.Content>
          </Card>

          <Card mode="contained" style={[styles.statCard, styles.statCardLavender]}>
            <Card.Content style={styles.statCardContent}>
              <View style={[styles.statIconCircle, styles.statIconLavender]}>
                <MaterialCommunityIcons color="#7B61FF" name="wallet-outline" size={20} />
              </View>

              <Text style={styles.statLabel} variant="labelLarge">
                YHTEENSÄ
              </Text>
              <Text style={styles.statValueLavender} variant="displaySmall">
                255€
              </Text>
              <Text style={styles.statDescription} variant="bodyMedium">
                säästetty
              </Text>
            </Card.Content>
          </Card>
        </View>

        <MenuRow icon="account-outline" onPress={() => setActivePage('info')} title="Omat tiedot" />
        <MenuRow icon="history" onPress={() => setActivePage('history')} title="Tankkaushistoria" />
        <MenuRow
          icon="car-cog"
          onPress={() => setActivePage('vehicle')}
          title="Ajoneuvon asetukset"
        />

        <Button
          mode="outlined"
          onPress={handleSignOutPress}
          style={styles.signOutButton}
          textColor="#F06464"
        >
          Kirjaudu ulos
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#F7F7F2',
    flex: 1,
  },
  mainContent: {
    paddingBottom: 32,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  subPageContent: {
    paddingBottom: 28,
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  pageTitle: {
    color: '#212121',
    fontWeight: '800',
    marginBottom: 18,
  },
  userCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#F0F0EB',
    borderRadius: 28,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#1B2B1F',
    shadowOffset: {
      height: 6,
      width: 0,
    },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  userCardContent: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingVertical: 6,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarImage: {
    borderRadius: 34,
    height: 68,
    width: 68,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: brandColors.lightMint,
    borderRadius: 34,
    height: 68,
    justifyContent: 'center',
    width: 68,
  },
  avatarInitials: {
    color: brandColors.forest,
    fontWeight: '800',
  },
  avatarStatusDot: {
    backgroundColor: '#2CD84F',
    borderColor: '#FFFFFF',
    borderRadius: 9,
    borderWidth: 3,
    bottom: -1,
    height: 18,
    position: 'absolute',
    right: -1,
    width: 18,
  },
  userTextContent: {
    flex: 1,
    marginLeft: 16,
  },
  userName: {
    color: '#222222',
    fontWeight: '800',
  },
  userEmail: {
    color: '#8A8A84',
    marginTop: 2,
  },
  changePhotoButton: {
    alignSelf: 'flex-start',
    marginLeft: -8,
    marginTop: 4,
  },
  sectionLabel: {
    color: '#7E7E78',
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 12,
    marginTop: 24,
  },
  vehicleCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#F0F0EB',
    borderRadius: 28,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#1B2B1F',
    shadowOffset: {
      height: 6,
      width: 0,
    },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  vehicleCardContent: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  vehicleCardLeading: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
  },
  vehicleIconCircle: {
    backgroundColor: '#ECFFF1',
  },
  vehicleTextContent: {
    flex: 1,
    marginLeft: 14,
  },
  vehicleName: {
    color: '#222222',
    fontWeight: '800',
  },
  vehicleMeta: {
    color: '#8A8A84',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    borderRadius: 24,
    flex: 1,
    minHeight: 168,
  },
  statCardMint: {
    backgroundColor: '#EAFBF2',
  },
  statCardLavender: {
    backgroundColor: '#F1EEFF',
  },
  statCardContent: {
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  statIconCircle: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    marginBottom: 18,
    width: 40,
  },
  statIconMint: {
    backgroundColor: '#D9F7E5',
  },
  statIconLavender: {
    backgroundColor: '#E2D7FF',
  },
  statLabel: {
    color: '#8A8A84',
    fontWeight: '800',
  },
  statValueMint: {
    color: '#0A7A3B',
    fontWeight: '900',
    marginTop: 10,
  },
  statValueLavender: {
    color: '#2D145E',
    fontWeight: '900',
    marginTop: 10,
  },
  statDescription: {
    color: '#B0B0AA',
    marginTop: 6,
  },
  menuRowCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#F0F0EB',
    borderRadius: 24,
    borderWidth: 1,
    elevation: 2,
    marginTop: 14,
    shadowColor: '#1B2B1F',
    shadowOffset: {
      height: 6,
      width: 0,
    },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  menuRowContent: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  menuRowLeading: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  menuIconCircle: {
    alignItems: 'center',
    backgroundColor: '#F5F4F1',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  menuRowTitle: {
    color: '#222222',
    fontWeight: '700',
    marginLeft: 14,
  },
  signOutButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFBCBC',
    borderRadius: 22,
    borderWidth: 1,
    marginTop: 28,
    minHeight: 64,
  },
  divider: {
    backgroundColor: brandColors.lightMint,
  },
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#F0F0EB',
    borderRadius: 28,
    borderWidth: 1,
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
  detailDeleteButton: {
    borderRadius: 16,
    marginTop: 20,
  },
  emptyText: {
    color: brandColors.forestSoft,
    lineHeight: 22,
    marginTop: 4,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    marginLeft: -8,
  },
  inputOutline: {
    borderRadius: 18,
  },
  inputSpacing: {
    marginTop: 16,
  },
  fuelTypeLabel: {
    color: brandColors.forestSoft,
    marginTop: 12,
  },
  fuelTypeButtons: {
    marginTop: 10,
  },
  helperText: {
    marginBottom: 4,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  storageNote: {
    color: brandColors.forestSoft,
  },
  primaryActionButton: {
    borderRadius: 18,
    marginTop: 12,
  },
  secondaryActionButton: {
    marginTop: 10,
  },
});
