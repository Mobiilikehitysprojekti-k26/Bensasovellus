import { useState } from 'react';
import { Platform } from 'react-native';
import { BottomNavigation } from 'react-native-paper';
import type { RegisteredUser } from '../storage/authStorage';
import { brandColors } from '../theme';
import MapScreen from './MapScreen';
import PricesScreen from './Prices';
import ProfileScreen from './Profile';

const tabBarBottomPadding = Platform.OS === 'android' ? 12 : 20;

interface MainTabsProps {
  onDeleteAccount: () => Promise<void> | void;
  onOpenRegistration: () => void;
  onSignOut: () => Promise<void> | void;
  user: RegisteredUser | null;
}

type AppRoute = {
  focusedIcon: string;
  key: 'map' | 'prices' | 'profile';
  title: string;
  unfocusedIcon: string;
};

const routes: AppRoute[] = [
  {
    key: 'map',
    title: 'Kartta',
    focusedIcon: 'map-marker-radius',
    unfocusedIcon: 'map-marker-outline',
  },
  {
    key: 'prices',
    title: 'Hinnat',
    focusedIcon: 'cash-multiple',
    unfocusedIcon: 'cash',
  },
  {
    key: 'profile',
    title: 'Profiili',
    focusedIcon: 'account-circle',
    unfocusedIcon: 'account-outline',
  },
];

export default function MainTabs({
  onDeleteAccount,
  onOpenRegistration,
  onSignOut,
  user,
}: MainTabsProps) {
  const [index, setIndex] = useState(0);

  const renderScene = ({ route }: { route: AppRoute }) => {
    switch (route.key) {
      case 'map':
        return <MapScreen />;
      case 'prices':
        return <PricesScreen />;
      case 'profile':
        return (
          <ProfileScreen
            onDeleteAccount={onDeleteAccount}
            onOpenRegistration={onOpenRegistration}
            onSignOut={onSignOut}
            user={user}
          />
        );
      default:
        return null;
    }
  };

  return (
    <BottomNavigation
      activeColor={brandColors.forest}
      barStyle={styles.bar}
      inactiveColor={brandColors.forestSoft}
      navigationState={{ index, routes }}
      onIndexChange={setIndex}
      renderScene={renderScene}
      sceneAnimationEnabled
      shifting={false}
    />
  );
}

const styles = {
  bar: {
    backgroundColor: '#F6FFF9',
    borderTopColor: brandColors.lightMint,
    borderTopWidth: 1,
    height: 74 + tabBarBottomPadding,
    paddingBottom: tabBarBottomPadding,
  },
};
