import { Ionicons } from '@expo/vector-icons';
import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import OpenStreetMap from "../components/OpenStreetMap";

export default function Index() {
  console.log('Index component rendered with OpenStreetMap');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(true);

  // Locate user position
  const getLocation = async () => {
    setLocating(true);
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setLocating(false);
      return;
    }
    let loc = await Location.getCurrentPositionAsync({});
    setLocation({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    });
    setLocating(false);
  };

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    (async () => {
      setLocating(true);
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocating(false);
        return;
      }
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 5 },
        (loc) => {
          setLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
          // hide only while first fix is pending; subsequent watch updates should keep marker visible
          setLocating(false);
        }
      );
    })();
    return () => {
      if (subscription) subscription.remove();
    };
  }, []);
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>ÔnibusDF</Text>
      </View>
      <View style={styles.mapContainer}>
        <OpenStreetMap 
          latitude={location?.latitude}
          longitude={location?.longitude}
          zoom={16}
          showUserMarker={!!location && !locating}
        />
        <TouchableOpacity style={styles.locateButton} onPress={getLocation}>
          <Ionicons name="locate" size={28} color="#007AFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 15,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333333',
  },
  mapContainer: {
    flex: 1,
    padding: 10,
  },
  locateButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#fff',
    borderRadius: 24,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
});
