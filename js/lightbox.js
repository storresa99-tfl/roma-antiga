// Galeria a pantalla completa: lliscar per canviar, pessigar/doble toc per fer zoom, lliscar cap avall per tancar.
import { $, $$, esc, commonsUrl, roman } from "./util.js";
import { ic } from "./icons.js";
import { reduced, vibe } from "./ui.js";

const lb = $("#lightbox");
let items = [], idx = 0, opener = null, open = false;
let track, st = { s: 1, x: 0, y: 0 }, mode = "", pts = new Map(), start = null, lastTap = 0;

const slideHTML = (it, i) => `<div class="lb-slide" data-i="${i}"><img class="lb-pic" ${Math.abs(i - idx) <= 1 ? `src="${esc(commonsUrl(it.file, 1200))}"` : `data-src="${esc(commonsUrl(it.file, 1200))}"`} alt="${esc(it.title)}" draggable="false"></div>`;

function caption() {
  const it = items[idx];
  $(".lb-cap", lb).innerHTML = `<b>${esc(it.title)}</b>${(it.text || "").split("\n").filter(Boolean).map((t) => `<div>${esc(t)}</div>`).join("")}<div class="lb-cr">${esc(it.credit || "")}${it.credit ? " · " : ""}Wikimedia Commons</div>`;
  $(".lb-count", lb).textContent = items.length > 1 ? `${roman(idx + 1)} / ${roman(items.length)}` : "";
}
function place(animate = true) {
  track.style.transition = animate && !reduced() ? "transform .32s cubic-bezier(.32,.72,0,1)" : "none";
  track.style.transform = `translate3d(${-idx * 100}%,0,0)`;
  $$(".lb-slide", track).forEach((sl, i) => { const im = $("img", sl); if (Math.abs(i - idx) <= 1 && !im.getAttribute("src") && im.dataset.src) im.src = im.dataset.src; });
}
function applyZoom(animate) {
  const im = $$(".lb-slide img", track)[idx]; if (!im) return;
  im.style.transition = animate ? "transform .25s cubic-bezier(.23,1,.32,1)" : "none";
  im.style.transform = `translate3d(${st.x}px,${st.y}px,0) scale(${st.s})`;
}
function resetZoom() { st = { s: 1, x: 0, y: 0 }; applyZoom(false); }
function go(d) {
  const n = Math.max(0, Math.min(items.length - 1, idx + d));
  if (n === idx) { place(); return; }
  resetZoom(); idx = n; place(); caption();
}
function draw() {
  lb.innerHTML = `<div class="lb-bar"><span class="lb-count"></span><button type="button" data-lb-close aria-label="Tanca">${ic("close")}</button></div>
    <div class="lb-view"><div class="lb-track">${items.map(slideHTML).join("")}</div>
      ${items.length > 1 ? `<button type="button" class="lb-nav l" data-lb-prev aria-label="Anterior">${ic("chevron-left")}</button><button type="button" class="lb-nav r" data-lb-next aria-label="Següent">${ic("chevron-right")}</button>` : ""}</div>
    <div class="lb-cap" aria-live="polite"></div>`;
  track = $(".lb-track", lb); place(false); caption(); $("[data-lb-close]", lb).focus();
  bindGestures($(".lb-view", lb));
}

function bindGestures(view) {
  const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  view.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".lb-nav")) return;
    view.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) { mode = "pinch"; start = { d: dist(), s: st.s }; }
    else {
      start = { x: e.clientX, y: e.clientY, t: performance.now(), sx: st.x, sy: st.y };
      mode = st.s > 1 ? "pan" : "";
      const now = performance.now();
      if (now - lastTap < 280) { // doble toc
        if (st.s > 1) st = { s: 1, x: 0, y: 0 };
        else { const r = view.getBoundingClientRect(); st = { s: 2.5, x: (r.width / 2 - (e.clientX - r.left)) * 1.5, y: (r.height / 2 - (e.clientY - r.top)) * 1.5 }; }
        applyZoom(true); lastTap = 0; mode = "none"; vibe(6);
      } else lastTap = now;
    }
  });
  view.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (mode === "pinch" && pts.size === 2) { st.s = Math.max(1, Math.min(5, start.s * dist() / start.d)); applyZoom(false); return; }
    if (mode === "none" || pts.size !== 1) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (mode === "pan") { st.x = start.sx + dx; st.y = start.sy + dy; applyZoom(false); return; }
    if (!mode && Math.hypot(dx, dy) > 10) mode = Math.abs(dx) > Math.abs(dy) ? "swipe" : "dismiss";
    if (mode === "swipe") {
      const edge = (idx === 0 && dx > 0) || (idx === items.length - 1 && dx < 0) ? 0.35 : 1;
      track.style.transition = "none"; track.style.transform = `translate3d(calc(${-idx * 100}% + ${dx * edge}px),0,0)`;
    } else if (mode === "dismiss") {
      const y = Math.max(0, dy);
      view.style.transform = `translate3d(0,${y}px,0)`; lb.style.background = `rgba(10,8,5,${Math.max(0.35, 0.96 - y / 500)})`;
    }
  });
  const end = (e) => {
    if (!pts.has(e.pointerId)) return; const was = mode; pts.delete(e.pointerId);
    if (was === "pinch") { if (st.s < 1.05) { st = { s: 1, x: 0, y: 0 }; applyZoom(true); } mode = ""; return; }
    if (pts.size || !start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y, v = Math.abs(dx) / Math.max(1, performance.now() - start.t);
    if (was === "swipe") { if (Math.abs(dx) > 60 || v > 0.4) go(dx < 0 ? 1 : -1); else place(); }
    else if (was === "dismiss") {
      const vel = dy / Math.max(1, performance.now() - start.t);
      view.style.transform = ""; lb.style.background = "";
      if (dy > 110 || vel > 0.6) close(); else place();
    } else if (was === "pan") { st.x = Math.max(-600, Math.min(600, st.x)); applyZoom(true); }
    mode = "";
  };
  view.addEventListener("pointerup", end); view.addEventListener("pointercancel", end);
  view.addEventListener("wheel", (e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); st.s = Math.max(1, Math.min(5, st.s * (e.deltaY < 0 ? 1.15 : 0.87))); applyZoom(false); } }, { passive: false });
}

let pushed = false; // la galeria té una entrada d'historial: el botó «enrere» del mòbil la tanca en lloc de sortir de la fitxa
export function openGallery(list, i = 0) {
  items = list; idx = Math.max(0, Math.min(list.length - 1, i)); st = { s: 1, x: 0, y: 0 }; mode = ""; pts.clear();
  opener = document.activeElement; lb.hidden = false; open = true; document.body.style.overflow = "hidden"; lb.style.background = "";
  draw(); requestAnimationFrame(() => lb.classList.add("on"));
  try { if (!pushed) { history.pushState({ lb: 1 }, ""); pushed = true; } } catch {}
}
window.addEventListener("popstate", () => { if (open && pushed && !history.state?.lb) { pushed = false; close(); } });
export function close() {
  if (!open) return;
  if (pushed) { pushed = false; try { history.back(); } catch {} }
  open = false; lb.classList.remove("on");
  setTimeout(() => { if (!open) { lb.hidden = true; lb.innerHTML = ""; } }, reduced() ? 0 : 200);
  document.body.style.overflow = ""; opener?.focus?.();
}

// Obertura delegada: qualsevol element amb data-lb (i data-file), dins d'un grup [data-lbgroup] o de #main
export function initLightbox(main) {
  document.addEventListener("click", (e) => {
    if (open) {
      if (e.target.closest("[data-lb-close]")) close();
      else if (e.target.closest("[data-lb-prev]")) go(-1);
      else if (e.target.closest("[data-lb-next]")) go(1);
      return;
    }
    const t = e.target.closest("[data-lb]"); if (!t || !t.dataset.file) return;
    const group = t.closest("[data-lbgroup]") || main;
    const els = $$("[data-lb]", group).filter((x) => x.dataset.file);
    openGallery(els.map((x) => ({ file: x.dataset.file, title: x.dataset.title, text: x.dataset.text, credit: x.dataset.credit })), Math.max(0, els.indexOf(t)));
  });
  document.addEventListener("keydown", (e) => {
    if (open) {
      if (e.key === "Escape") close(); else if (e.key === "ArrowRight") go(1); else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Tab") { const f = $$("button", lb); if (f.length) { const i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); } }
      return;
    }
    const t = e.target; if ((e.key === "Enter" || e.key === " ") && t.matches?.("img[data-lb]")) { e.preventDefault(); t.click(); }
  });
}
