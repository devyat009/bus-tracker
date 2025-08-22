import apiService from '@/src/services/api';
import { useAppStore } from '@/src/store';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from "react";
import { Alert, Modal, SafeAreaView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import MapLibreBasic from '../src/components/MapWebViewV2';
import { useLocation } from "../src/hooks/useLocation";

export default function Index() {
  // Location hook
  const { userLocation, getCurrentLocation, requestPermission, watchLocation } = useLocation();
  // Api Service
  const [bounds, setBounds] = useState<any>(null);
  const [stops, setStops] = useState<any[]>([]);
  const [buses, setBuses] = useState<any[]>([]);
  // Store
  const { 
    loading, 
    style: mapTheme, 
    appTheme,
    showOnlyActiveBuses,
    showStops: showStopsStore,
    showTraffic,
    setShowOnlyActiveBuses,
    setShowStops: setShowStopsStore,
    setShowTraffic
  } = useAppStore();

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

  // Settings modal
  const [showSettings, setShowSettings] = useState(false);

  // Solicitar permissão ao montar e iniciar watch de localização
  useEffect(() => {
    let subscription: any = null;
    
    const startLocationWatch = async () => {
      await requestPermission();
      subscription = await watchLocation();
    };
    
    startLocationWatch();
    
    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [requestPermission, watchLocation]);

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
  }, [userLocation, initialized]);

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
      }
    } catch (error) {
      console.error('Failed to get location:', error);
    }
  };

  // Configuracoes
  const handleConfigPress = async () => {
    setShowSettings(true);
  }
  
  // Atualiza os bounds quando move o mapa
  const handleRegionDidChange = (
    bounds: { north: number; south: number; east: number; west: number; },
    center?: { latitude: number; longitude: number },
    zoom?: number
  ) => {
    setBounds(bounds);
    if (cameraMode === 'auto') {
      setCameraMode('free');
    }
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

  // Buscar os onibus
  useEffect(() => {
    let interval: number;
    const fetchBuses = async () => {
      if (!bounds) return;
      try {
        const result = await apiService.getEnhancedBuses(bounds);
        const filteredBuses = showOnlyActiveBuses 
          ? result.filter(bus => bus.linha && bus.linha.trim())
          : result;
        setBuses(filteredBuses.map(bus => ({
          id: bus.id,
          latitude: bus.latitude,
          longitude: bus.longitude,
          title: `Linha ${bus.linha} - ${bus.prefixo}`,
          prefixo: bus.prefixo,
          linha: bus.linha,
          velocidade: bus.velocidade,
          sentido: bus.sentido,
          datalocal: bus.datalocal,
          operadora: bus.operadora,
          corOperadora: bus.corOperadora,
        })));
      } catch (error) {
        console.error('Erro ao buscar ônibus', error);
      }
    };

    fetchBuses();
    interval = setInterval(fetchBuses, 8000); // Atualiza a cada 8 segundos

    return () => clearInterval(interval);
  }, [bounds, showOnlyActiveBuses]);
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: appTheme === 'dark' ? '#000' : '#fff' }]}>
      <View style={[styles.header, { backgroundColor: appTheme === 'dark' ? '#000' : '#fff' }]}>
        <Text style={[styles.title, { color: appTheme === 'dark' ? '#fff' : '#333' }]}>ÔnibusDF</Text>
      </View>
      <View style={styles.mapContainer}>
        <MapLibreBasic
          latitude={cameraMode === 'auto' ? mapCenter.latitude : undefined}
          longitude={cameraMode === 'auto' ? mapCenter.longitude : undefined}
          zoom={cameraMode === 'auto' ? mapCenter.zoom : undefined}
          style={{ flex: 1 }}
          theme={mapTheme as 'light' | 'dark'} // Usar tema do mapa do store
          // Paradas de onibus
          busStopMarker={showStopsStore ? stops.map(stop => ({
            id: stop.id,
            latitude: stop.latitude,
            longitude: stop.longitude,
            title: stop.nome,
          })) : []}
          onBusStopMarkerPress={marker => Alert.alert('Parada', marker.title || marker.id)}
          // Map change
          onRegionDidChange={handleRegionDidChange}
          // Traffic
          showTraffic={showTraffic}
          // Onibus
          buses={buses}
          onBusMarkerPress={bus => Alert.alert('Ônibus', bus.title || bus.id)}
        />

        {/* Botão de Localização */}
        <TouchableOpacity
          style={[styles.locateButton, { backgroundColor: appTheme === 'dark' ? '#333' : '#fff' }]}
          onPress={handleLocatePress}
          disabled={loading.location}
        >
          <Ionicons
            name={loading.location ? "hourglass" : "locate"}
            size={28}
            color={loading.location ? "#999" : "#007AFF"}
          />
        </TouchableOpacity>

        {/* Botão de Configurações */}
        <TouchableOpacity
          style={[styles.configButton, { backgroundColor: appTheme === 'dark' ? '#333' : '#fff' }]}
          onPress={handleConfigPress}
        >
          <Ionicons
            name="settings"
            size={28}
            color={appTheme === 'dark' ? '#999' : '#007AFF'}
          />
        </TouchableOpacity>
      </View>

      {/* Modal de Configurações */}
      <Modal
        visible={showSettings}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: appTheme === 'dark' ? '#333' : '#fff' }]}>
            <Text style={[styles.modalTitle, { color: appTheme === 'dark' ? '#fff' : '#333' }]}>
              Configurações
            </Text>
            
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: appTheme === 'dark' ? '#fff' : '#333' }]}>
                Apenas ônibus ativos
              </Text>
              <Switch
                value={showOnlyActiveBuses}
                onValueChange={setShowOnlyActiveBuses}
                trackColor={{ 
                  false: '#767577', 
                  true: appTheme === 'dark' ? '#81b0ff' : '#81b0ff' 
                }}
                thumbColor={showOnlyActiveBuses ? (appTheme === 'dark' ? '#007AFF' : '#007AFF') : '#f4f3f4'}
              />
            </View>

            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: appTheme === 'dark' ? '#fff' : '#333' }]}>
                Mostrar paradas
              </Text>
              <Switch
                value={showStopsStore}
                onValueChange={setShowStopsStore}
                trackColor={{ 
                  false: '#767577', 
                  true: appTheme === 'dark' ? '#81b0ff' : '#81b0ff' 
                }}
                thumbColor={showStopsStore ? (appTheme === 'dark' ? '#007AFF' : '#007AFF') : '#f4f3f4'}
              />
            </View>

            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: appTheme === 'dark' ? '#fff' : '#333' }]}>
                Mostrar trânsito
              </Text>
              <Switch
                value={showTraffic}
                onValueChange={setShowTraffic}
                trackColor={{ 
                  false: '#767577', 
                  true: appTheme === 'dark' ? '#81b0ff' : '#81b0ff' 
                }}
                thumbColor={showTraffic ? (appTheme === 'dark' ? '#007AFF' : '#007AFF') : '#f4f3f4'}
              />
            </View>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowSettings(false)}
            >
              <Text style={styles.closeButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    marginTop: 25,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  mapContainer: {
    flex: 1,
    padding: 8,
  },
  locateButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
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
  configButton: {
    position: 'absolute',
    bottom: 84,
    right: 24,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    margin: 20,
    borderRadius: 10,
    padding: 20,
    width: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  settingLabel: {
    fontSize: 16,
  },
  closeButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});