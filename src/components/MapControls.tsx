import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppStore } from '../store';

interface MapControlsProps {
  onLayerToggle?: (layer: string, enabled: boolean) => void;
  mapRef: React.RefObject<MapHandleLike>;
}

type MapHandleLike = {
  recenter: (lat: number, lng: number, zoom?: number) => void;
};

const MapControls: React.FC<MapControlsProps> = ({ onLayerToggle, mapRef }) => {
  const {
    showBuses,
    showStops,
    showOnlyActiveBuses,
    style: mapStyle,
    setShowBuses,
    setShowStops,
    setShowOnlyActiveBuses,
    setMapStyle,
  } = useAppStore();

  const handleToggle = (key: string, value: boolean) => {
    switch (key) {
      case 'buses':
        setShowBuses(value);
        onLayerToggle?.('buses', value);
        break;
      case 'stops':
        setShowStops(value);
        onLayerToggle?.('stops', value);
        break;
      case 'activeBuses':
        setShowOnlyActiveBuses(value);
        onLayerToggle?.('activeBuses', value);
        break;
    }
  };

  const handleStyleChange = () => {
    const styles = ['osm', 'stadia_dark', 'stadia_bright'] as const;
    const currentIndex = styles.indexOf(mapStyle);
    const nextIndex = (currentIndex + 1) % styles.length;
    setMapStyle(styles[nextIndex]);
  };

  const getStyleIcon = () => {
    switch (mapStyle) {
      case 'osm':
        return 'sunny-outline';
      case 'stadia_dark':
        return 'moon-outline';
      case 'stadia_bright':
        return 'sunny';
      default:
        return 'sunny-outline';
    }
  };

  const getStyleLabel = () => {
    switch (mapStyle) {
      case 'osm':
        return 'Padrão';
      case 'stadia_dark':
        return 'Escuro';
      case 'stadia_bright':
        return 'Claro';
      default:
        return 'Padrão';
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Controles do Mapa</Text>
      
      {/* Layer toggles */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Camadas</Text>
        
        <TouchableOpacity
          style={styles.control}
          onPress={() => handleToggle('buses', !showBuses)}
        >
          <View style={styles.controlContent}>
            <Ionicons
              name={showBuses ? 'bus' : 'bus-outline'}
              size={20}
              color={showBuses ? '#007AFF' : '#8E8E93'}
            />
            <Text style={[
              styles.controlLabel,
              { color: showBuses ? '#007AFF' : '#8E8E93' }
            ]}>
              Ônibus
            </Text>
          </View>
          <View style={[
            styles.toggle,
            { backgroundColor: showBuses ? '#007AFF' : '#E5E5EA' }
          ]}>
            <View style={[
              styles.toggleKnob,
              { transform: [{ translateX: showBuses ? 18 : 2 }] }
            ]} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.control}
          onPress={() => handleToggle('stops', !showStops)}
        >
          <View style={styles.controlContent}>
            <Ionicons
              name={showStops ? 'location' : 'location-outline'}
              size={20}
              color={showStops ? '#007AFF' : '#8E8E93'}
            />
            <Text style={[
              styles.controlLabel,
              { color: showStops ? '#007AFF' : '#8E8E93' }
            ]}>
              Paradas
            </Text>
          </View>
          <View style={[
            styles.toggle,
            { backgroundColor: showStops ? '#007AFF' : '#E5E5EA' }
          ]}>
            <View style={[
              styles.toggleKnob,
              { transform: [{ translateX: showStops ? 18 : 2 }] }
            ]} />
          </View>
        </TouchableOpacity>

        {showBuses && (
          <TouchableOpacity
            style={[styles.control, styles.subControl]}
            onPress={() => handleToggle('activeBuses', !showOnlyActiveBuses)}
          >
            <View style={styles.controlContent}>
              <Ionicons
                name={showOnlyActiveBuses ? 'flash' : 'flash-outline'}
                size={18}
                color={showOnlyActiveBuses ? '#007AFF' : '#8E8E93'}
              />
              <Text style={[
                styles.controlLabel,
                styles.subControlLabel,
                { color: showOnlyActiveBuses ? '#007AFF' : '#8E8E93' }
              ]}>
                Apenas Ativos
              </Text>
            </View>
            <View style={[
              styles.toggle,
              styles.subToggle,
              { backgroundColor: showOnlyActiveBuses ? '#007AFF' : '#E5E5EA' }
            ]}>
              <View style={[
                styles.toggleKnob,
                styles.subToggleKnob,
                { transform: [{ translateX: showOnlyActiveBuses ? 14 : 2 }] }
              ]} />
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Style selector */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Estilo do Mapa</Text>
        
        <TouchableOpacity
          style={styles.control}
          onPress={handleStyleChange}
        >
          <View style={styles.controlContent}>
            <Ionicons
              name={getStyleIcon()}
              size={20}
              color="#007AFF"
            />
            <Text style={styles.controlLabel}>
              {getStyleLabel()}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={16}
            color="#C7C7CC"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  control: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  subControl: {
    paddingLeft: 20,
    paddingVertical: 8,
  },
  controlContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  controlLabel: {
    fontSize: 16,
    fontWeight: '400',
    marginLeft: 12,
    color: '#1C1C1E',
  },
  subControlLabel: {
    fontSize: 14,
  },
  toggle: {
    width: 40,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  subToggle: {
    width: 32,
    height: 20,
    borderRadius: 10,
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  subToggleKnob: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
});

export default MapControls;
