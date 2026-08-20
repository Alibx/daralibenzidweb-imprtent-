export const API_BASE = (typeof window !== "undefined" && window.__API_BASE__) 
  ? window.__API_BASE__ 
  : "https://daralibenzidweb.onrender.com";

async function req(m, p, body) {
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
  return ct.includes("application/json") ? r.json() : r.text();
}

export const api = {
  get: (p) => req("GET", p),
  post: (p, d) => req("POST", p, d),
  put: (p, d) => req("PUT", p, d),
  patch: (p, d) => req("PATCH", p, d),
  del: (p) => req("DELETE", p),
  upload: (p, f, field = "file") => {
    const fd = new FormData();
    fd.append(field, f);
    return req("POST", p, fd);
  },
};