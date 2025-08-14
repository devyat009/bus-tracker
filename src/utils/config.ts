import { AppConfig } from '../types';

const isDevelopment = __DEV__;

export const config: AppConfig = {
  api: {
    baseUrl: 'http://geoserver.semob.df.gov.br/geoserver/semob/ows',
    endpoints: {
      buses: 'service=WFS&version=1.0.0&request=GetFeature&typeName=semob%3A%C3%9Altima%20posi%C3%A7%C3%A3o%20da%20frota&outputFormat=application%2Fjson&maxFeatures=500',
      stops: 'service=WFS&version=1.0.0&request=GetFeature&typeName=semob%3AParadas%20de%20onibus&outputFormat=application%2Fjson&maxFeatures=200',
      lines: 'service=WFS&version=1.0.0&request=GetFeature&typeName=semob%3ALinhas%20de%20onibus&outputFormat=application%2Fjson&maxFeatures=100',
    },
  },
  map: {
    initialPosition: {
      latitude: -15.793782954386705,
      longitude: -47.882705972050054,
      zoom: 15,
    },
    styles: {
      osm: {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      },
      stadia_dark: {
        url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 20,
      },
      stadia_bright: {
        url: 'https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 20,
      },
    },
  },
  cache: {
    ttl: 5 * 60 * 1000, // 5 minutes
    maxSize: 100, // Maximum number of cached items
  },
};

// Environment-specific overrides
export const getConfig = (): AppConfig => {
  if (isDevelopment) {
    return {
      ...config,
      // Development-specific settings
      cache: {
        ...config.cache,
        ttl: 30 * 1000, // 30 seconds for faster development
      },
    };
  }

  return config;
};

export default getConfig();
