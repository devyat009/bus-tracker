import React, { useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocation } from '../hooks/useLocation';
import { useAppStore } from '../store';
import { MapHandle } from './Map';

interface MapControlsProps {
  mapRef: React.RefObject<MapHandle>;
}

const MapControls = ({ mapRef }: MapControlsProps) => {
  const {
    showBuses,
    showStops,
    selectedLines,
    setShowBuses,
    setShowStops,
    setSelectedLines,
  } = useAppStore();

  const { getCurrentLocation } = useLocation();

  const toggleBuses = useCallback(() => {
    setShowBuses(!showBuses);
  }, [showBuses, setShowBuses]);

  const toggleStops = useCallback(() => {
    setShowStops(!showStops);
  }, [showStops, setShowStops]);
  
  const clearSelectedLines = useCallback(() => {
    setSelectedLines([]);
  }, [setSelectedLines]);

  // Recenter map on user location
  const handleRecenter = useCallback(async () => {
    try {
      mapRef.current?.showLoading('Obtendo localização...', 20);
      
      const location = await getCurrentLocation();
      console.warn('location',location);
      if (location && mapRef.current) {
        console.log('Centering map on user location:', location);
        mapRef.current.setUserPosition(location.latitude, location.longitude, 16);
        mapRef.current.setUserMarkerVisible(true);
        mapRef.current.showToast('Localização atualizada', 2000);
      } else {
        console.log('Failed to get current location:', location);
        mapRef.current?.showToast('Não foi possível obter sua localização', 3000);
      }
    } catch (error) {
      console.error('Error getting location:', error);
      mapRef.current?.showToast('Erro ao obter localização', 3000);
    } finally {
      mapRef.current?.hideLoading();
    }
  }, [getCurrentLocation, mapRef]);

  // Clear the bus route
  const handleClearRoute = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.setBusRoute('');
      mapRef.current.showToast('Rota limpa', 1500);
    }
    clearSelectedLines();
  }, [mapRef, clearSelectedLines]);

  // Show the bus route
  const handleShowRoute = useCallback(() => {
    if (selectedLines.length > 0 && mapRef.current) {
      mapRef.current.showLoading('Carregando rota...', 50);
      mapRef.current.setBusRoute(selectedLines[0]);
      setTimeout(() => {
        mapRef.current?.hideLoading();
      }, 1500);
    }
  }, [selectedLines, mapRef]);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.button, showBuses && styles.buttonActive]}
          onPress={toggleBuses}
        >
          <Text style={[styles.buttonText, showBuses && styles.buttonTextActive]}>
            🚌 Ônibus
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, showStops && styles.buttonActive]}
          onPress={toggleStops}
        >
          <Text style={[styles.buttonText, showStops && styles.buttonTextActive]}>
            🚏 Paradas
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.locationButton]}
          onPress={handleRecenter}
        >
          <Text style={[styles.buttonText, styles.locationButtonText]}>
            📍
          </Text>
        </TouchableOpacity>
      </View>

      {selectedLines.length > 0 && (
        <>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.button, styles.routeButton]}
              onPress={handleShowRoute}
            >
              <Text style={[styles.buttonText, styles.routeButtonText]}>
                📍 Mostrar Rota
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.clearButton]}
              onPress={handleClearRoute}
            >
              <Text style={[styles.buttonText, styles.clearButtonText]}>
                ✕ Limpar
              </Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.selectedLinesContainer}>
            <Text style={styles.selectedLinesTitle}>Linhas selecionadas:</Text>
            <View style={styles.linesChips}>
              {selectedLines.map((line, index) => (
                <View key={index} style={styles.lineChip}>
                  <Text style={styles.lineChipText}>{line}</Text>
                </View>
              ))}
            </View>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    margin: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  buttonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  buttonTextActive: {
    color: '#fff',
  },
  locationButton: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
    minWidth: 48,
  },
  locationButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  routeButton: {
    backgroundColor: '#FF9500',
    borderColor: '#FF9500',
  },
  routeButtonText: {
    color: '#fff',
  },
  clearButton: {
    backgroundColor: '#FF3B30',
    borderColor: '#FF3B30',
  },
  clearButtonText: {
    color: '#fff',
  },
  selectedLinesContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f1f3f4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  selectedLinesTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  linesChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  lineChip: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 6,
    marginBottom: 4,
  },
  lineChipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default MapControls;
