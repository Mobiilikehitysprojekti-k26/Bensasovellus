import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Map from './Map';
import * as Location from 'expo-location';
import { Region } from 'react-native-maps';
import { StatusBar } from 'expo-status-bar';

const initialRegion: Region = {
  latitude: 60.1699,
  longitude: 24.9384,
  latitudeDelta: 0.05,
  longitudeDelta: 0.03,
};

export default function MapScreen() {
  const [location, setLocation] = useState<Region | null>(null);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async (): Promise<void> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        setLocation(null);
        console.log('Permission denied', 'Location permission required to show current position');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.03,
      });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {location ? <Map region={location} /> : <ActivityIndicator size="large" />}
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
