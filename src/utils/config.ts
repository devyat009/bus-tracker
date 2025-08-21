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
