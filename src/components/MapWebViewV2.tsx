import {
  Camera,
  MapView,
  PointAnnotation,
  UserLocation
} from '@maplibre/maplibre-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppStore } from '../store';

interface BusStopMarker {
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
  onRegionDidChange?: (bounds: {north: number, south: number, east: number, west: number}) => void;
  onBusMarkerPress?: (busStopMarker: BusStopMarker) => void;
  busStopMarker?: BusStopMarker[];
}

const mapStyles = {
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  osm: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json', // fallback
};

const MapLibreBasic: React.FC<MapLibreBasicProps> = ({
  latitude = -15.793889, // Brasília
  longitude = -47.882778,
  zoom = 12,
  style = {},
  onRegionDidChange,
  busStopMarker = [],
  onBusMarkerPress,
}) => {
  const theme = useAppStore(state => state.style) as 'light' | 'dark' | 'osm';

  const handleRegionDidChange = async (event: any) => {
    if (onRegionDidChange && event && event.properties && event.properties.visibleBounds) {
      const [[west, south], [east, north]] = event.properties.visibleBounds;
      onRegionDidChange({ north, south, east, west });
    }
  };
  
  return (
    <View style={[styles.container, style]}>
      <MapView
        style={{ flex: 1 }}
        mapStyle={mapStyles[theme] || mapStyles.light}
        onRegionDidChange={handleRegionDidChange}
      >
        <Camera
          centerCoordinate={[longitude, latitude]}
          zoomLevel={zoom}
        />
        <UserLocation
          visible={true}
          showsUserHeadingIndicator={true}
        />
        {busStopMarker.map((busStop: BusStopMarker) => (
          <PointAnnotation
            key={busStop.id}
            id={busStop.id}
            coordinate={[busStop.longitude, busStop.latitude]}
            onSelected={() => onBusMarkerPress?.(busStop)}
          >
          <View style={{
              width: 18,
              height: 18,
              backgroundColor: '#007AFF',
              borderRadius: 9,
              borderWidth: 2,
              borderColor: '#fff'
            }}
          />
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