import { Ionicons } from '@expo/vector-icons';
import { useEffect } from "react";
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapLibreBasic from '../src/components/MapWebViewV2';
import { useLocation } from "../src/hooks/useLocation";
import { useAppStore } from "../src/store";

export default function Index() {
  // Location hook
  const { userLocation, getCurrentLocation, requestPermission } = useLocation();

  // Store
  const { setMapCenter, setMapZoom, loading } = useAppStore();

  // Centralizar no usuário
  const handleLocatePress = async () => {
    try {
      const permission = await requestPermission();
      if (!permission) {
        console.warn('Permissão de localização negada');
        return;
      }
      const location = await getCurrentLocation();
      if (location) {
        setMapCenter(location.latitude, location.longitude);
        setMapZoom(16);
        // O MapLibreBasic vai receber novas props e centralizar via props
      }
    } catch (error) {
      console.error('Failed to get location:', error);
    }
  };

  // Solicitar permissão ao montar
  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>ÔnibusDF</Text>
      </View>
      <View style={styles.mapContainer}>
        <MapLibreBasic
          latitude={userLocation?.latitude ?? -15.793889}
          longitude={userLocation?.longitude ?? -47.882778}
          zoom={12}
          style={{ flex: 1 }}
          theme='dark' // light
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
    padding: 8,
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