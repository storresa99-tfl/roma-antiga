// Càrrega de dades (JSON estàtics). Si falta un fitxer retorna el valor per defecte.
const cache = {};
async function load(name, def) {
  if (name in cache) return cache[name];
  try {
    const r = await fetch(`data/${name}.json`);
    if (!r.ok) throw new Error(r.status);
    cache[name] = await r.json();
  } catch {
    cache[name] = def;
  }
  return cache[name];
}
export const getLlocs = () => load("llocs", []);
export const getCronologia = () => load("cronologia", null);
export const getRutes = () => load("rutes", null);
export const getPractic = () => load("practic", null);
export const getImatges = () => load("imatges", { urls: [] });
export async function getLloc(id) { return (await getLlocs()).find((l) => l.id === id); }
export async function llocsMap() { return new Map((await getLlocs()).map((l) => [l.id, l])); }

// Posició de l'usuari (compartida entre pantalles)
export const geo = { pos: null, error: "", watching: null };
export function locate(onUpdate, { watch = false } = {}) {
  if (!("geolocation" in navigator)) { geo.error = "El dispositiu no ofereix geolocalització."; onUpdate?.(); return; }
  const ok = (p) => { geo.pos = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }; geo.error = ""; onUpdate?.(); };
  const ko = (e) => { geo.error = e.code === 1 ? "Permís de ubicació denegat." : "No s'ha pogut obtenir la ubicació."; onUpdate?.(); };
  const opts = { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 };
  if (watch) {
    if (geo.watching != null) navigator.geolocation.clearWatch(geo.watching);
    geo.watching = navigator.geolocation.watchPosition(ok, ko, opts);
  } else navigator.geolocation.getCurrentPosition(ok, ko, opts);
}
export function stopWatch() { if (geo.watching != null) { navigator.geolocation.clearWatch(geo.watching); geo.watching = null; } }
