export const API_BASE = (typeof window !== "undefined" && window.__API_BASE__) 
  ? window.__API_BASE__ 
  : "https://daralibenzidweb.onrender.com";

// Smart memory cache for static reads
const cacheMap = new Map();
const CACHE_TTL_MS = 25000; // 25 seconds for fast snappy navigation

async function req(m, p, body, useCache = false) {
  const isGet = m.toUpperCase() === "GET";
  const cacheKey = p;

  if (isGet && useCache && cacheMap.has(cacheKey)) {
    const entry = cacheMap.get(cacheKey);
    if (Date.now() - entry.time < CACHE_TTL_MS) {
      return entry.data;
    }
  }

  const o = { method: m, headers: {} };
  if (body instanceof FormData) o.body = body;
  else if (body !== undefined) {
    o.headers["Content-Type"] = "application/json";
    o.body = JSON.stringify(body);
  }

  const r = await fetch(API_BASE + p, o);
  if (!r.ok) {
    const t = await r.text().catch(() => r.statusText);
    throw new Error(m + " " + p + " → " + r.status + ": " + t);
  }

  const ct = r.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await r.json() : await r.text();

  if (isGet && useCache) {
    cacheMap.set(cacheKey, { data, time: Date.now() });
  } else if (!isGet) {
    // Invalidate related cache entries on mutations
    cacheMap.clear();
  }

  return data;
}

export const api = {
  get: (p, useCache = false) => req("GET", p, undefined, useCache),
  post: (p, d) => req("POST", p, d),
  put: (p, d) => req("PUT", p, d),
  patch: (p, d) => req("PATCH", p, d),
  del: (p) => req("DELETE", p),
  clearCache: () => cacheMap.clear(),
  upload: (p, f, field = "file") => {
    const fd = new FormData();
    fd.append(field, f);
    return req("POST", p, fd);
  },
};