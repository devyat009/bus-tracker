import React, { useCallback, useEffect, useImperativeHandle, useRef } from 'react';
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
export interface MapWebViewHandle {
  recenter: (lat: number, lng: number, zoom?: number) => void;
  showLoading: (text?: string, progress?: number) => void;
  hideLoading: () => void;
  showToast: (message: string, duration?: number) => void;
  setUserPosition: (lat: number, lng: number, zoom?: number) => void;
  setUserMarkerVisible: (visible: boolean) => void;
  setBusRoute: (lineCode: string) => void;
  // setRoute: (code: string) => void;
  // fitToBounds: (bounds: MapBounds) => void;
  // //getUserLocation: () => UserLocation | null;
  // setUserPosition: (lat: number, lng: number, zoom?: number) => void;
  // setUserMarkerVisible: (visible: boolean) => void;
  // setBusRoute: (lineCode: string) => void;
  // showLoading: (text?: string, progress?: number) => void;
  // hideLoading: () => void;
  // showToast: (message: string, duration?: number) => void;
}

const MapWebView = React.forwardRef<MapWebViewHandle, MapWebViewProps>(({
  onMapReady,
  onMapError,
}, ref) => {
  const webViewRef = useRef<WebView>(null);
  const {
    style: mapStyle,
    showBuses,
    showStops,
    showOnlyActiveBuses,
    selectedLines,
    // center,
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
    } catch {
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
          
        case 'centerChanged':
        case 'zoomChanged':
          // Do NOT update the store when user manually moves the map
          // This prevents the auto-recenter bug
          // setMapCenter(message.center.lat, message.center.lng);
          // setMapZoom(message.zoom);
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
    } catch {
      console.error('Failed to parse WebView message:');
    }
  }, [onMapReady, onMapError, handleWebViewFetch]);

  // Send data to WebView when it changes
  useEffect(() => {
    if (!webViewRef.current) return;
    if (showBuses) {
      fetchBuses();
    }

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
  }, [buses, stops, lines, userLocation, mapStyle, showBuses, showStops, showOnlyActiveBuses, selectedLines, fetchBuses]);

  useImperativeHandle(ref, () => ({
    recenter: (lat: number, lng: number, zoomLevel?: number) => {
      if (!webViewRef.current) return;
      const targetZoom = zoomLevel ?? zoom;
      const js = `
        if (window.recenterOnly) {
          window.recenterOnly(${lat}, ${lng}, ${targetZoom});
        }
        true;
      `;
      webViewRef.current.injectJavaScript(js);

      // Atualiza o estado global, se necessário
      setMapCenter(lat, lng);
      if (zoomLevel) setMapZoom(zoomLevel);
    },
    showLoading: (text?: string, progress?: number) => {
      webViewRef.current?.injectJavaScript(`
        if(window.showLoading){window.showLoading(${text ? JSON.stringify(text) : 'undefined'},${progress !== undefined ? progress : 'undefined'});} true;
      `);
    },
    hideLoading: () => {
      webViewRef.current?.injectJavaScript(`
        if(window.hideLoading){window.hideLoading();} true;
      `);
    },
    showToast: (message = '', duration = 2000) => {
      webViewRef.current?.injectJavaScript(`
        if(window.showToast){window.showToast(${JSON.stringify(message)},${duration});} true;
      `);
    },
    setUserPosition: (lat, lng, zoom = 16) => {
      webViewRef.current?.injectJavaScript(`
        if(window.setUserPosition){window.setUserPosition(${lat},${lng},${zoom});} true;
      `);
    },
    setUserMarkerVisible: (visible) => {
      webViewRef.current?.injectJavaScript(`
        if(window.setUserMarkerVisible){window.setUserMarkerVisible(${visible});} true;
      `);
    },
    setBusRoute: (lineCode) => {
      webViewRef.current?.injectJavaScript(`
        if(window.setBusRoute){window.setBusRoute(${JSON.stringify(lineCode)});} true;
      `);
    },
  }), [zoom, setMapCenter, setMapZoom]);

  // Initialize data fetching
  useEffect(() => {
    fetchLines(); // Lines are fetched once and cached
    fetchBuses(bounds);
    fetchStops(bounds);
  }, [fetchLines, fetchBuses, fetchStops, bounds]);

  // inline HTML
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    html, body, #map {
      height: 100%;
      width: 100%;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    /* User location marker with pulse animation */
    .user-marker {
      position: relative;
      width: 20px;
      height: 20px;
    }

    .user-marker-pulse {
      position: absolute;
      top: 0;
      left: 0;
      width: 20px;
      height: 20px;
      background: #007AFF;
      opacity: 0.4;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }

    .user-marker-inner {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 14px;
      height: 14px;
      background: #007AFF;
      border: 2px solid #fff;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0, 122, 255, 0.3);
    }

    @keyframes pulse {
      0% { transform: scale(1); opacity: 0.4; }
      50% { transform: scale(1.5); opacity: 0.1; }
      100% { transform: scale(2); opacity: 0; }
    }

    /* Loading overlay */
    #loading-overlay {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 1000;
      display: none;
      background: rgba(255, 255, 255, 0.95);
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      text-align: center;
      min-width: 140px;
    }

    #loading-text {
      color: #333;
      font-size: 14px;
      margin-bottom: 12px;
    }

    #loading-bar {
      width: 100%;
      height: 4px;
      background: #f0f0f0;
      border-radius: 2px;
      overflow: hidden;
    }

    #loading-progress {
      height: 100%;
      background: linear-gradient(90deg, #007AFF, #34C759);
      border-radius: 2px;
      width: 0%;
      transition: width 0.3s ease;
    }

    /* Toast notifications */
    #toast {
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1001;
      display: none;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      max-width: 80%;
      text-align: center;
    }

    /* Custom marker styles */
    .bus-marker {
      background: #FF3B30;
      border: 2px solid #fff;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(255, 59, 48, 0.4);
    }

    .bus-marker.active {
      background: #34C759;
      box-shadow: 0 2px 6px rgba(52, 199, 89, 0.4);
    }

    .stop-marker {
      background: #007AFF;
      border: 2px solid #fff;
      border-radius: 3px;
      box-shadow: 0 2px 6px rgba(0, 122, 255, 0.4);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  
  <!-- Loading overlay -->
  <div id="loading-overlay">
    <div id="loading-text">Carregando...</div>
    <div id="loading-bar">
      <div id="loading-progress"></div>
    </div>
  </div>
  
  <!-- Toast notifications -->
  <div id="toast"></div>

  <!-- Load Leaflet and plugins -->
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
  
  <script>
    let map;
    let userMarker;
    let userMarkerVisible = false;
    let busesCluster;
    let stopsCluster;
    let routeLayer;
    
    // Initialize map
    function initMap() {
      map = L.map('map').setView([-15.7942, -47.8822], 11);
      
      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);
      
      // Create clusters
      busesCluster = L.markerClusterGroup();
      stopsCluster = L.markerClusterGroup();
      routeLayer = L.layerGroup();
      
      map.addLayer(busesCluster);
      map.addLayer(stopsCluster);
      map.addLayer(routeLayer);
      
      // Create user marker
      createUserMarker();
      
      // Setup event listeners
      map.on('moveend', function() {
        const center = map.getCenter();
        const zoom = map.getZoom();
        postMessage('centerChanged', { 
          center: { lat: center.lat, lng: center.lng }, 
          zoom 
        });
      });
      
      map.on('zoomend', function() {
        const zoom = map.getZoom();
        postMessage('zoomChanged', { zoom });
      });
      
      // Notify React Native that map is ready
      postMessage('mapReady', { status: 'initialized' });
    }
    
    function createUserMarker() {
      const userIcon = L.divIcon({
        className: '',
        html: '<div class="user-marker"><div class="user-marker-pulse"></div><div class="user-marker-inner"></div></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      userMarker = L.marker([-15.7942, -47.8822], { 
        icon: userIcon 
      });
    }
    
    function setUserPosition(lat, lng, zoom) {
      if (!userMarker) {
        createUserMarker();
      }
      userMarker.setLatLng([lat, lng]);
      const targetZoom = zoom || map.getZoom();
      map.flyTo([lat, lng], targetZoom, { 
        animate: true, 
        duration: 0.8 
      });
      
      if (userMarkerVisible && !map.hasLayer(userMarker)) {
        userMarker.addTo(map);
      }
    }
    
    function setUserMarkerVisible(visible) {
      userMarkerVisible = !!visible;
      if (!userMarker) {
        createUserMarker();
      }
      
      if (userMarkerVisible) {
        if (!map.hasLayer(userMarker)) {
          userMarker.addTo(map);
        }
      } else {
        if (map.hasLayer(userMarker)) {
          map.removeLayer(userMarker);
        }
      }
    }
    
    function recenterOnly(lat, lng, zoom) {
      const targetZoom = zoom || map.getZoom();
      map.flyTo([lat, lng], targetZoom, { 
        animate: true, 
        duration: 0.8 
      });
    }
    
    function updateMapData(data) {
      // Update buses and stops without recentering
      const buses = data.buses || [];
      const stops = data.stops || [];
      
      renderBuses(buses, data.showBuses);
      renderStops(stops, data.showStops);
    }
    
    function renderBuses(buses, showBuses) {
      busesCluster.clearLayers();
      
      if (!showBuses || !buses.length) {
        return;
      }
      
      buses.forEach(bus => {
        if (!bus.geometry || !bus.geometry.coordinates) return;
        
        const [lng, lat] = bus.geometry.coordinates;
        const props = bus.properties || {};
        
        const busIcon = L.divIcon({
          className: 'bus-marker',
          html: '🚌',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });
        
        const marker = L.marker([lat, lng], { icon: busIcon });
        busesCluster.addLayer(marker);
      });
    }
    
    function renderStops(stops, showStops) {
      stopsCluster.clearLayers();
      
      if (!showStops || !stops.length) {
        return;
      }
      
      stops.forEach(stop => {
        if (!stop.geometry || !stop.geometry.coordinates) return;
        
        const [lng, lat] = stop.geometry.coordinates;
        
        const stopIcon = L.divIcon({
          className: 'stop-marker',
          html: '🚏',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });
        
        const marker = L.marker([lat, lng], { icon: stopIcon });
        stopsCluster.addLayer(marker);
      });
    }
    
    function showLoading(text = 'Carregando...', progress = 0) {
      const overlay = document.getElementById('loading-overlay');
      const textEl = document.getElementById('loading-text');
      const progressEl = document.getElementById('loading-progress');
      
      if (overlay && textEl && progressEl) {
        textEl.textContent = text;
        progressEl.style.width = Math.min(100, Math.max(0, progress)) + '%';
        overlay.style.display = 'block';
      }
    }

    function hideLoading() {
      const overlay = document.getElementById('loading-overlay');
      if (overlay) {
        overlay.style.display = 'none';
      }
    }

    function showToast(message, duration = 3000) {
      const toast = document.getElementById('toast');
      if (toast) {
        toast.textContent = message;
        toast.style.display = 'block';
        
        setTimeout(() => {
          toast.style.display = 'none';
        }, duration);
      }
    }
    
    function setBusRoute(lineCode) {
      routeLayer.clearLayers();
      // Route implementation would go here
    }
    
    function postMessage(type, data = {}) {
      if (window.ReactNativeWebView) {
        const message = { type, ...data, timestamp: Date.now() };
        window.ReactNativeWebView.postMessage(JSON.stringify(message));
      }
    }
    
    // Handle messages from React Native
    window.addEventListener('message', function(event) {
      const message = JSON.parse(event.data);
      
      switch(message.type) {
        case 'updateData':
          updateMapData(message.data);
          break;
      }
    });
    
    // Expose global functions
    window.setUserPosition = setUserPosition;
    window.setUserMarkerVisible = setUserMarkerVisible;
    window.recenterOnly = recenterOnly;
    window.updateMapData = updateMapData;
    window.setBusRoute = setBusRoute;
    window.showLoading = showLoading;
    window.hideLoading = hideLoading;
    window.showToast = showToast;
    
    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', initMap);
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
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webView: {
    flex: 1,
  },
});

MapWebView.displayName = 'MapWebView';

export default MapWebView;
