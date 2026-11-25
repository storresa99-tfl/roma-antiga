// Utilitats comunes: escapament, text enriquit, imatges Commons, anys, distàncies, localStorage segur.

export const TIPUS = {
  monument: "Monument", museu: "Museu", via: "Via", esglesia: "Església", excursio: "Excursió", zona: "Zona",
};
export const TIPUS_COLOR = {
  monument: "#8c2a22", museu: "#1f4d6e", via: "#5d6b2a", esglesia: "#5a2f5e", excursio: "#1d6b5c", zona: "#a8472a",
};
export const PERIODES = {
  monarquia: "Monarquia", republica: "República", imperi: "Imperi", "antiguitat-tardana": "Antiguitat tardana", posterior: "Posterior",
};

export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Ressalta [VALIDAR] i aplica **negreta** (sobre text ja escapat).
export function inline(s) {
  return esc(s)
    .replace(/\[VALIDAR\]/g, '<mark class="val" title="Dada pendent de confirmar">[VALIDAR]</mark>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}
export function paragraphs(s) {
  return String(s ?? "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${inline(p)}</p>`).join("");
}
export function hasValidar(s) { return typeof s === "string" && s.includes("[VALIDAR]"); }

export function safeUrl(u) {
  try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch { return ""; }
}
export function link(url, text) {
  const u = safeUrl(url);
  return u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(text || u)}</a>` : esc(text || url || "");
}

// Imatges: Wikimedia Commons (mateixa lògica que scripts/build.py)
export function commonsUrl(fitxer, width = 1200) {
  const nom = String(fitxer || "").trim().replace(/ /g, "_");
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(nom)}?width=${width}`;
}
export function commonsPage(fitxer) {
  return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(String(fitxer).trim().replace(/ /g, "_"))}`;
}
export function img(fitxer, alt, width = 1200, cls = "") {
  if (!fitxer) return "";
  return `<img src="${esc(commonsUrl(fitxer, width))}" alt="${esc(alt || "")}" loading="lazy" decoding="async" class="im${cls ? " " + cls : ""}">`;
}
// Imatge ampliable (lightbox): s'obre en tocar-la o amb Enter/Espai
export function lbAttrs(fitxer, titol, text, credit, lic) {
  return `data-lb data-file="${esc(fitxer)}" data-title="${esc(titol || "")}" data-text="${esc(text || "")}" data-credit="${esc([credit, lic].filter(Boolean).join(" · "))}"`;
}
export function zoomImg(fitxer, alt, titol, text, credit, lic, width = 1200) {
  if (!fitxer) return "";
  return `<img src="${esc(commonsUrl(fitxer, width))}" alt="${esc(alt || "")}" loading="lazy" decoding="async" class="im" role="button" tabindex="0" ${lbAttrs(fitxer, titol, text, credit, lic)}>`;
}
export function creditLine(c, lic) {
  const parts = [c, lic].filter(Boolean).map(esc);
  return parts.length ? `<div class="credit">${parts.join(" · ")} · Wikimedia Commons</div>` : "";
}

// Anys: nombres negatius = aC
export function fmtYear(n) {
  if (typeof n !== "number") return String(n ?? "");
  return n < 0 ? `${Math.abs(n)} aC` : `${n} dC`;
}
export function fmtRange(a, b) {
  if (a < 0 && b < 0) return `${Math.abs(a)} – ${Math.abs(b)} aC`;
  if (a > 0 && b > 0) return `${a} – ${b} dC`;
  return `${fmtYear(a)} – ${fmtYear(b)}`;
}

export function roman(n) {
  n = Math.floor(n); if (n < 1 || n > 3999) return String(n);
  const m = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let r = ""; for (const [v, s] of m) while (n >= v) { r += s; n -= v; } return r;
}
// Imatge de lloc per a miniatures
export function placeThumb(l) {
  const im = l?.imatges || {};
  return im.despres?.fitxer || im.galeria?.[0]?.fitxer || im.abans?.fitxer || l?.obres?.find((o) => o.imatge)?.imatge || "";
}
// Primera frase (per a títols curts)
export function firstSentence(s, max = 90) {
  const t = String(s ?? "").replace(/\*\*/g, "").trim(); const m = /^(.+?[.!?])(\s|$)/.exec(t); const x = m ? m[1] : t;
  return x.length > max ? x.slice(0, max - 1).replace(/\s+\S*$/, "") + "…" : x;
}

export function distKm(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export function fmtDist(km) {
  if (km < 1) return `${Math.round(km * 100) * 10} m`;
  return `${km.toFixed(km < 10 ? 1 : 0).replace(".", ",")} km`;
}

export function mapsPlace(c) { return `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}&travelmode=walking`; }
export function mapsRoute(points) {
  if (!points.length) return "";
  if (points.length === 1) return `https://www.google.com/maps/search/?api=1&query=${points[0].lat},${points[0].lng}`;
  const f = (p) => `${p.lat},${p.lng}`;
  const mid = points.slice(1, -1).slice(0, 9).map(f).join("%7C");
  return `https://www.google.com/maps/dir/?api=1&travelmode=walking&origin=${f(points[0])}&destination=${f(points[points.length - 1])}` + (mid ? `&waypoints=${mid}` : "");
}

export function norm(s) { return String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }

// localStorage amb try/catch (mode privat, quota, etc.)
const mem = {};
export const store = {
  get(k, def) { try { const v = localStorage.getItem(k); return v == null ? (k in mem ? mem[k] : def) : JSON.parse(v); } catch { return k in mem ? mem[k] : def; } },
  set(k, v) { mem[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};

let toastT;
export function toast(msg) {
  let t = $(".toast");
  if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3200);
}
