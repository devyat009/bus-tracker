// File: /df-bus-tracker/df-bus-tracker/src/js/map/map.js

// Initialize Leaflet map and WMS layers
(function () {
    if (!window.L) {
        console.error('Leaflet (L) not found. Make sure Leaflet JS is loaded before this script.');
        return;
    }

    // Create the map centered on Brasília
    const map = L.map('map').setView([-15.7801, -47.9292], 12);

    // Base map (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const wmsBaseUrl = 'https://geoserver.semob.df.gov.br/geoserver/semob/wms';

    // WMS: Bus Stops
    const busStopsLayer = L.tileLayer.wms(wmsBaseUrl, {
        layers: 'semob:Paradas de onibus',
        format: 'image/png',
        transparent: true,
        attribution: 'Paradas de ônibus (SEMOB)'
    }).addTo(map);

    // WMS: Real-time Bus Positions
    let busPositionsLayer = L.tileLayer.wms(wmsBaseUrl, {
        layers: 'semob:Última posição da frota',
        format: 'image/png',
        transparent: true,
        attribution: 'Última posição da frota (SEMOB)'
    }).addTo(map);

    // Public refresh function (cache-bust the WMS layer)
    function refreshBusPositions() {
        if (busPositionsLayer && typeof busPositionsLayer.setParams === 'function') {
            busPositionsLayer.setParams({ _: Date.now() });
        }
    }

    // Expose to global scope for other scripts
    window.refreshBusPositions = refreshBusPositions;

    // Hook up refresh button if present
    const refreshBtn = document.getElementById('refreshButton');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshBusPositions);
    }

    // Optional: expose layers/map if needed elsewhere
    window.dfBusMap = { map, busStopsLayer, busPositionsLayer };
})();