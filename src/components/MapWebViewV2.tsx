import {
  Camera,
  MapView,
  UserLocation
} from '@maplibre/maplibre-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppStore } from '../store';

interface MapLibreBasicProps {
  latitude?: number;
  longitude?: number;
  zoom?: number;
  style?: object;
  theme?: 'light' | 'dark';
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
}) => {
  const theme = useAppStore(state => state.style) as 'light' | 'dark' | 'osm';

  return (
    <View style={[styles.container, style]}>
      <MapView
        style={{ flex: 1 }}
        mapStyle={mapStyles[theme] || mapStyles.light}
      >
        <Camera
          centerCoordinate={[longitude, latitude]}
          zoomLevel={zoom}
        />
        <UserLocation
          visible={true}
          showsUserHeadingIndicator={true}
        />
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