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
  setUserPosition: (lat: number, lng: number, zoom?: number) => void;
  setUserMarkerVisible: (visible: boolean) => void;
  setBusRoute: (lineCode: string) => void;
  showLoading: (text?: string, progress?: number) => void;
  hideLoading: () => void;
  showToast: (message: string, duration?: number) => void;
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
    selectedLines,
    center,
    zoom,
    stops,
    lines,
    userLocation,
    loading,
    setMapCenter,
    setMapZoom,
  } = useAppStore();

  // Hooks
  const { requestPermission } = useLocation();
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
        const maxFeatures = isBusesRequest ? 300 : url.includes('Paradas') ? 150 : 50;
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
        if (window.recenterOnly) {
          window.recenterOnly(${lat}, ${lng}, ${targetZoom});
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
        if (window.setBusRoute) {
          window.setBusRoute(${JSON.stringify(sanitizedCode)});
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

    setUserPosition: (lat: number, lng: number, zoomLevel?: number) => {
      if (!webViewRef.current) return;
      
      const js = `
        if (window.setUserPosition) {
          window.setUserPosition(${lat}, ${lng}, ${zoomLevel || 'undefined'});
        }
        true;
      `;
      webViewRef.current.injectJavaScript(js);
      
      // Update store
      setMapCenter(lat, lng);
      if (zoomLevel) setMapZoom(zoomLevel);
    },

    setUserMarkerVisible: (visible: boolean) => {
      if (!webViewRef.current) return;
      
      const js = `
        if (window.setUserMarkerVisible) {
          window.setUserMarkerVisible(${visible});
        }
        true;
      `;
      webViewRef.current.injectJavaScript(js);
    },

    setBusRoute: (lineCode: string) => {
      if (!webViewRef.current) return;
      
      const sanitizedCode = lineCode.replace(/[^0-9A-Za-z _.-]/g, '');
      const js = `
        if (window.setBusRoute) {
          window.setBusRoute(${JSON.stringify(sanitizedCode)});
        }
        true;
      `;
      webViewRef.current.injectJavaScript(js);
    },

    showLoading: (text?: string, progress?: number) => {
      if (!webViewRef.current) return;
      
      const js = `
        if (window.showLoading) {
          window.showLoading(${JSON.stringify(text || 'Carregando...')}, ${progress || 0});
        }
        true;
      `;
      webViewRef.current.injectJavaScript(js);
    },

    hideLoading: () => {
      if (!webViewRef.current) return;
      
      const js = `
        if (window.hideLoading) {
          window.hideLoading();
        }
        true;
      `;
      webViewRef.current.injectJavaScript(js);
    },

    showToast: (message: string, duration?: number) => {
      if (!webViewRef.current) return;
      
      const js = `
        if (window.showToast) {
          window.showToast(${JSON.stringify(message)}, ${duration || 3000});
        }
        true;
      `;
      webViewRef.current.injectJavaScript(js);
    },
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
          
          case 'requestRoute':
          // Handle route request from WebView
          if (message.lineCode) {
            // Here you could fetch route data and send it back
            // For now, we'll just acknowledge the request
            console.log('Route requested for line:', message.lineCode);
          }
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
    // Don't proceed if WebView is not available
    if (!webViewRef.current) {
      console.log('[Map:updateMapData] Skipping - WebView not ready');
      return;
    }

    console.log('[Map:updateMapData] Preparing data update', {
      buses: filteredBuses?.length || 0,
      stops: stops?.length || 0,
      showBuses,
      showStops
    });

    const mapData = {
      buses: showBuses ? (filteredBuses || []) : [],
      stops: showStops ? (stops || []) : [],
      lines: lines || [],
      userLocation: userLocation || null,
      mapStyle: mapStyle,
      showBuses,
      showStops,
      showOnlyActiveBuses,
      selectedLines: selectedLines || []
    };

    // console.log('[Map:DATA] Sending to WebView:', mapData);

    // Add a small delay to ensure WebView is ready for function calls
    const timer = setTimeout(() => {
      if (webViewRef.current) {
        const js = `
          (function() {
            console.log('[WebView] Attempting to update map data');
            console.log('[WebView] Available window functions:', Object.keys(window).filter(k => typeof window[k] === 'function' && k.includes('update')));
            
            if (typeof window.updateMapData === 'function') {
              console.log('[WebView] Calling updateMapData with data');
              try {
                window.updateMapData(${JSON.stringify(mapData)});
                console.log('[WebView] updateMapData called successfully');
              } catch (error) {
                console.error('[WebView] Error calling updateMapData:', error);
              }
            } else {
              console.warn('[WebView] updateMapData function not available');
              console.log('[WebView] Available functions:', Object.keys(window).filter(k => typeof window[k] === 'function'));
            }
            return true;
          })();
        `;
        webViewRef.current.injectJavaScript(js);
      }
    }, 500); // Give WebView time to be ready

    return () => clearTimeout(timer);
  }, [
    filteredBuses,
    stops,
    lines,
    showBuses,
    showStops,
    showOnlyActiveBuses,
    selectedLines,
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
        source={require('../../components/MapComponent/map_modern.html')}
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
