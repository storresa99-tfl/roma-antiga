// Cronologia, rutes (6 dies) i pràctic
import { $, $$, esc, inline, paragraphs, link, fmtYear, fmtRange, mapsRoute, mapsPlace, store, toast } from "./util.js";
import { getCronologia, getRutes, getPractic, llocsMap } from "./data.js";

const missing = (what) => `<div class="view-in"><h1>${what}</h1><div class="notice">Encara no hi ha dades d'aquesta secció. Executa <code>python3 scripts/build.py</code> quan estiguin les dades.</div></div>`;
const chips = (m, ids) => (ids || []).map((id) => m.get(id)).filter(Boolean).map((l) => `<a href="#/lloc/${encodeURIComponent(l.id)}">${esc(l.nom)}</a>`).join(" · ");

// ---------- Cronologia ----------
export async function cronologia() {
  const [c, m] = await Promise.all([getCronologia(), llocsMap()]);
  if (!c) return { html: missing("Cronologia"), title: "Cronologia", tab: "inici" };
  const per = [...(c.periodes || [])].sort((a, b) => a.inici - b.inici);
  const emps = c.emperadors || [];
  const dins = [...new Set(emps.map((e) => e.dinastia || "Altres"))];
  const html = `<div class="view-in"><h1>Cronologia</h1><p class="lead">De la fundació llegendària a la caiguda de l'Imperi d'Occident, amb els llocs que en guarden la memòria.</p>
    <div class="timeline">
    ${per.map((p) => `<section class="period" id="p-${esc(p.id)}"><h2>${esc(p.nom)}</h2><div class="range">${esc(fmtRange(p.inici, p.fi))}</div>
      <div class="text">${paragraphs(p.intro)}</div>
      ${[...(p.esdeveniments || [])].sort((a, b) => a.any - b.any).map((e) => `<div class="event"><div class="yr">${esc(fmtYear(e.any))}</div><h3>${esc(e.titol)}</h3>
        <p>${inline(e.text)}</p><div class="lk">${chips(m, e.llocs)}${e.font ? ` <span>· ${link(e.font, "font")}</span>` : ""}</div></div>`).join("")}
    </section>`).join("")}
    </div>
    ${emps.length ? `<h2>Emperadors</h2><div class="emp-sec">${dins.map((d) => `<details class="acc"><summary>${esc(d)} <span class="muted">${emps.filter((e) => (e.dinastia || "Altres") === d).length} emperadors</span></summary><div class="in">
      ${emps.filter((e) => (e.dinastia || "Altres") === d).map((e) => `<details class="acc item"><summary>${esc(e.nom)} <span class="muted">${esc(e.regnat || "")}</span></summary><div class="in"><p>${inline(e.text || "")}</p><div class="lk sans">${chips(m, e.llocs)}</div></div></details>`).join("")}
    </div></details>`).join("")}</div>` : ""}
    ${c.fonts?.length ? `<h2>Fonts</h2><ul class="sources">${c.fonts.map((f) => `<li>${link(f.url, f.titol || f.url)}</li>`).join("")}</ul>` : ""}
  </div>`;
  return { html, title: "Cronologia", tab: "inici" };
}

// ---------- Rutes ----------
const doneKey = (d, i, id) => `${d.dia}:${i}:${id}`;
const getDone = () => store.get("roma.fet", {});
function shortDate(iso) {
  const x = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); if (!x) return "";
  try { return new Date(+x[1], +x[2] - 1, +x[3]).toLocaleDateString("ca", { weekday: "short", day: "numeric", month: "short" }); } catch { return iso; }
}
export async function rutes(ctx) {
  const [r, m] = await Promise.all([getRutes(), llocsMap()]);
  if (!r?.dies?.length) return { html: missing("Rutes"), title: "Rutes", tab: "rutes" };
  let idx = Math.max(0, r.dies.findIndex((d) => String(d.dia) === String(ctx.id || r.dies[0].dia)));
  const html = `<div class="view-in"><h1>Rutes</h1>${r.nota ? `<p class="lead">${inline(r.nota)}</p>` : ""}
    <div class="tabs" role="tablist" aria-label="Dies de la ruta">${r.dies.map((d, i) => `<button role="tab" id="tab${i}" aria-selected="${i === idx}" aria-controls="day" data-i="${i}">Dia ${esc(d.dia)}<small>${esc(shortDate(d.data))}</small></button>`).join("")}</div>
    <div id="day" role="tabpanel" aria-live="polite"></div>
    ${r.fonts?.length ? `<h2>Fonts</h2><ul class="sources">${r.fonts.map((f) => `<li>${link(f.url, f.titol || f.url)}</li>`).join("")}</ul>` : ""}</div>`;
  const mount = (el) => {
    const day = $("#day", el);
    const draw = () => {
      const d = r.dies[idx], done = getDone();
      const pts = d.parades.map((p) => m.get(p.lloc)?.coords).filter((c) => c && typeof c.lat === "number");
      const n = d.parades.filter((p, i) => done[doneKey(d, i, p.lloc)]).length;
      day.innerHTML = `<h2 style="margin-top:.4em">${esc(d.titol || "")}</h2>
        <p class="muted" style="margin:0 0 8px">${esc(shortDate(d.data))}</p>
        ${d.intro ? `<div class="text">${paragraphs(d.intro)}</div>` : ""}
        ${d.avisos?.length ? `<ul class="warns" aria-label="Avisos">${d.avisos.map((a) => `<li>${inline(a)}</li>`).join("")}</ul>` : ""}
        <div class="toolbar">${pts.length ? `<a class="btn" href="${esc(mapsRoute(pts))}" target="_blank" rel="noopener noreferrer">➜ Obre la ruta del dia a Google Maps</a>` : `<span class="muted">Sense coordenades per generar la ruta.</span>`}</div>
        ${pts.length > 11 ? `<p class="muted">Google Maps admet com a màxim 11 punts: s'han fet servir els primers 11.</p>` : ""}
        <div class="muted">${n} de ${d.parades.length} parades fetes</div><div class="progress"><i style="width:${d.parades.length ? (n / d.parades.length) * 100 : 0}%"></i></div>
        <ol class="stops">${d.parades.map((p, i) => {
          const l = m.get(p.lloc), isDone = !!done[doneKey(d, i, p.lloc)];
          return `<li class="stop${isDone ? " done" : ""}"><div class="h">${esc(p.hora || "")}</div>
            <div class="box"><div class="top"><div><h3>${l ? `<a href="#/lloc/${encodeURIComponent(l.id)}">${esc(l.nom)}</a>` : esc(p.lloc)}</h3>
              <div class="dur">${p.durada ? "Durada: " + esc(p.durada) : ""}${l?.coords ? `${p.durada ? " · " : ""}<a href="${esc(mapsPlace(l.coords))}" target="_blank" rel="noopener noreferrer">Com arribar-hi</a>` : ""}</div></div>
              <button class="check" type="button" data-i="${i}" aria-pressed="${isDone}" aria-label="Marca la parada «${esc(l?.nom || p.lloc)}» com a feta">✓</button></div>
              ${p.nota ? `<p class="nt">${inline(p.nota)}</p>` : ""}</div></li>
            ${p.a_peu_fins_seguent && i < d.parades.length - 1 ? `<li class="walk">${esc(p.a_peu_fins_seguent)} a peu fins a la següent</li>` : ""}`;
        }).join("")}</ol>
        ${n ? `<div class="toolbar"><button class="btn ghost small" id="reset" type="button">Reinicia les parades d'aquest dia</button></div>` : ""}`;
    };
    el.addEventListener("click", (e) => {
      const tab = e.target.closest(".tabs button");
      if (tab) {
        idx = +tab.dataset.i; $$(".tabs button", el).forEach((b, i) => b.setAttribute("aria-selected", i === idx));
        try { history.replaceState(null, "", `#/rutes/${r.dies[idx].dia}`); } catch {}
        draw(); return;
      }
      const ck = e.target.closest(".check");
      if (ck) {
        const d = r.dies[idx], i = +ck.dataset.i, k = doneKey(d, i, d.parades[i].lloc), done = getDone();
        if (done[k]) delete done[k]; else done[k] = true;
        if (!store.set("roma.fet", done)) toast("No s'ha pogut desar (emmagatzematge bloquejat)");
        draw(); $$(".check", el)[i]?.focus(); return;
      }
      if (e.target.id === "reset") {
        const d = r.dies[idx], done = getDone();
        d.parades.forEach((p, i) => delete done[doneKey(d, i, p.lloc)]);
        store.set("roma.fet", done); draw();
      }
    });
    $(".tabs", el).addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const bs = $$(".tabs button", el), cur = bs.indexOf(document.activeElement); if (cur < 0) return;
      const nx = bs[(cur + (e.key === "ArrowRight" ? 1 : -1) + bs.length) % bs.length]; nx.focus(); nx.click();
    });
    draw();
  };
  return { html, mount, title: "Rutes", tab: "rutes" };
}

// ---------- Pràctic ----------
function fmtDate(iso) { const x = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); return x ? `${x[3]}/${x[2]}/${x[1]}` : iso || ""; }
export async function practic() {
  const p = await getPractic();
  if (!p?.seccions?.length) return { html: missing("Pràctic"), title: "Pràctic", tab: "practic" };
  const html = `<div class="view-in"><h1>Pràctic</h1><p class="lead">Entrades, transport, horaris i consells. Cada dada indica la font i quan es va comprovar.</p>
    ${p.seccions.map((s, si) => `<details class="acc"${si === 0 ? " open" : ""}><summary>${esc(s.titol)}</summary><div class="in">
      ${(s.items || []).map((it) => `<div style="margin-bottom:1.2em"><h3>${esc(it.titol)}</h3><div class="text">${paragraphs(it.text)}</div>
        <div class="checked">${it.font ? `Font: ${link(it.font, it.font.replace(/^https?:\/\//, "").split("/")[0])}` : `Font no indicada <mark class="val">[VALIDAR]</mark>`}${it.comprovat ? ` · Comprovat el ${esc(fmtDate(it.comprovat))}` : ""}</div></div>`).join("")}
    </div></details>`).join("")}</div>`;
  return { html, title: "Pràctic", tab: "practic" };
}
