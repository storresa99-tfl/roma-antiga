// Arrencada, router per hash, lightbox, indicador sense connexió i service worker
import { $, $$, esc, commonsUrl, inline } from "./util.js";
import * as lists from "./views-lists.js";
import * as place from "./views-place.js";
import { mapa } from "./views-map.js";
import * as time from "./views-time.js";
import { ajustos } from "./views-settings.js";

const main = $("#main");
const topbar = $("#topbar");
let current = null;
let navCount = 0;

const routes = [
  [/^\/?$/, () => lists.home()],
  [/^\/llocs$/, (c) => lists.llocs(c)],
  [/^\/a-prop$/, (c) => lists.llocs(c, { nearby: true })],
  [/^\/lloc\/(.+)$/, (c, m) => place.lloc({ ...c, id: decodeURIComponent(m[1]) })],
  [/^\/museus$/, () => lists.museus()],
  [/^\/museu\/(.+)$/, (c, m) => place.museu({ ...c, id: decodeURIComponent(m[1]) })],
  [/^\/mapa$/, (c) => mapa(c)],
  [/^\/cronologia$/, () => time.cronologia()],
  [/^\/rutes(?:\/(\d+))?$/, (c, m) => time.rutes({ ...c, id: m[1] })],
  [/^\/practic$/, () => time.practic()],
  [/^\/preferits$/, () => lists.preferits()],
  [/^\/ajustos$/, () => ajustos()],
];

function parseHash() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [path, qs] = raw.split("?");
  return { path, params: Object.fromEntries(new URLSearchParams(qs || "")) };
}

async function render() {
  const { path, params } = parseHash();
  try { current?.unmount?.(); } catch {}
  current = null;
  let view;
  for (const [re, fn] of routes) {
    const m = re.exec(path);
    if (m) { try { view = await fn({ params }, m); } catch (e) { console.error(e); view = { html: `<div class="view-in"><h1>Error</h1><div class="notice">No s'ha pogut carregar aquesta pantalla.</div></div>`, title: "Error" }; } break; }
  }
  view ||= { html: `<div class="view-in"><h1>Pàgina no trobada</h1><a class="btn" href="#/">Torna a l'inici</a></div>`, title: "No trobat" };
  main.className = view.cls || "";
  main.innerHTML = view.html;
  document.title = view.title && view.title !== "Roma Antiga" ? `${view.title} · Roma Antiga` : "Roma Antiga";
  $$("#tabbar a").forEach((a) => (a.dataset.tab === view.tab ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  $("#back-btn").hidden = path === "/" || path === "";
  current = view;
  window.scrollTo(0, 0);
  try { await view.mount?.(main); } catch (e) { console.error(e); }
  main.focus({ preventScroll: true });
}

let goingBack = false;
window.addEventListener("hashchange", () => { if (goingBack) goingBack = false; else navCount++; render(); });
$("#back-btn").addEventListener("click", () => { if (navCount > 0) { navCount--; goingBack = true; history.back(); } else location.hash = "#/"; });

// Lightbox (imatges ampliades amb crèdit)
const lb = $("#lightbox");
let lbItems = [], lbIdx = 0, lbOpener = null;
function lbDraw() {
  const it = lbItems[lbIdx];
  lb.innerHTML = `<div class="lb-bar"><button type="button" data-lb-close aria-label="Tanca">×</button></div>
    <div class="lb-img"><img src="${esc(commonsUrl(it.file, 1200))}" alt="${esc(it.title)}"></div>
    <div class="lb-cap">${lbItems.length > 1 ? `<div style="display:flex;gap:8px;margin-bottom:8px"><button class="btn small ghost" style="color:#fff;border-color:#fff" type="button" data-lb-prev>‹ Anterior</button><button class="btn small ghost" style="color:#fff;border-color:#fff" type="button" data-lb-next>Següent ›</button><span style="align-self:center">${lbIdx + 1} / ${lbItems.length}</span></div>` : ""}
      <b>${esc(it.title)}</b>${it.text.split("\n").filter(Boolean).map((t) => `<div>${esc(t)}</div>`).join("")}<div style="opacity:.75;margin-top:4px">${esc(it.credit)}${it.credit ? " · " : ""}Wikimedia Commons</div></div>`;
  $("[data-lb-close]", lb).focus();
}
function lbOpen(el) {
  const group = el.closest("[data-lbgroup]") || main;
  const els = $$("[data-lb]", group).filter((e) => e.dataset.file);
  lbItems = els.map((e) => ({ file: e.dataset.file, title: e.dataset.title, text: e.dataset.text, credit: e.dataset.credit }));
  lbIdx = Math.max(0, els.indexOf(el.closest("[data-lb]")));
  lbOpener = document.activeElement; lb.hidden = false; document.body.style.overflow = "hidden"; lbDraw();
}
function lbClose() { lb.hidden = true; lb.innerHTML = ""; document.body.style.overflow = ""; lbOpener?.focus?.(); }
const lbStep = (d) => { lbIdx = (lbIdx + d + lbItems.length) % lbItems.length; lbDraw(); };
document.addEventListener("click", (e) => {
  if (!lb.hidden) {
    if (e.target.closest("[data-lb-close]") || e.target === lb || e.target.classList.contains("lb-img")) lbClose();
    else if (e.target.closest("[data-lb-prev]")) lbStep(-1);
    else if (e.target.closest("[data-lb-next]")) lbStep(1);
    return;
  }
  const t = e.target.closest("[data-lb]");
  if (t && t.dataset.file) lbOpen(t);
});
document.addEventListener("keydown", (e) => {
  if (!lb.hidden) {
    if (e.key === "Escape") lbClose(); else if (e.key === "ArrowRight" && lbItems.length > 1) lbStep(1); else if (e.key === "ArrowLeft" && lbItems.length > 1) lbStep(-1);
    else if (e.key === "Tab") { const f = $$("button", lb); if (f.length) { const i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); } }
    return;
  }
  const t = e.target;
  if ((e.key === "Enter" || e.key === " ") && t.matches?.("img[data-lb]")) { e.preventDefault(); lbOpen(t); }
});

// Imatges que fallen (sense connexió i sense cache)
document.addEventListener("error", (e) => { if (e.target?.tagName === "IMG") e.target.classList.add("broken"); }, true);

// Indicador sense connexió
const badge = $("#offline-badge");
const upd = () => { badge.hidden = navigator.onLine; };
window.addEventListener("online", upd); window.addEventListener("offline", upd); upd();

// Service worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch((e) => console.warn("SW:", e)));
}

render();
