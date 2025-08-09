import React from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

interface OpenStreetMapProps {
  latitude?: number;
  longitude?: number;
  zoom?: number;
}

const OpenStreetMap: React.FC<OpenStreetMapProps> = ({
  latitude = -15.7801,
  longitude = -47.9292,
  zoom = 15
}) => {
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
          top: 4px;
          left: 4px;
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
        var map = L.map('map').setView([${latitude}, ${longitude}], ${zoom});
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
        L.marker([${latitude}, ${longitude}], {icon: userIcon}).addTo(map);
      </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <WebView
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