// Comparador abans/després amb control lliscant (ratolí, tàctil i teclat).
import { img, zoomImg, creditLine, esc } from "./util.js";

export function compareHTML(im, nomLloc) {
  const a = im?.abans, d = im?.despres;
  if (a?.fitxer && d?.fitxer) {
    return `<section class="compare" aria-label="Comparador abans i després">
      <div class="cmp-stage" data-cmp style="--pos:50%">
        ${img(d.fitxer, `Després: ${d.descripcio || nomLloc}`, 1200)}
        ${img(a.fitxer, `Abans: ${a.descripcio || nomLloc}`, 1200, "top")}
        <span class="cmp-tag l">Abans</span><span class="cmp-tag r">Després</span>
        <button class="cmp-handle" role="slider" aria-label="Comparador abans i després: posició del control" aria-orientation="horizontal"
          aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" aria-valuetext="50% — meitat abans, meitat després"><span>‹›</span></button>
      </div>
      <div class="cmp-caps">
        <div><b>Abans</b>${esc(a.descripcio || "")}${creditLine(a.credit, a.llicencia)}</div>
        <div><b>Després</b>${esc(d.descripcio || "")}${creditLine(d.credit, d.llicencia)}</div>
      </div>
    </section>`;
  }
  const one = a?.fitxer ? a : d?.fitxer ? d : null;
  if (!one) return "";
  return `<section class="compare"><div class="cmp-stage cmp-single">${zoomImg(one.fitxer, one.descripcio || nomLloc, nomLloc, one.descripcio, one.credit, one.llicencia)}</div>
    <div class="cmp-caps" style="grid-template-columns:1fr"><div>${esc(one.descripcio || "")}${creditLine(one.credit, one.llicencia)}</div></div></section>`;
}

export function initCompare(root) {
  const stage = root.querySelector("[data-cmp]");
  if (!stage) return;
  const handle = stage.querySelector(".cmp-handle");
  const top = stage.querySelector("img.top");
  // La imatge "abans" es retalla amb clip-path (definit al CSS: .cmp-stage .top)
  let pos = 50;
  const set = (p, announce = true) => {
    pos = Math.max(0, Math.min(100, p));
    stage.style.setProperty("--pos", pos + "%");
    // "abans" a l'esquerra: la capa superior mostra la part esquerra
    top.style.clipPath = `inset(0 ${100 - pos}% 0 0)`;
    handle.setAttribute("aria-valuenow", String(Math.round(pos)));
    if (announce) handle.setAttribute("aria-valuetext", `${Math.round(pos)}% — ${pos > 55 ? "més abans" : pos < 45 ? "més després" : "meitat abans, meitat després"}`);
  };
  set(50, false);
  const fromEvent = (e) => { const r = stage.getBoundingClientRect(); set(((e.clientX - r.left) / r.width) * 100); };
  let drag = false;
  stage.addEventListener("pointerdown", (e) => {
    // Al tàctil, només s'arrossega des del control (així es pot desplaçar la pàgina amb el dit sobre la imatge)
    if (e.pointerType === "touch" && !e.target.closest(".cmp-handle")) return;
    drag = true; stage.setPointerCapture(e.pointerId); fromEvent(e); handle.focus({ preventScroll: true });
  });
  stage.addEventListener("pointermove", (e) => { if (drag) { fromEvent(e); e.preventDefault(); } });
  const end = (e) => { drag = false; try { stage.releasePointerCapture(e.pointerId); } catch {} };
  stage.addEventListener("pointerup", end); stage.addEventListener("pointercancel", end);
  handle.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") { set(pos - step); e.preventDefault(); }
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") { set(pos + step); e.preventDefault(); }
    else if (e.key === "Home") { set(0); e.preventDefault(); }
    else if (e.key === "End") { set(100); e.preventDefault(); }
    else if (e.key === "PageUp") { set(pos + 10); e.preventDefault(); }
    else if (e.key === "PageDown") { set(pos - 10); e.preventDefault(); }
  });
}
