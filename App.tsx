import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  DefaultTheme as NavigationDefaultTheme,
  NavigationContainer,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, PaperProvider } from 'react-native-paper';
import MainTabs from './navigation/MainTabs';
import FilterScreen from './screens/Filter';
import LoginScreen from './screens/LoginScreen';
import RegistrationScreen from './screens/RegistrationScreen';
import WelcomeScreen from './screens/WelcomeScreen';
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
import { clearProfilePreferences } from './storage/profileStorage';
import { clearRefuelHistory } from './storage/refuelStorage';
import { appTheme, brandColors } from './theme';

type AuthStatus = 'authenticated' | 'loading' | 'unauthenticated';

type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  Register: undefined;
  Welcome: undefined;
  Filter: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [registeredUser, setRegisteredUser] = useState<RegisteredUser | null>(null);

  useEffect(() => {
    const loadStoredUser = async () => {
      try {
        const user = await getRegisteredUser();
        const hasActiveSession = await getSessionActive();
        setRegisteredUser(user);
        setAuthStatus(user && hasActiveSession ? 'authenticated' : 'unauthenticated');
      } catch {
        setAuthStatus('unauthenticated');
      }
    };

    void loadStoredUser();
  }, []);

  const handleRegistrationComplete = async (user: RegisteredUser, token?: string) => {
    await saveRegisteredUser(user);
    if (token) {
      await saveAuthToken(token);
    } else {
      await clearAuthToken();
    }
    await setSessionActive(true);
    setRegisteredUser(user);
    setAuthStatus('authenticated');
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
    setAuthStatus('authenticated');
  };

  const handleSignOut = async () => {
    await clearAuthToken();
    await setSessionActive(false);
    setAuthStatus('unauthenticated');
  };

  const handleDeleteAccount = async () => {
    if (registeredUser?.email) {
      await clearProfilePreferences(registeredUser.email);
      await clearRefuelHistory(registeredUser.email);
    }
    await clearRegisteredUser();
    await clearAuthToken();
    await setSessionActive(false);
    setRegisteredUser(null);
    setAuthStatus('unauthenticated');
  };

  const navigationTheme = useMemo<NavigationTheme>(
    () => ({
      ...NavigationDefaultTheme,
      colors: {
        ...NavigationDefaultTheme.colors,
        background: appTheme.colors.background,
        border: brandColors.lightMint,
        card: '#F6FFF9',
        notification: brandColors.mint,
        primary: brandColors.forest,
        text: brandColors.forest,
      },
    }),
    []
  );

  return (
    <SafeAreaProvider>
      <PaperProvider theme={appTheme}>
        {authStatus === 'loading' ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator animating size="large" color={brandColors.forest} />
          </View>
        ) : (
          <NavigationContainer theme={navigationTheme}>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              {authStatus === 'authenticated' ? (
                <>
                  <Stack.Screen name="Main">
                    {() => (
                      <MainTabs
                        onDeleteAccount={handleDeleteAccount}
                        onSignOut={handleSignOut}
                        user={registeredUser}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="Filter" component={FilterScreen} />
                </>
              ) : (
                <>
                  <Stack.Screen name="Welcome">
                    {({ navigation }) => (
                      <WelcomeScreen
                        onLogin={() => navigation.navigate('Login')}
                        onRegister={() => navigation.navigate('Register')}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="Login">
                    {({ navigation }) => (
                      <LoginScreen
                        onBack={navigation.goBack}
                        onLoggedIn={handleLoginComplete}
                        storedUser={registeredUser}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="Register">
                    {({ navigation }) => (
                      <RegistrationScreen
                        onBack={navigation.goBack}
                        onRegistered={handleRegistrationComplete}
                      />
                    )}
                  </Stack.Screen>
                </>
              )}
            </Stack.Navigator>
          </NavigationContainer>
        )}
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
