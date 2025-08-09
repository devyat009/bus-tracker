import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

interface OpenStreetMapProps {
  latitude?: number;
  longitude?: number;
  zoom?: number;
  showUserMarker?: boolean; // controls visibility of the pulsating user marker
}

const INITIAL_LAT = -15.7801;
const INITIAL_LNG = -47.9292;
const INITIAL_ZOOM = 15;

const OpenStreetMap: React.FC<OpenStreetMapProps> = ({
  latitude,
  longitude,
  zoom = INITIAL_ZOOM,
  showUserMarker = true,
}) => {
  const webviewRef = useRef<WebView>(null);

  // When coordinates change, tell the map to recenter and move the user marker
  useEffect(() => {
    if (webviewRef.current && typeof latitude === 'number' && typeof longitude === 'number') {
      const js = `
        if (window.setUserPosition) {
          window.setUserPosition(${latitude}, ${longitude}, ${zoom});
        }
        true; // required to avoid silent failures on Android
      `;
      // @ts-ignore - injectJavaScript exists at runtime
      webviewRef.current.injectJavaScript(js);
    }
  }, [latitude, longitude, zoom]);

  // Toggle user marker visibility when requested from RN
  useEffect(() => {
    if (webviewRef.current) {
      const js = `
        if (window.setUserMarkerVisible) {
          window.setUserMarkerVisible(${showUserMarker ? 'true' : 'false'});
        }
        true;
      `;
      // @ts-ignore
      webviewRef.current.injectJavaScript(js);
    }
  }, [showUserMarker]);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css"/>
      <style>
        html, body, #map { height: 100%; margin: 0; padding: 0; }
        .pulse-marker {
          position: relative;
          width: 24px;
          height: 24px;
        }
        .pulse-outer {
          position: absolute;
          top: 0;
          left: 0;
          width: 24px;
          height: 24px;
          background: #2196f3;
          opacity: 0.3;
          border-radius: 50%;
          animation: pulse 1.5s infinite;
        }
        .pulse-inner {
          position: absolute;
          top: 6px; /* center 12px inside 24px */
          left: 6px;
          width: 12px;
          height: 12px;
          background: #2196f3;
          border-radius: 50%;
          border: 2px solid #fff;
          box-shadow: 0 0 4px #2196f3;
        }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.7); opacity: 0.1; }
          100% { transform: scale(1); opacity: 0.3; }
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
      <script>
        // Keep map persistent regardless of RN prop changes
        var map = L.map('map').setView([${INITIAL_LAT}, ${INITIAL_LNG}], ${INITIAL_ZOOM});
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
        }).addTo(map);

        // Custom pulsating marker
        var userIcon = L.divIcon({
          className: '',
          html: '<div class="pulse-marker"><div class="pulse-outer"></div><div class="pulse-inner"></div></div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        // Create a user marker reference (hidden by default)
        var userMarker = L.marker([${INITIAL_LAT}, ${INITIAL_LNG}], {icon: userIcon});
        var userMarkerVisible = false; // default hidden to avoid flashing at initial position

        // Expose a function to recenter and move the marker from RN
        window.setUserPosition = function(lat, lng, z) {
          try {
            userMarker.setLatLng([lat, lng]);
            // Keep current zoom if not provided
            var targetZoom = (typeof z === 'number' && !isNaN(z)) ? z : map.getZoom();
            map.setView([lat, lng], targetZoom, { animate: true });
            // Ensure marker is shown only when visibility is enabled
            if (userMarkerVisible && !map.hasLayer(userMarker)) {
              userMarker.addTo(map);
            }
          } catch (e) { /* noop */ }
        }

        // Show/hide the user marker
        window.setUserMarkerVisible = function(visible) {
          try {
            userMarkerVisible = !!visible;
            if (userMarkerVisible) {
              if (!map.hasLayer(userMarker)) { userMarker.addTo(map); }
            } else {
              if (map.hasLayer(userMarker)) { map.removeLayer(userMarker); }
            }
          } catch (e) { /* noop */ }
        }
      </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <WebView
      ref={webviewRef}
        originWhitelist={['*']}
        source={{ html }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
  },
});

export default OpenStreetMap;