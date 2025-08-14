import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useDataFetching } from '../hooks/useDataFetching';
import { useLocation } from '../hooks/useLocation';
import { selectFilteredBuses, useAppStore } from '../store';
import { MapBounds, UserLocation } from '../types';
import { getConfig } from '../utils/config';

interface MapProps {
  onMapReady?: () => void;
  onMapError?: (error: string) => void;
  onBoundsChange?: (bounds: MapBounds) => void;
}

export interface MapHandle {
  recenter: (lat: number, lng: number, zoom?: number) => void;
  setRoute: (code: string) => void;
  fitToBounds: (bounds: MapBounds) => void;
  getUserLocation: () => UserLocation | null;
}

const Map = forwardRef<MapHandle, MapProps>(({
  onMapReady,
  onMapError,
  onBoundsChange,
}, ref) => {
  const webViewRef = useRef<WebView>(null);
  const config = getConfig();
  
  // Store state
  const {
    style: mapStyle,
    showBuses,
    showStops,
    showOnlyActiveBuses,
    center,
    zoom,
    buses,
    stops,
    lines,
    userLocation,
    loading,
    setMapCenter,
    setMapZoom,
  } = useAppStore();

  // Hooks
  const { getCurrentLocation, requestPermission } = useLocation();
  const { fetchBuses, fetchStops, fetchLines } = useDataFetching();

  // Filtered data
  const filteredBuses = useAppStore(selectFilteredBuses);

  // Handle fetch requests from WebView
  const handleWebViewFetch = useCallback(async (id: number, url: string) => {
    try {
      // console.log('WebView fetch request:', {
      //   id,
      //   url: url.substring(0, 150) + '...',
      //   size: url.length
      // });

      // Check if this is a buses request (never cache)
      const isBusesRequest = url.includes('typeName=semob%3A%C3%9Altima%20posi%C3%A7%C3%A3o%20da%20frota');
      
      // Add memory-safe parameters to URL
      let safeUrl = url;
      if (!url.includes('maxFeatures')) {
        const maxFeatures = isBusesRequest ? 300 : 
                           url.includes('Paradas') ? 150 : 50;
        safeUrl += `&maxFeatures=${maxFeatures}`;
      }
      
      let response;
      if (isBusesRequest) {
        // For buses, always fetch fresh data
        const fetchResponse = await fetch(safeUrl, {
          headers: { accept: 'application/json' },
          cache: 'no-store',
        });
        const text = await fetchResponse.text();
        response = {
          ok: fetchResponse.ok,
          status: fetchResponse.status,
          text,
        };
      } else {
        // For other requests, use our caching service
        const { fetchWithCache } = await import('../services/http');
        response = await fetchWithCache(safeUrl, {
          headers: { accept: 'application/json' },
        });
      }

      // console.log('WebView fetch response:', {
      //   id,
      //   ok: response.ok,
      //   status: response.status,
      //   size: response.text.length,
      //   preview: response.text.substring(0, 100) + '...'
      // });

      // Send response back to WebView
      const js = `
        if (window.__deliverFetchText) {
          window.__deliverFetchText(${id}, ${response.ok}, ${response.status}, ${JSON.stringify(response.text)});
        }
        true;
      `;
      webViewRef.current?.injectJavaScript(js);
    } catch (error: any) {
      console.error('WebView fetch error:', {
        id,
        error: error.message,
        url: url.substring(0, 100) + '...'
      });
      // Send error back to WebView
      const errorMessage = error?.message || String(error);
      const js = `
        if (window.__deliverFetchText) {
          window.__deliverFetchText(${id}, false, 0, ${JSON.stringify(errorMessage)});
        }
        true;
      `;
      webViewRef.current?.injectJavaScript(js);
    }
  }, []);

  // Expose imperative methods to parent components
  useImperativeHandle(ref, () => ({
    recenter: (lat: number, lng: number, zoomLevel?: number) => {
      if (!webViewRef.current) return;
      
      const targetZoom = zoomLevel ?? zoom;
      const js = `
        if (window.recenterMap) {
          window.recenterMap(${lat}, ${lng}, ${targetZoom});
        }
        true;
      `;
      webViewRef.current.injectJavaScript(js);
      
      // Update store
      setMapCenter(lat, lng);
      if (zoomLevel) setMapZoom(zoomLevel);
    },
    
    setRoute: (code: string) => {
      if (!webViewRef.current) return;
      
      const sanitizedCode = code.replace(/[^0-9A-Za-z _.-]/g, '');
      const js = `
        if (window.highlightRoute) {
          window.highlightRoute(${JSON.stringify(sanitizedCode)});
        }
        true;
      `;
      webViewRef.current.injectJavaScript(js);
    },
    
    fitToBounds: (bounds: MapBounds) => {
      if (!webViewRef.current) return;
      
      const js = `
        if (window.fitMapToBounds) {
          window.fitMapToBounds(${JSON.stringify(bounds)});
        }
        true;
      `;
      webViewRef.current.injectJavaScript(js);
    },
    
    getUserLocation: () => userLocation,
  }), [zoom, userLocation, setMapCenter, setMapZoom]);

  // Handle WebView messages
  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      
      switch (message.type) {
        case 'log':
          console.log(`[Map:${message.tag}]`, message.msg, message.extra ?? '');
          break;
          
        case 'fetch':
          // Handle fetch requests from WebView
          if (message.id && message.url) {
            handleWebViewFetch(message.id, message.url);
          }
          break;
          
        case 'mapReady':
          console.log('Map is ready');
          onMapReady?.();
          break;
          
        case 'mapError':
          console.error('Map error:', message.error);
          onMapError?.(message.error);
          break;
          
        case 'boundsChanged':
          const bounds: MapBounds = {
            north: message.bounds.north,
            south: message.bounds.south,
            east: message.bounds.east,
            west: message.bounds.west,
          };
          onBoundsChange?.(bounds);
          break;
          
        case 'centerChanged':
          setMapCenter(message.center.lat, message.center.lng);
          break;
          
        case 'zoomChanged':
          setMapZoom(message.zoom);
          break;
          
        case 'busClicked':
          console.log('Bus clicked:', message.bus);
          // Handle bus selection
          break;
          
        case 'stopClicked':
          console.log('Stop clicked:', message.stop);
          // Handle stop selection
          break;
          
        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to parse WebView message:', error);
    }
  }, [onMapReady, onMapError, onBoundsChange, setMapCenter, setMapZoom, handleWebViewFetch]);

  // Update map data when store changes
  useEffect(() => {
    if (!webViewRef.current) return;

    const js = `
      if (window.updateMapData) {
        window.updateMapData({
          buses: ${JSON.stringify(showBuses ? filteredBuses : [])},
          stops: ${JSON.stringify(showStops ? stops : [])},
          lines: ${JSON.stringify(lines)},
          userLocation: ${userLocation ? JSON.stringify(userLocation) : 'null'},
          mapStyle: ${JSON.stringify(mapStyle)},
        });
      }
      true;
    `;
    webViewRef.current.injectJavaScript(js);
  }, [
    filteredBuses,
    stops,
    lines,
    showBuses,
    showStops,
    userLocation,
    mapStyle,
  ]);

  // Update map position when store changes
  useEffect(() => {
    if (!webViewRef.current || !center) return;

    const js = `
      if (window.setMapPosition) {
        window.setMapPosition(${center.latitude}, ${center.longitude}, ${zoom});
      }
      true;
    `;
    webViewRef.current.injectJavaScript(js);
  }, [center, zoom]);

  // Request location permission on mount
  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  // Handle WebView load complete
  const handleLoadEnd = useCallback(() => {
    if (!webViewRef.current) return;

    // Initialize map with current settings
    const js = `
      if (window.initializeMap) {
        window.initializeMap({
          center: ${center ? JSON.stringify(center) : JSON.stringify(config.map.initialPosition)},
          zoom: ${zoom},
          style: ${JSON.stringify(mapStyle)},
          userLocation: ${userLocation ? JSON.stringify(userLocation) : 'null'},
        });
      }
      true;
    `;
    webViewRef.current.injectJavaScript(js);
  }, [center, zoom, mapStyle, userLocation, config.map.initialPosition]);

  // Auto-fetch data
  useEffect(() => {
    // Fetch data for current bounds
    if (showBuses) fetchBuses();
    if (showStops) fetchStops();
    fetchLines();
  }, [showBuses, showStops, fetchBuses, fetchStops, fetchLines]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={require('../../components/MapComponent/map.html')}
        style={styles.webView}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        onMessage={handleMessage}
        onLoadEnd={handleLoadEnd}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('WebView error:', nativeEvent);
          onMapError?.(nativeEvent.description || 'Unknown WebView error');
        }}
        originWhitelist={['*']}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mixedContentMode="compatibility"
      />
      
      {/* Loading indicator could be added here */}
      {(loading.buses || loading.stops || loading.lines) && (
        <View style={styles.loadingOverlay}>
          {/* Add your loading component here */}
        </View>
      )}
    </View>
  );
});

Map.displayName = 'Map';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default Map;
