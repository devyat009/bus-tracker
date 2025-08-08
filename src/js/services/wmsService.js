// WMS helper utilities (non-module version)
(function (global) {
    const wmsBaseUrl = 'https://geoserver.semob.df.gov.br/geoserver/semob/wms';

    function buildWmsOptions(layerName) {
        return {
            layers: layerName,
            format: 'image/png',
            transparent: true
        };
    }

    function createWmsLayer(layerName) {
        if (!global.L) {
            console.error('Leaflet not found');
            return null;
        }
        return L.tileLayer.wms(wmsBaseUrl, buildWmsOptions(layerName));
    }

    global.WmsService = {
        createWmsLayer
    };
})(window);