// File: /df-bus-tracker/df-bus-tracker/src/js/map/map.js

// Enhanced Leaflet map with clickable bus stops and bus positions using WFS (GeoJSON)
(function () {
    // Debug helper
    const DEBUG = true;
    function log(tag, msg, extra) {
        if (!DEBUG) return;
        const time = new Date().toISOString();
        if (extra !== undefined) {
            console.log(`[DFBus][${tag}] ${time} - ${msg}`, extra);
        } else {
            console.log(`[DFBus][${tag}] ${time} - ${msg}`);
        }
    }

    log('INIT', 'map.js starting');

    if (!window.L) {
        console.error('Leaflet (L) not found. Make sure Leaflet JS is loaded before this script.');
        return;
    }

    // Create the map centered on Brasília
    const map = L.map('map', {
        tap: false,
        tapTolerance: 60,
        zoomSnap: 0.25,
        zoomDelta: 0.5
    }).setView([-15.7801, -47.9292], 12);

    // Base map (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // WFS/WMS endpoints
    const USE_PROXY = true;
    const ALLOW_WMS_MAP_CLICK = false; // only markers/overlays are clickable in fallback
    const DISABLE_FALLBACKS = true;    // disable any WMS fallback logic
    log('CONFIG', `USE_PROXY=${USE_PROXY}, ALLOW_WMS_MAP_CLICK=${ALLOW_WMS_MAP_CLICK}`);

    const WFS_BASE = USE_PROXY ? '/proxy/wfs' : 'https://geoserver.semob.df.gov.br/geoserver/semob/ows';
    const wmsUrl = USE_PROXY ? '/proxy/wms' : 'https://geoserver.semob.df.gov.br/geoserver/semob/wms';

    // Add direct WFS endpoints (no proxy) provided by the user
    const FIXED_WFS_URLS = {
        buses: 'https://geoserver.semob.df.gov.br/geoserver/semob/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=semob%3A%C3%9Altima%20posi%C3%A7%C3%A3o%20da%20frota&outputFormat=application%2Fjson',
        schedules: 'https://geoserver.semob.df.gov.br/geoserver/semob/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=semob%3AHor%C3%A1rios%20das%20Linhas&outputFormat=application%2Fjson',
        stops: 'https://geoserver.semob.df.gov.br/geoserver/semob/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=semob%3AParadas%20de%20onibus&outputFormat=application%2Fjson'
    };

    function fixedWfsUrl(baseUrl, bbox4326) {
        try {
            const u = new URL(baseUrl);
            if (bbox4326) {
                u.searchParams.set('bbox', `${bbox4326.getWest()},${bbox4326.getSouth()},${bbox4326.getEast()},${bbox4326.getNorth()},EPSG:4326`);
            }
            if (!u.searchParams.has('srsName')) u.searchParams.set('srsName', 'EPSG:4326');
            return u.toString();
        } catch (e) {
            log('WFS', 'fixedWfsUrl error', e);
            return baseUrl;
        }
    }

    function getStopsWfsUrl(bounds4326) {
        const remote = fixedWfsUrl(FIXED_WFS_URLS.stops, bounds4326);
        return USE_PROXY ? `/proxy/fetch?url=${encodeURIComponent(remote)}` : remote;
    }
    function getBusesWfsUrl(bounds4326) {
        const remote = fixedWfsUrl(FIXED_WFS_URLS.buses, bounds4326);
        return USE_PROXY ? `/proxy/fetch?url=${encodeURIComponent(remote)}` : remote;
    }
    function getSchedulesWfsUrl() {
        const remote = FIXED_WFS_URLS.schedules;
        return USE_PROXY ? `/proxy/fetch?url=${encodeURIComponent(remote)}` : remote;
    }

    let wfsAvailable = true;

    // Build a WFS URL with optional bbox in EPSG:4326
    function buildWfsUrl(typeName, bbox4326) {
        const params = new URLSearchParams({
            service: 'WFS', version: '1.0.0', request: 'GetFeature', typeName, outputFormat: 'application/json', srsName: 'EPSG:4326'
        });
        if (bbox4326) {
            params.set('bbox', `${bbox4326.getWest()},${bbox4326.getSouth()},${bbox4326.getEast()},${bbox4326.getNorth()},EPSG:4326`);
        }
        const url = `${WFS_BASE}?${params.toString()}`;
        log('WFS', 'buildWfsUrl', { typeName, bbox: bbox4326 ? bbox4326.toBBoxString?.() : null, url });
        return url;
    }

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
        const minZ = 10, maxZ = 16, minS = 34, maxS = 58;
        const clamped = Math.max(minZ, Math.min(maxZ, z));
        const t = (clamped - minZ) / (maxZ - minZ);
        const size = Math.round(minS + t * (maxS - minS));
        log('ICON', `iconSizeForZoom z=${z} -> ${size}`);
        return size;
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

    // Extra layer: big clickable buttons over bus stops to ease tapping
    const stopHitLayer = L.layerGroup().addTo(map);

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
            // Use compact card popup (descricao + codigo)
            layer.bindPopup(buildStopMiniCard(feature.properties || {}));

            // Add a bigger clickable overlay button on top of the stop
            const props = feature.properties || {};
            const latlng = layer.getLatLng();
            const hit = createStopHitMarker(latlng, props);
            stopHitLayer.addLayer(hit);

            const stopDrag = () => map.dragging.disable();
            const startDrag = () => map.dragging.enable();
            layer.on('mousedown touchstart', (e) => { stopDrag(); if (e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent); });
            layer.on('mouseup touchend', (e) => { startDrag(); if (e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent); });
        }
    });

    let busPositionsLayer = L.geoJSON(null, {
        pointToLayer: (feature, latlng) => L.marker(latlng, {
            icon: currentBusIcon,
            riseOnHover: true,
            bubblingMouseEvents: false,
            title: `Ônibus ${((feature && feature.properties && feature.properties.prefixo) || '')}`.trim(),
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
        log('EVENT', `zoomend -> size=${size}`);
        currentBusStopIcon = makeBusStopIcon(size);
        currentBusIcon = makeBusIcon(size);
        busStopsLayer.eachLayer(m => m.setIcon && m.setIcon(currentBusStopIcon));
        busPositionsLayer.eachLayer(m => m.setIcon && m.setIcon(currentBusIcon));
    });

    // Selected lines filter (from multiselect)
    let selectedLines = new Set();

    // No-op when fallbacks are disabled
    function applyWmsBusFilter() { /* fallbacks disabled */ }

    // Initialize Select2 and load options from WFS schedules (fallback to CSV if needed)
    function initLineMultiSelect() {
        log('FILTER', 'initLineMultiSelect start');
        const $sel = window.jQuery && window.jQuery('#busLineSelect');
        if (!$sel || !$sel.length || !$sel.select2) { log('FILTER', 'Select2 not available'); return; }
        $sel.select2({ placeholder: 'Digite para filtrar linhas', allowClear: true, width: 'resolve' });

        function extractCodesFromWfs(data) {
            try {
                const feats = (data && data.features) || [];
                const set = new Set();
                feats.forEach(f => {
                    const p = f && f.properties || {};
                    const code = (p.cd_linha || p.linha || p.servico || '').toString().trim();
                    if (code) set.add(code);
                });
                return set;
            } catch (e) {
                log('FILTER', 'extractCodesFromWfs error', e);
                return new Set();
            }
        }
        function loadCsvCodesFallback() {
            return fetch('src/data/horarios-das-linhas.csv')
                .then(r => { log('FILTER', 'fetch CSV status', r.status); return r.text(); })
                .then(txt => {
                    const rows = txt.split(/\r?\n/).filter(Boolean);
                    const dataRows = rows.slice(1);
                    const set = new Set();
                    dataRows.forEach(row => {
                        const cols = row.includes(';') ? row.split(';') : row.split(',');
                        const cd = (cols[3] || '').trim();
                        if (cd) set.add(cd);
                    });
                    return set;
                });
        }

        fetch(getSchedulesWfsUrl(), { headers: { 'Accept': 'application/json' }, mode: 'cors' })
            .then(resp => { log('FILTER', 'WFS schedules status', resp.status); if (!resp.ok) throw new Error(resp.statusText); return resp.json(); })
            .then(data => {
                let codes = extractCodesFromWfs(data);
                if (!codes.size) throw new Error('No codes from WFS');
                log('FILTER', `loaded codes (WFS): ${codes.size}`);
                const options = Array.from(codes).sort().map(cd => new Option(cd, cd, false, false));
                $sel.append(options).trigger('change');
            })
            .catch(err => {
                log('FILTER', 'WFS schedules failed, fallback CSV', err);
                loadCsvCodesFallback()
                    .then(codes => {
                        log('FILTER', `loaded codes (CSV): ${codes.size}`);
                        const options = Array.from(codes).sort().map(cd => new Option(cd, cd, false, false));
                        $sel.append(options).trigger('change');
                    })
                    .catch(e2 => log('FILTER', 'CSV fallback failed', e2));
            });

        $sel.on('change', function () {
            const values = $sel.val() || [];
            selectedLines = new Set(values.map(v => (v || '').toString().trim().toUpperCase()));
            log('FILTER', 'selectedLines', Array.from(selectedLines));
            refreshBusPositions();
            applyWmsBusFilter();
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
        if (!selectedLines.size) { log('FILTER', 'no filter, returning all'); return geojson; }
        const features = (geojson.features || []).filter(f => {
            const p = f.properties || {};
            const code = (p.cd_linha || p.linha || p.servico || '').toString().toUpperCase();
            return selectedLines.has(code);
        });
        log('FILTER', `filtered ${features.length}/${geojson.features?.length || 0}`);
        return { type: 'FeatureCollection', features };
    }

    // Keep only active stops (heuristic based on common property names)
    function isActiveStop(props = {}) {
        const v = (props.ativa ?? props.ativo ?? props.st_ativa ?? props.status ?? props.situacao ?? '').toString().trim().toUpperCase();
        if (v === '' || v === 'NULL') return true; // unknown -> keep
        if (['1','S','SIM','ATIVA','ATIVO','TRUE','T'].includes(v)) return true;
        if (['0','N','NAO','NÃO','INATIVA','INATIVO','FALSE','F'].includes(v)) return false;
        return true;
    }
    function filterActiveStops(geojson) {
        const feats = (geojson?.features || []).filter(f => isActiveStop(f.properties || {}));
        log('WFS', `filterActiveStops ${feats.length}/${geojson?.features?.length || 0}`);
        return { type: 'FeatureCollection', features: feats };
    }

    // Refresh status indicator
    function setStatus(text, ok = true) {
        const refreshStatusEl = document.getElementById('refreshStatus');
        log('STATUS', text);
        if (!refreshStatusEl) return;
        refreshStatusEl.textContent = `${new Date().toLocaleTimeString()} - ${text}`;
        refreshStatusEl.className = `d-block mt-2 small ${ok ? 'text-success' : 'text-danger'}`;
    }

    // MOVE UP: refresh timing and UI helpers (must be defined before any usage)
    const REFRESH_MS = 10000;
    let countdownTimer = null;

    function startCountdown() {
        log('UI', 'startCountdown');
        const barWrap = document.getElementById('refreshProgress');
        if (!barWrap) return;
        const bar = barWrap.querySelector('.progress-bar');
        let elapsed = 0;
        clearInterval(countdownTimer);
        bar.style.width = '0%';
        bar.setAttribute('aria-valuenow', '0');
        countdownTimer = setInterval(() => {
            elapsed += 200;
            const pct = Math.min(100, Math.round(100 * elapsed / REFRESH_MS));
            bar.style.width = pct + '%';
            bar.setAttribute('aria-valuenow', String(pct));
            if (elapsed >= REFRESH_MS) clearInterval(countdownTimer);
        }, 200);
    }

    function showUpdatedToast(ok = true) {
        log('UI', `showUpdatedToast ok=${ok}`);
        const el = document.getElementById('updateToast');
        if (!el) return;
        el.classList.remove('d-none', 'alert-success', 'alert-danger');
        el.classList.add(ok ? 'alert-success' : 'alert-danger');
        el.textContent = ok ? 'Atualizado' : 'Falha ao atualizar';
        setTimeout(() => el.classList.add('d-none'), 1500);
    }

    // Optional WMS fallback if WFS fails (non-clickable)
    // const wmsUrl = 'https://geoserver.semob.df.gov.br/geoserver/semob/wms';
    let stopsWmsFallback = null;
    let busesWmsFallback = null;
    let wmsClickAttached = false;

    function wmsGetFeatureInfoUrl(layer, latlng) {
        const point = map.latLngToContainerPoint(latlng, map.getZoom());
        const size = map.getSize();
        const b = map.getBounds();
        const sw = map.options.crs.project(b.getSouthWest());
        const ne = map.options.crs.project(b.getNorthEast());
        const bbox = `${sw.x},${sw.y},${ne.x},${ne.y}`;
        const params = { request: 'GetFeatureInfo', service: 'WMS', srs: 'EPSG:3857', styles: layer.wmsParams.styles || '', transparent: layer.wmsParams.transparent, version: '1.1.1', format: layer.wmsParams.format, bbox, height: size.y, width: size.x, layers: layer.wmsParams.layers, query_layers: layer.wmsParams.layers, info_format: 'text/html', x: Math.trunc(point.x), y: Math.trunc(point.y) };
        const url = wmsUrl + L.Util.getParamString(params, wmsUrl, true);
        log('WMS', 'GetFeatureInfo URL', url);
        return url;
    }

    function attachWmsClick() {
        if (wmsClickAttached || !ALLOW_WMS_MAP_CLICK) return;
        log('WMS', 'attachWmsClick');
        map.on('click', (e) => {
            const layersToQuery = [busesWmsFallback, stopsWmsFallback].filter(Boolean);
            log('WMS', 'map click', { latlng: e.latlng, layers: layersToQuery.length });
            if (!layersToQuery.length) return;
            const url = wmsGetFeatureInfoUrl(layersToQuery[0], e.latlng);
            const html = `<div class="card shadow-sm border-0" style="min-width:200px;max-width:260px">
                <div class="card-body p-2">
                    <div class="small mb-1">Detalhes indisponíveis no popup.</div>
                    <a class="btn btn-sm btn-primary" target="_blank" rel="noopener" href="${url}">Abrir detalhes</a>
                </div>
            </div>`;
            L.popup().setLatLng(e.latlng).setContent(html).openOn(map);
        });
        wmsClickAttached = true;
    }

    // Add overlays from a local GeoJSON file (used in fallback)
    async function tryLoadLocalStopsOverlay() {
        try {
            if (!stopHitLayer || (stopHitLayer.getLayers && stopHitLayer.getLayers().length)) return;
            const r = await fetch('src/data/geojson_paradas.json');
            if (!r.ok) return;
            const gj = await r.json();
            (gj.features || []).forEach(f => {
                const c = f.geometry && f.geometry.coordinates;
                if (!c || c.length < 2) return;
                const latlng = L.latLng(c[1], c[0]);
                stopHitLayer.addLayer(createStopHitMarker(latlng, f.properties || {}));
            });
            log('WMS', `local stops overlay loaded: ${gj.features?.length || 0}`);
        } catch { /* ignore */ }
    }

    function enableWmsFallback() {
        log('WMS', 'enableWmsFallback');
        // Always create both layers in fallback
        if (!stopsWmsFallback) {
            stopsWmsFallback = L.tileLayer.wms(wmsUrl, {
                layers: 'semob:Paradas de onibus',
                format: 'image/png',
                transparent: true,
                opacity: 0.7,
                version: '1.1.1'
            }).addTo(map);
        }
        if (!busesWmsFallback) {
            busesWmsFallback = L.tileLayer.wms(wmsUrl, {
                layers: 'semob:Última posição da frota',
                format: 'image/png',
                transparent: true,
                opacity: 0.9,
                version: '1.1.1'
            }).addTo(map);
            applyWmsBusFilter();
        }
        attachWmsClick();
        // Try to add big clickable buttons using a local GeoJSON if available
        tryLoadLocalStopsOverlay();
        setStatus('Fallback WMS ativo (cliques só nos botões das paradas)');
        log('WMS', 'fallback layers active');
    }

    function disableWmsFallback() {
        log('WMS', 'disableWmsFallback');
        if (stopsWmsFallback) { map.removeLayer(stopsWmsFallback); stopsWmsFallback = null; }
        if (busesWmsFallback) { map.removeLayer(busesWmsFallback); busesWmsFallback = null; }
    }

    // Loaders
    async function loadBusStops() {
        log('WFS', 'loadBusStops start');
        try {
            const bounds = map.getBounds();
            const url = getStopsWfsUrl(bounds) + `&_=${Date.now()}`;
            log('WFS', 'fetch stops', url);
            const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
            log('WFS', 'stops status', resp.status);
            if (!resp.ok) throw new Error(`Erro WFS Paradas: ${resp.status}`);
            let geojson = await resp.json();
            geojson = filterActiveStops(geojson);
            // Clear layers before adding
            stopHitLayer.clearLayers();
            busStopsLayer.clearLayers();
            stopsCluster.clearLayers();
            // Add data
            busStopsLayer.addData(geojson);
            stopsCluster.addLayer(busStopsLayer);
            setStatus(`Paradas: ${geojson.features?.length || 0}`);
            log('WFS', 'loadBusStops ok', geojson.features?.length || 0);
        } catch (e) {
            console.error('Falha ao carregar paradas:', e);
            setStatus('Falha ao carregar paradas', false);
            showUpdatedToast(false);
            log('WFS', 'loadBusStops failed', e);
        }
    }

    async function refreshBusPositions() {
        startCountdown();
        log('WFS', 'refreshBusPositions start');
        try {
            // if (!wfsAvailable) {
            //     applyWmsBusFilter();
            //     busesWmsFallback && busesWmsFallback.setParams({ _refresh: Date.now() });
            //     setStatus('Ônibus via WMS (WFS indisponível)');
            //     showUpdatedToast(true);
            //     log('WMS', 'refreshed WMS buses');
            //     return;
            // }
            const bounds = map.getBounds();
            const url = getBusesWfsUrl(bounds) + `&_=${Date.now()}`;
            log('WFS', 'fetch buses', url);
            const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
            log('WFS', 'buses status', resp.status);
            if (!resp.ok) throw new Error(`Erro WFS Frota: ${resp.status}`);
            let geojson = await resp.json();
            geojson = filterBusesBySelectedLines(geojson);
            busPositionsLayer.clearLayers();
            busesCluster.clearLayers();
            busPositionsLayer.addData(geojson);
            busesCluster.addLayer(busPositionsLayer);
            // disableWmsFallback();
            setStatus(`Ônibus: ${geojson.features?.length || 0}`);
            showUpdatedToast(true);
            log('WFS', 'refreshBusPositions ok', geojson.features?.length || 0);
        } catch (e) {
            console.error('Falha ao atualizar posições da frota:', e);
            setStatus('Falha ao atualizar posições da frota', false);
            showUpdatedToast(false);
            log('WFS', 'refreshBusPositions failed', e);
        }
    }

    // Auto refresh when map stops moving and every REFRESH_MS
    map.on('moveend', () => { log('EVENT', 'moveend'); refreshBusPositions(); loadBusStops(); });
    setInterval(() => refreshBusPositions(), REFRESH_MS);

    // Kick-off initial loads so layers appear even antes do primeiro intervalo
    try {
        loadBusStops();
        refreshBusPositions();
    } catch (e) {
        log('INIT', 'initial load failed', e);
    }

    // Helpers for popups
    function pickProp(props, candidates, fallback) {
        for (const k of candidates) {
            if (props && props[k] != null && `${props[k]}`.trim() !== '') return props[k];
        }
        return fallback;
    }

    function buildStopPopup(props) {
        const title = pickProp(props, ['descricao', 'ds_ponto', 'nm_parada', 'nome', 'ds_descricao'], 'Parada de ônibus');
        const codigo = pickProp(props, ['cd_parada', 'codigo', 'id', 'id_parada'], '—');
        const sentido = pickProp(props, ['sentido', 'ds_sentido'], '—');
        return `
            <div>
                <strong>${title}</strong><br/>
                Código: ${codigo}<br/>
                Sentido: ${sentido}
            </div>
        `;
    }

    function buildBusPopup(props) {
        const prefixo = pickProp(props, ['prefixo'], '—');
        const velocidade = pickProp(props, ['velocidade'], '—');
        const datalocal = pickProp(props, ['datalocal'], '—');
        const sentido = pickProp(props, ['sentido'], '—');
        const linha = pickProp(props, ['cd_linha', 'linha', 'servico'], '—');
        return `
            <div>
                <strong>Ônibus ${prefixo}</strong><br/>
                Linha: ${linha}<br/>
                Velocidade: ${velocidade} km/h<br/>
                Sentido: ${sentido}<br/>
                Data local: ${datalocal}
            </div>
        `;
    }

    // Compact popup for stops (only description and code)
    function buildStopMiniCard(props) {
        const title = pickProp(props, ['descricao', 'ds_ponto', 'nm_parada', 'nome', 'ds_descricao'], 'Parada de ônibus');
        const codigo = pickProp(props, ['cd_parada', 'codigo', 'id', 'id_parada'], '—');
        return `
            <div class="card shadow-sm border-0" style="min-width:200px;max-width:260px">
                <div class="card-body p-2">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <strong class="small text-truncate" title="${title}">${title}</strong>
                        <span class="badge badge-primary ml-2">Parada ${codigo}</span>
                    </div>
                </div>
            </div>
        `;
    }

    function createStopHitMarker(latlng, props) {
        const html = `
            <div class="stop-hit">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="4" y="5" width="16" height="10" rx="2" ry="2" fill="#1f4fbf"></rect>
                    <rect x="6" y="7" width="12" height="4" rx="1" ry="1" fill="#ffffff"></rect>
                    <circle cx="9" cy="15" r="1.3" fill="#ffffff"></circle>
                    <circle cx="15" cy="15" r="1.3" fill="#ffffff"></circle>
                </svg>
            </div>`;
        const bigIcon = L.divIcon({
            className: 'stop-hit-btn',
            html,
            iconSize: [48, 48],
            iconAnchor: [24, 44], // anchor near the pin bottom
        });
        const marker = L.marker(latlng, { icon: bigIcon, interactive: true, bubblingMouseEvents: false });
        marker.on('click', () => {
            L.popup({ maxWidth: 280 })
                .setLatLng(latlng)
                .setContent(buildStopMiniCard(props || {}))
                .openOn(map);
        });
        marker.on('mousedown touchstart', (e) => { map.dragging.disable(); if (e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent); });
        marker.on('mouseup touchend', (e) => { map.dragging.enable(); if (e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent); });
        return marker;
    }

    // Expose to global
    window.refreshBusPositions = refreshBusPositions;
    window.dfBusMap = { map, busStopsLayer, busPositionsLayer };
    log('INIT', 'map.js ready');
})();