// Estat del jugador (localStorage 'roma.progress'): XP, rang, ratxes, targetes vistes, encerts, jocs, check-ins i assoliments.
import { store, distKm } from "./util.js";
import { getLlocs, getRutes } from "./data.js";
import { getJocs } from "./data-jocs.js";
import { fxToast, confetti, feedback, medal, fmtNum, countUp } from "./fx.js";

const KEY = "roma.progress";
export const CHECKIN_M = 150;

// Rangs: per defecte els d'aquí; si jocs.json en porta («rangs»: [{nom, xp_min}]) manen les dades.
export let RANGS = [
  { xp: 0, nom: "Tiro" }, { xp: 100, nom: "Legionari" }, { xp: 300, nom: "Optio" }, { xp: 700, nom: "Centurió" },
  { xp: 1500, nom: "Tribú" }, { xp: 3000, nom: "Legat" }, { xp: 6000, nom: "Cònsol" }, { xp: 10000, nom: "Emperador" },
];
let readyP;
const rutaStops = {}; // dia -> [ids de lloc] (per a condicions amb «ruta_dia» sense llista «llocs»)
export function ready() {
  return (readyP ||= Promise.all([getJocs(), getRutes()]).then(([j, r]) => {
    if (j.rangs?.length) RANGS = j.rangs.map((x) => ({ xp: x.xp_min ?? x.xp ?? 0, nom: x.nom, desc: x.descripcio })).sort((a, b) => a.xp - b.xp);
    for (const d of r?.dies || []) rutaStops[d.dia] = (d.parades || []).map((p) => p.lloc).filter(Boolean);
  }).catch(() => {}));
}
export function rankFor(xp) {
  let i = 0;
  while (i + 1 < RANGS.length && xp >= RANGS[i + 1].xp) i++;
  const cur = RANGS[i], next = RANGS[i + 1] || null;
  return { idx: i, nom: cur.nom, min: cur.xp, next, pct: next ? (xp - cur.xp) / (next.xp - cur.xp) : 1, falta: next ? next.xp - xp : 0 };
}

const blank = () => ({
  xp: 0, seen: {}, seenCount: 0, quizCorrect: 0, quizAnswered: 0, onEsCorrect: 0, ordenaPerfect: 0, miteCorrect: 0,
  games: { quiz: { played: 0, best: 0, bestPts: 0 }, mite: { played: 0, best: 0, bestStreak: 0 }, "on-es": { played: 0, best: 0, bestPts: 0 }, ordena: { played: 0, best: 0, perfect: 0 } },
  checkins: {}, achievements: {}, streak: { days: 0, last: "", best: 0 }, scrollMite: {}, since: Date.now(),
});
let state = null;
export function get() {
  if (!state) {
    const s = store.get(KEY, null);
    const b = blank();
    state = s && typeof s === "object" ? { ...b, ...s, games: { ...b.games, ...(s.games || {}) }, streak: { ...b.streak, ...(s.streak || {}) } } : b;
  }
  return state;
}
const save = () => store.set(KEY, state);
const listeners = new Set();
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((f) => { try { f(get()); } catch {} });

const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function touchStreak() {
  const s = get().streak, today = dayKey();
  if (s.last === today) return;
  const y = new Date(); y.setDate(y.getDate() - 1);
  s.days = s.last === dayKey(y) ? s.days + 1 : 1;
  s.last = today; s.best = Math.max(s.best, s.days);
}

// Suma XP; si canvia el rang mostra un toast
export function addXP(n, { silent = true } = {}) {
  const s = get();
  const before = rankFor(s.xp).idx;
  s.xp = Math.max(0, s.xp + n);
  touchStreak();
  const after = rankFor(s.xp);
  save(); emit();
  if (after.idx > before) {
    fxToast(`<span class="jx-toast-ico">${medal("laurel", after.nom)}</span><span><b>Nou rang: ${after.nom}</b><small>Ave! Segueixes pujant.</small></span>`, { kind: "gold", ms: 4200 });
    feedback("win"); confetti({ y: 0.25, count: 90 });
  } else if (!silent && n > 0) fxToast(`<span><b>+${n} XP</b></span>`, { kind: "xp", ms: 1400 });
  scheduleCheck();
  return after;
}
export const xp = () => get().xp;

// ---- targetes vistes ----
export function markSeen(id) {
  const s = get();
  if (s.seen[id]) return false;
  s.seen[id] = Date.now(); s.seenCount = Object.keys(s.seen).length;
  save(); addXP(1); return true;
}
export const hasSeen = (id) => !!get().seen[id];
export const seenCount = () => get().seenCount;

// ---- resultats de jocs ----
export function recordQuizAnswer(qid, ok) {
  const s = get(); s.quizAnswered++; if (ok) s.quizCorrect++; save(); scheduleCheck();
}
export function recordGame(joc, { score = 0, pts = 0, perfect = 0, streak = 0 } = {}) {
  const s = get(), g = s.games[joc] ||= { played: 0, best: 0 };
  g.played++; g.best = Math.max(g.best || 0, score);
  if (pts) g.bestPts = Math.max(g.bestPts || 0, pts);
  if (joc === "mite") g.bestStreak = Math.max(g.bestStreak || 0, streak);
  if (joc === "ordena") { g.perfect = (g.perfect || 0) + perfect; s.ordenaPerfect += perfect; }
  touchStreak(); save(); emit(); scheduleCheck();
}
export function recordOnEs() { const s = get(); s.onEsCorrect++; save(); scheduleCheck(); }
export function recordMite(ok) { if (ok) { get().miteCorrect++; save(); } }
export function setScrollMite(id, choice) { const s = get(); s.scrollMite[id] = choice; save(); }
export const getScrollMite = (id) => get().scrollMite[id];

// ---- preferits de curiositats (scroll) ----
const CFAV = "roma.curi.fav";
export const curiFavs = () => store.get(CFAV, []);
export const isCuriFav = (id) => curiFavs().includes(id);
export function toggleCuriFav(id) {
  const a = curiFavs().slice(), i = a.indexOf(id);
  if (i >= 0) a.splice(i, 1); else a.push(id);
  store.set(CFAV, a); scheduleCheck(); emit();
  return i < 0;
}
const favCount = () => curiFavs().length + (store.get("roma.fav", []) || []).length;

// ---- check-ins ----
export const isVisited = (id) => !!get().checkins[id];
export const visitedCount = () => Object.keys(get().checkins).length;
export async function stats() {
  const llocs = await getLlocs();
  return { visited: visitedCount(), total: llocs.length };
}
function getPos() {
  return new Promise((res, rej) => {
    if (!("geolocation" in navigator)) return rej(new Error("El dispositiu no ofereix geolocalització."));
    navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
      (e) => rej(new Error(e.code === 1 ? "Permís d'ubicació denegat." : "No s'ha pogut obtenir la ubicació.")), { enableHighAccuracy: true, timeout: 15000, maximumAge: 15000 });
  });
}
// Retorna { ok, already, distM, nom, xp, error }
export async function checkIn(llocId, { gps = true } = {}) {
  const llocs = await getLlocs();
  const l = llocs.find((x) => x.id === llocId);
  if (!l) return { ok: false, error: "Lloc desconegut." };
  if (isVisited(llocId)) return { ok: true, already: true, nom: l.nom, distM: 0, xp: 0 };
  let distM = null;
  if (gps) {
    if (!l.coords) return { ok: false, nom: l.nom, error: "Aquest lloc no té coordenades." };
    let p;
    try { p = await getPos(); } catch (e) { return { ok: false, nom: l.nom, error: e.message }; }
    distM = Math.round(distKm(p, l.coords) * 1000);
    if (distM > CHECKIN_M) return { ok: false, nom: l.nom, distM, acc: p.acc };
  }
  const s = get(); s.checkins[llocId] = Date.now(); save();
  addXP(50); emit();
  return { ok: true, nom: l.nom, distM, xp: 50 };
}
// El lloc més proper a una posició (per al botó «Hi sóc» general)
export async function nearest(pos) {
  const llocs = (await getLlocs()).filter((l) => l.coords);
  let best = null;
  for (const l of llocs) { const d = distKm(pos, l.coords) * 1000; if (!best || d < best.distM) best = { lloc: l, distM: Math.round(d) }; }
  return best;
}
export function locate() { return getPos(); }

// ---- assoliments ----
// cond (opcional): condició completa de l'assoliment. «llocs» = llista d'ids que compten (valor = quants cal visitar);
// «ruta_dia» = parades d'aquell dia de ruta (si no hi ha «llocs»).
export function metric(tipus, cond = null) {
  const s = get();
  if (tipus === "llocs_visitats" && cond) {
    const list = cond.llocs?.length ? cond.llocs : cond.ruta_dia ? rutaStops[cond.ruta_dia] : null;
    if (list?.length) return [...new Set(list)].filter((id) => s.checkins[id]).length;
  }
  return { quiz_encerts: s.quizCorrect, targetes_vistes: s.seenCount, llocs_visitats: Object.keys(s.checkins).length,
    jocs_on_es: s.onEsCorrect, ordena_perfecte: s.ordenaPerfect, preferits: favCount() }[tipus] ?? 0;
}
let checking = false, queued = false, timer;
function scheduleCheck() { clearTimeout(timer); timer = setTimeout(() => checkAchievements(), 350); }
export async function checkAchievements() {
  if (checking) { queued = true; return []; }
  checking = true;
  const fresh = [];
  try {
    await ready();
    const { assoliments } = await getJocs();
    const s = get();
    for (const a of assoliments) {
      if (s.achievements[a.id] || !a.condicio) continue;
      if (metric(a.condicio.tipus, a.condicio) >= a.condicio.valor) { s.achievements[a.id] = Date.now(); fresh.push(a); }
    }
    if (fresh.length) {
      s.xp += 25 * fresh.length; save(); emit();
      fresh.forEach((a, i) => setTimeout(() => {
        fxToast(`<span class="jx-toast-ico">${medal(a.icona, a.nom, "on")}</span><span><b>${a.nom}</b><small>${a.descripcio} · +25 XP</small></span>`, { kind: "gold", ms: 4200 });
        feedback("win");
      }, i * 900));
    }
  } finally { checking = false; if (queued) { queued = false; scheduleCheck(); } }
  return fresh;
}

export { fmtNum, countUp };
