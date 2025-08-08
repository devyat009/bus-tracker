// File: /df-bus-tracker/df-bus-tracker/src/js/map/map.js

// Enhanced Leaflet map with clickable bus stops and bus positions using WFS (GeoJSON)
(function () {
    if (!window.L) {
        console.error('Leaflet (L) not found. Make sure Leaflet JS is loaded before this script.');
        return;
    }

    // Create the map centered on Brasília
    const map = L.map('map', {
        tap: false,            // disable tap to reduce drag-on-click issues on mobile
        tapTolerance: 60,      // larger tap tolerance
        zoomSnap: 0.25,
        zoomDelta: 0.5
    }).setView([-15.7801, -47.9292], 12);

    // Base map (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // WFS base for GeoServer
    const WFS_BASE = 'https://geoserver.semob.df.gov.br/geoserver/semob/ows';

    // Data URIs for simple SVG icons
    function makeBusStopIcon(size) {
        return L.icon({
            iconUrl: 'data:image/svg+xml;utf8,' + encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 28 28">
                    <defs>
                        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#000" flood-opacity="0.3"/>
                        </filter>
                    </defs>
                    <circle cx="14" cy="14" r="12" fill="#32cd32" filter="url(#shadow)"/>
                    <rect x="9" y="7" width="10" height="12" rx="2" ry="2" fill="#fff"/>
                    <rect x="10.5" y="9" width="7" height="3" rx="1" ry="1" fill="#2e7d32"/>
                    <rect x="10.5" y="13" width="7" height="4" rx="1" ry="1" fill="#c8e6c9"/>
                    <circle cx="12" cy="20" r="1.2" fill="#fff"/>
                    <circle cx="16" cy="20" r="1.2" fill="#fff"/>
                </svg>
            `),
            iconSize: [size, size],
            iconAnchor: [size / 2, size * 0.9],
            popupAnchor: [0, -size * 0.7]
        });
    }

    function makeBusIcon(size) {
        return L.icon({
            iconUrl: 'data:image/svg+xml;utf8,' + encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 28 28">
                    <defs>
                        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#000" flood-opacity="0.3"/>
                        </filter>
                    </defs>
                    <circle cx="14" cy="14" r="12" fill="#ff1493" filter="url(#shadow)"/>
                    <rect x="7.5" y="8" width="13" height="10" rx="2" ry="2" fill="#fff"/>
                    <rect x="9" y="9.5" width="10" height="4" rx="1" ry="1" fill="#ff80bf"/>
                    <rect x="9" y="14.5" width="10" height="2.5" rx="1" ry="1" fill="#ffd1e6"/>
                    <circle cx="11" cy="20" r="1.3" fill="#fff"/>
                    <circle cx="17" cy="20" r="1.3" fill="#fff"/>
                </svg>
            `),
            iconSize: [size, size],
            iconAnchor: [size / 2, size * 0.9],
            popupAnchor: [0, -size * 0.7]
        });
    }

    // Stronger icon scaling so markers stay large when zoomed out
    function iconSizeForZoom(z) {
        // scale size between 34px (zoom 10) and 58px (zoom 16+)
        const minZ = 10, maxZ = 16, minS = 34, maxS = 58;
        const clamped = Math.max(minZ, Math.min(maxZ, z));
        const t = (clamped - minZ) / (maxZ - minZ);
        return Math.round(minS + t * (maxS - minS));
    }

    let currentBusStopIcon = makeBusStopIcon(iconSizeForZoom(map.getZoom()));
    let currentBusIcon = makeBusIcon(iconSizeForZoom(map.getZoom()));

    // Cluster groups
    const stopsCluster = L.markerClusterGroup({
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        disableClusteringAtZoom: 17
    }).addTo(map);

    const busesCluster = L.markerClusterGroup({
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        disableClusteringAtZoom: 17
    }).addTo(map);

    // Replace GeoJSON layers to feed into clusters
    let busStopsLayer = L.geoJSON(null, {
        pointToLayer: (feature, latlng) => L.marker(latlng, {
            icon: currentBusStopIcon,
            riseOnHover: true,
            bubblingMouseEvents: false,
            title: 'Parada de ônibus',
            keyboard: true
        }),
        onEachFeature: (feature, layer) => {
            layer.bindPopup(buildStopPopup(feature.properties || {}));
            const stopDrag = () => map.dragging.disable();
            const startDrag = () => map.dragging.enable();
            layer.on('mousedown touchstart', (e) => {
                stopDrag();
                if (e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent);
            });
            layer.on('mouseup touchend', (e) => {
                startDrag();
                if (e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent);
            });
        }
    });

    let busPositionsLayer = L.geoJSON(null, {
        pointToLayer: (feature, latlng) => L.marker(latlng, {
            icon: currentBusIcon,
            riseOnHover: true,
            bubblingMouseEvents: false,
            title: 'Ônibus',
            keyboard: true
        }),
        onEachFeature: (feature, layer) => {
            layer.bindPopup(buildBusPopup(feature.properties || {}));
            const stopDrag = () => map.dragging.disable();
            const startDrag = () => map.dragging.enable();
            layer.on('mousedown touchstart', (e) => {
                stopDrag();
                if (e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent);
            });
            layer.on('mouseup touchend', (e) => {
                startDrag();
                if (e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent);
            });
        }
    });

    // Add to clusters
    stopsCluster.addLayer(busStopsLayer);
    busesCluster.addLayer(busPositionsLayer);

    // Update icon sizes when zoom changes
    map.on('zoomend', () => {
        const size = iconSizeForZoom(map.getZoom());
        currentBusStopIcon = makeBusStopIcon(size);
        currentBusIcon = makeBusIcon(size);
        busStopsLayer.eachLayer(m => m.setIcon && m.setIcon(currentBusStopIcon));
        busPositionsLayer.eachLayer(m => m.setIcon && m.setIcon(currentBusIcon));
    });

    // Selected lines filter (from multiselect)
    let selectedLines = new Set();

    // Initialize Select2 and load options from CSV
    function initLineMultiSelect() {
        const $sel = window.jQuery && window.jQuery('#busLineSelect');
        if (!$sel || !$sel.length || !$sel.select2) return; // Select2 not loaded
        $sel.select2({ placeholder: 'Digite para filtrar linhas', allowClear: true, width: 'resolve' });

        fetch('src/data/horarios-das-linhas.csv')
            .then(r => r.text())
            .then(txt => {
                const rows = txt.split(/\r?\n/).filter(Boolean);
                const dataRows = rows.slice(1);
                const codes = new Set();
                dataRows.forEach(row => {
                    const cols = row.split(',');
                    const cd = (cols[3] || '').trim();
                    if (cd) codes.add(cd);
                });
                const options = Array.from(codes).sort().map(cd => new Option(cd, cd, false, false));
                $sel.append(options).trigger('change');
            })
            .catch(() => {
                // fallback: nothing to load
            });

        $sel.on('change', function () {
            const values = $sel.val() || [];
            selectedLines = new Set(values.map(v => (v || '').toString().trim().toUpperCase()));
            // refresh buses to apply filter
            refreshBusPositions();
        });
    }

    // Call after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLineMultiSelect);
    } else {
        initLineMultiSelect();
    }

    // Helper to filter GeoJSON by selected line codes
    function filterBusesBySelectedLines(geojson) {
        if (!selectedLines.size) return geojson;
        const features = (geojson.features || []).filter(f => {
            const p = f.properties || {};
            const code = (p.cd_linha || p.linha || p.servico || '').toString().toUpperCase();
            return selectedLines.has(code);
        });
        return { type: 'FeatureCollection', features };
    }

    // Refresh status indicator
    const refreshStatusEl = document.getElementById('refreshStatus');
    function setStatus(text, ok = true) {
        if (!refreshStatusEl) return;
        refreshStatusEl.textContent = `${new Date().toLocaleTimeString()} - ${text}`;
        refreshStatusEl.className = `d-block mt-2 small ${ok ? 'text-success' : 'text-danger'}`;
    }

    // Optional WMS fallback if WFS fails (non-clickable)
    const wmsUrl = 'https://geoserver.semob.df.gov.br/geoserver/semob/wms';
    let stopsWmsFallback = null;
    let busesWmsFallback = null;

    function enableWmsFallback() {
        if (!stopsWmsFallback) {
            stopsWmsFallback = L.tileLayer.wms(wmsUrl, {
                layers: 'semob:Paradas de onibus',
                format: 'image/png',
                transparent: true,
                opacity: 0.7
            }).addTo(map);
        }
        if (!busesWmsFallback) {
            busesWmsFallback = L.tileLayer.wms(wmsUrl, {
                layers: 'semob:Última posição da frota',
                format: 'image/png',
                transparent: true,
                opacity: 0.9
            }).addTo(map);
        }
        setStatus('Fallback WMS ativo (sem cliques)', false);
    }

    function disableWmsFallback() {
        if (stopsWmsFallback) { map.removeLayer(stopsWmsFallback); stopsWmsFallback = null; }
        if (busesWmsFallback) { map.removeLayer(busesWmsFallback); busesWmsFallback = null; }
    }

    // Loaders
    async function loadBusStops() {
        try {
            const typeName = 'semob:Paradas de onibus';
            const url = buildWfsUrl(typeName);
            const resp = await fetch(url, { headers: { 'Accept': 'application/json' }, mode: 'cors' });
            if (!resp.ok) throw new Error(`Erro WFS Paradas: ${resp.status}`);
            const geojson = await resp.json();
            // Clear and re-add to cluster to avoid duplicates
            busStopsLayer.clearLayers();
            stopsCluster.clearLayers();
            busStopsLayer.addData(geojson);
            stopsCluster.addLayer(busStopsLayer);
            disableWmsFallback();
            setStatus(`Paradas: ${geojson.features?.length || 0}`);
        } catch (e) {
            console.error('Falha ao carregar paradas:', e);
            enableWmsFallback();
        }
    }

    async function refreshBusPositions() {
        try {
            const bounds = map.getBounds();
            const typeName = 'semob:Última posição da frota';
            const url = buildWfsUrl(typeName, bounds) + `&_=${Date.now()}`; // cache-bust
            const resp = await fetch(url, { headers: { 'Accept': 'application/json' }, mode: 'cors' });
            if (!resp.ok) throw new Error(`Erro WFS Frota: ${resp.status}`);
            let geojson = await resp.json();
            geojson = filterBusesBySelectedLines(geojson);
            // Clear and re-add to cluster to avoid duplicates
            busPositionsLayer.clearLayers();
            busesCluster.clearLayers();
            busPositionsLayer.addData(geojson);
            busesCluster.addLayer(busPositionsLayer);
            disableWmsFallback();
            setStatus(`Ônibus: ${geojson.features?.length || 0}`);
        } catch (e) {
            console.error('Falha ao atualizar posições da frota:', e);
            enableWmsFallback();
        }
    }

    // Initial loads
    loadBusStops();
    refreshBusPositions();

    // Refresh button
    const refreshBtn = document.getElementById('refreshButton');
    if (refreshBtn) refreshBtn.addEventListener('click', refreshBusPositions);

    // Auto refresh when map stops moving and every 10s
    map.on('moveend', () => refreshBusPositions());
    setInterval(() => refreshBusPositions(), 10000);

    // Ensure clicks on clusters open popups for markers when spiderfied
    stopsCluster.on('clusterclick', function (a) { a.layer.spiderfy(); });
    busesCluster.on('clusterclick', function (a) { a.layer.spiderfy(); });

    // Expose to global
    window.refreshBusPositions = refreshBusPositions;
    window.dfBusMap = { map, busStopsLayer, busPositionsLayer };
})();