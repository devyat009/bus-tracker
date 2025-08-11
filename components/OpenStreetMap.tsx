import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { fetchWithCache } from "../src/services/http";

interface OpenStreetMapProps {
  latitude?: number;
  longitude?: number;
  zoom?: number;
  showUserMarker?: boolean; // controls visibility of the pulsating user marker
}

export type OpenStreetMapHandle = {
  recenter: (lat: number, lng: number, z?: number) => void;
  setRoute: (code: string) => void;
};

const INITIAL_LAT = -15.7801;
const INITIAL_LNG = -47.9292;
const INITIAL_ZOOM = 15;

const OpenStreetMap = forwardRef<OpenStreetMapHandle, OpenStreetMapProps>(({
  latitude,
  longitude,
  zoom = INITIAL_ZOOM,
  showUserMarker = true,
}, ref) => {
  const webviewRef = useRef<WebView>(null);

  // Expose an imperative recenter method
  useImperativeHandle(ref, () => ({
    recenter: (lat: number, lng: number, z?: number) => {
      if (!webviewRef.current) return;
      const js = `
  if (window.recenterOnly) { window.recenterOnly(${Number(lat)}, ${Number(lng)}, ${typeof z === 'number' ? Number(z) : 'undefined'}); }
        if (window.setUserMarkerVisible) { window.setUserMarkerVisible(true); }
        true;
      `;
      // @ts-ignore
      webviewRef.current.injectJavaScript(js);
    },
    setRoute: (code: string) => {
      if (!webviewRef.current) return;
      // Basic sanitize to avoid breaking quotes in injected JS
      const safe = String(code).replace(/[^0-9A-Za-z _.-]/g, '');
      const js = `
        if (window.setBusRoute) { window.setBusRoute(${JSON.stringify(safe)}); }
        true;
      `;
      // @ts-ignore
      webviewRef.current.injectJavaScript(js);
    }
  }), []);

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

  // Toggle user marker visibility and optionally recenter when becoming visible
  useEffect(() => {
    if (webviewRef.current) {
      const js = `
        if (window.setUserMarkerVisible) {
          window.setUserMarkerVisible(${showUserMarker ? 'true' : 'false'});
        }
        ${showUserMarker && typeof latitude === 'number' && typeof longitude === 'number'
          ? `if (window.setUserPosition) { window.setUserPosition(${latitude}, ${longitude}, ${zoom}); }`
          : ''}
        true;
      `;
      // @ts-ignore
      webviewRef.current.injectJavaScript(js);
    }
  }, [showUserMarker, latitude, longitude, zoom]);

  return (
    <View style={styles.container}>
      <WebView
      ref={webviewRef}
        originWhitelist={['*']}
        source={require('./MapComponent/map.html')}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        onMessage={async (event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (!data) return;
            if (data.type === 'log') {
              console.log(`[Map:${data.tag}]`, data.msg, data.extra ?? '');
              return;
            }
            if (data.type === 'fetch' && data.id && data.url) {
              // Se for requisição de ônibus, nunca usar cache
              const isBuses = data.url.includes('typeName=semob%3A%C3%9Altima%20posi%C3%A7%C3%A3o%20da%20frota');
              (async () => {
                try {
                  let resp;
                  if (isBuses) {
                    const r = await fetch(data.url, { headers: { accept: 'application/json' }, cache: 'no-store' });
                    const text = await r.text();
                    resp = { ok: r.ok, status: r.status, text };
                  } else {
                    resp = await fetchWithCache(data.url, { headers: { accept: 'application/json' } });
                  }
                  const js = `window.__deliverFetchText(${Number(data.id)}, ${resp.ok ? 'true' : 'false'}, ${resp.status}, ${JSON.stringify(resp.text)}); true;`;
                  // @ts-ignore
                  webviewRef.current && webviewRef.current.injectJavaScript(js);
                } catch (err: any) {
                  const js = `window.__deliverFetchText(${Number(data.id)}, false, 0, ${JSON.stringify(String(err && err.message || err))}); true;`;
                  // @ts-ignore
                  webviewRef.current && webviewRef.current.injectJavaScript(js);
                }
              })();
              return;
            }
          } catch {
            // ignore malformed messages
          }
        }}
        onLoadEnd={() => {
          if (!webviewRef.current) return;
          const js = `
            if (window.setUserMarkerVisible) { window.setUserMarkerVisible(${showUserMarker ? 'true' : 'false'}); }
            ${typeof latitude === 'number' && typeof longitude === 'number' ? `if (window.setUserPosition) { window.setUserPosition(${latitude}, ${longitude}, ${zoom}); }` : ''}
            // Trigger initial stops load with current bounds keeping internal cache
            try {
              var b = (window.map && window.map.getBounds && window.map.getBounds()) || null;
              if (window.loadStopsForBounds) { window.loadStopsForBounds(b); }
              else if (window.loadStopsOnceForBounds) { window.loadStopsOnceForBounds(b); }
            } catch(e) {}
            true;
          `;
          // @ts-ignore
          webviewRef.current.injectJavaScript(js);
        }}
      />
    </View>
  );
});

OpenStreetMap.displayName = 'OpenStreetMap';

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