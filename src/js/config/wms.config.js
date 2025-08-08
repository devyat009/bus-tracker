const wmsConfig = {
    busStopsLayer: {
        url: "https://geoserver.semob.df.gov.br/geoserver/semob/wms?service=WMS&version=1.1.0&request=GetMap&layers=semob%3AParadas%20de%20onibus",
        params: {
            bbox: "150862.232029551,8223188.17981321,252204.625205115,8284240.71057392",
            width: 768,
            height: 462,
            srs: "EPSG:31983",
            format: "application/openlayers"
        }
    },
    busPositionsLayer: {
        url: "https://geoserver.semob.df.gov.br/geoserver/semob/wms?service=WMS&version=1.1.0&request=GetMap&layers=semob%3A%C3%9Altima%20posi%C3%A7%C3%A3o%20da%20frota",
        params: {
            bbox: "-180.0,-90.0,180.0,90.0",
            width: 768,
            height: 384,
            srs: "EPSG:4326",
            format: "application/openlayers"
        }
    }
};

export default wmsConfig;