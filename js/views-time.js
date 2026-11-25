// Cronologia (línia de temps interactiva + cromos d'emperadors), rutes (mapa del dia) i pràctic
import { $, $$, esc, img, inline, paragraphs, link, fmtYear, fmtRange, mapsRoute, mapsPlace, store, toast, roman, placeThumb, norm, firstSentence } from "./util.js";
import { getCronologia, getRutes, getPractic, llocsMap } from "./data.js";
import { ic, tipusIc } from "./icons.js";
import { vibe, pop, reduced, openSheet, stagger } from "./ui.js";

const missing = (what) => `<div class="view-in"><h1>${what}</h1><div class="notice">Encara no hi ha dades d'aquesta secció. Executa <code>python3 scripts/build.py</code> quan estiguin les dades.</div></div>`;
const chips = (m, ids) => (ids || []).map((id) => m.get(id)).filter(Boolean).map((l) => `<a class="chip-btn" href="#/lloc/${encodeURIComponent(l.id)}">${tipusIc(l.tipus)} ${esc(l.nom)}</a>`).join("");

// ---------- Cronologia ----------
const PX = 3.4; // píxels per any a la regla
const PER_COLOR = { monarquia: "#a8472a", republica: "#8c2a22", imperi: "#946a1c", "antiguitat-tardana": "#5a4a3a", posterior: "#4a4a4a" };

export async function cronologia() {
  const [c, m] = await Promise.all([getCronologia(), llocsMap()]);
  if (!c) return { html: missing("Cronologia"), title: "Cronologia", tab: "" };
  const per = [...(c.periodes || [])].sort((a, b) => a.inici - b.inici);
  const evs = per.flatMap((p) => (p.esdeveniments || []).map((e) => ({ ...e, per: p }))).sort((a, b) => a.any - b.any);
  const start = Math.min(...per.map((p) => p.inici), ...evs.map((e) => e.any)), end = Math.max(...per.map((p) => p.fi), ...evs.map((e) => e.any));
  const W = (end - start) * PX;
  const emps = c.emperadors || [];
  const dins = [...new Set(emps.map((e) => e.dinastia || "Altres"))];
  const perOf = (y) => per.find((p) => y >= p.inici && y <= p.fi) || per.reduce((b, p) => (Math.abs(y - p.inici) < Math.abs(y - b.inici) ? p : b), per[0]);

  const ticks = []; for (let y = Math.ceil(start / 100) * 100; y <= end; y += 100) ticks.push(y);
  const html = `<div class="view-in tl-page">
    <header class="page-h"><h1>Cronologia</h1><span class="count">${evs.length} fets</span></header>
    <section class="tl" aria-label="Línia de temps">
      <div class="tl-read" aria-live="polite"><div class="tl-year" id="tl-year"></div><div class="tl-per" id="tl-per"></div></div>
      <div class="tl-wrap"><div class="tl-strip" id="tl-strip" tabindex="0" role="slider" aria-label="Desplaça't pel temps" aria-valuemin="${start}" aria-valuemax="${end}">
        <div class="tl-ruler" style="width:${W}px">
          ${per.map((p) => `<div class="tl-band" style="left:${(p.inici - start) * PX}px;width:${(p.fi - p.inici) * PX}px;--c:${PER_COLOR[p.id] || "#946a1c"}"><span>${esc(p.nom)}</span></div>`).join("")}
          ${ticks.map((y) => `<i class="tl-tick" style="left:${(y - start) * PX}px"><b>${esc(fmtYear(y))}</b></i>`).join("")}
          ${evs.map((e, i) => `<button type="button" class="tl-pin" data-i="${i}" style="left:${(e.any - start) * PX}px" aria-label="${esc(fmtYear(e.any) + ": " + e.titol)}"></button>`).join("")}
        </div></div><div class="tl-needle" aria-hidden="true"></div></div>
      <div class="tl-nav"><button type="button" id="tl-prev" class="chip-btn">${ic("chevron-left")} Abans</button><button type="button" id="tl-intro" class="chip-btn">${ic("scroll")} El període</button><button type="button" id="tl-next" class="chip-btn">Després ${ic("chevron-right")}</button></div>
      <article class="tl-card" id="tl-card" aria-live="polite"></article>
    </section>
    ${emps.length ? `<section class="sec"><div class="sec-h"><h2>Emperadors</h2><span class="muted">${emps.length} cromos</span></div>
      <div class="chips sm" id="d-chips" role="group" aria-label="Dinastia"><button type="button" class="chip-btn" data-v="" aria-pressed="true">Tots</button>${dins.map((d) => `<button type="button" class="chip-btn" data-v="${esc(d)}" aria-pressed="false">${esc(d)}</button>`).join("")}</div>
      <div class="hscroll deck" id="deck">${emps.map((e, i) => empCard(e, i, m)).join("")}</div></section>` : ""}
    ${c.fonts?.length ? `<details class="acc"><summary>${ic("scroll")} Fonts</summary><div class="in"><ul class="sources">${c.fonts.map((f) => `<li>${link(f.url, f.titol || f.url)}</li>`).join("")}</ul></div></details>` : ""}
  </div>`;

  const mount = (el) => {
    const strip = $("#tl-strip", el), card = $("#tl-card", el), yearEl = $("#tl-year", el), perEl = $("#tl-per", el);
    const pad = () => { const p = strip.clientWidth / 2; $(".tl-ruler", el).style.margin = `0 ${p}px`; };
    pad();
    let cur = -1, raf = 0, yearNow = start;
    const draw = (i) => {
      const e = evs[i]; if (!e) return; cur = i;
      const l = (e.llocs || []).map((id) => m.get(id)).filter(Boolean), t = l.map(placeThumb).find(Boolean);
      card.innerHTML = `${t ? `<div class="tc-img">${img(t, "", 800)}</div>` : `<div class="tc-img none">${ic("column", "ic-xxl")}</div>`}
        <div class="tc-b"><div class="tc-y">${esc(fmtYear(e.any))}</div><h3>${esc(e.titol)}</h3><p>${inline(e.text || "")}</p>
        <div class="tc-l">${chips(m, e.llocs)}</div></div>`;
      pop(card, "swap"); $$(".tl-pin", strip).forEach((b, k) => b.classList.toggle("on", k === i));
    };
    const update = () => {
      raf = 0; yearNow = Math.round(start + strip.scrollLeft / PX);
      yearEl.textContent = fmtYear(yearNow); const p = perOf(yearNow); perEl.textContent = p?.nom || "";
      strip.setAttribute("aria-valuenow", yearNow); strip.setAttribute("aria-valuetext", fmtYear(yearNow));
      let best = 0, bd = 1e9; evs.forEach((e, k) => { const d = Math.abs(e.any - yearNow); if (d < bd) { bd = d; best = k; } });
      if (best !== cur) { draw(best); vibe(4); }
    };
    strip.addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
    const goTo = (i) => { i = Math.max(0, Math.min(evs.length - 1, i)); strip.scrollTo({ left: (evs[i].any - start) * PX, behavior: reduced() ? "auto" : "smooth" }); };
    $("#tl-prev", el).addEventListener("click", () => goTo(cur - 1));
    $("#tl-next", el).addEventListener("click", () => goTo(cur + 1));
    strip.addEventListener("click", (e) => { const b = e.target.closest(".tl-pin"); if (b) goTo(+b.dataset.i); });
    strip.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") { goTo(cur + 1); e.preventDefault(); } else if (e.key === "ArrowLeft") { goTo(cur - 1); e.preventDefault(); } });
    $("#tl-intro", el).addEventListener("click", () => { const p = perOf(yearNow); openSheet({ title: `${esc(p.nom)} <small>${esc(fmtRange(p.inici, p.fi))}</small>`, html: `<div class="text">${paragraphs(p.intro)}</div>` }); });
    // posició inicial: primer fet de la República (si n'hi ha) o el primer
    const i0 = Math.max(0, evs.findIndex((e) => e.any >= -44)); strip.scrollLeft = (evs[i0].any - start) * PX; update();
    const onResize = () => pad(); window.addEventListener("resize", onResize); mount.off = () => window.removeEventListener("resize", onResize);

    // cromos
    const deck = $("#deck", el);
    if (deck) {
      deck.addEventListener("click", (e) => {
        if (e.target.closest("a")) return; const k = e.target.closest(".emp"); if (!k) return;
        const on = k.getAttribute("aria-pressed") !== "true"; k.setAttribute("aria-pressed", String(on)); vibe(8);
      });
      deck.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("emp")) { e.preventDefault(); e.target.click(); } });
      $("#d-chips", el).addEventListener("click", (e) => {
        const b = e.target.closest("button"); if (!b) return; $$("#d-chips button", el).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        $$(".emp", deck).forEach((k) => { k.hidden = !!b.dataset.v && k.dataset.d !== b.dataset.v; }); deck.scrollLeft = 0;
      });
    }
  };
  return { html, mount, unmount: () => mount.off?.(), title: "Cronologia", tab: "" };
}

function empCard(e, i, m) {
  const l = (e.llocs || []).map((id) => m.get(id)).filter(Boolean), t = l.map(placeThumb).find(Boolean);
  return `<div class="emp" role="button" tabindex="0" aria-pressed="false" data-d="${esc(e.dinastia || "Altres")}" aria-label="${esc(e.nom)}, ${esc(e.regnat || "")}. Toca per girar el cromo">
    <div class="e-in"><div class="e-front">${t ? img(t, "", 400) : `<span class="e-none">${ic("crown", "ic-xxl")}</span>`}<span class="e-shade"></span>
      <span class="e-n">${roman(i + 1)}</span><span class="e-name">${esc(e.nom)}</span><span class="e-reg">${esc(e.regnat || "")}</span><span class="e-din">${esc(e.dinastia || "")}</span></div>
      <div class="e-back"><b>${esc(e.nom)}</b><p>${inline(e.text || "")}</p><div class="tc-l">${chips(m, e.llocs)}</div></div></div></div>`;
}

// ---------- Rutes ----------
const doneKey = (d, i, id) => `${d.dia}:${i}:${id}`;
const getDone = () => store.get("roma.fet", {});
function shortDate(iso) {
  const x = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); if (!x) return "";
  try { return new Date(+x[1], +x[2] - 1, +x[3]).toLocaleDateString("ca", { weekday: "short", day: "numeric", month: "short" }); } catch { return iso; }
}
const isToday = (iso) => { const x = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); if (!x) return false; const n = new Date(); return +x[1] === n.getFullYear() && +x[2] === n.getMonth() + 1 && +x[3] === n.getDate(); };

export async function rutes(ctx) {
  const [r, m] = await Promise.all([getRutes(), llocsMap()]);
  if (!r?.dies?.length) return { html: missing("Rutes"), title: "Rutes", tab: "rutes" };
  let idx = r.dies.findIndex((d) => String(d.dia) === String(ctx.id));
  if (idx < 0) idx = Math.max(0, r.dies.findIndex((d) => isToday(d.data)));
  const html = `<div class="view-in rutes">
    <header class="page-h"><h1>Rutes</h1><span class="count">${r.dies.length} dies</span></header>
    <div class="tabs days" role="tablist" aria-label="Dies de la ruta">${r.dies.map((d, i) => `<button role="tab" id="tab${i}" aria-selected="${i === idx}" aria-controls="day" data-i="${i}"><b>${roman(i + 1)}</b><small>${esc(shortDate(d.data))}${isToday(d.data) ? " · avui" : ""}</small></button>`).join("")}</div>
    <div id="day" role="tabpanel" aria-live="polite"></div>
    ${r.fonts?.length ? `<details class="acc"><summary>${ic("scroll")} Fonts</summary><div class="in"><ul class="sources">${r.fonts.map((f) => `<li>${link(f.url, f.titol || f.url)}</li>`).join("")}</ul></div></details>` : ""}</div>`;
  let map = null;
  const killMap = () => { try { map?.remove(); } catch {} map = null; };
  const mount = (el) => {
    const day = $("#day", el);
    const draw = () => {
      killMap();
      const d = r.dies[idx], done = getDone();
      const pts = d.parades.map((p) => m.get(p.lloc)?.coords).filter((c) => c && typeof c.lat === "number");
      const n = d.parades.filter((p, i) => done[doneKey(d, i, p.lloc)]).length, N = d.parades.length;
      day.innerHTML = `<div class="day-h"><div><h2>${esc(d.titol || "")}</h2><p class="muted">${esc(shortDate(d.data))}</p></div>
          <div class="day-prog" aria-label="${n} de ${N} parades fetes"><b>${n}</b><span>/ ${N}</span></div></div>
        <div class="progress thin"><i style="width:${N ? (n / N) * 100 : 0}%"></i></div>
        ${pts.length ? `<div class="day-map-w"><div id="dmap" class="day-map" role="application" aria-label="Mapa del dia"></div></div>` : ""}
        <div class="p-actions">${pts.length ? `<a class="btn" href="${esc(mapsRoute(pts))}" target="_blank" rel="noopener noreferrer">${ic("routes")} Obre a Google Maps</a>` : ""}${n ? `<button class="btn ghost small" id="reset" type="button">Reinicia</button>` : ""}</div>
        ${pts.length > 11 ? `<p class="muted">Google Maps admet com a màxim 11 punts: s'han fet servir els primers 11.</p>` : ""}
        ${d.avisos?.length ? `<details class="acc warn"><summary>${ic("flag")} Avisos del dia (${d.avisos.length})</summary><div class="in"><ul class="warns">${d.avisos.map((a) => `<li>${inline(a)}</li>`).join("")}</ul></div></details>` : ""}
        ${d.intro ? `<details class="acc"><summary>${ic("scroll")} Resum del dia</summary><div class="in"><div class="text">${paragraphs(d.intro)}</div></div></details>` : ""}
        <ol class="stops">${d.parades.map((p, i) => {
          const l = m.get(p.lloc), isDone = !!done[doneKey(d, i, p.lloc)], t = l && placeThumb(l);
          return `<li class="stop${isDone ? " done" : ""}" id="stop${i}"><div class="s-no"><b>${i + 1}</b><span>${esc(p.hora || "")}</span></div>
            <div class="s-card"><a class="s-img" href="#/lloc/${encodeURIComponent(p.lloc)}" data-vt aria-label="Obre ${esc(l?.nom || p.lloc)}">${t ? img(t, "", 800, "vt-img") : `<span class="s-none">${tipusIc(l?.tipus, "ic-xl")}</span>`}<h3 class="s-name">${esc(l?.nom || p.lloc)}</h3></a>
              <div class="s-row"><span class="s-dur">${p.durada ? `${ic("clock")} ${esc(p.durada)}` : ""}</span>
                ${l?.coords ? `<a class="s-ic" href="${esc(mapsPlace(l.coords))}" target="_blank" rel="noopener noreferrer" aria-label="Com arribar-hi">${ic("routes")}</a><button type="button" class="s-ic s-loc" data-i="${i}" aria-label="Mostra al mapa">${ic("pin")}</button>` : ""}
                <button class="check" type="button" data-i="${i}" aria-pressed="${isDone}" aria-label="Marca la parada «${esc(l?.nom || p.lloc)}» com a feta">${ic("check")}</button></div>
              ${p.nota ? `<details class="s-note"><summary>Nota</summary><p>${inline(p.nota)}</p></details>` : ""}</div></li>
            ${p.a_peu_fins_seguent && i < N - 1 ? `<li class="walk" aria-hidden="false">${ic("walk")}<span>${esc(p.a_peu_fins_seguent)} a peu</span></li>` : ""}`;
        }).join("")}</ol>`;
      stagger($(".stops", day), ":scope > .stop", 8);
      if (pts.length && typeof L !== "undefined") {
        map = L.map("dmap", { zoomControl: false, attributionControl: false, scrollWheelZoom: false, dragging: !L.Browser.mobile || true });
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
        const ll = d.parades.map((p) => m.get(p.lloc)).filter((l) => l?.coords).map((l) => [l.coords.lat, l.coords.lng]);
        L.polyline(ll, { color: "#946a1c", weight: 3, dashArray: "2 8", lineCap: "round" }).addTo(map);
        d.parades.forEach((p, i) => {
          const l = m.get(p.lloc); if (!l?.coords) return;
          const k = L.marker([l.coords.lat, l.coords.lng], { icon: L.divIcon({ className: "mk-wrap", html: `<div class="mk num${done[doneKey(d, i, p.lloc)] ? " ok" : ""}">${i + 1}</div>`, iconSize: [30, 30], iconAnchor: [15, 15] }), title: l.nom, keyboard: false }).addTo(map);
          k.on("click", () => { const s = $("#stop" + i, day); s?.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "center" }); pop($(".s-card", s), "flash"); });
        });
        map.fitBounds(ll, { padding: [26, 26], maxZoom: 16 });
        map.__pts = d.parades.map((p) => m.get(p.lloc)?.coords);
      }
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
        const on = !!done[k]; vibe(on ? 12 : 6);
        const sc = window.scrollY; draw(); window.scrollTo(0, sc); const b = $$(".check", el)[i]; b?.focus({ preventScroll: true }); pop(b);
        if (on && Object.keys(done).filter((x) => x.startsWith(d.dia + ":")).length === d.parades.length) { vibe([14, 40, 14, 40, 26]); toast("Dia completat"); }
        return;
      }
      const loc = e.target.closest(".s-loc");
      if (loc && map) { const c = map.__pts?.[+loc.dataset.i]; if (c) { map.setView([c.lat, c.lng], 17, { animate: !reduced() }); $("#dmap", el).scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "center" }); } return; }
      if (e.target.closest("#reset")) {
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
    $(".tabs button[aria-selected='true']", el)?.scrollIntoView({ inline: "center", block: "nearest" });
  };
  return { html, mount, unmount: killMap, title: "Rutes", tab: "rutes" };
}

// ---------- Pràctic ----------
function fmtDate(iso) { const x = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); return x ? `${x[3]}/${x[2]}/${x[1]}` : iso || ""; }
const secIcon = (t) => { t = norm(t); return /entrad|reserv|bitllet/.test(t) ? "ticket" : /transport|metro|bus|tren|aeroport|arribar/.test(t) ? "routes" : /horari|calendari|setmana|tancament/.test(t) ? "calendar" : /diners|preu|pagament|pressupost/.test(t) ? "coin" : /menj|restaur|gastro/.test(t) ? "amphora" : /seguretat|salut|emergen/.test(t) ? "shield" : /vatic|esglesia|dress|roba/.test(t) ? "church" : "practical"; };
export async function practic() {
  const p = await getPractic();
  if (!p?.seccions?.length) return { html: missing("Pràctic"), title: "Pràctic", tab: "" };
  const html = `<div class="view-in"><header class="page-h"><h1>Pràctic</h1><span class="count">${p.seccions.reduce((n, s) => n + (s.items || []).length, 0)} consells</span></header>
    <div class="searchbox"><span class="s-ic">${ic("search")}</span><input id="pq" type="search" placeholder="Cerca: entrades, metro, Vaticà…" enterkeyhint="search" aria-label="Cerca als consells"></div>
    <div id="psecs">${p.seccions.map((s, si) => `<details class="acc sec-acc" data-s="${si}"${si === 0 ? " open" : ""}><summary>${ic(secIcon(s.titol))} ${esc(s.titol)} <span class="muted">${(s.items || []).length}</span></summary><div class="in">
      ${(s.items || []).map((it) => `<details class="acc item" data-h="${esc(norm([it.titol, it.text].join(" ")))}"><summary>${esc(it.titol)}</summary><div class="in"><div class="text">${paragraphs(it.text)}</div>
        <div class="checked">${it.font ? `Font: ${link(it.font, it.font.replace(/^https?:\/\//, "").split("/")[0])}` : `Font no indicada <mark class="val">[VALIDAR]</mark>`}${it.comprovat ? ` · Comprovat el ${esc(fmtDate(it.comprovat))}` : ""}</div></div></details>`).join("")}
    </div></details>`).join("")}</div><div id="pnone" class="empty" hidden>Cap consell coincideix.</div></div>`;
  const mount = (el) => {
    $("#pq", el).addEventListener("input", (e) => {
      const t = norm(e.target.value.trim()); let any = false;
      $$(".sec-acc", el).forEach((s) => {
        let n = 0; $$(".item", s).forEach((it) => { const hit = !t || it.dataset.h.includes(t); it.hidden = !hit; if (hit) n++; if (t && hit) it.open = false; });
        s.hidden = !n; if (n) any = true; if (t) s.open = !!n;
      });
      $("#pnone", el).hidden = any;
    });
  };
  return { html, mount, title: "Pràctic", tab: "" };
}
