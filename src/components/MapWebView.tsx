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
  setUserPosition: (lat: number, lng: number) => void;
  setUserMarkerVisible: (visible: boolean) => void;
  setBusRoute: (lineCode: string) => void;
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
  const { userLocation, watchLocation } = useLocation();
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
  const [webViewReady, setWebViewReady] = React.useState(false);
  
  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      
      switch (message.type) {
        case 'log':
          console.log(`[WebView:${message.tag}]`, message.msg, message.extra);
          break;
          
        case 'mapReady':
          setWebViewReady(true);
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
    if (!webViewRef.current || !webViewReady) return;
    if (showBuses) {
      fetchBuses();
    }

    const dataToSend = {
      buses,
      stops,
      lines,
      userLocation,
      mapStyle,
      showBuses,
      showStops,
      showOnlyActiveBuses,
      selectedLines,
    };

    console.log('[MapWebView] Sending data to WebView:', {
      busesCount: buses.length,
      stopsCount: stops.length,
      linesCount: lines.length,
      showBuses,
      showStops,
      hasUserLocation: !!userLocation
    });

    webViewRef.current.postMessage(JSON.stringify({
      type: 'updateData',
      data: dataToSend,
    }));
  }, [webViewReady, buses, stops, lines, userLocation, mapStyle, showBuses, showStops, showOnlyActiveBuses, selectedLines, fetchBuses]);

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
    setUserPosition: (lat, lng) => {
      webViewRef.current?.injectJavaScript(`
        if(window.setUserPosition){window.setUserPosition(${lat},${lng});} true;
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

  // Follow user location automatically (move marker only, don't recenter map)
  useEffect(() => {
    if (userLocation && webViewRef.current) {
      console.log('User location changed, updating marker:', userLocation);
      // Only move the marker, don't recenter the map
      webViewRef.current.injectJavaScript(`
        if(window.setUserPosition){window.setUserPosition(${userLocation.latitude},${userLocation.longitude});} 
        if(window.setUserMarkerVisible){window.setUserMarkerVisible(true);}
        true;
      `);
    }
  }, [userLocation]);

  // Start watching location when component mounts
  useEffect(() => {
    let subscription: any = null;
    
    const startWatching = async () => {
      subscription = await watchLocation();
    };
    
    startWatching();
    
    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [watchLocation]);

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

    /* Bus markers */
    .bus-marker {
      background: rgba(255, 255, 255, 0.9);
      border: 2px solid #FF6B35;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
      transition: all 0.2s ease;
    }

    .bus-marker.active {
      border-color: #28A745;
      background: rgba(40, 167, 69, 0.1);
    }

    .bus-marker:hover {
      transform: scale(1.1);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    }

    /* Stop markers */
    .stop-marker {
      background: rgba(255, 255, 255, 0.9);
      border: 2px solid #007BFF;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
      transition: all 0.2s ease;
    }

    .stop-marker:hover {
      transform: scale(1.1);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
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
    let busesGeoLayer;
    let stopsGeoLayer;
    let routeLayer;
  // Queue to hold latest dataset while map/layers still initializing
  let pendingDataQueue = null;
    
    // Initialize map
    function initMap() {
      console.log('[WebView] Initializing map...');
      map = L.map('map').setView([-15.7942, -47.8822], 11);
      
      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);
      
      // Create GeoJSON layers first (like the old map)
      busesGeoLayer = L.geoJSON(null, {
        pointToLayer: function(feature, latlng) {
          const props = feature.properties || {};
          const isActive = !!(props.cd_linha || props.linha || props.servico);
          
          const busIcon = L.divIcon({
            className: 'bus-marker' + (isActive ? ' active' : ''),
            html: '🚌',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });
          
          const marker = L.marker(latlng, { icon: busIcon });
          const popupContent = createBusPopup(props);
          marker.bindPopup(popupContent);
          
          return marker;
        }
      });
      
      stopsGeoLayer = L.geoJSON(null, {
        pointToLayer: function(feature, latlng) {
          const props = feature.properties || {};
          
          const stopIcon = L.divIcon({
            className: 'stop-marker',
            html: '🚏',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });
          
          const marker = L.marker(latlng, { icon: stopIcon });
          const popupContent = createStopPopup(props);
          marker.bindPopup(popupContent);
          
          return marker;
        }
      });
      
      // Attempt to create clusters; fallback if plugin missing
      const clusterSupported = !!(window.L && L.markerClusterGroup);
      routeLayer = L.layerGroup();
      map.addLayer(routeLayer);

      if (clusterSupported) {
        try {
          busesCluster = L.markerClusterGroup();
          stopsCluster = L.markerClusterGroup();
          map.addLayer(busesCluster);
          map.addLayer(stopsCluster);
          console.log('[WebView] Clusters initialized');
        } catch(e) {
          console.warn('[WebView] Cluster init failed, using direct layers', e);
          busesCluster = null;
          stopsCluster = null;
          // Add geo layers directly so markers are visible
          busesGeoLayer.addTo(map);
          stopsGeoLayer.addTo(map);
        }
      } else {
        console.warn('[WebView] Cluster plugin not available, adding GeoJSON layers directly');
        busesGeoLayer.addTo(map);
        stopsGeoLayer.addTo(map);
      }
      
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
      
      console.log('[WebView] Map initialization complete');
      
      // Notify React Native that map is ready
      postMessage('mapReady', { status: 'initialized' });

      // If there was data sent before map was ready, apply it now
      if (pendingDataQueue) {
        try {
          console.log('[WebView] Applying queued data after init');
          updateMapData(pendingDataQueue);
        } catch(e) { console.error('[WebView] Failed applying queued data', e); }
        pendingDataQueue = null;
      }
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
    
    // Move only the user marker WITHOUT recentering the map
    function setUserPosition(lat, lng) {
      console.log('[WebView] setUserPosition called:', lat, lng);
      if (!userMarker) {
        createUserMarker();
      }
      userMarker.setLatLng([lat, lng]);
      
      if (userMarkerVisible && !map.hasLayer(userMarker)) {
        userMarker.addTo(map);
      }
      // DO NOT call flyTo here - only move the marker!
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
      console.log('[WebView] updateMapData called with:', data);
      // Update buses and stops without recentering
      const buses = data.buses || [];
      const stops = data.stops || [];

      // If layers not ready yet, queue the latest data
      if (!map || !busesGeoLayer || !stopsGeoLayer || !busesCluster || !stopsCluster) {
        console.log('[WebView] Map/layers not ready yet, queueing data');
        pendingDataQueue = data;
        return;
      }
      
      renderBuses(buses, data.showBuses);
      renderStops(stops, data.showStops);
    }
    
    function renderBuses(buses, showBuses) {
      console.log('[WebView] renderBuses called:', buses.length, 'buses, showBuses:', showBuses);
      
      // Clear existing data
  busesGeoLayer && busesGeoLayer.clearLayers();
  if (busesCluster) { busesCluster.clearLayers(); }
      
      if (!showBuses || !buses.length) {
        console.log('[WebView] Skipping bus rendering');
        return;
      }
      
      // Convert to GeoJSON format
      const geojsonFeatures = [];
      let renderedCount = 0;
      
      buses.forEach(bus => {
        // Handle different bus data formats
        let lat, lng, props = {};
        
        if (bus.geometry && bus.geometry.coordinates) {
          // GeoJSON format
          [lng, lat] = bus.geometry.coordinates;
          props = bus.properties || {};
        } else if (bus.latitude && bus.longitude) {
          // Direct format
          lat = bus.latitude;
          lng = bus.longitude;
          props = bus;
        } else {
          console.log('[WebView] Skipping bus without coordinates:', bus);
          return;
        }
        
        // Create GeoJSON feature
        const feature = {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [lng, lat]
          },
          properties: props
        };
        
        geojsonFeatures.push(feature);
        renderedCount++;
      });
      
      const geojson = {
        type: 'FeatureCollection',
        features: geojsonFeatures
      };
      
      // Add to GeoJSON layer first
      busesGeoLayer.addData(geojson);
      
      // Then rebuild cluster from GeoJSON layer (like the old map)
      if (busesCluster) {
        rebuildBusesCluster();
        const clusterCount = busesCluster.getLayers ? busesCluster.getLayers().length : 'n/a';
        if ((clusterCount === 0 || clusterCount === 'n/a') && renderedCount > 0) {
          console.warn('[WebView] Cluster empty after adding buses – falling back to direct layer');
          if (!map.hasLayer(busesGeoLayer)) busesGeoLayer.addTo(map);
        }
        console.log('[WebView] Successfully rendered', renderedCount, 'buses (cluster layers:', clusterCount, ')');
      } else {
        // Direct layer mode
        if (!map.hasLayer(busesGeoLayer)) busesGeoLayer.addTo(map);
        console.log('[WebView] Successfully rendered', renderedCount, 'buses (direct layer)');
      }
    }
    
    function renderStops(stops, showStops) {
      console.log('[WebView] renderStops called:', stops.length, 'stops, showStops:', showStops);
      
      // Clear existing data
      stopsGeoLayer && stopsGeoLayer.clearLayers();
      if (stopsCluster) { stopsCluster.clearLayers(); }
      
      if (!showStops || !stops.length) {
        console.log('[WebView] Skipping stops rendering');
        return;
      }
      
      // Convert to GeoJSON format
      const geojsonFeatures = [];
      let renderedCount = 0;
      
      stops.forEach(stop => {
        // Handle different stop data formats
        let lat, lng, props = {};
        
        if (stop.geometry && stop.geometry.coordinates) {
          // GeoJSON format
          [lng, lat] = stop.geometry.coordinates;
          props = stop.properties || {};
        } else if (stop.latitude && stop.longitude) {
          // Direct format
          lat = stop.latitude;
          lng = stop.longitude;
          props = stop;
        } else {
          console.log('[WebView] Skipping stop without coordinates:', stop);
          return;
        }
        
        // Create GeoJSON feature
        const feature = {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [lng, lat]
          },
          properties: props
        };
        
        geojsonFeatures.push(feature);
        renderedCount++;
      });
      
      const geojson = {
        type: 'FeatureCollection',
        features: geojsonFeatures
      };
      
      // Add to GeoJSON layer first
      stopsGeoLayer.addData(geojson);
      
      // Then rebuild cluster from GeoJSON layer (like the old map)
      if (stopsCluster) {
        rebuildStopsCluster();
        const clusterCount = stopsCluster.getLayers ? stopsCluster.getLayers().length : 'n/a';
        if ((clusterCount === 0 || clusterCount === 'n/a') && renderedCount > 0) {
          console.warn('[WebView] Cluster empty after adding stops – falling back to direct layer');
          if (!map.hasLayer(stopsGeoLayer)) stopsGeoLayer.addTo(map);
        }
        console.log('[WebView] Successfully rendered', renderedCount, 'stops (cluster layers:', clusterCount, ')');
      } else {
        if (!map.hasLayer(stopsGeoLayer)) stopsGeoLayer.addTo(map);
        console.log('[WebView] Successfully rendered', renderedCount, 'stops (direct layer)');
      }
    }
    
    function rebuildBusesCluster() {
      if (!busesCluster || !busesGeoLayer) return;
      
      try {
        busesCluster.clearLayers();
        busesGeoLayer.eachLayer(function(marker) {
          try {
            const latLng = marker.getLatLng();
            if (!latLng) return;
            
            // Clone the marker for the cluster
            const clonedMarker = L.marker(latLng, { icon: marker.options.icon });
            if (marker.getPopup()) {
              clonedMarker.bindPopup(marker.getPopup().getContent());
            }
            
            busesCluster.addLayer(clonedMarker);
          } catch (e) {
            console.error('[WebView] Error adding bus to cluster:', e);
          }
        });
        console.log('[WebView] Buses cluster rebuilt');
      } catch (e) {
        console.error('[WebView] Error rebuilding buses cluster:', e);
      }
    }
    
    function rebuildStopsCluster() {
      if (!stopsCluster || !stopsGeoLayer) return;
      
      try {
        stopsCluster.clearLayers();
        stopsGeoLayer.eachLayer(function(marker) {
          try {
            const latLng = marker.getLatLng();
            if (!latLng) return;
            
            // Clone the marker for the cluster
            const clonedMarker = L.marker(latLng, { icon: marker.options.icon });
            if (marker.getPopup()) {
              clonedMarker.bindPopup(marker.getPopup().getContent());
            }
            
            stopsCluster.addLayer(clonedMarker);
          } catch (e) {
            console.error('[WebView] Error adding stop to cluster:', e);
          }
        });
        console.log('[WebView] Stops cluster rebuilt');
      } catch (e) {
        console.error('[WebView] Error rebuilding stops cluster:', e);
      }
    }
    
    function createBusPopup(props) {
      const linha = props.linha || props.cd_linha || props.servico || 'N/A';
      const veiculo = props.prefixo || props.veiculo || props.cd_veiculo || 'N/A';
      const velocidade = props.velocidade || 'N/A';
      const timestamp = props.timestamp || props.datalocal || props.data_hora || 'N/A';
      
      return \`
        <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; min-width: 200px;">
          <h3 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">
            🚌 Ônibus \${linha}
          </h3>
          <div style="font-size: 14px; line-height: 1.4;">
            <p style="margin: 4px 0;"><strong>Veículo:</strong> \${veiculo}</p>
            <p style="margin: 4px 0;"><strong>Velocidade:</strong> \${velocidade} km/h</p>
            <p style="margin: 4px 0;"><strong>Última atualização:</strong> \${timestamp}</p>
          </div>
        </div>
      \`;
    }
    
    function createStopPopup(props) {
      const nome = props.nome || props.descricao || props.ds_ponto || props.nm_parada || props.name || 'Parada de Ônibus';
      const codigo = props.codigo || props.cd_parada || props.code || 'N/A';
      
      return \`
        <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; min-width: 180px;">
          <h3 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">
            🚏 \${nome}
          </h3>
          <div style="font-size: 14px; line-height: 1.4;">
            <p style="margin: 4px 0;"><strong>Código:</strong> \${codigo}</p>
          </div>
        </div>
      \`;
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
      console.log('[WebView] Received message:', event.data);
      
      try {
        const message = JSON.parse(event.data);
        console.log('[WebView] Parsed message:', message.type, message.data);
        
        switch(message.type) {
          case 'updateData':
            console.log('[WebView] Processing updateData with:', {
              busesCount: message.data?.buses?.length || 0,
              stopsCount: message.data?.stops?.length || 0,
              showBuses: message.data?.showBuses,
              showStops: message.data?.showStops
            });
            updateMapData(message.data);
            break;
        }
      } catch (e) {
        console.error('[WebView] Error parsing message:', e);
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
    
    // Also try immediate init if DOM is already ready
    if (document.readyState === 'loading') {
      // DOM is still loading, wait for DOMContentLoaded
      document.addEventListener('DOMContentLoaded', initMap);
    } else {
      // DOM is already loaded, init immediately
      initMap();
    }
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
