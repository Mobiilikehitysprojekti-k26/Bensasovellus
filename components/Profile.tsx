import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

function ProfileAvatar({ initials = 'KS', imageUri, bgColor = '#3b82f6' }: { initials?: string; imageUri?: string | null; bgColor?: string }) {
  if (imageUri) {
    return (
      <View style={styles.avatarContainer}>
        <Image source={{ uri: imageUri }} style={styles.avatarImage} />
        <Text style={styles.avatarLabel}>Profiilikuva</Text>
      </View>
    );
  }

  return (
    <View style={styles.avatarContainer}>
      <View style={[styles.avatarCircle, { backgroundColor: bgColor }]}> 
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <Text style={styles.avatarLabel}>Profiilikuva</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Lupa tarvitaan', 'Sallitaan gallerian käyttö, jotta profiilikuvaa voidaan vaihtaa.');
      }
    })();
  }, []);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: true,
        aspect: [1, 1],
      });

      if (!result.canceled) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Virhe', 'Kuvan valinta epäonnistui. Yritä uudelleen.');
    }
  };

  return (
    <View style={styles.container}>
      <ProfileAvatar initials="KS" imageUri={selectedImage} />

      <TouchableOpacity style={styles.changeButton} onPress={pickImage}>
        <Text style={styles.changeButtonText}>Valitse kuva</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Profiili</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  avatarLabel: {
    marginTop: 8,
    color: '#333',
  },
  changeButton: {
    backgroundColor: '#1d4ed8',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 20,
    alignItems: 'center',
  },
  changeButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  label: {
    fontSize: 16,
    marginTop: 10,
    color: '#555',
  },
  value: {
    fontSize: 18,
  },
});
