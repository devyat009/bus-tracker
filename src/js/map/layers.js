// This file defines the layers to be added to the map, including the bus stops and real-time bus positions, and manages their visibility and interactions.

const layers = {
    busStopsLayer: {
        name: "Bus Stops",
        url: "https://geoserver.semob.df.gov.br/geoserver/semob/wms?service=WMS&version=1.1.0&request=GetMap&layers=semob%3AParadas%20de%20onibus&bbox=150862.232029551%2C8223188.17981321%2C252204.625205115%2C8284240.71057392&width=768&height=462&srs=EPSG%3A31983&styles=&format=application/openlayers",
        visible: true,
    },
    busPositionsLayer: {
        name: "Real-time Bus Positions",
        url: "https://geoserver.semob.df.gov.br/geoserver/semob/wms?service=WMS&version=1.1.0&request=GetMap&layers=semob%3A%C3%9Altima%20posi%C3%A7%C3%A3o%20da%20frota&bbox=-180.0%2C-90.0%2C180.0%2C90.0&width=768&height=384&srs=EPSG%3A4326&styles=&format=application/openlayers",
        visible: true,
    }
};

export default layers;