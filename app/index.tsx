import { Ionicons } from '@expo/vector-icons';
import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import OpenStreetMap, { OpenStreetMapHandle } from "../components/OpenStreetMap";

export default function Index() {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(true);
  const mapRef = useRef<OpenStreetMapHandle>(null);

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
  // Force recenter even if props haven't changed
  mapRef.current?.recenter(loc.coords.latitude, loc.coords.longitude, 16);
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
      try {
        // Get an initial fix immediately
        const first = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setLocation({ latitude: first.coords.latitude, longitude: first.coords.longitude });
        setLocating(false);
  // Recenter map to initial position
  mapRef.current?.recenter(first.coords.latitude, first.coords.longitude, 16);
  } catch {
        setLocating(false);
      }
      // Then start watching for updates
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 5 },
        (loc) => {
          setLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
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
          ref={mapRef}
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
    backgroundColor: '#ffffffff',
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
