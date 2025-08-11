// Lightweight HTTP service with URL-based caching and simple TTLs per dataset
// Used by OpenStreetMap WebView bridge to centralize requests.

export type HttpTextResponse = {
  ok: boolean;
  status: number;
  text: string;
};



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





export async function fetchWithCache(url: string, options?: RequestInit): Promise<HttpTextResponse> {
  // Sempre faz fetch novo, nunca retorna do cache
  try {
    const resp = await fetch(url, options);
    const text = await resp.text();
    return { ok: resp.ok, status: resp.status, text };
  } catch (err) {
    const text = String((err as any)?.message || err);
    return { ok: false, status: 0, text };
  }
}


