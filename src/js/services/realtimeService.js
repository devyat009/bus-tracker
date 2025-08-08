// Realtime service utilities for WMS layers (non-module)
(function (global) {
    function refreshWmsLayer(layer) {
        if (layer && typeof layer.setParams === 'function') {
            layer.setParams({ _: Date.now() });
        }
    }

    global.RealtimeService = {
        refreshWmsLayer
    };
})(window);