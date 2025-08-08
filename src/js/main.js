// main.js

document.addEventListener('DOMContentLoaded', function () {
    // Map is initialized inside map.js IIFE

    const refreshBtn = document.getElementById('refreshButton');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function () {
            if (typeof window.refreshBusPositions === 'function') {
                window.refreshBusPositions();
            }
        });
    }
});