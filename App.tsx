import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import MapScreen from './components/MapScreen';
import PricesScreen from './components/Prices';
import ProfileScreen from './components/Profile';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: true,
          tabBarActiveTintColor: '#007aff',
          tabBarInactiveTintColor: '#555',
          tabBarStyle: {
            height: 64,
            borderTopWidth: 1,
            borderTopColor: '#ddd',
            backgroundColor: '#fff',
          },
          tabBarIcon: ({ color, size }) => {
            let iconName: React.ComponentProps<typeof MaterialCommunityIcons>['name'];

            if (route.name === 'Map') {
              iconName = 'map-marker';
            } else if (route.name === 'Prices') {
              iconName = 'currency-eur';
            } else if (route.name === 'Profile') {
              iconName = 'account-circle';
            } else {
              iconName = 'help-circle';
            }

            return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Map" component={MapScreen} />
        <Tab.Screen name="Prices" component={PricesScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

