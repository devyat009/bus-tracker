// Lightweight HTTP service with URL-based caching and simple TTLs per dataset
// Used by OpenStreetMap WebView bridge to centralize requests.

export type HttpTextResponse = {
  ok: boolean;
  status: number;
  text: string;
};

type CacheEntry = {
  ok: boolean;
  status: number;
  text: string;
  ts: number; // epoch ms
};

const responseCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<HttpTextResponse>>();

function normalize(str: string) {
  try {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  } catch {
    return (str || '').toLowerCase();
  }
}

function ttlForUrl(rawUrl: string): number | undefined {
  // Default: no cache
  try {
    const u = new URL(rawUrl);
    const typeName = u.searchParams.get('typeName') || '';
    const n = normalize(typeName);
    // Heuristics based on WFS layer names
    if (n.includes('linhas') || n.includes('linha')) {
      // Lines change rarely: cache for 24h
      return 24 * 60 * 60 * 1000;
    }
    if (n.includes('paradas') || n.includes('ponto')) {
      // Stops: cache for 5 minutes
      if (n.includes('paradas')) return 5 * 60 * 1000;
    }
    // Última posição da frota (buses): nunca cachear
    if (n.includes('ultima') || n.includes('posicao') || n.includes('frota')) return 0;
  } catch {
    // ignore parse errors
  }
  // Fallback: 0 (no cache)
  return 0;
}

export async function fetchWithCache(url: string, options?: RequestInit): Promise<HttpTextResponse> {
  const key = url; // cache by full URL including bbox
  const ttl = ttlForUrl(url) ?? 0;

  // Serve from cache if fresh
  const cached = responseCache.get(key);
  if (cached && (ttl === Infinity || (Date.now() - cached.ts) <= ttl)) {
    return { ok: cached.ok, status: cached.status, text: cached.text };
    }

  // Coalesce concurrent requests
  const existing = inflight.get(key);
  if (existing) return existing;

  const p = (async () => {
    try {
      const resp = await fetch(url, options);
      const text = await resp.text();
      const entry: CacheEntry = { ok: resp.ok, status: resp.status, text, ts: Date.now() };
      if (ttl && ttl > 0 && resp.ok) {
        responseCache.set(key, entry);
      }
      return { ok: resp.ok, status: resp.status, text } as HttpTextResponse;
    } catch (err) {
      const text = String((err as any)?.message || err);
      const entry: CacheEntry = { ok: false, status: 0, text, ts: Date.now() };
      if (ttl && ttl > 0) {
        responseCache.set(key, entry);
      }
      return { ok: false, status: 0, text };
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  return p;
}

export function clearHttpCache(predicate?: (url: string) => boolean) {
  if (!predicate) {
    responseCache.clear();
    return;
  }
  for (const k of Array.from(responseCache.keys())) {
    if (predicate(k)) responseCache.delete(k);
  }
}
