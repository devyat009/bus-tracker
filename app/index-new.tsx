import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from "react";
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Map, { MapHandle } from "../src/components/Map";
import { useLocation } from "../src/hooks/useLocation";
import { useAppStore } from "../src/store";

export default function Index() {
  const mapRef = useRef<MapHandle>(null);
  
  // Use the new location hook
  const { userLocation, getCurrentLocation, requestPermission } = useLocation();
  
  // Use the app store
  const { 
    setMapCenter, 
    setMapZoom,
    loading 
  } = useAppStore();

  // Handle location button press
  const handleLocatePress = async () => {
    try {
      const location = await getCurrentLocation();
      if (location && mapRef.current) {
        // Update store and recenter map
        setMapCenter(location.latitude, location.longitude);
        setMapZoom(16);
        mapRef.current.recenter(location.latitude, location.longitude, 16);
      }
    } catch (error) {
      console.error('Failed to get location:', error);
    }
  };

  // Request permission on mount
  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  // Handle map ready
  const handleMapReady = () => {
    console.log('Map component is ready');
    if (userLocation && mapRef.current) {
      mapRef.current.recenter(userLocation.latitude, userLocation.longitude, 16);
    }
  };

  // Handle map errors
  const handleMapError = (error: string) => {
    console.error('Map error:', error);
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>ÔnibusDF</Text>
      </View>
      <View style={styles.mapContainer}>
        <Map 
          ref={mapRef}
          onMapReady={handleMapReady}
          onMapError={handleMapError}
        />
        <TouchableOpacity 
          style={styles.locateButton} 
          onPress={handleLocatePress}
          disabled={loading.location}
        >
          <Ionicons 
            name={loading.location ? "hourglass" : "locate"} 
            size={28} 
            color={loading.location ? "#999" : "#007AFF"} 
          />
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
    marginTop: 25,
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
