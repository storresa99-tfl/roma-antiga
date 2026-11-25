// Peces d'interfície compartides: haptics, reduced motion, sheets, parallax, transicions
import { $, store } from "./util.js";

export const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const hapticsOn = () => store.get("roma.haptics", true) !== false;
// Vibració curta (Android; iOS Safari no la ofereix). Només en moments que ho mereixen.
export function vibe(p = 10) { try { if (hapticsOn() && navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(p); } catch {} }

// Reinicia una animació CSS d'una classe (feedback: pop, stamp…)
export function pop(el, cls = "pop") { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

// Aparició esglaonada: assigna --i als primers n fills
export function stagger(parent, sel = ":scope > *", n = 12) {
  if (!parent || reduced()) return;
  [...parent.querySelectorAll(sel)].slice(0, n).forEach((el, i) => { el.style.setProperty("--i", i); el.classList.add("rise"); });
}

// Transició de vista (View Transitions API amb alternativa)
export function transition(update) {
  if (document.startViewTransition && !reduced()) {
    try { const t = document.startViewTransition(update); t.ready.catch(() => {}); t.finished.catch(() => {}); return t.updateCallbackDone.catch(() => {}); } catch {}
  }
  return Promise.resolve(update());
}

// Parallax suau de la imatge de capçalera
export function parallax(hero) {
  const im = $("img", hero); if (!im || reduced()) return () => {};
  let ticking = false;
  const on = () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      const y = Math.min(window.scrollY, hero.offsetHeight);
      im.style.transform = `translate3d(0, ${y * 0.32}px, 0) scale(${1 + y * 0.0004})`;
      ticking = false;
    });
  };
  window.addEventListener("scroll", on, { passive: true });
  return () => window.removeEventListener("scroll", on);
}

// Arrossegar cap avall per tancar un panell (amb velocitat). Retorna cleanup.
export function dragDown(panel, handle, close, only = "") {
  let y0 = 0, dy = 0, t0 = 0, drag = false, id = null;
  const down = (e) => { if (only && !e.target.closest(only)) return; if (e.pointerType === "mouse" && e.button) return; drag = true; id = e.pointerId; y0 = e.clientY; t0 = performance.now(); dy = 0; panel.style.transition = "none"; handle.setPointerCapture?.(id); };
  const move = (e) => { if (!drag) return; dy = Math.max(0, e.clientY - y0); panel.style.transform = `translate3d(0, ${dy}px, 0)`; };
  const up = () => {
    if (!drag) return; drag = false;
    const v = dy / Math.max(1, performance.now() - t0), closing = dy > 90 || v > 0.5;
    panel.style.transition = ""; panel.style.removeProperty("transform");
    if (closing) close();
  };
  handle.addEventListener("pointerdown", down); handle.addEventListener("pointermove", move);
  handle.addEventListener("pointerup", up); handle.addEventListener("pointercancel", up);
}

// Sheet modal inferior
export function openSheet({ title = "", html = "", cls = "" } = {}) {
  const bd = document.createElement("div");
  bd.className = "sheet-bd";
  bd.innerHTML = `<div class="sheet ${cls}" role="dialog" aria-modal="true" aria-label="${title.replace(/"/g, "&quot;")}"><div class="sheet-grip" tabindex="-1"><i></i></div>${title ? `<h2 class="sheet-t">${title}</h2>` : ""}<div class="sheet-body">${html}</div></div>`;
  const panel = $(".sheet", bd), opener = document.activeElement;
  document.body.appendChild(bd); document.body.style.overflow = "hidden";
  requestAnimationFrame(() => bd.classList.add("on"));
  let closed = false;
  const close = () => {
    if (closed) return; closed = true; bd.classList.remove("on");
    document.removeEventListener("keydown", key); document.body.style.overflow = "";
    setTimeout(() => bd.remove(), reduced() ? 0 : 280); opener?.focus?.();
  };
  const key = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", key);
  bd.addEventListener("click", (e) => { if (e.target === bd) close(); });
  panel.addEventListener("click", (e) => { if (e.target.closest("a[href]") || e.target.closest("[data-close]")) close(); });
  dragDown(panel, $(".sheet-grip", bd), close);
  (panel.querySelector("a,button") || panel).focus?.({ preventScroll: true });
  return { el: panel, close };
}

// Índex del carrusel horitzontal amb scroll-snap
export function carouselIndex(scroller, cb) {
  let raf = 0;
  const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => {
    const kids = [...scroller.children]; const c = scroller.scrollLeft + scroller.clientWidth / 2;
    let best = 0, bd = 1e9; kids.forEach((k, i) => { const d = Math.abs(k.offsetLeft - scroller.offsetLeft + k.offsetWidth / 2 - c); if (d < bd) { bd = d; best = i; } });
    cb(best);
  }); };
  scroller.addEventListener("scroll", on, { passive: true }); on();
  return () => scroller.removeEventListener("scroll", on);
}

// Semilla del dia (per a «curiositat del dia» i hero)
export function daySeed(d = new Date()) { return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
export function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
