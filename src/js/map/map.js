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
    const ENABLE_STOP_HIT_OVERLAY = false; // disable blue stop overlay buttons
    log('CONFIG', `USE_PROXY=${USE_PROXY}, ALLOW_WMS_MAP_CLICK=${ALLOW_WMS_MAP_CLICK}`);

    const WFS_BASE = USE_PROXY ? '/proxy/wfs' : 'https://geoserver.semob.df.gov.br/geoserver/semob/ows';
    const wmsUrl = USE_PROXY ? '/proxy/wms' : 'https://geoserver.semob.df.gov.br/geoserver/semob/wms';

    // Add direct WFS endpoints (no proxy) provided by the user
    const FIXED_WFS_URLS = {
        buses: 'https://geoserver.semob.df.gov.br/geoserver/semob/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=semob%3A%C3%9Altima%20posi%C3%A7%C3%A3o%20da%20frota&outputFormat=application%2Fjson',
        schedules: 'https://geoserver.semob.df.gov.br/geoserver/semob/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=semob%3AHor%C3%A1rios%20das%20Linhas&outputFormat=application%2Fjson',
    stops: 'https://geoserver.semob.df.gov.br/geoserver/semob/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=semob%3AParadas%20de%20onibus&outputFormat=application%2Fjson',
    lines: 'https://geoserver.semob.df.gov.br/geoserver/semob/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=semob%3ALinhas%20de%20onibus&outputFormat=application%2Fjson'
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
    function getLinesWfsUrl(bounds4326) {
        // Ensure we force srsName=EPSG:4326 (Leaflet expects lon/lat)
        const remote = fixedWfsUrl(FIXED_WFS_URLS.lines, bounds4326);
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
                    <!-- Rectangle -->
                    <rect x="5" y="3" width="18" height="14" rx="3" ry="3" fill="#32cd32" filter="url(#shadow)"/>
                    <!-- Triangulum -->
                    <path d="M9 17 L19 17 L14 23 Z" fill="#32cd32" filter="url(#shadow)"/>
                    <!-- Sign and Pole -->
                    <!-- Sign pole -->
                    <rect x="7.5" y="7" width="1" height="5" fill="#fff"/> <!-- haste -->
                    <!-- Sign -->
                    <rect x="6.5" y="5" width="3" height="2" rx="0.5" ry="0.5" fill="#2e7d32"/>
                    <!-- Roof -->
                    <rect x="10" y="6" width="9" height="1.2" fill="#fff"/>
                    <!-- Lateral Bars -->
                    <rect x="10" y="7" width="0.8" height="5" fill="#fff"/>
                    <rect x="18.2" y="7" width="0.8" height="5" fill="#fff"/>
                    <!-- Seat -->
                    <rect x="11" y="10" width="7" height="1.2" rx="0.3" fill="#fff"/>
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

                    <!-- Background Rectangle -->
                    <rect x="3" y="3" width="22" height="22" rx="4" ry="4" fill="#c30505ff" filter="url(#shadow)"/>

                    <!-- Side Mirrors -->
                    <rect x="7.5" y="9" width="1" height="2" rx="0.3" fill="#000"/>
                    <rect x="19.5" y="9" width="1" height="2" rx="0.3" fill="#000"/>

                    <!-- Body -->
                    <rect x="9" y="7" width="10" height="10" rx="2" ry="2" fill="#fff"/>

                    <!-- Windshield -->
                    <rect x="10.5" y="8.5" width="7" height="4" rx="1" ry="1" fill="#bcbcbcff"/>

                    <!-- Central Stripe -->
                    <rect x="10.5" y="13.5" width="7" height="2" fill="#949494ff"/>

                    <!-- Headlights -->
                    <circle cx="11.5" cy="16.5" r="0.9" fill="#fff"/>
                    <circle cx="16.5" cy="16.5" r="0.9" fill="#fff"/>

                    <!-- Black Wheels -->
                    <rect x="9.5" y="17.8" width="2" height="2" rx="0.5" fill="#000"/>
                    <rect x="16.5" y="17.8" width="2" height="2" rx="0.5" fill="#000"/>
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

    // Layer to display the selected bus route (trajeto)
    const currentRouteLayer = L.geoJSON(null, {
        style: {
            color: '#1f6feb',
            weight: 4,
            opacity: 0.9
        }
    }).addTo(map);

    // Cache for lines dataset to avoid repeated WFS fetches
    let linesDataset = null; // FeatureCollection or null
    let linesDatasetLoading = false; // Track if dataset is being loaded
    // Control whether we auto-fit to the route after drawing (disabled per user request)
    let autoFitRoute = false;

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
    const stopHitLayer = ENABLE_STOP_HIT_OVERLAY ? L.layerGroup().addTo(map) : L.layerGroup();

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

            // Add a bigger clickable overlay button on top of the stop (disabled by config)
            if (ENABLE_STOP_HIT_OVERLAY) {
                const props = feature.properties || {};
                const latlng = layer.getLatLng();
                const hit = createStopHitMarker(latlng, props);
                stopHitLayer.addLayer(hit);
            }

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
            // On click, draw the route for this bus (based on its line code)
            layer.on('click', async () => {
                const p = feature?.properties || {};
                const codeRaw = (p.cd_linha ?? p.linha ?? p.servico ?? '').toString().trim();
                // Ensure popup stays visible
                try { layer.openPopup(); } catch {}
                if (!codeRaw) {
                    log('ROUTE', 'no line code on bus feature');
                    // Try to enrich popup with tarifa from own props (if any)
                    try { await maybeEnrichPopupWithTarifa(layer, p, null); } catch {}
                    return;
                }
                // Draw route
                await drawRouteForLineCode(codeRaw);
                // Prepare tarifa enrichment in parallel
                const tarifaPromise = maybeEnrichPopupWithTarifa(layer, p, codeRaw).catch(() => {});
                // After any zoom/fits caused by route drawing, ensure marker is visible and reopen popup
                if (typeof busesCluster?.zoomToShowLayer === 'function') {
                    busesCluster.zoomToShowLayer(layer, () => {
                        Promise.resolve(tarifaPromise).finally(() => {
                            try { layer.openPopup(); } catch {}
                        });
                    });
                } else {
                    map.once('moveend', () => {
                        Promise.resolve(tarifaPromise).finally(() => {
                            try { layer.openPopup(); } catch {}
                        });
                    });
                }
            });
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
        let size = iconSizeForZoom(map.getZoom());
        size = Math.min(size, 42);
        log('EVENT', `zoomend -> size=${size}`);
        currentBusStopIcon = makeBusStopIcon(size);
        currentBusIcon = makeBusIcon(size);
        busStopsLayer.eachLayer(m => m.setIcon && m.setIcon(currentBusStopIcon));
        busPositionsLayer.eachLayer(m => m.setIcon && m.setIcon(currentBusIcon));
    });

    // Visibility toggles for Stops and Buses
    function updateStopsVisibility(show) {
        log('UI', `updateStopsVisibility: ${show}`);
        if (show) {
            if (!map.hasLayer(stopsCluster)) map.addLayer(stopsCluster);
            if (ENABLE_STOP_HIT_OVERLAY && !map.hasLayer(stopHitLayer)) map.addLayer(stopHitLayer);
            if (stopsWmsFallback && !map.hasLayer(stopsWmsFallback)) map.addLayer(stopsWmsFallback);
        } else {
            if (map.hasLayer(stopsCluster)) map.removeLayer(stopsCluster);
            if (map.hasLayer(stopHitLayer)) map.removeLayer(stopHitLayer);
            if (stopsWmsFallback && map.hasLayer(stopsWmsFallback)) map.removeLayer(stopsWmsFallback);
        }
    }
    function updateBusesVisibility(show) {
        log('UI', `updateBusesVisibility: ${show}`);
        if (show) {
            if (!map.hasLayer(busesCluster)) map.addLayer(busesCluster);
            if (busesWmsFallback && !map.hasLayer(busesWmsFallback)) map.addLayer(busesWmsFallback);
        } else {
            if (map.hasLayer(busesCluster)) map.removeLayer(busesCluster);
            if (busesWmsFallback && map.hasLayer(busesWmsFallback)) map.removeLayer(busesWmsFallback);
        }
    }

    function initLayerVisibilityToggles() {
        const stopsToggle = document.getElementById('toggleStops');
        const busesToggle = document.getElementById('toggleBuses');
        const activeBusesToggle = document.getElementById('toggleActiveBuses');
        if (stopsToggle) {
            updateStopsVisibility(stopsToggle.checked);
            stopsToggle.addEventListener('change', (e) => updateStopsVisibility(e.target.checked));
        }
        if (busesToggle) {
            updateBusesVisibility(busesToggle.checked);
            busesToggle.addEventListener('change', (e) => updateBusesVisibility(e.target.checked));
        }
        if (activeBusesToggle) {
            showOnlyActiveBuses = !!activeBusesToggle.checked;
            activeBusesToggle.addEventListener('change', (e) => {
                showOnlyActiveBuses = !!e.target.checked;
                log('FILTER', `toggle active buses -> ${showOnlyActiveBuses}`);
                refreshBusPositions();
                applyWmsBusFilter();
            });
        }
    }

    // Selected lines filter (from multiselect)
    let selectedLines = new Set();
    // Active buses filter: only include features that have a Linha value
    let showOnlyActiveBuses = false;

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

    // Initialize visibility toggles
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLayerVisibilityToggles);
    } else {
        initLayerVisibilityToggles();
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

    // When enabled, keep only buses that have a non-empty Linha-related property
    function filterOnlyActiveBuses(geojson) {
        if (!showOnlyActiveBuses) return geojson;
        const features = (geojson.features || []).filter(f => {
            const p = f.properties || {};
            const linhaVal = (p.cd_linha ?? p.linha ?? p.servico ?? '').toString().trim();
            return linhaVal !== '' && linhaVal.toUpperCase() !== 'NULL' && linhaVal.toUpperCase() !== 'N/A';
        });
        log('FILTER', `active buses ${features.length}/${geojson.features?.length || 0}`);
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
            if (!ENABLE_STOP_HIT_OVERLAY) return;
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
        if (ENABLE_STOP_HIT_OVERLAY) tryLoadLocalStopsOverlay();
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
            geojson = filterOnlyActiveBuses(geojson);
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

    function buildBusPopup(props, tarifaOverride) {
        const prefixo = pickProp(props, ['prefixo'], '—');
        const velocidade = pickProp(props, ['velocidade'], '—');
        const datalocal = pickProp(props, ['datalocal'], '—');
        const sentido = pickProp(props, ['sentido'], '—');
        const linha = pickProp(props, ['cd_linha', 'linha', 'servico'], '—');
        const tarifa = tarifaOverride ?? pickProp(props, ['tarifa', 'vl_tarifa', 'valor_tarifa', 'preco', 'valor'], null);
        return `
            <div>
                <strong>Ônibus ${prefixo}</strong><br/>
                Linha: ${linha}<br/>
                Velocidade: ${velocidade} km/h<br/>
                Sentido: ${sentido}<br/>
                Data local: ${datalocal}
                ${tarifa != null && tarifa !== '—' && `${formatTarifaLine(tarifa)}` || ''}
            </div>
        `;
    }

    function formatTarifaLine(v) {
        const num = Number(v);
        if (Number.isFinite(num)) {
            // Simple BRL format without relying on locale
            const s = 'R$ ' + num.toFixed(2).replace('.', ',');
            return `<br/>Tarifa: ${s}`;
        }
        return '';
    }

    async function maybeEnrichPopupWithTarifa(layer, busProps, codeRaw) {
        try {
            // If popup already has a tarifa line, skip
            const popup = layer.getPopup?.();
            const currentHtml = popup?.getContent?.() || '';
            if (typeof currentHtml === 'string' && currentHtml.includes('Tarifa:')) return;

            // Try from bus props first
            let tarifa = pickProp(busProps || {}, ['tarifa', 'vl_tarifa', 'valor_tarifa', 'preco', 'valor'], null);
            if (tarifa == null && codeRaw) {
                // Fallback to lines dataset
                const ds = await ensureLinesDataset();
                const feat = ds?.features?.find(f => matchLineCode(f.properties || {}, codeRaw));
                tarifa = feat?.properties?.tarifa ?? null;
            }
            if (tarifa == null) return;
            const html = buildBusPopup(busProps || {}, tarifa);
            if (popup && popup.setContent) {
                popup.setContent(html);
                try { layer.openPopup(); } catch {}
            } else {
                try { layer.bindPopup(html).openPopup(); } catch {}
            }
        } catch (e) {
            log('POPUP', 'maybeEnrichPopupWithTarifa error', e);
        }
    }

    // Helpers to draw route (trajeto) by line code
    function matchLineCode(props = {}, codeRaw = '') {
        const norm = (v) => (v ?? '').toString().trim().toUpperCase();
        const digitOnly = (v) => norm(v).replace(/[^0-9]/g, '').replace(/^0+/, '');
        const target = norm(codeRaw);
        const targetDigits = digitOnly(codeRaw);
        if (!target) return false;
        const candidates = [props.cd_linha, props.linha, props.servico, props.cd_linha_principal, props.codigo, props.cod_linha]
            .map(v => ({ raw: norm(v), digits: digitOnly(v) }))
            .filter(c => !!c.raw);
        // Match by raw equality OR by digits-only equality ignoring leading zeros
        return candidates.some(c => c.raw === target || (c.digits && c.digits === targetDigits));
    }

    async function ensureLinesDataset(forceRefresh = false) {
        if (linesDataset && !forceRefresh) return linesDataset;
        if (linesDatasetLoading) {
            // If already loading, wait for the current request to finish
            return new Promise(resolve => {
                const check = () => {
                    if (!linesDatasetLoading) resolve(linesDataset);
                    else setTimeout(check, 100);
                };
                check();
            });
        }
        
        try {
            linesDatasetLoading = true;
            if (forceRefresh) setStatus('Recarregando trajetos das linhas...');
            const url = getLinesWfsUrl() + `&_=${Date.now()}`;
            log('ROUTE', forceRefresh ? 'force refresh lines' : 'fetch lines', url);
            const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
            log('ROUTE', 'lines status', resp.status);
            if (!resp.ok) throw new Error(`Erro WFS Linhas: ${resp.status}`);
            linesDataset = await resp.json();
            if (forceRefresh) setStatus('Trajetos recarregados');
        } catch (e) {
            console.error('Falha ao carregar linhas:', e);
            if (forceRefresh) setStatus('Falha ao recarregar trajetos', false);
        } finally {
            linesDatasetLoading = false;
        }
        return linesDataset;
    }

    async function drawRouteForLineCode(codeRaw) {
        try {
            const ds = await ensureLinesDataset();
            if (!ds || !Array.isArray(ds.features)) return;
            // Clear previous route
            currentRouteLayer.clearLayers();
            // Filter matching features
            const feats = ds.features.filter(f => matchLineCode(f.properties || {}, codeRaw));
            // If no features found, force refresh and try again
            if (!feats.length) {
                log('ROUTE', `no features for code ${codeRaw}, forcing refresh`);
                ds = await ensureLinesDataset(true); // Force refresh
                feats = ds?.features?.filter(f => matchLineCode(f.properties || {}, codeRaw)) || [];
                if (!feats.length) {
                    log('ROUTE', `still no features after refresh for code ${codeRaw}`);
                    showUpdatedToast(false);
                    return;
                }
            }
            const gj = { type: 'FeatureCollection', features: feats };
            currentRouteLayer.addData(gj);
            try {
                if (autoFitRoute) {
                    const b = currentRouteLayer.getBounds();
                    if (b && b.isValid()) map.fitBounds(b.pad(0.15));
                }
            } catch {}
            showUpdatedToast(true);
            log('ROUTE', `drawn route for ${codeRaw} (features=${feats.length})`);
        } catch (e) {
            console.error('Falha ao desenhar trajeto:', e);
            showUpdatedToast(false);
        }
    }

    // Optional: allow manual fit to the currently drawn route
    function fitCurrentRoute(padding = 0.15) {
        try {
            const b = currentRouteLayer.getBounds();
            if (b && b.isValid()) map.fitBounds(b.pad(padding));
        } catch {}
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

    // Auto refresh when map stops moving and every REFRESH_MS
    map.on('moveend', () => { log('EVENT', 'moveend'); refreshBusPositions(); loadBusStops(); });
    setInterval(() => refreshBusPositions(), REFRESH_MS);

    // Kick-off initial loads so layers appear even antes do primeiro intervalo
    try {
        loadBusStops();
        refreshBusPositions();
        // Quietly preload lines dataset in background
        ensureLinesDataset().catch(e => log('PRELOAD', 'background lines preload failed', e));
    } catch (e) {
        log('INIT', 'initial load failed', e);
    }

    // Expose to global
    window.refreshBusPositions = refreshBusPositions;
    window.dfBusMap = { map, busStopsLayer, busPositionsLayer };
    log('INIT', 'map.js ready');
})();