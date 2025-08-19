import MapControls from '@/src/components/MapControlsModern';
import MapWebView, { MapWebViewHandle } from '@/src/components/MapWebView';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from "react";
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocation } from "../src/hooks/useLocation";
import { useAppStore } from "../src/store";

export default function Index() {
  const mapRef = useRef<MapWebViewHandle>(null);

  // Location hook
  const { userLocation, getCurrentLocation, requestPermission } = useLocation();

  // Store
  const { setMapCenter, setMapZoom, loading } = useAppStore();

  // Centralizar no usuário
  const handleLocatePress = async () => {
    try {
      const location = await getCurrentLocation();
      if (location && mapRef.current) {
        setMapCenter(location.latitude, location.longitude);
        setMapZoom(16);
        mapRef.current.recenter?.(location.latitude, location.longitude, 16);
        mapRef.current.setUserMarkerVisible(true);
        mapRef.current.showToast('Localização atualizada', 2000);
      }
    } catch (error) {
      console.error('Failed to get location:', error);
    }
  };

  // Solicitar permissão ao montar
  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  // Map pronto
  const handleMapReady = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.recenter?.(userLocation.latitude, userLocation.longitude, 16);
    }
  };

  // Erro no mapa
  const handleMapError = (error: string) => {
    console.error('Map error:', error);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>ÔnibusDF</Text>
      </View>
      <View style={styles.mapContainer}>
        <MapWebView
          ref={mapRef}
          onMapReady={handleMapReady}
          onMapError={handleMapError}
        />
        {/* Pass mapRef as MapWebViewHandle, not MapHandle */}
        <MapControls mapRef={mapRef as any} />
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