import { createContext, useContext } from 'react';
import { StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RegisteredUser } from '../storage/authStorage';
import { brandColors } from '../theme';
import AddRefuel from '../screens/AddRefuel';
import MapScreen from '../screens/MapScreen';
import PricesScreen from '../screens/Prices';
import ProfileScreen from '../screens/Profile';
import RefuelHistory from '../screens/RefuelHistory';

interface MainTabsProps {
  onDeleteAccount: () => Promise<void> | void;
  onSignOut: () => Promise<void> | void;
  user: RegisteredUser | null;
}

type MainTabParamList = {
  MapTab: undefined;
  PricesTab: undefined;
  ProfileTab: undefined;
};

type ProfileStackParamList = {
  AddRefuel: undefined;
  ProfileMain: undefined;
  RefuelHistory: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
const ProfileFlowContext = createContext<MainTabsProps | null>(null);

function ProfileStackNavigator() {
  const profileFlow = useContext(ProfileFlowContext);

  if (!profileFlow) {
    return null;
  }

  const { onDeleteAccount, onSignOut, user } = profileFlow;

  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileMain">
        {({ navigation }) => (
          <ProfileScreen
            navigation={navigation}
            onDeleteAccount={onDeleteAccount}
            onSignOut={onSignOut}
            user={user}
          />
        )}
      </ProfileStack.Screen>

      <ProfileStack.Screen component={RefuelHistory} name="RefuelHistory" />
      <ProfileStack.Screen component={AddRefuel} name="AddRefuel" />
    </ProfileStack.Navigator>
  );
}

export default function MainTabs({ onDeleteAccount, onSignOut, user }: MainTabsProps) {
  return (
    <ProfileFlowContext.Provider value={{ onDeleteAccount, onSignOut, user }}>
      <Tab.Navigator
        initialRouteName="MapTab"
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: brandColors.forest,
          tabBarHideOnKeyboard: true,
          tabBarInactiveTintColor: brandColors.forestSoft,
          tabBarLabelPosition: 'below-icon',
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarStyle: styles.tabBar,
          tabBarIcon: ({ color, focused, size }) => {
            const iconName =
              route.name === 'MapTab'
                ? focused
                  ? 'map-marker-radius'
                  : 'map-marker-outline'
                : route.name === 'PricesTab'
                  ? focused
                    ? 'cash-multiple'
                    : 'cash'
                  : focused
                    ? 'account-circle'
                    : 'account-outline';

            return <MaterialCommunityIcons color={color} name={iconName} size={size} />;
          },
        })}
      >
        <Tab.Screen
          name="MapTab"
          options={{
            title: 'Kartta',
          }}
        >
          {() => <MapScreen user={user} />}
        </Tab.Screen>

        <Tab.Screen
          component={PricesScreen}
          name="PricesTab"
          options={{
            title: 'Hinnat',
          }}
        />

        <Tab.Screen
          component={ProfileStackNavigator}
          name="ProfileTab"
          options={{
            title: 'Profiili',
          }}
        />
      </Tab.Navigator>
    </ProfileFlowContext.Provider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#F6FFF9',
    borderTopColor: brandColors.lightMint,
    borderTopWidth: 1,
    height: 74,
    paddingBottom: 10,
    paddingTop: 8,
  },
  tabBarLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
