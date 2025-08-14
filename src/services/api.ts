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
    const response = await this.makeRequest<StopApiProperties>(
      appConfig.api.endpoints.stops,
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

    const [longitude, latitude] = geometry.coordinates as [number, number];
    
    const codigo = properties.cd_parada || properties.codigo || properties.id || '';
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
