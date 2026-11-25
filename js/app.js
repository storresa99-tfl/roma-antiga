// Arrencada, router per hash (amb View Transitions), menú «Més», galeria, indicador sense connexió i service worker
import { $, $$, esc } from "./util.js";
import { ic } from "./icons.js";
import { transition, openSheet, vibe, reduced } from "./ui.js";
import { initLightbox } from "./lightbox.js";
import * as lists from "./views-lists.js";
import * as place from "./views-place.js";
import { mapa } from "./views-map.js";
import * as time from "./views-time.js";
import { ajustos } from "./views-settings.js";

const main = $("#main");
let current = null;
let navCount = 0;

// Pantalles creades per un altre mòdul: es carreguen quan existeixen; si no, «Aviat».
async function lazy(file, fn, ctx, nom, tab) {
  let mod;
  try { mod = await import(file); } catch (e) { console.warn("Mòdul no disponible:", file, e?.message); }
  if (!mod || typeof mod[fn] !== "function") return soon(nom, tab);
  return mod[fn](ctx);
}
function soon(nom, tab) {
  return {
    title: nom, tab, cls: "",
    html: `<div class="view-in soon"><div class="soon-ic">${ic(tab === "jocs" ? "games" : tab === "scroll" ? "scroll" : "passport", "ic-xl")}</div><h1>${esc(nom)}</h1><p class="lead">Aviat.</p><a class="btn" href="#/">Torna a l'inici</a></div>`,
  };
}

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
  [/^\/scroll$/, (c) => lazy("./views-scroll.js", "scroll", c, "Scroll", "scroll")],
  [/^\/jocs(?:\/([^/?]+))?$/, (c, m) => lazy("./views-jocs.js", "jocs", { ...c, joc: m[1] || c.params.joc || "" }, "Jocs", "jocs")],
  [/^\/passaport$/, (c) => lazy("./views-passaport.js", "passaport", c, "Passaport", "passaport")],
];

function parseHash() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [path, qs] = raw.split("?");
  return { path, params: Object.fromEntries(new URLSearchParams(qs || "")) };
}

let token = 0;
async function render() {
  const my = ++token;
  const { path, params } = parseHash();
  try { current?.unmount?.(); } catch {}
  current = null;
  let view;
  for (const [re, fn] of routes) {
    const m = re.exec(path);
    if (m) { try { view = await fn({ params }, m); } catch (e) { console.error(e); view = { html: `<div class="view-in"><h1>Error</h1><div class="notice">No s'ha pogut carregar aquesta pantalla.</div></div>`, title: "Error" }; } break; }
  }
  if (my !== token) return; // una navegació més nova ha guanyat
  view ||= { html: `<div class="view-in"><h1>Pàgina no trobada</h1><a class="btn" href="#/">Torna a l'inici</a></div>`, title: "No trobat" };
  const swap = () => {
    main.className = view.cls || "";
    main.innerHTML = view.html;
    document.title = view.title && view.title !== "Roma Antiga" ? `${view.title} · Roma Antiga` : "Roma Antiga";
    $$("#tabbar a").forEach((a) => (a.dataset.tab === view.tab ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
    $("#back-btn").hidden = path === "/" || path === "";
    document.body.classList.toggle("on-hero", /\bhero\b/.test(view.cls || ""));
    document.body.dataset.view = view.tab || "";
    current = view;
    window.scrollTo(0, 0); onScroll();
  };
  await transition(swap);
  try { await view.mount?.(main); } catch (e) { console.error(e); }
  main.focus({ preventScroll: true });
}

// Barra superior: translúcida només en desplaçar-se (sobre el hero és transparent)
const onScroll = () => document.body.classList.toggle("scrolled", window.scrollY > 8);
window.addEventListener("scroll", onScroll, { passive: true });

let goingBack = false;
window.addEventListener("hashchange", () => { if (goingBack) goingBack = false; else navCount++; render(); });
$("#back-btn").addEventListener("click", () => { if (navCount > 0) { navCount--; goingBack = true; history.back(); } else location.hash = "#/"; });

// Targeta -> fitxa: la imatge «viatja» (View Transition amb nom compartit)
document.addEventListener("click", (e) => {
  const a = e.target.closest("a[data-vt]"); if (!a || reduced()) return;
  document.querySelectorAll('[style*="view-transition-name"]').forEach((x) => (x.style.viewTransitionName = ""));
  const im = $(".vt-img", a); if (im) im.style.viewTransitionName = "hero";
}, true);

// Feedback en prémer (vibració lleu a controls importants)
document.addEventListener("click", (e) => { if (e.target.closest(".tabbar a, .btn, .chip-btn, .fav, .check")) vibe(6); }, { passive: true });

// Menú «Més»
const MENU = [
  ["rutes", "Rutes", "routes"], ["cronologia", "Cronologia", "timeline"], ["museus", "Museus", "museum"],
  ["practic", "Pràctic", "practical"], ["passaport", "Passaport", "passport"], ["preferits", "Preferits", "favorites"],
  ["a-prop", "A prop meu", "locate"], ["ajustos", "Ajustos", "settings"],
];
$("#menu-btn").addEventListener("click", () => {
  openSheet({ title: "Més", cls: "menu", html: `<div class="menu-grid">${MENU.map(([h, t, i]) => `<a href="#/${h}" class="menu-it">${ic(i, "ic-lg")}<span>${t}</span></a>`).join("")}</div>` });
});

initLightbox(main);

// Imatges: esquelet fins que carreguen; error -> placeholder
document.addEventListener("load", (e) => { if (e.target?.tagName === "IMG") e.target.classList.add("ld"); }, true);
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
