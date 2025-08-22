import {
  Camera,
  MapView,
  PointAnnotation,
  UserLocation
} from '@maplibre/maplibre-react-native';
import React, { useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useAppStore } from '../store';

interface BusStopMarker {
  id: string;
  latitude: number;
  longitude: number;
  title?: string;
}

interface BusMarker {
  id: string;
  latitude: number;
  longitude: number;
  title?: string;
  prefixo?: string;
  linha?: string;
  velocidade?: number;
  sentido?: string;
  datalocal?: string;
  operadora?: {
    nome: string;
    servico: string;
    tipoOnibus: string;
    dataReferencia: string;
  };
  corOperadora?: string;
}

interface MapLibreBasicProps {
  latitude?: number;
  longitude?: number;
  zoom?: number;
  style?: object;
  theme?: 'light' | 'dark';
  onRegionDidChange?: (bounds: {north: number, south: number, east: number, west: number}, center?: {latitude: number, longitude: number}, zoom?: number) => void;
  onBusStopMarkerPress?: (busStopMarker: BusStopMarker) => void;
  busStopMarker?: BusStopMarker[];

  buses?: BusMarker[];
  onBusMarkerPress?: (bus: BusMarker) => void;
}

const mapStyles = {
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  osm: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json', // fallback
};

const MapLibreBasic: React.FC<MapLibreBasicProps> = ({
  latitude,
  longitude,
  zoom,
  style = {},
  onRegionDidChange,

  // Paradas de onibus
  busStopMarker = [],
  onBusStopMarkerPress,

  // Onibus
  onBusMarkerPress,
  buses = [],
}) => {
  const mapTheme = useAppStore(state => state.style) as 'light' | 'dark' | 'osm';
  const appTheme = useAppStore(state => state.appTheme);
  const [currentZoom, setCurrentZoom] = React.useState(zoom ?? 12);
  const [selectedBus, setSelectedBus] = useState<BusMarker | null>(null);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const [isFetching, setIsFetching] = React.useState(false);
  const progressAnim = React.useRef(new Animated.Value(0)).current;

  // Atualiza o zoom quando a prop muda (ao recentralizar)
  React.useEffect(() => {
    if (zoom !== undefined) {
      setCurrentZoom(zoom);
    }
  }, [zoom]);

  // Manipula a mudança de região
  const handleRegionDidChange = async (event: any) => {
    if (onRegionDidChange && event && event.properties && event.properties.visibleBounds) {
      const [[west, south], [east, north]] = event.properties.visibleBounds;
      // Extrai centro e zoom do evento
      const center = event.geometry?.coordinates
        ? { longitude: event.geometry.coordinates[0], latitude: event.geometry.coordinates[1] }
        : undefined;
      const zoomLevel = event.properties.zoomLevel;
      setCurrentZoom(zoomLevel); // Atualiza o zoom local
      onRegionDidChange({ north, south, east, west }, center, zoomLevel);

    }
  };

  // Manipulao ao selecionar um onibus
  const handleBusSelect = (bus: BusMarker) => {
    if (selectedBus?.id === bus.id) {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setSelectedBus(null));
    } else {
      setSelectedBus(bus);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
      
      // Auto fade-out após 5 segundos
      setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setSelectedBus(null));
      }, 5000);
    }
  };

  // Simula busca dos ônibus a cada 5 segundos
  React.useEffect(() => {
    const fetchBuses = () => {
      setIsFetching(true);
      progressAnim.setValue(0);
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start(() => {
        setIsFetching(false);
        progressAnim.setValue(0);
      });
    };

    fetchBuses(); // Busca inicial
    const interval = setInterval(fetchBuses, 5000);
    return () => clearInterval(interval);
  }, [progressAnim]);
  
  return (
    <View style={[styles.container, style]}>
      {/* Barrinha azul de busca */}
      {isFetching && (
        <Animated.View
          style={[
            styles.fetchBar,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      )}
      <MapView
        style={{ flex: 1 }}
        mapStyle={mapStyles[mapTheme] || mapStyles.light}
        onRegionDidChange={handleRegionDidChange}
      >
        {latitude !== undefined && longitude !== undefined && zoom !== undefined ? (
          <Camera
              centerCoordinate={[longitude, latitude]}
              zoomLevel={zoom}
            />
          ) : (
          <Camera />
        )}
        <UserLocation
          visible={true}
          showsUserHeadingIndicator={true}
        />

        {/* Paradas de ônibus */}
        {currentZoom >= 14 && busStopMarker.map((busStop: BusStopMarker) => (
          <PointAnnotation
            key={busStop.id}
            id={busStop.id}
            coordinate={[busStop.longitude, busStop.latitude]}
            onSelected={() => onBusStopMarkerPress?.(busStop)}
          >
          <View style={{
              width: 35,
              height: 35,
              backgroundColor: '#007AFF',
              borderRadius: 9,
              borderWidth: 2,
              borderColor: '#fff'
            }}
          />
          </PointAnnotation>
        ))}

        {/* Ônibus */}
        {currentZoom >= 13 && buses && buses.map((bus: BusMarker) => (
          <PointAnnotation
            key={bus.id}
            id={bus.id}
            coordinate={[bus.longitude, bus.latitude]}
            onSelected={() => handleBusSelect(bus)}
          >
            <View style={{
              width: 40,
              height: 40,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
            }}>
              <View style={{
                width: 30,
                height: 30,
                backgroundColor: bus.corOperadora || '#5a4799',
                borderRadius: 15,
                borderWidth: 2,
                borderColor: '#fff',
                justifyContent: 'center',
                alignItems: 'center',
                shadowColor: '#000',
                shadowOpacity: 0.3,
                shadowRadius: 3,
                shadowOffset: { width: 0, height: 1 },
              }} />
            </View>
          </PointAnnotation>
        ))}
      </MapView>
      
      {/* Popup customizado fora do mapa */}
      {selectedBus && (
        <Animated.View style={[
          styles.customPopup, 
          { opacity: fadeAnim },
          { backgroundColor: appTheme === 'dark' ? '#333' : 'white' }
        ]}>
          <View style={styles.popupContent}>
            <Text style={[styles.popupTitle, { color: appTheme === 'dark' ? '#fff' : '#333' }]}>
              Linha {selectedBus.linha}
            </Text>
            <Text style={[styles.popupSubtitle, { color: appTheme === 'dark' ? '#ccc' : '#666' }]}>
              Prefixo: {selectedBus.prefixo}
            </Text>
            {selectedBus.operadora && (
              <Text style={[styles.popupOperator, { color: appTheme === 'dark' ? '#fff' : '#444' }]}>
                Operadora: {selectedBus.operadora.nome}
              </Text>
            )}
            {selectedBus.velocidade && (
              <Text style={[styles.popupInfo, { color: appTheme === 'dark' ? '#ddd' : '#444' }]}>
                Velocidade: {selectedBus.velocidade.toFixed(1)} km/h
              </Text>
            )}
            {selectedBus.sentido && (
              <Text style={[styles.popupInfo, { color: appTheme === 'dark' ? '#ddd' : '#444' }]}>
                Sentido: {selectedBus.sentido === '1' ? 'Ida' : selectedBus.sentido === '2' ? 'Volta' : selectedBus.sentido}
              </Text>
            )}
            {selectedBus.datalocal && (
              <Text style={[styles.popupTimestamp, { color: appTheme === 'dark' ? '#aaa' : '#888' }]}>
                Atualizado: {new Date(selectedBus.datalocal).toLocaleTimeString('pt-BR')}
              </Text>
            )}
          </View>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 300,
    borderRadius: 10,
    overflow: 'hidden',
  },
  customPopup: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    borderRadius: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  popupContent: {
    padding: 12,
  },
  popupTitle: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  popupSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  popupOperator: {
    fontSize: 13,
    marginTop: 4,
    fontWeight: '600',
  },
  popupInfo: {
    fontSize: 12,
    marginTop: 2,
  },
  popupTimestamp: {
    fontSize: 10,
    marginTop: 4,
    fontStyle: 'italic',
  },
  fetchBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 4,
    backgroundColor: '#2196F3',
    zIndex: 10,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
});

export default MapLibreBasic;