import {
  ApiResponse,
  Bus,
  BusApiProperties,
  BusLine,
  BusStop,
  ErrorCode,
  LineApiProperties,
  MapBounds,
  StopApiProperties
} from '../types';
import appConfig from '../utils/config';

class ApiError extends Error {
  code: ErrorCode;
  details?: any;

  constructor(code: ErrorCode, message: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = appConfig.api.baseUrl;
  }

  private async makeRequest<T>(endpoint: string, bounds?: MapBounds): Promise<ApiResponse<T>> {
    try {
      let url = `${this.baseUrl}?${endpoint}`;
      
      if (bounds) {
        const bbox = `${bounds.west},${bounds.south},${bounds.east},${bounds.north},EPSG:4326`;
        url += `&bbox=${bbox}&srsName=EPSG:4326`;
      }

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new ApiError('API_ERROR', `HTTP ${response.status}`, {
          status: response.status,
          statusText: response.statusText,
          url,
        });
      }

      const data = await response.json();
      return data as ApiResponse<T>;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      throw new ApiError('NETWORK_ERROR', 'Failed to fetch data', error);
    }
  }

  async getBuses(bounds?: MapBounds): Promise<Bus[]> {
    const response = await this.makeRequest<BusApiProperties>(
      appConfig.api.endpoints.buses,
      bounds
    );

    return response.features
      .map(feature => this.transformBusFromApi(feature))
      .filter(bus => bus !== null) as Bus[];
  }

  async getStops(bounds?: MapBounds): Promise<BusStop[]> {
    let endpoint = appConfig.api.endpoints.stops;
    
    // Force EPSG:4326 output for stops
    if (!endpoint.includes('srsName=')) {
      endpoint += '&srsName=EPSG:4326';
    }
    
    const response = await this.makeRequest<StopApiProperties>(
      endpoint,
      bounds
    );

    return response.features
      .map(feature => this.transformStopFromApi(feature))
      .filter(stop => stop !== null) as BusStop[];
  }

  async getLines(): Promise<BusLine[]> {
    const response = await this.makeRequest<LineApiProperties>(
      appConfig.api.endpoints.lines
    );

    return response.features
      .map(feature => this.transformLineFromApi(feature))
      .filter(line => line !== null) as BusLine[];
  }

  private transformBusFromApi(feature: ApiResponse<BusApiProperties>['features'][0]): Bus | null {
    const { properties, geometry } = feature;
    
    if (geometry.type !== 'Point' || !Array.isArray(geometry.coordinates)) {
      return null;
    }

    const [longitude, latitude] = geometry.coordinates as [number, number];
    
    if (!properties.prefixo || (!properties.cd_linha && !properties.linha && !properties.servico)) {
      return null;
    }

    return {
      id: properties.prefixo,
      prefixo: properties.prefixo,
      linha: properties.cd_linha || properties.linha || properties.servico || '',
      latitude,
      longitude,
      velocidade: properties.velocidade || 0,
      sentido: properties.sentido || '',
      datalocal: properties.datalocal || '',
      tarifa: properties.tarifa,
      active: Boolean(properties.cd_linha || properties.linha || properties.servico),
    };
  }

  private transformStopFromApi(feature: ApiResponse<StopApiProperties>['features'][0]): BusStop | null {
    const { properties, geometry } = feature;
    
    if (geometry.type !== 'Point' || !Array.isArray(geometry.coordinates)) {
      return null;
    }

    let [longitude, latitude] = geometry.coordinates as [number, number];
    
    // Check if coordinates are in UTM format (large numbers typically > 180)
    if (Math.abs(longitude) > 180 || Math.abs(latitude) > 90) {
      // UTM coordinates detected, convert to lat/lng
      // EPSG:31983 (UTM Zone 23S) to EPSG:4326 conversion for Brasília region
      const converted = this.convertUtmToLatLng(longitude, latitude);
      longitude = converted.longitude;
      latitude = converted.latitude;
    }
    
    // Skip invalid coordinates (outside of Brazil bounds)
    if (latitude < -35 || latitude > 5 || longitude < -75 || longitude > -30) {
      console.log('Invalid coordinates for stop, skipping:', { latitude, longitude, properties });
      return null;
    }
    
    const codigo = properties.parada || properties.cd_parada || properties.codigo || properties.id || '';
    const nome = properties.descricao || properties.ds_ponto || properties.nm_parada || properties.nome || properties.ds_descricao || 'Parada de ônibus';

    return {
      id: codigo || `${latitude}-${longitude}`,
      codigo,
      nome,
      descricao: nome,
      latitude,
      longitude,
    };
  }

  private convertUtmToLatLng(utmX: number, utmY: number): { latitude: number; longitude: number } {
    // UTM Zone 23S parameters for Central Brazil (Brasília region)
    const zone = 23;
    const hemisphere = 'S';
    const a = 6378137.0; // WGS84 semi-major axis
    const e = 0.0818191908426; // WGS84 eccentricity
    const e1sq = 0.00673949674228; // e1 squared
    const k0 = 0.9996; // UTM scale factor
    const falseEasting = 500000.0;
    const falseNorthing = hemisphere === 'S' ? 10000000.0 : 0.0;

    // Central meridian for UTM zone 23: -45 degrees
    const centralMeridian = (zone - 1) * 6 - 180 + 3; // -45 degrees

    const x = utmX - falseEasting;
    const y = utmY - falseNorthing;

    const M = y / k0;
    const mu = M / (a * (1 - Math.pow(e, 2) / 4 - 3 * Math.pow(e, 4) / 64 - 5 * Math.pow(e, 6) / 256));

    const e1 = (1 - Math.sqrt(1 - Math.pow(e, 2))) / (1 + Math.sqrt(1 - Math.pow(e, 2)));
    const J1 = 3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32;
    const J2 = 21 * Math.pow(e1, 2) / 16 - 55 * Math.pow(e1, 4) / 32;
    const J3 = 151 * Math.pow(e1, 3) / 96;
    const J4 = 1097 * Math.pow(e1, 4) / 512;

    const fp = mu + J1 * Math.sin(2 * mu) + J2 * Math.sin(4 * mu) + J3 * Math.sin(6 * mu) + J4 * Math.sin(8 * mu);

    const e2 = Math.sqrt(1 - Math.pow(e, 2));
    const C1 = Math.pow(e2, 2) / Math.pow(Math.cos(fp), 2);
    const T1 = Math.pow(Math.tan(fp), 2);
    const R1 = a * (1 - Math.pow(e, 2)) / Math.pow(1 - Math.pow(e, 2) * Math.pow(Math.sin(fp), 2), 1.5);
    const N1 = a / Math.sqrt(1 - Math.pow(e, 2) * Math.pow(Math.sin(fp), 2));
    const D = x / (N1 * k0);

    const Q1 = N1 * Math.tan(fp) / R1;
    const Q2 = Math.pow(D, 2) / 2;
    const Q3 = (5 + 3 * T1 + 10 * C1 - 4 * Math.pow(C1, 2) - 9 * e1sq) * Math.pow(D, 4) / 24;
    const Q4 = (61 + 90 * T1 + 298 * C1 + 45 * Math.pow(T1, 2) - 1.6 * e1sq - 37 * e1sq * C1) * Math.pow(D, 6) / 720;

    const latitude = fp - Q1 * (Q2 - Q3 + Q4);

    const Q5 = D;
    const Q6 = (1 + 2 * T1 + C1) * Math.pow(D, 3) / 6;
    const Q7 = (5 - 2 * C1 + 28 * T1 - 3 * Math.pow(C1, 2) + 8 * e1sq + 24 * Math.pow(T1, 2)) * Math.pow(D, 5) / 120;

    const longitude = centralMeridian + (Q5 - Q6 + Q7) / Math.cos(fp);

    return {
      latitude: latitude * 180 / Math.PI,
      longitude: longitude * 180 / Math.PI
    };
  }

  private transformLineFromApi(feature: ApiResponse<LineApiProperties>['features'][0]): BusLine | null {
    const { properties, geometry } = feature;
    
    if (!['LineString', 'MultiLineString'].includes(geometry.type)) {
      return null;
    }

    const codigo = properties.cd_linha || properties.linha || properties.servico || properties.codigo || properties.cod_linha || '';
    
    if (!codigo) {
      return null;
    }

    let coordinates: [number, number][] = [];

    if (geometry.type === 'LineString') {
      coordinates = geometry.coordinates as [number, number][];
    } else if (geometry.type === 'MultiLineString') {
      // Flatten MultiLineString into a single LineString
      coordinates = (geometry.coordinates as [number, number][][]).flat();
    }

    return {
      id: codigo,
      codigo,
      nome: codigo,
      servico: properties.servico || codigo,
      coordinates,
      tipo: geometry.type as 'LineString' | 'MultiLineString',
    };
  }
}

export const apiService = new ApiService();
export { ApiError };
export default apiService;
