// Core domain types for the bus tracking application

export interface Bus {
  id: string;
  prefixo: string;
  linha: string;
  latitude: number;
  longitude: number;
  velocidade: number;
  sentido: string;
  datalocal: string;
  tarifa?: number;
  active: boolean;
}

export interface BusStop {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
  latitude: number;
  longitude: number;
}

export interface BusLine {
  id: string;
  codigo: string;
  nome: string;
  servico: string;
  coordinates: [number, number][]; // [lng, lat] format
  tipo: 'LineString' | 'MultiLineString';
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface MapState {
  center: {
    latitude: number;
    longitude: number;
  };
  zoom: number;
  style: MapStyle;
  showBuses: boolean;
  showStops: boolean;
  showOnlyActiveBuses: boolean;
  selectedLines: string[];
}

export type MapStyle = 
  | 'light'
  | 'dark'
  | 'osm' 
  | 'stadia_dark' 
  | 'stadia_bright';

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

export interface ApiResponse<T> {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    properties: T;
    geometry: {
      type: 'Point' | 'LineString' | 'MultiLineString';
      coordinates: number[] | number[][] | number[][][];
    };
  }[];
}

// API response types
export interface BusApiProperties {
  prefixo: string;
  cd_linha?: string;
  linha?: string;
  servico?: string;
  velocidade: number;
  sentido: string;
  datalocal: string;
  tarifa?: number;
}

export interface StopApiProperties {
  parada?: string;
  cd_parada?: string;
  codigo?: string;
  id?: string;
  descricao?: string;
  ds_ponto?: string;
  nm_parada?: string;
  nome?: string;
  ds_descricao?: string;
  situacao?: string;
  estrutura_de_paragem?: string;
  tipo?: string;
}

export interface LineApiProperties {
  cd_linha?: string;
  linha?: string;
  servico?: string;
  cd_linha_principal?: string;
  codigo?: string;
  cod_linha?: string;
}

// App configuration
export interface AppConfig {
  api: {
    baseUrl: string;
    endpoints: {
      buses: string;
      stops: string;
      lines: string;
    };
  };
  map: {
    initialPosition: {
      latitude: number;
      longitude: number;
      zoom: number;
    };
    styles: Record<MapStyle, {
      url: string;
      attribution: string;
      maxZoom: number;
    }>;
  };
  cache: {
    ttl: number; // Time to live in milliseconds
    maxSize: number;
  };
}

// Error types
export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: number;
}

export type ErrorCode = 
  | 'NETWORK_ERROR'
  | 'LOCATION_PERMISSION_DENIED'
  | 'LOCATION_UNAVAILABLE'
  | 'API_ERROR'
  | 'CACHE_ERROR'
  | 'UNKNOWN_ERROR';
