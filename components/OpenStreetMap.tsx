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

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster/dist/MarkerCluster.css"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster/dist/MarkerCluster.Default.css"/>
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

        /* Controls */
        .controls {
          position: absolute;
          top: 10px;
          right: 10px;
          background: rgba(255,255,255,0.95);
          border-radius: 10px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          padding: 8px 10px;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
          z-index: 1000;
          min-width: 200px;
        }
        .controls label { display: flex; align-items: center; gap: 6px; font-size: 13px; margin: 4px 0; }
        .controls .row { display: flex; gap: 6px; align-items: center; margin-top: 6px; }
        .controls input[type="text"] { flex: 1; padding: 6px 8px; border-radius: 6px; border: 1px solid #ccc; font-size: 13px; }
        .controls button { padding: 6px 10px; border-radius: 6px; border: 1px solid #1f6feb; background: #1f6feb; color: #fff; font-size: 13px; }
        .controls button:active { transform: translateY(1px); }

        /* Loading indicator */
        #loading { position: absolute; top: 10px; left: 10px; z-index: 1000; display: none; background: rgba(0,0,0,0.6); color: #fff; padding: 6px 10px; border-radius: 8px; font-size: 12px; }
        /* Toast */
        #toast { position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); color: #fff; padding: 8px 12px; border-radius: 8px; font-size: 13px; z-index: 1100; display: none; max-width: 90%; text-align: center; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <div id="loading">Carregando…</div>
      <div id="toast"></div>
      <div class="controls">
        <label><input id="chkBuses" type="checkbox" checked /> Mostrar ônibus</label>
        <label><input id="chkStops" type="checkbox" checked /> Mostrar paradas</label>
        <label><input id="chkOnlyActive" type="checkbox" /> Apenas ônibus ativos</label>
        <div class="row">
          <input id="txtLine" type="text" placeholder="Buscar linha (ex: 0.123)" />
          <button id="btnSearch">Buscar</button>
        </div>
      </div>
      <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
      <script src="https://unpkg.com/leaflet.markercluster/dist/leaflet.markercluster.js"></script>
      <script>
        // UI helpers
        function setLoading(active, text) {
          try {
            var el = document.getElementById('loading');
            if (!el) return;
            if (typeof text === 'string' && text) { el.textContent = text; }
            el.style.display = active ? 'block' : 'none';
          } catch (e) {}
        }
        var toastTimer = null;
        function showToast(msg, ms) {
          try {
            var el = document.getElementById('toast');
            if (!el) return;
            el.textContent = String(msg || '');
            el.style.display = 'block';
            clearTimeout(toastTimer);
            toastTimer = setTimeout(function(){ el.style.display = 'none'; }, Math.max(1500, ms||2500));
          } catch (e) {}
        }

        function rnLog(tag, msg, extra) {
          try {
            var payload = { type: 'log', tag: String(tag || ''), msg: String(msg || ''), extra: extra };
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(payload));
          } catch (e) { /* noop */ }
        }
        // RN fetch bridge state
        window.__pending = {};
        window.__reqId = 1;
        function nativeFetch(url) {
          try {
            var id = window.__reqId++;
            return new Promise(function(resolve, reject) {
              var to = setTimeout(function(){ try { delete window.__pending[id]; } catch(e){}; reject(new Error('timeout')); }, 15000);
              window.__pending[id] = { resolve: resolve, reject: reject, t: to };
              var payload = { type: 'fetch', id: id, url: String(url) };
              window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(payload));
            });
          } catch (e) { return Promise.reject(e); }
        }
        window.__deliverFetchText = function(id, ok, status, text) {
          try {
            var entry = window.__pending && window.__pending[id];
            if (!entry) return;
            clearTimeout(entry.t);
            delete window.__pending[id];
            if (ok) {
              try {
                var json = JSON.parse(text);
                entry.resolve(json);
              } catch (e) {
                entry.reject(new Error('invalid json'));
              }
            } else {
              entry.reject(new Error('HTTP ' + status));
            }
          } catch (e) { /* noop */ }
        }
        // Keep map persistent regardless of RN prop changes
        var map = L.map('map').setView([${INITIAL_LAT}, ${INITIAL_LNG}], ${INITIAL_ZOOM});
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
        }).addTo(map);
        rnLog('INIT', 'Leaflet map created');

        // UI state
  var showStops = true, showBuses = true;
  var clusterEnabled = true; // clustering is default and always on
  var showOnlyActiveBuses = false; // when true, only buses with a linha value are shown
        var filterLine = '';
        function normalizeLine(s) {
          var t = (s==null?'':String(s)).toUpperCase().trim();
          return { raw: t, digits: t.replace(/[^0-9]/g, '').replace(/^0+/, '') };
        }

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
            map.flyTo([lat, lng], targetZoom, { animate: true, duration: 0.6 });
            // Ensure marker is shown only when visibility is enabled
            if (userMarkerVisible && !map.hasLayer(userMarker)) {
              userMarker.addTo(map);
            }
          } catch (e) { /* noop */ }
        }

        // Recenter without touching marker state
        window.recenterOnly = function(lat, lng, z) {
          try {
            var targetZoom = (typeof z === 'number' && !isNaN(z)) ? z : map.getZoom();
            map.flyTo([lat, lng], targetZoom, { animate: true, duration: 0.6 });
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

        // =========================
        // WFS endpoints & helpers
        // =========================
        var WFS_URLS = {
          buses: 'http://geoserver.semob.df.gov.br/geoserver/semob/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=semob%3A%C3%9Altima%20posi%C3%A7%C3%A3o%20da%20frota&outputFormat=application%2Fjson',
          stops: 'http://geoserver.semob.df.gov.br/geoserver/semob/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=semob%3AParadas%20de%20onibus&outputFormat=application%2Fjson',
          lines: 'http://geoserver.semob.df.gov.br/geoserver/semob/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=semob%3ALinhas%20de%20onibus&outputFormat=application%2Fjson'
        };

        function bboxParamFromMap() {
          try {
            var b = map.getBounds();
            // WFS bbox expects lon,lat order in EPSG:4326
            var sw = b.getSouthWest();
            var ne = b.getNorthEast();
            return sw.lng + ',' + sw.lat + ',' + ne.lng + ',' + ne.lat;
          } catch (e) { return null; }
        }

        function withBbox(url) {
          try {
            var u = new URL(url);
            var bbox = bboxParamFromMap();
            if (bbox) {
              u.searchParams.set('bbox', bbox + ',EPSG:4326');
            }
            if (!u.searchParams.has('srsName')) {
              u.searchParams.set('srsName', 'EPSG:4326');
            }
            return u.toString();
          } catch (e) { return url; }
        }

        function bboxParamFromBounds(b) {
          try {
            var sw = b.getSouthWest();
            var ne = b.getNorthEast();
            return sw.lng + ',' + sw.lat + ',' + ne.lng + ',' + ne.lat;
          } catch (e) { return null; }
        }

        function withBboxForBounds(url, bounds) {
          try {
            var u = new URL(url);
            var bbox = bboxParamFromBounds(bounds);
            if (bbox) {
              u.searchParams.set('bbox', bbox + ',EPSG:4326');
            }
            if (!u.searchParams.has('srsName')) {
              u.searchParams.set('srsName', 'EPSG:4326');
            }
            return u.toString();
          } catch (e) { return url; }
        }

        function fetchJson(url) {
          rnLog('NET', 'GET ' + url);
          if (window.ReactNativeWebView) {
            // Use RN bridge to bypass CORS in WebView
            return nativeFetch(url).catch(function (e) { rnLog('NET', 'FETCH_ERR ' + url, String(e && e.message || e)); throw e; });
          } else {
            return fetch(url, { headers: { 'accept': 'application/json' } })
              .then(function (r) { if (!r.ok) { rnLog('NET', 'HTTP ' + r.status + ' ' + url); throw new Error('HTTP ' + r.status); } return r.json(); })
              .catch(function (e) { rnLog('NET', 'FETCH_ERR ' + url, String(e && e.message || e)); throw e; });
          }
        }

        // =========================
        // Lines dataset preload/cache
        // =========================
        var linesCache = null; // FeatureCollection
        var linesRequested = false;
        function ensureLinesDataset() {
          if (linesCache) { rnLog('LINES', 'cache-hit', { total: (linesCache.features||[]).length }); return Promise.resolve(linesCache); }
          if (linesRequested) {
            rnLog('LINES', 'already-requested');
            return new Promise(function(res, rej){
              var waited = 0; var it = setInterval(function(){
                if (linesCache) { clearInterval(it); res(linesCache); }
                waited += 250; if (waited > 15000) { clearInterval(it); rej(new Error('timeout lines')); }
              }, 250);
            });
          }
          linesRequested = true;
          rnLog('LINES', 'preload-start');
          return fetchJson(WFS_URLS.lines)
            .then(function (geojson) { linesCache = geojson; rnLog('LINES', 'preload-done', { total: (geojson.features||[]).length }); return geojson; })
            .catch(function (e) { rnLog('LINES', 'preload-error', String(e && e.message || e)); throw e; })
            .finally(function () { linesRequested = false; });
        }

        // =========================
        // Icons
        // =========================
        function makeStopIcon(size) {
          return L.icon({
            iconUrl: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 28 28"><rect x="5" y="3" width="18" height="14" rx="3" ry="3" fill="#32cd32"/><path d="M9 17 L19 17 L14 23 Z" fill="#32cd32"/></svg>'),
            iconSize: [size, size],
            iconAnchor: [size/2, size*0.9],
            popupAnchor: [0, -size*0.7]
          });
        }
        function makeBusIcon(size) {
          return L.icon({
            iconUrl: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 28 28"><rect x="3" y="3" width="22" height="22" rx="4" ry="4" fill="#c30505"/><rect x="9" y="7" width="10" height="10" rx="2" ry="2" fill="#fff"/></svg>'),
            iconSize: [size, size],
            iconAnchor: [size/2, size*0.9],
            popupAnchor: [0, -size*0.7]
          });
        }
        function iconSizeForZoom(z) {
          var minZ = 10, maxZ = 16, minS = 28, maxS = 48;
          var clamped = Math.max(minZ, Math.min(maxZ, z));
          var t = (clamped - minZ) / (maxZ - minZ);
          return Math.round(minS + t * (maxS - minS));
        }

        var currentStopIcon = makeStopIcon(iconSizeForZoom(map.getZoom()));
        var currentBusIcon = makeBusIcon(iconSizeForZoom(map.getZoom()));

        map.on('zoomend', function () {
          var size = Math.min(iconSizeForZoom(map.getZoom()), 42);
          currentStopIcon = makeStopIcon(size);
          currentBusIcon = makeBusIcon(size);
          try { stopsLayer.eachLayer(function (m) { m.setIcon && m.setIcon(currentStopIcon); }); } catch (e) {}
          try { busesLayer.eachLayer(function (m) { m.setIcon && m.setIcon(currentBusIcon); }); } catch (e) {}
          try { if (stopsCluster) { stopsCluster.eachLayer(function (m){ m.setIcon && m.setIcon(currentStopIcon); }); if (stopsCluster.refreshClusters) { stopsCluster.refreshClusters(); } } } catch (e) {}
          try { if (busesCluster) { busesCluster.eachLayer(function (m){ m.setIcon && m.setIcon(currentBusIcon); }); if (busesCluster.refreshClusters) { busesCluster.refreshClusters(); } } } catch (e) {}
          rnLog('MAP', 'zoomend', { zoom: map.getZoom(), iconSize: size });
        });

        // =========================
        // Layers
        // =========================
        var routeLayer = L.geoJSON(null, { style: { color: '#1f6feb', weight: 4, opacity: 0.9 } }).addTo(map);
        var stopsLayer = L.geoJSON(null, {
          pointToLayer: function (feature, latlng) { return L.marker(latlng, { icon: currentStopIcon }); },
          onEachFeature: function (feature, layer) {
            var props = feature && feature.properties || {};
            var title = (props.descricao || props.ds_ponto || props.nm_parada || props.nome || props.ds_descricao || 'Parada de ônibus');
            var codigo = (props.cd_parada || props.codigo || props.id || props.id_parada || '—');
            layer.bindPopup('<strong>' + String(title) + '</strong><br/>Parada ' + String(codigo));
          }
        }).addTo(map);
        var busesLayer = L.geoJSON(null, {
          pointToLayer: function (feature, latlng) { return L.marker(latlng, { icon: currentBusIcon }); },
          onEachFeature: function (feature, layer) {
            var p = feature && feature.properties || {};
            var prefixo = p.prefixo || '—';
            var linha = (p.cd_linha || p.linha || p.servico || '—');
            var velocidade = (p.velocidade != null ? p.velocidade : '—');
            var sentido = (p.sentido != null ? p.sentido : '—');
            var datalocal = (p.datalocal != null ? p.datalocal : '—');
            var tarifa = (p.tarifa || p.vl_tarifa || p.valor_tarifa || p.preco || p.valor);
            function fmtTarifa(v){ var n = Number(v); return isFinite(n) ? ('R$ ' + n.toFixed(2).replace('.', ',')) : null; }
            var tarifaLine = (tarifa!=null && tarifa!=='' && tarifa!=='—') ? ('<br/>Tarifa: ' + (fmtTarifa(tarifa) || String(tarifa))) : '';
            var html = '<div><strong>Ônibus ' + String(prefixo) + '</strong><br/>' +
              'Linha: ' + String(linha) + '<br/>' +
              'Velocidade: ' + String(velocidade) + ' km/h<br/>' +
              'Sentido: ' + String(sentido) + '<br/>' +
              'Data local: ' + String(datalocal) +
              tarifaLine +
              '</div>';
            layer.bindPopup(html);
            layer.on('click', function () {
              var codeRaw = (p.cd_linha || p.linha || p.servico || '').toString().trim();
              if (codeRaw) { window.setBusRoute(codeRaw); }
            });
          }
        }).addTo(map);
        var stopsCluster = null, busesCluster = null;
        function ensureClusters() {
          if (!clusterEnabled) return;
          if (!L.markerClusterGroup) { showToast('Plugin de cluster não disponível'); clusterEnabled = false; return; }
          var created = false;
          if (!stopsCluster) {
            stopsCluster = L.markerClusterGroup({
              spiderfyOnMaxZoom: true,
              showCoverageOnHover: false,
              zoomToBoundsOnClick: true,
              disableClusteringAtZoom: 18,
              removeOutsideVisibleBounds: true,
              spiderfyDistanceMultiplier: 1.2,
              maxClusterRadius: function (zoom) {
                if (zoom >= 18) return 1; // effectively no clustering at very high zoom
                if (zoom >= 17) return 20;
                if (zoom >= 16) return 40;
                return 60;
              }
            });
            created = true;
          }
          if (!busesCluster) {
            busesCluster = L.markerClusterGroup({
              spiderfyOnMaxZoom: true,
              showCoverageOnHover: false,
              zoomToBoundsOnClick: true,
              disableClusteringAtZoom: 18,
              removeOutsideVisibleBounds: true,
              spiderfyDistanceMultiplier: 1.2,
              maxClusterRadius: function (zoom) {
                if (zoom >= 18) return 1;
                if (zoom >= 17) return 20;
                if (zoom >= 16) return 40;
                return 60;
              }
            });
            created = true;
          }
          // Attach to map if visible
          if (showStops && !map.hasLayer(stopsCluster)) { stopsCluster.addTo(map); }
          if (showBuses && !map.hasLayer(busesCluster)) { busesCluster.addTo(map); }
          // When clustering is active, hide base layers to avoid duplicates
          try { if (map.hasLayer(stopsLayer)) { map.removeLayer(stopsLayer); } } catch (e) {}
          try { if (map.hasLayer(busesLayer)) { map.removeLayer(busesLayer); } } catch (e) {}
          // If clusters were created now, seed them from existing layers
          if (created) { try { rebuildStopsCluster(); rebuildBusesCluster(); } catch (e) {} }
        }
        function clearClusters() {
          try { if (stopsCluster) { stopsCluster.clearLayers(); } } catch (e) {}
          try { if (busesCluster) { busesCluster.clearLayers(); } } catch (e) {}
        }
    function rebuildStopsCluster() {
          if (!clusterEnabled || !stopsCluster) return;
          try { stopsCluster.clearLayers(); } catch (e) {}
          try {
            stopsLayer.eachLayer(function (m) {
              try {
                var ll = m.getLatLng && m.getLatLng();
                if (!ll) return;
                var mk = L.marker(ll, { icon: currentStopIcon });
                if (m.getPopup && m.getPopup()) { mk.bindPopup(m.getPopup()); }
                stopsCluster.addLayer(mk);
              } catch (e) {}
            });
      if (stopsCluster.refreshClusters) { stopsCluster.refreshClusters(); }
          } catch (e) {}
        }
    function rebuildBusesCluster() {
          if (!clusterEnabled || !busesCluster) return;
          try { busesCluster.clearLayers(); } catch (e) {}
          try {
            busesLayer.eachLayer(function (m) {
              try {
                var ll = m.getLatLng && m.getLatLng();
                if (!ll) return;
                var mk = L.marker(ll, { icon: currentBusIcon });
                if (m.getPopup && m.getPopup()) { mk.bindPopup(m.getPopup()); }
                busesCluster.addLayer(mk);
              } catch (e) {}
            });
      if (busesCluster.refreshClusters) { busesCluster.refreshClusters(); }
          } catch (e) {}
        }

        // =========================
        // Data loading
        // =========================
        var stopsCache = { geojson: null, bounds: null }; // cache with bounds snapshot
        var stopsRequested = false;
        function boundsChangedSignificantly(oldB, newB) {
          try {
            if (!oldB || !newB) return true;
            var oldC = oldB.getCenter && oldB.getCenter();
            var newC = newB.getCenter && newB.getCenter();
            if (!oldC || !newC) return true;
            var dist = map.distance(oldC, newC);
            // compare vertical span as a proxy for zoom/extent change
            var oldSpan = Math.abs(oldB.getNorthEast().lat - oldB.getSouthWest().lat);
            var newSpan = Math.abs(newB.getNorthEast().lat - newB.getSouthWest().lat);
            return dist > 1000 || Math.abs(oldSpan - newSpan) > 0.01;
          } catch (e) { return true; }
        }
        function loadStopsForBounds(bounds) {
          setLoading(true, 'Carregando paradas…');
          // pad bounds a bit to cover slight pans
          var b = null;
          try { b = bounds && bounds.pad ? bounds.pad(0.2) : bounds; } catch (e) { b = bounds; }
          // If we have cache for similar bounds, just render cached data
          try {
            if (stopsCache.geojson && stopsCache.bounds && !boundsChangedSignificantly(stopsCache.bounds, b)) {
              rnLog('STOPS', 'cache-hit', { count: (stopsCache.geojson.features||[]).length });
              stopsLayer.clearLayers();
              stopsLayer.addData(stopsCache.geojson);
              if (clusterEnabled) { ensureClusters(); rebuildStopsCluster(); if (map.hasLayer(stopsLayer)) { map.removeLayer(stopsLayer); } }
              setLoading(false);
              return Promise.resolve();
            }
          } catch (e) { /* fallback to network */ }
          if (stopsRequested) { rnLog('STOPS', 'already-requested'); setLoading(false); return Promise.resolve(); }
          stopsRequested = true;
          var url = b ? withBboxForBounds(WFS_URLS.stops, b) : withBbox(WFS_URLS.stops);
          rnLog('STOPS', 'load', { url: url });
          return fetchJson(url)
            .then(function (geojson) {
              stopsCache = { geojson: geojson, bounds: b };
              try {
                stopsLayer.clearLayers();
                stopsLayer.addData(geojson);
                var count = (geojson && geojson.features && geojson.features.length) || 0;
                rnLog('STOPS', 'loaded', { count: count });
                if (clusterEnabled) { ensureClusters(); rebuildStopsCluster(); if (map.hasLayer(stopsLayer)) { map.removeLayer(stopsLayer); } }
              } catch (e) { rnLog('STOPS', 'layer_error', String(e && e.message || e)); }
            })
            .catch(function (e) { rnLog('STOPS', 'error', String(e && e.message || e)); showToast('Erro ao carregar paradas'); })
            .finally(function () { stopsRequested = false; setLoading(false); });
        }
        var lastBusesGeoJson = null;
        function isActiveBusFeature(feat){
          try {
            var p = (feat && feat.properties) || {};
            var v = (p.cd_linha || p.linha || p.servico || '').toString().trim().toUpperCase();
            if (!v) return false;
            if (v === 'NULL' || v === 'N/A') return false;
            return true;
          } catch (e) { return false; }
        }
        function refreshBuses() {
          var url = withBbox(WFS_URLS.buses);
          setLoading(true, 'Carregando ônibus…');
          return fetchJson(url)
            .then(function (geojson) {
              lastBusesGeoJson = geojson;
              try {
                var feats = (geojson && geojson.features) || [];
                var f = normalizeLine(filterLine);
                if (f.raw) {
                  feats = feats.filter(function (feat) {
                    var p = feat && feat.properties || {};
                    var cands = [p.cd_linha, p.linha, p.servico, p.codigo, p.cod_linha]
                      .map(function (v) { var s = (v==null?'':String(v)).toUpperCase().trim(); return { raw: s, digits: s.replace(/[^0-9]/g, '').replace(/^0+/, '') }; })
                      .filter(function (c) { return !!c.raw; });
                    for (var i=0;i<cands.length;i++) {
                      if (cands[i].raw === f.raw || (cands[i].digits && cands[i].digits === f.digits)) return true;
                    }
                    return false;
                  });
                }
                if (showOnlyActiveBuses) {
                  feats = feats.filter(isActiveBusFeature);
                }
                var filteredGeo = { type: 'FeatureCollection', features: feats };
                busesLayer.clearLayers();
                busesLayer.addData(filteredGeo);
                var count = feats.length;
                rnLog('BUSES', 'loaded', { count: count, filteredBy: f.raw || '' });
                if (clusterEnabled) { ensureClusters(); rebuildBusesCluster(); if (map.hasLayer(busesLayer)) { map.removeLayer(busesLayer); } }
              } catch (e) { rnLog('BUSES', 'layer_error', String(e && e.message || e)); }
            })
            .catch(function (e) { rnLog('BUSES', 'error', String(e && e.message || e)); showToast('Erro ao carregar ônibus'); })
            .finally(function () { setLoading(false); });
        }

        // Draw route by line code (use cached dataset; keep zoom/center)
        function setBusRoute(codeRaw) {
          if (!codeRaw) return;
          rnLog('ROUTE', 'setBusRoute start', { code: String(codeRaw) });
          ensureLinesDataset()
            .then(function (geojson) {
              var feats = (geojson && geojson.features) || [];
              var target = String(codeRaw).toUpperCase().trim();
              var digits = target.replace(/[^0-9]/g, '').replace(/^0+/, '');
              var filtered = feats.filter(function (f) {
                var pr = (f && f.properties) || {};
                var cands = [pr.cd_linha, pr.linha, pr.servico, pr.cd_linha_principal, pr.codigo, pr.cod_linha]
                  .map(function (v) { var s = (v==null?'':String(v)).toUpperCase().trim(); return { raw: s, digits: s.replace(/[^0-9]/g, '').replace(/^0+/, '') }; })
                  .filter(function (c) { return !!c.raw; });
                for (var i=0;i<cands.length;i++) {
                  if (cands[i].raw === target || (cands[i].digits && cands[i].digits === digits)) return true;
                }
                return false;
              });
              try { routeLayer.clearLayers(); routeLayer.addData({ type: 'FeatureCollection', features: filtered }); } catch (e) {}
              var routeBounds = null;
              try { var bnds = routeLayer.getBounds(); if (bnds && bnds.isValid()) { routeBounds = bnds; } } catch (e) {}
              // Load stops using route bounds with cache awareness
              try { loadStopsForBounds(routeBounds || map.getBounds()); } catch (e) {}
              rnLog('ROUTE', 'setBusRoute done', { total: feats.length, matched: filtered.length });
            })
            .catch(function (e) { rnLog('ROUTE', 'error', String(e && e.message || e)); });
        }
        window.setBusRoute = setBusRoute;

  // UI bindings
  try {
    var chkBuses = document.getElementById('chkBuses');
    var chkStops = document.getElementById('chkStops');
    var chkOnlyActive = document.getElementById('chkOnlyActive');
    var txtLine = document.getElementById('txtLine');
    var btnSearch = document.getElementById('btnSearch');
    chkBuses.addEventListener('change', function(){ showBuses = !!chkBuses.checked; if (clusterEnabled) { if (showBuses) { ensureClusters(); if (busesCluster && !map.hasLayer(busesCluster)) busesCluster.addTo(map); } else { if (busesCluster && map.hasLayer(busesCluster)) map.removeLayer(busesCluster); } } else { if (showBuses) { if (!map.hasLayer(busesLayer)) busesLayer.addTo(map); } else { if (map.hasLayer(busesLayer)) map.removeLayer(busesLayer); } } });
    chkStops.addEventListener('change', function(){ showStops = !!chkStops.checked; if (clusterEnabled) { if (showStops) { ensureClusters(); if (stopsCluster && !map.hasLayer(stopsCluster)) stopsCluster.addTo(map); } else { if (stopsCluster && map.hasLayer(stopsCluster)) map.removeLayer(stopsCluster); } } else { if (showStops) { if (!map.hasLayer(stopsLayer)) stopsLayer.addTo(map); } else { if (map.hasLayer(stopsLayer)) map.removeLayer(stopsLayer); } } });
    if (chkOnlyActive) { chkOnlyActive.addEventListener('change', function(){ showOnlyActiveBuses = !!chkOnlyActive.checked; refreshBuses(); }); }
    function applySearch() { var val = (txtLine && txtLine.value) || ''; filterLine = val; refreshBuses(); if (val && val.trim()) { try { window.setBusRoute(val); } catch (e) {} } }
    btnSearch.addEventListener('click', applySearch);
    txtLine.addEventListener('keydown', function(ev){ if (ev.key === 'Enter') { applySearch(); } });
  } catch (e) {}

  // Kick off initial buses refresh; preload lines for instant route drawing
  ensureLinesDataset().catch(function(){});
  ensureClusters();
  refreshBuses();
  // initial stops for current view
  try { loadStopsForBounds(map.getBounds()); } catch (e) {}
  map.on('moveend', function () { rnLog('MAP', 'moveend'); refreshBuses(); try { loadStopsForBounds(map.getBounds()); } catch (e) {} });
        setInterval(function () { refreshBuses(); }, 10000);
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
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (!data) return;
            if (data.type === 'log') {
              console.log(`[Map:${data.tag}]`, data.msg, data.extra ?? '');
              return;
            }
            if (data.type === 'fetch' && data.id && data.url) {
              // Perform native fetch via centralized service and send back to WebView as text
              (async () => {
                try {
                  const resp = await fetchWithCache(data.url, { headers: { accept: 'application/json' } });
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