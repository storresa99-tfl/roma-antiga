// Descàrrega massiva d'imatges per a ús sense connexió
import { getImatges } from "./data.js";

export const IMG_CACHE = "roma-img-v1"; // ha de coincidir amb sw.js
const KB400 = 55, KB1200 = 280; // mida mitjana aproximada (KB) per estimar

export const supported = () => "caches" in window && "serviceWorker" in navigator;

export async function plan() {
  const { urls = [] } = await getImatges();
  if (!supported()) return { total: urls.length, pending: urls, cached: 0, estMB: 0 };
  const c = await caches.open(IMG_CACHE);
  const pending = [];
  for (const u of urls) if (!(await c.match(u))) pending.push(u);
  const est = pending.reduce((s, u) => s + (u.endsWith("width=400") ? KB400 : KB1200), 0) / 1024;
  return { total: urls.length, pending, cached: urls.length - pending.length, estMB: est };
}

export async function cachedCount() {
  if (!supported()) return 0;
  try { return (await (await caches.open(IMG_CACHE)).keys()).length; } catch { return 0; }
}
export async function clearImages() { if (supported()) await caches.delete(IMG_CACHE); }

// Descarrega en paral·lel limitat. Les URLs Special:FilePath redirigeixen i no tenen CORS: mode no-cors (resposta opaca).
export async function downloadAll(pending, onProgress, ctl = { cancel: false }) {
  try { await navigator.storage?.persist?.(); } catch {}
  const cache = await caches.open(IMG_CACHE);
  let done = 0, failed = 0, i = 0;
  const total = pending.length;
  const worker = async () => {
    while (!ctl.cancel) {
      const idx = i++; if (idx >= total) return;
      const u = pending[idx];
      try { const r = await fetch(u, { mode: "no-cors" }); await cache.put(u, r); } catch { failed++; }
      done++; onProgress({ done, total, failed });
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  return { done, total, failed, cancelled: ctl.cancel };
}
