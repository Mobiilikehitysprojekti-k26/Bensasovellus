import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, PaperProvider } from 'react-native-paper';
import LoginScreen from './components/LoginScreen';
import MainTabs from './components/MainTabs';
import RegistrationScreen from './components/RegistrationScreen';
import WelcomeScreen from './components/WelcomeScreen';
import {
  clearAuthToken,
  clearRegisteredUser,
  getSessionActive,
  getRegisteredUser,
  saveAuthToken,
  saveRegisteredUser,
  setSessionActive,
  type RegisteredUser,
} from './storage/authStorage';
import { appTheme, brandColors } from './theme';

type RootScreen = 'loading' | 'welcome' | 'login' | 'register' | 'app';
type AuthBackTarget = 'app' | 'welcome';

export default function App() {
  const [rootScreen, setRootScreen] = useState<RootScreen>('loading');
  const [registeredUser, setRegisteredUser] = useState<RegisteredUser | null>(null);
  const [authBackTarget, setAuthBackTarget] = useState<AuthBackTarget>('welcome');

  useEffect(() => {
    const loadStoredUser = async () => {
      try {
        const user = await getRegisteredUser();
        const hasActiveSession = await getSessionActive();
        setRegisteredUser(user);
        setRootScreen(user && hasActiveSession ? 'app' : 'welcome');
      } catch (error) {
        console.error('Failed to load registered user', error);
        setRootScreen('welcome');
      }
    };

    void loadStoredUser();
  }, []);

  const handleRegistrationComplete = async (user: RegisteredUser) => {
    await saveRegisteredUser(user);
    await clearAuthToken();
    await setSessionActive(true);
    setRegisteredUser(user);
    setRootScreen('app');
  };

  const handleLoginComplete = async (user: RegisteredUser, token?: string) => {
    await saveRegisteredUser(user);
    if (token) {
      await saveAuthToken(token);
    } else {
      await clearAuthToken();
    }
    await setSessionActive(true);
    setRegisteredUser(user);
    setRootScreen('app');
  };

  const handleSignOut = async () => {
    await clearAuthToken();
    await setSessionActive(false);
    setRootScreen('welcome');
  };

  const handleDeleteAccount = async () => {
    await clearRegisteredUser();
    await clearAuthToken();
    await setSessionActive(false);
    setRegisteredUser(null);
    setRootScreen('welcome');
  };

  const handleLoginPress = () => {
    setAuthBackTarget('welcome');
    setRootScreen('login');
  };

  const renderRootScreen = () => {
    switch (rootScreen) {
      case 'loading':
        return (
          <View style={styles.loadingContainer}>
            <ActivityIndicator animating size="large" color={brandColors.forest} />
          </View>
        );
      case 'register':
        return (
          <RegistrationScreen
            onBack={() => setRootScreen(authBackTarget)}
            onRegistered={handleRegistrationComplete}
          />
        );
      case 'login':
        return (
          <LoginScreen
            onBack={() => setRootScreen('welcome')}
            onLoggedIn={handleLoginComplete}
            storedUser={registeredUser}
          />
        );
      case 'app':
        return (
          <MainTabs
            onDeleteAccount={handleDeleteAccount}
            onSignOut={handleSignOut}
            user={registeredUser}
            onOpenRegistration={() => {
              setAuthBackTarget('app');
              setRootScreen('register');
            }}
          />
        );
      case 'welcome':
      default:
        return (
          <WelcomeScreen
            onLogin={handleLoginPress}
            onRegister={() => {
              setAuthBackTarget('welcome');
              setRootScreen('register');
            }}
          />
        );
    }
  };

  return (
    <SafeAreaProvider>
      <PaperProvider
        theme={appTheme}
        settings={{
          icon: ({ color, size, direction, testID, name }) => (
            <MaterialCommunityIcons
              color={color}
              name={name}
              size={size}
              style={{ transform: [{ scaleX: direction === 'rtl' ? -1 : 1 }] }}
              testID={testID}
            />
          ),
        }}
      >
        {renderRootScreen()}
      </PaperProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    alignItems: 'center',
    backgroundColor: appTheme.colors.background,
    flex: 1,
    justifyContent: 'center',
  },
});
