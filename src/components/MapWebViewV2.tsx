import {
  Callout,
  Camera,
  MapView,
  PointAnnotation,
  UserLocation
} from '@maplibre/maplibre-react-native';
import React, { useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
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
  const theme = useAppStore(state => state.style) as 'light' | 'dark' | 'osm';
  const [currentZoom, setCurrentZoom] = React.useState(zoom ?? 12);
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const fadeAnim = React.useRef(new Animated.Value(1)).current;

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
  const handleBusSelect = (busId: string) => {
    console.log('Bus select:', busId);
    if (selectedBusId === busId) {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setSelectedBusId(null));
    } else {
      fadeAnim.setValue(1); // Reset opacity imediatamente
      setSelectedBusId(busId);
    }
  };
  
  return (
    <View style={[styles.container, style]}>
      <MapView
        style={{ flex: 1 }}
        mapStyle={mapStyles[theme] || mapStyles.light}
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
        {currentZoom >= 11 && buses && buses.map((bus: BusMarker) => (
          <PointAnnotation
            key={bus.id}
            id={bus.id}
            coordinate={[bus.longitude, bus.latitude]}
            onSelected={() => handleBusSelect(bus.id)}
          >
            <View style={{
              width: 40,
              height: 40,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
            }}>
              <View style={{
                width: 27,
                height: 27,
                backgroundColor: '#FFD600',
                borderRadius: 13.5,
                borderWidth: 2,
                borderColor: '#a91a1aff',
                justifyContent: 'center',
                alignItems: 'center',
              }} />
            </View>
            <>
              {selectedBusId === bus.id && (
                <Callout>
                  <Animated.View style={{ opacity: fadeAnim }}>
                    <View style={{ padding: 8 }}>
                      <Text style={{ fontWeight: 'bold' }}>{bus.title || bus.id}</Text>
                    </View>
                  </Animated.View>
                </Callout>
              )}
            </>
          </PointAnnotation>
        ))}
      </MapView>
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
});

export default MapLibreBasic;