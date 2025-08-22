import AsyncStorage from '@react-native-async-storage/async-storage';

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  forceRefresh?: boolean;
}

export async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const { ttl = THREE_DAYS_MS, forceRefresh = false } = options;
  
  if (forceRefresh) {
    const data = await fetcher();
    await setCacheData(key, data);
    return data;
  }

  const cache = await AsyncStorage.getItem(key);
  const timestamp = await AsyncStorage.getItem(`${key}_timestamp`);
  const now = Date.now();

  if (cache && timestamp && now - Number(timestamp) < ttl) {
    try {
      return JSON.parse(cache) as T;
    } catch (error) {
      console.warn(`Failed to parse cached data for key ${key}:`, error);
      // If parsing fails, fetch fresh data
    }
  }

  const data = await fetcher();
  await setCacheData(key, data);
  return data;
}

export async function setCacheData<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
    await AsyncStorage.setItem(`${key}_timestamp`, String(Date.now()));
  } catch (error) {
    console.error(`Failed to cache data for key ${key}:`, error);
  }
}

export async function getCacheData<T>(key: string): Promise<T | null> {
  try {
    const cache = await AsyncStorage.getItem(key);
    return cache ? JSON.parse(cache) : null;
  } catch (error) {
    console.error(`Failed to get cached data for key ${key}:`, error);
    return null;
  }
}

export async function clearCache(key?: string): Promise<void> {
  try {
    if (key) {
      await AsyncStorage.removeItem(key);
      await AsyncStorage.removeItem(`${key}_timestamp`);
    } else {
      await AsyncStorage.clear();
    }
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
}

export async function isCacheValid(key: string, ttl: number = THREE_DAYS_MS): Promise<boolean> {
  try {
    const timestamp = await AsyncStorage.getItem(`${key}_timestamp`);
    if (!timestamp) return false;
    
    const now = Date.now();
    return now - Number(timestamp) < ttl;
  } catch (error) {
    console.error(`Failed to check cache validity for key ${key}:`, error);
    return false;
  }
}

// Cache keys constants
export const CACHE_KEYS = {
  LINES: 'bus_lines',
  FROTA: 'frota_operadora',
  STOPS: 'bus_stops',
  BUSES: 'bus_positions',
} as const;