import apiService from '@/src/services/api';
import { useAppStore } from '@/src/store';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from "react";
import { Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapLibreBasic from '../src/components/MapWebViewV2';
import { useLocation } from "../src/hooks/useLocation";

export default function Index() {
  // Location hook
  const { userLocation, getCurrentLocation, requestPermission } = useLocation();
  // Api Service
  const [bounds, setBounds] = useState<any>(null);
  const [stops, setStops] = useState<any[]>([]);
  // Store
  //const { setMapCenter, setMapZoom, loading } = useAppStore();
  const { loading } = useAppStore();

  // Map center state
  const [mapCenter, setMapCenter] = useState({
    latitude: -15.793889,
    longitude: -47.882778,
    zoom: 12,
  });

  // Map initialization state
  const [initialized, setInitialized] = useState(false);

  // Map Camera
  const [cameraMode, setCameraMode] = useState<'auto' | 'free'>('auto');

  // Solicitar permissão ao montar
  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  // Centralizar no usuário ao iniciar
  useEffect(() => {
    if (userLocation && !initialized) {
      setMapCenter({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        zoom: 16,
      });
      setCameraMode('auto');
      setInitialized(true);
    }
  }, [userLocation]);

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
        setMapCenter({
          latitude: location.latitude,
          longitude: location.longitude,
          zoom: 16,
        });
        setCameraMode('auto');
        console.warn('camera mode changed to auto');
      }
    } catch (error) {
      console.error('Failed to get location:', error);
    }
  };

  const handleRegionDidChange = (
    bounds: { north: number; south: number; east: number; west: number; },
    center?: { latitude: number; longitude: number },
    zoom?: number
  ) => {
    setBounds(bounds);
    if (cameraMode === 'auto') {
      setCameraMode('free');
      console.warn('camera mode changed to free');
    }
    // if (center && zoom !== undefined) {
    //   setMapCenter({
    //     latitude: center.latitude,
    //     longitude: center.longitude,
    //     zoom,
    //   });
    // }
  };

  // Buscar paradas ao mudar os bounds
  useEffect(() => {
    if (!bounds) return;
    apiService.getStops(bounds)
      .then(setStops)
      .catch((error) => {
        //Alert.alert('Erro', 'Não foi possível carregar as paradas.');
        console.error('error ao buscar paradas', error);
      });
  }, [bounds]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>ÔnibusDF</Text>
      </View>
      <View style={styles.mapContainer}>
        <MapLibreBasic
          latitude={cameraMode === 'auto' ? mapCenter.latitude : undefined}
          longitude={cameraMode === 'auto' ? mapCenter.longitude : undefined}
          zoom={cameraMode === 'auto' ? mapCenter.zoom : undefined}
          style={{ flex: 1 }}
          theme='dark' // light,
          busStopMarker={stops.map(stop => ({
            id: stop.id,
            latitude: stop.latitude,
            longitude: stop.longitude,
            title: stop.nome,
          }))}
          onBusMarkerPress={marker => Alert.alert('Parada', marker.title || marker.id)}
          onRegionDidChange={handleRegionDidChange}
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