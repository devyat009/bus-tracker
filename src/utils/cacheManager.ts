import { CACHE_KEYS, clearCache, getCacheData, isCacheValid } from './asyncStorage';

export class CacheManager {
  /**
   * Check if all critical caches are valid
   */
  static async areMainCachesValid(): Promise<{
    lines: boolean;
    frota: boolean;
    overall: boolean;
  }> {
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    
    const linesValid = await isCacheValid(CACHE_KEYS.LINES, THREE_DAYS_MS);
    const frotaValid = await isCacheValid(CACHE_KEYS.FROTA, THREE_DAYS_MS);
    
    return {
      lines: linesValid,
      frota: frotaValid,
      overall: linesValid && frotaValid,
    };
  }

  /**
   * Clear all cached data
   */
  static async clearAllCache(): Promise<void> {
    await Promise.all([
      clearCache(CACHE_KEYS.LINES),
      clearCache(CACHE_KEYS.FROTA),
      clearCache(CACHE_KEYS.STOPS),
      clearCache(CACHE_KEYS.BUSES),
    ]);
  }

  /**
   * Clear only outdated caches
   */
  static async clearOutdatedCache(): Promise<void> {
    const cacheStatus = await this.areMainCachesValid();
    
    const clearPromises = [];
    
    if (!cacheStatus.lines) {
      clearPromises.push(clearCache(CACHE_KEYS.LINES));
    }
    
    if (!cacheStatus.frota) {
      clearPromises.push(clearCache(CACHE_KEYS.FROTA));
    }
    
    await Promise.all(clearPromises);
  }

  /**
   * Get cache statistics
   */
  static async getCacheStats(): Promise<{
    lines: { exists: boolean; valid: boolean; size?: number };
    frota: { exists: boolean; valid: boolean; size?: number };
    stops: { exists: boolean; valid: boolean; size?: number };
  }> {
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    const THIRTY_MINUTES_MS = 30 * 60 * 1000;

    const [linesData, frotaData, stopsData] = await Promise.all([
      getCacheData(CACHE_KEYS.LINES),
      getCacheData(CACHE_KEYS.FROTA),
      getCacheData(CACHE_KEYS.STOPS),
    ]);

    const [linesValid, frotaValid, stopsValid] = await Promise.all([
      isCacheValid(CACHE_KEYS.LINES, THREE_DAYS_MS),
      isCacheValid(CACHE_KEYS.FROTA, THREE_DAYS_MS),
      isCacheValid(CACHE_KEYS.STOPS, THIRTY_MINUTES_MS),
    ]);

    return {
      lines: {
        exists: !!linesData,
        valid: linesValid,
        size: linesData ? JSON.stringify(linesData).length : undefined,
      },
      frota: {
        exists: !!frotaData,
        valid: frotaValid,
        size: frotaData ? JSON.stringify(frotaData).length : undefined,
      },
      stops: {
        exists: !!stopsData,
        valid: stopsValid,
        size: stopsData ? JSON.stringify(stopsData).length : undefined,
      },
    };
  }

  /**
   * Force refresh of main caches
   */
  static async forceRefreshMainCaches(): Promise<void> {
    await Promise.all([
      clearCache(CACHE_KEYS.LINES),
      clearCache(CACHE_KEYS.FROTA),
    ]);
  }
}
