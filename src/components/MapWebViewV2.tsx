import MapLibreGL from '@maplibre/maplibre-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';

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
};

const MapLibreBasic: React.FC<MapLibreBasicProps> = ({
  latitude = -15.793889, // Brasília
  longitude = -47.882778,
  zoom = 12,
  style = {},
  theme = 'light',
}) => {
  return (
    <View style={[styles.container, style]}>
      <MapLibreGL.MapView
        style={{ flex: 1 }}
        mapStyle={mapStyles[theme]}
      >
        <MapLibreGL.Camera
          centerCoordinate={[longitude, latitude]}
          zoomLevel={zoom}
        />
      </MapLibreGL.MapView>
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