import { StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { RegisteredUser } from '../storage/authStorage';
import { brandColors } from '../theme';
import MapScreen from './MapScreen';
import PricesScreen from './Prices';
import ProfileScreen from './Profile';

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

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabs({ onDeleteAccount, onSignOut, user }: MainTabsProps) {
  return (
    <Tab.Navigator
      initialRouteName="MapTab"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: brandColors.forest,
        tabBarHideOnKeyboard: true,
        tabBarInactiveTintColor: brandColors.forestSoft,
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
        name="ProfileTab"
        options={{
          title: 'Profiili',
        }}
      >
        {() => (
          <ProfileScreen onDeleteAccount={onDeleteAccount} onSignOut={onSignOut} user={user} />
        )}
      </Tab.Screen>
    </Tab.Navigator>
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
