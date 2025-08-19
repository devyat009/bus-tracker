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
    let [rawX, rawY] = geometry.coordinates as [number, number];
    let latitude: number;
    let longitude: number;

    // Detect UTM (EPSG:31983 – SIRGAS 2000 / UTM zone 23S)
    const looksLikeUtm = rawX > 100000 && rawX < 400000 && rawY > 8_000_000 && rawY < 9_200_000; // heuristic
    if (looksLikeUtm) {
      const { lat, lng } = this.utmToLatLngZone23S(rawX, rawY);
      latitude = lat;
      longitude = lng;
    } else {
      // Already lon/lat
      longitude = rawX;
      latitude = rawY;
    }

    // Validate plausible region (Central Brazil / DF)
    if (isNaN(latitude) || isNaN(longitude) || latitude < -35 || latitude > 10 || longitude < -75 || longitude > -25) {
      // Fallback: skip invalid
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
  // Precise UTM zone 23S (WGS84/SIRGAS 2000) conversion
  private utmToLatLngZone23S(easting: number, northing: number): { lat: number; lng: number } {
    const k0 = 0.9996;
    const a = 6378137.0;
    const eccSquared = 0.00669438;
    const eccPrimeSquared = eccSquared / (1 - eccSquared);
    const e1 = (1 - Math.sqrt(1 - eccSquared)) / (1 + Math.sqrt(1 - eccSquared));
    const zoneNumber = 23;
    const longOrigin = (zoneNumber - 1) * 6 - 180 + 3; // -45°

    let x = easting - 500000.0; // remove false easting
    let y = northing - 10000000.0; // remove false northing (southern hemisphere)

    const M = y / k0;
    const mu = M / (a * (1 - eccSquared / 4 - 3 * eccSquared * eccSquared / 64 - 5 * eccSquared * eccSquared * eccSquared / 256));

    const J1 = (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32);
    const J2 = (21 * Math.pow(e1, 2) / 16 - 55 * Math.pow(e1, 4) / 32);
    const J3 = (151 * Math.pow(e1, 3) / 96);
    const J4 = (1097 * Math.pow(e1, 4) / 512);

    const fp = mu + J1 * Math.sin(2 * mu) + J2 * Math.sin(4 * mu) + J3 * Math.sin(6 * mu) + J4 * Math.sin(8 * mu);

    const sinfp = Math.sin(fp);
    const cosfp = Math.cos(fp);
    const tanfp = Math.tan(fp);

    const C1 = eccPrimeSquared * cosfp * cosfp;
    const T1 = tanfp * tanfp;
    const N1 = a / Math.sqrt(1 - eccSquared * sinfp * sinfp);
    const R1 = N1 * (1 - eccSquared) / (1 - eccSquared * sinfp * sinfp);
    const D = x / (N1 * k0);

    // Latitude
    let lat = fp - (N1 * tanfp / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * eccPrimeSquared) * Math.pow(D, 4) / 24 + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * eccPrimeSquared - 3 * C1 * C1) * Math.pow(D, 6) / 720);
    lat = lat * 180 / Math.PI;

    // Longitude
    let lng = (D - (1 + 2 * T1 + C1) * Math.pow(D, 3) / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * eccPrimeSquared + 24 * T1 * T1) * Math.pow(D, 5) / 120) / cosfp;
    lng = longOrigin + lng * 180 / Math.PI;

    return { lat, lng };
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
