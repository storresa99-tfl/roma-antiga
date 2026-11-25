// Descàrrega d'imatges per a ús sense connexió: dos modes («lleuger» i «complet»), cancel·lable, que reprèn i que no bloqueja la interfície.
// Les imatges es desen a la Cache API sota la URL de Commons (Special:FilePath) que fa servir l'app.
// Si tenim la URL directa de la miniatura (upload.wikimedia.org, amb CORS) es baixa amb resposta normal (pes real, sense l'ompliment
// que Chrome/Safari apliquen a les respostes opaques); si no, es baixa en mode no-cors com abans.
import { getImatges } from "./data.js";
import { commonsUrl } from "./util.js";

export const IMG_CACHE = "roma-img-v1"; // ha de coincidir amb sw.js
export const supported = () => "caches" in window && "serviceWorker" in navigator;
const DEF_KB = { 400: 60, 1200: 340 }; // mitjana mesurada de les miniatures de 500 i 1280 px (es refina amb imatges.json → kb)

export const MODES = {
  lleuger: { nom: "Lleuger", desc: "Dades, miniatures de totes les imatges i imatges grans dels llocs de les rutes dels 6 dies." },
  complet: { nom: "Complet", desc: "Tot en alta qualitat: totes les imatges grans de tots els llocs, obres i curiositats." },
};

// Llista de feines d'un mode: { key (URL de l'app), src (d'on es baixa), cors, kb }
function jobsFor(mode, im) {
  const kb = { ...DEF_KB, ...(im.kb || {}) };
  const base = im.base || "";
  const out = [];
  for (const [f, p400, p1200, ruta] of im.items || []) {
    for (const w of [400, 1200]) {
      if (w === 1200 && mode === "lleuger" && !ruta) continue;
      const p = w === 400 ? p400 : p1200, key = new URL(commonsUrl(f, w)).href;
      out.push({ key, src: p ? (/^https?:/.test(p) ? p : base + p) : key, cors: !!p, kb: kb[w] });
    }
  }
  return out;
}

async function cachedKeys() {
  const c = await caches.open(IMG_CACHE);
  return new Set((await c.keys()).map((r) => r.url));
}

// Estat dels dos modes: total, pendents, MB estimats dels pendents
export async function plan() {
  const im = await getImatges();
  const have = supported() ? await cachedKeys() : new Set();
  const res = {};
  for (const m of Object.keys(MODES)) {
    const all = jobsFor(m, im), pending = all.filter((j) => !have.has(j.key));
    res[m] = { total: all.length, pending, cached: all.length - pending.length, estMB: pending.reduce((s, j) => s + j.kb, 0) / 1024, totalMB: all.reduce((s, j) => s + j.kb, 0) / 1024 };
  }
  res.count = have.size;
  return res;
}
export async function cachedCount() { if (!supported()) return 0; try { return (await cachedKeys()).size; } catch { return 0; } }
export async function clearImages() { if (supported()) await caches.delete(IMG_CACHE); }
export async function storageInfo() {
  try { const e = await navigator.storage?.estimate?.(); return e ? { usage: e.usage || 0, quota: e.quota || 0 } : null; } catch { return null; }
}

// ---- feina en curs (viu fora de la pantalla d'Ajustos: si en surts, continua) ----
export const job = { state: "idle", mode: "", total: 0, done: 0, failed: 0, error: "", ctl: null };
const subs = new Set();
export const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };
let lastEmit = 0;
const emit = (force) => { const t = performance.now(); if (!force && t - lastEmit < 150) return; lastEmit = t; subs.forEach((f) => { try { f(job); } catch {} }); };

export function cancel() { if (job.ctl) job.ctl.cancel = true; }

export async function start(mode, pending) {
  if (job.state === "running") return job;
  Object.assign(job, { state: "running", mode, total: pending.length, done: 0, failed: 0, error: "", ctl: { cancel: false } });
  const ctl = job.ctl; emit(true);
  try { await navigator.storage?.persist?.(); } catch {}
  const cache = await caches.open(IMG_CACHE);
  let i = 0, offlineStop = false, penalty = 0; // penalty: espera (ms) quan Wikimedia respon «massa peticions» (429)
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function grab(j) {
    if (j.cors) {
      const r = await fetch(j.src, { mode: "cors" });
      if (r.ok) { await cache.put(new Request(j.key), r); penalty = Math.max(0, penalty * 0.6 - 100); return true; }
      if (r.status === 429 || r.status >= 500) { penalty = Math.min(12000, (penalty || 1200) * 2); throw new Error("busy"); }
      // 400/404: aquesta imatge no té miniatura estàndard → alternativa opaca més avall
    }
    const r = await fetch(j.key, { mode: "no-cors" });
    await cache.put(new Request(j.key), r); return true;
  }
  const worker = async () => {
    while (!ctl.cancel && !offlineStop) {
      const idx = i++; if (idx >= pending.length) return;
      const j = pending[idx];
      if (penalty) await wait(penalty);
      let ok = false;
      for (let attempt = 0; attempt < 4 && !ok && !ctl.cancel && !offlineStop; attempt++) {
        try { ok = await grab(j); }
        catch (e) {
          if (e?.name === "QuotaExceededError") { job.error = "No hi ha prou espai al dispositiu."; offlineStop = true; break; }
          if (!navigator.onLine) { job.error = "S'ha perdut la connexió."; offlineStop = true; break; }
          await wait(penalty || 800 * (attempt + 1));
        }
      }
      if (ok) job.done++; else if (!ctl.cancel && !offlineStop) job.failed++;
      emit();
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  job.state = ctl.cancel ? "cancelled" : offlineStop ? "paused" : "done";
  emit(true);
  return job;
}
