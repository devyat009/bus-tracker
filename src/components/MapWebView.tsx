import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useAutoRefresh, useDataFetching } from '../hooks/useDataFetching';
import { useLocation } from '../hooks/useLocation';
import { selectFilteredBuses, useAppStore } from '../store';
import { MapBounds } from '../types';

interface MapWebViewProps {
  onMapReady?: () => void;
  onMapError?: (error: string) => void;
}

const MapWebView: React.FC<MapWebViewProps> = ({
  onMapReady,
  onMapError,
}) => {
  const webViewRef = useRef<WebView>(null);
  const {
    style: mapStyle,
    showBuses,
    showStops,
    showOnlyActiveBuses,
    selectedLines,
    center,
    zoom,
    stops,
    lines,
    setMapCenter,
    setMapZoom,
  } = useAppStore();

  const buses = useAppStore(selectFilteredBuses);
  const { userLocation } = useLocation();
  const { fetchBuses, fetchStops, fetchLines } = useDataFetching();

  // Calculate bounds for data fetching
  const getBoundsForFetching = useCallback((): MapBounds | undefined => {
    // This would be calculated based on the current map view
    // For now, returning undefined to fetch all data
    return undefined;
  }, []);

  const bounds = getBoundsForFetching();
  useAutoRefresh(bounds, 10000);

  // Handle messages from WebView
  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      
      switch (message.type) {
        case 'log':
          console.log(`[WebView:${message.tag}]`, message.msg, message.extra);
          break;
          
        case 'mapReady':
          onMapReady?.();
          break;
          
        case 'mapError':
          onMapError?.(message.error);
          break;
          
        case 'mapMoved':
          if (message.center && message.zoom) {
            setMapCenter(message.center.lat, message.center.lng);
            setMapZoom(message.zoom);
          }
          break;
          
        case 'fetch':
          // Handle fetch requests from WebView
          handleWebViewFetch(message.id, message.url);
          break;
          
        case 'setMapStyle':
          // This could be handled by the store directly
          break;
          
        default:
          console.warn('Unknown message type from WebView:', message.type);
      }
    } catch (error) {
      console.error('Failed to parse WebView message:', error);
    }
  }, [onMapReady, onMapError, setMapCenter, setMapZoom]);

  // Handle fetch requests from WebView (bypass CORS)
  const handleWebViewFetch = useCallback(async (id: number, url: string) => {
    try {
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store',
      });
      
      const text = await response.text();
      
      // Send response back to WebView
      webViewRef.current?.postMessage(JSON.stringify({
        type: 'fetchResponse',
        id,
        ok: response.ok,
        status: response.status,
        text,
      }));
    } catch (error) {
      // Send error back to WebView
      webViewRef.current?.postMessage(JSON.stringify({
        type: 'fetchResponse',
        id,
        ok: false,
        status: 0,
        text: '',
      }));
    }
  }, []);

  // Send data to WebView when it changes
  useEffect(() => {
    if (!webViewRef.current) return;

    webViewRef.current.postMessage(JSON.stringify({
      type: 'updateData',
      data: {
        buses,
        stops,
        lines,
        userLocation,
        mapStyle,
        showBuses,
        showStops,
        showOnlyActiveBuses,
        selectedLines,
      },
    }));
  }, [buses, stops, lines, userLocation, mapStyle, showBuses, showStops, showOnlyActiveBuses, selectedLines]);

  // Initialize data fetching
  useEffect(() => {
    fetchLines(); // Lines are fetched once and cached
    fetchBuses(bounds);
    fetchStops(bounds);
  }, [fetchLines, fetchBuses, fetchStops, bounds]);

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster/dist/MarkerCluster.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster/dist/MarkerCluster.Default.css" />
  <style>
    html, body, #map {
      height: 100%;
      margin: 0;
      padding: 0;
    }
    
    .loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 20px;
      border-radius: 8px;
      z-index: 1000;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="loading" class="loading" style="display: none;">Loading...</div>
  
  <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet.markercluster/dist/leaflet.markercluster.js"></script>
  <script>
    // Initialize map
    const map = L.map('map').setView([${center.latitude}, ${center.longitude}], ${zoom});
    
    // Map layers will be managed by React Native
    let currentLayer = null;
    let busLayer = null;
    let stopLayer = null;
    let routeLayer = null;
    
    // Initialize with default OSM layer
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    });
    osmLayer.addTo(map);
    currentLayer = osmLayer;
    
    // Notify React Native that map is ready
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'mapReady'
    }));
    
    // Handle messages from React Native
    window.addEventListener('message', function(event) {
      const message = JSON.parse(event.data);
      
      switch(message.type) {
        case 'updateData':
          updateMapData(message.data);
          break;
        case 'setMapStyle':
          setMapStyle(message.style);
          break;
      }
    });
    
    function updateMapData(data) {
      // Update buses, stops, lines, etc.
      console.log('Updating map data:', data);
    }
    
    function setMapStyle(style) {
      // Implementation for changing map style
      console.log('Setting map style:', style);
    }
    
    // Listen for map events
    map.on('moveend', function() {
      const center = map.getCenter();
      const zoom = map.getZoom();
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'mapMoved',
        center: { lat: center.lat, lng: center.lng },
        zoom: zoom
      }));
    });
  </script>
</body>
</html>
  `;

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: htmlContent }}
        style={styles.webView}
        onMessage={handleMessage}
        allowFileAccess={true}
        allowFileAccessFromFileURLs={true}
        allowUniversalAccessFromFileURLs={true}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          onMapError?.(`WebView error: ${nativeEvent.description}`);
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          onMapError?.(`HTTP error: ${nativeEvent.statusCode}`);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webView: {
    flex: 1,
  },
});

export default MapWebView;
