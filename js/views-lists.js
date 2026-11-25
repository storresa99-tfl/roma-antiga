// Inici, llistat de llocs, museus, preferits, «a prop meu»
import { $, $$, esc, img, norm, TIPUS, PERIODES, distKm, fmtDist, store, inline, roman, placeThumb, commonsUrl } from "./util.js";
import { getLlocs, getCuriositats, getRutes, geo, locate } from "./data.js";
import { ic, tipusIc } from "./icons.js";
import { stagger, reduced, daySeed, seeded, vibe } from "./ui.js";

export const favs = {
  all: () => store.get("roma.fav", []),
  has: (id) => favs.all().includes(id),
  toggle(id) { const a = favs.all(); const i = a.indexOf(id); if (i >= 0) a.splice(i, 1); else a.push(id); store.set("roma.fav", a); return i < 0; },
};

export const thumbOf = placeThumb;

// Targeta de lloc: imatge gran amb placa d'inscripció. Retorna un <li>.
export function placeCard(l, withDist = true, href = `#/lloc/${encodeURIComponent(l.id)}`, extra = "") {
  const t = placeThumb(l);
  const d = withDist && geo.pos && l.coords ? distKm(geo.pos, l.coords) : null;
  return `<li class="pcard"><a class="pc" data-vt href="${href}">
    <div class="pc-img">${t ? img(t, "", 400, "vt-img") : `<div class="pc-none">${tipusIc(l.tipus, "ic-xl")}</div>`}</div>
    <span class="pc-type" title="${esc(TIPUS[l.tipus] || "")}">${tipusIc(l.tipus)}</span>
    ${d != null ? `<span class="pc-dist">${fmtDist(d)}</span>` : ""}
    <div class="pc-plate"><h3>${esc(l.nom)}</h3><div class="pc-meta">${esc(extra || [l.zona, l.datacio].filter(Boolean).join(" · "))}</div></div></a></li>`;
}

// ---------- Inici ----------
function daysUntil(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); if (!m) return null;
  const t = new Date(+m[1], +m[2] - 1, +m[3]), n = new Date(); n.setHours(0, 0, 0, 0);
  return Math.round((t - n) / 86400000);
}

export async function home() {
  const [llocs, rutes] = await Promise.all([getLlocs(), getRutes()]);
  const rnd = seeded(daySeed());
  const withImg = llocs.filter((l) => placeThumb(l) && l.tipus !== "museu");
  const pool = withImg.slice().sort(() => rnd() - 0.5).slice(0, 6);
  const slideOf = (l, i) => {
    const im = l.imatges?.galeria?.[0] || l.imatges?.despres || l.imatges?.abans; const f = im?.fitxer || placeThumb(l);
    return `<a class="hr-slide${i === 0 ? " on" : ""}" href="#/lloc/${encodeURIComponent(l.id)}" data-vt tabindex="${i === 0 ? 0 : -1}" aria-hidden="${i === 0 ? "false" : "true"}">
      <img class="im vt-img" src="${esc(commonsUrl(f, 1200))}" alt="" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
      <span class="hr-cap"><b>${esc(l.nom)}</b><i>${esc(l.nom_antic || l.datacio || "")}</i></span></a>`;
  };
  // Compte enrere / dia del viatge
  const dies = rutes?.dies || [];
  const d0 = dies[0] && daysUntil(dies[0].data);
  const todayIdx = dies.findIndex((d) => daysUntil(d.data) === 0);
  let plaque = "";
  if (todayIdx >= 0) plaque = `<a class="hr-plaque live" href="#/rutes/${dies[todayIdx].dia}"><span class="pl-n">${roman(todayIdx + 1)}</span><span>Avui, dia ${todayIdx + 1} del viatge<br><b>${esc(dies[todayIdx].titol || "")}</b></span></a>`;
  else if (d0 != null && d0 > 0) plaque = `<a class="hr-plaque" href="#/rutes"><span class="pl-n">${d0}</span><span>dies per a Roma<br><b>Setmana Santa 2027</b></span></a>`;

  const html = `<div class="view-in home">
    <section class="hero-rot" aria-roledescription="carrusel" aria-label="Llocs destacats">
      <div class="hr-stage">${pool.map(slideOf).join("") || `<div class="hr-empty">${ic("laurel", "ic-xl")}</div>`}</div>
            <div class="hr-top">${plaque}</div>
      <div class="hr-dots" role="tablist" aria-label="Tria un lloc">${pool.map((l, i) => `<button type="button" role="tab" aria-selected="${i === 0}" aria-label="${esc(l.nom)}" data-i="${i}"></button>`).join("")}</div>
    </section>
    <div class="searchbox over"><span class="s-ic">${ic("search")}</span><input id="q" type="search" placeholder="Cerca un lloc, una obra…" autocomplete="off" enterkeyhint="search" aria-label="Cerca"></div>
    <div id="res" class="results" aria-live="polite"></div>
    <section class="duo" aria-label="Passa l'estona">
      <a class="big-tile scrollt" href="#/scroll" data-press><span class="bt-ic">${ic("scroll", "ic-xl")}</span><b>Scroll</b><small>Curiositats, una darrere l'altra</small></a>
      <a class="big-tile jocst" href="#/jocs" data-press><span class="bt-ic">${ic("games", "ic-xl")}</span><b>Jocs</b><small>Quiz, mites i més</small></a>
    </section>
    <section id="repte" class="repte" aria-label="Repte ràpid" hidden></section>
    <section id="cur" class="cur-day" hidden></section>
    <a id="pass" class="pass-strip" href="#/passaport" data-press></a>
    <section class="near-sec" id="near"></section>
    <nav class="quick" aria-label="Més seccions">
      ${[["rutes", "Rutes", "routes"], ["cronologia", "Cronologia", "timeline"], ["museus", "Museus", "museum"], ["practic", "Pràctic", "practical"], ["preferits", "Preferits", "favorites"], ["ajustos", "Ajustos", "settings"]]
        .map(([h, t, i]) => `<a href="#/${h}" data-press>${ic(i, "ic-lg")}<span>${t}</span></a>`).join("")}
    </nav>
    ${llocs.length ? "" : `<div class="notice">Encara no hi ha dades de llocs. Executa <code>python3 scripts/build.py</code>.</div>`}
  </div>`;

  let timer = 0, onVis;
  const mount = async (el) => {
    // --- hero rotatiu ---
    const slides = $$(".hr-slide", el), dots = $$(".hr-dots button", el);
    let cur = 0;
    const show = (i) => {
      cur = (i + slides.length) % slides.length;
      slides.forEach((s, k) => { const on = k === cur; s.classList.toggle("on", on); s.setAttribute("aria-hidden", String(!on)); s.tabIndex = on ? 0 : -1; });
      dots.forEach((d, k) => d.setAttribute("aria-selected", String(k === cur)));
    };
    const play = () => { clearInterval(timer); if (slides.length > 1 && !reduced()) timer = setInterval(() => show(cur + 1), 6500); };
    dots.forEach((d) => d.addEventListener("click", () => { show(+d.dataset.i); play(); }));
    // lliscar sobre el hero
    const stage = $(".hero-rot", el); let x0 = null;
    stage?.addEventListener("pointerdown", (e) => { x0 = e.clientX; });
    stage?.addEventListener("pointerup", (e) => { if (x0 != null && Math.abs(e.clientX - x0) > 50) { show(cur + (e.clientX < x0 ? 1 : -1)); play(); e.target.closest("a")?.addEventListener("click", (ev) => ev.preventDefault(), { once: true }); } x0 = null; });
    play();
    onVis = () => { if (document.hidden) clearInterval(timer); else play(); };
    document.addEventListener("visibilitychange", onVis);
    stagger($(".duo", el), ":scope > *", 2);

    // --- cerca ---
    const q = $("#q", el), res = $("#res", el);
    q.addEventListener("input", () => {
      const t = norm(q.value.trim());
      if (t.length < 2) { res.innerHTML = ""; return; }
      const hits = [];
      for (const l of llocs) {
        const hay = norm([l.nom, l.nom_antic, l.zona, l.resum, TIPUS[l.tipus]].join(" "));
        if (hay.includes(t)) hits.push({ l, why: "" });
        else { const o = (l.obres || []).find((o) => norm(o.nom).includes(t)); if (o) hits.push({ l, why: `Obra: ${o.nom}` }); }
      }
      res.innerHTML = hits.length
        ? `<ul class="rows">${hits.slice(0, 8).map(({ l, why }) => `<li><a class="row-hit" href="#/lloc/${encodeURIComponent(l.id)}">${placeThumb(l) ? img(placeThumb(l), "", 400) : `<span class="rh-ic">${tipusIc(l.tipus)}</span>`}<span><b>${esc(l.nom)}</b><small>${esc(why || [TIPUS[l.tipus], l.zona].filter(Boolean).join(" · "))}</small></span></a></li>`).join("")}</ul>${hits.length > 8 ? `<p class="muted">… i ${hits.length - 8} més. <a href="#/llocs?q=${encodeURIComponent(q.value)}">Veure-ho tot</a></p>` : ""}`
        : `<div class="empty">Cap resultat per «${esc(q.value)}».</div>`;
    });

    // --- repte ràpid: una pregunta del quiz, sempre diferent ---
    try {
      const [{ getQuiz }, fx, P] = await Promise.all([import("./data-jocs.js"), import("./fx.js"), import("./progress.js")]);
      const qs = await getQuiz(); const box = $("#repte", el);
      if (qs.length > 3 && box) {
        const recent = []; let cur = null, done = false;
        const next = () => {
          let q; for (let k = 0; k < 20; k++) { q = qs[(Math.random() * qs.length) | 0]; if (!recent.includes(q.id)) break; }
          recent.push(q.id); if (recent.length > 8) recent.shift();
          const order = fx.shuffle(q.opcions.map((t, k) => ({ t, k }))); cur = { q, order }; done = false;
          box.innerHTML = `<div class="rp-head"><span class="rp-tag">${ic("sparkle")} Repte ràpid</span><span class="rp-xp">+10 XP</span></div>
            <h2 class="rp-q">${esc(q.pregunta)}</h2>
            <div class="rp-opts" role="group" aria-label="Respostes">${order.map((o, n) => `<button type="button" class="rp-opt" data-n="${n}"><span class="rp-k">${"ABCD"[n]}</span><span>${esc(o.t)}</span></button>`).join("")}</div>
            <div class="rp-fb" aria-live="polite"></div>`;
          box.hidden = false;
          if (!reduced()) box.animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 320, easing: "cubic-bezier(.23,1,.32,1)" });
        };
        box.addEventListener("click", (e) => {
          const again = e.target.closest(".rp-again"); if (again) { vibe(6); next(); return; }
          const b = e.target.closest(".rp-opt"); if (!b || done || !cur) return;
          done = true;
          const { q, order } = cur, n = +b.dataset.n, ok = order[n].k === q.correcta, btns = [...box.querySelectorAll(".rp-opt")];
          btns[order.findIndex((o) => o.k === q.correcta)].classList.add("ok");
          if (!ok) { b.classList.add("ko"); fx.shake(b); }
          btns.forEach((x) => { x.disabled = true; if (!x.classList.contains("ok") && x !== b) x.classList.add("gone"); });
          fx.feedback(ok ? "ok" : "ko"); if (ok) fx.pop(b, { scale: 1.04, ms: 280 });
          P.recordQuizAnswer(q.id, ok); P.addXP(ok ? 10 : 2, { silent: false });
          $(".rp-fb", box).innerHTML = `<p><b>${ok ? "Correcte!" : `Ups. Era «${esc(q.opcions[q.correcta])}».`}</b> ${inline(q.explicacio || "")}</p><button type="button" class="chip-btn rp-again">${ic("rotate")} Un altre repte</button>`;
        });
        next();
      }
    } catch (e) { console.warn("Repte ràpid:", e); }

    // --- curiositat del dia (i «Una altra» a voluntat) ---
    const cur$ = $("#cur", el);
    try {
      const { targetes = [] } = await getCuriositats();
      const ok = targetes.filter((t) => t.imatge?.fitxer && t.text);
      const pickOf = (t) => ({ titol: t.titol, text: t.text, f: t.imatge.fitxer, lloc: t.lloc });
      let c = null, shown = -1;
      if (ok.length) { shown = Math.floor(seeded(daySeed() + 7)() * ok.length); c = pickOf(ok[shown]); }
      else {
        const cands = llocs.filter((l) => l.curiositats?.length && placeThumb(l)); const l = cands[Math.floor(seeded(daySeed() + 7)() * cands.length)];
        if (l) c = { titol: l.nom, text: l.curiositats[Math.floor(seeded(daySeed() + 3)() * l.curiositats.length)], f: placeThumb(l), lloc: l.id };
      }
      const paint = (c, first) => {
        const lnk = c.lloc ? llocs.find((l) => l.id === c.lloc) : null;
        cur$.innerHTML = `<div class="cd-img">${img(c.f, "", 1200)}</div><div class="cd-body"><span class="cd-tag">${ic("sparkle")} ${first ? "Curiositat del dia" : "Una altra curiositat"}</span><h2>${esc(c.titol || "")}</h2><p>${inline(c.text)}</p>
          <div class="cd-act">${lnk ? `<a class="chip-btn" href="#/lloc/${encodeURIComponent(lnk.id)}">${tipusIc(lnk.tipus)} ${esc(lnk.nom)}</a>` : ""}${ok.length > 1 ? `<button type="button" class="chip-btn gold" id="cd-more">${ic("rotate")} Una altra</button>` : ""}<a class="chip-btn" href="#/scroll">${ic("scroll")} Scroll</a></div></div>`;
        if (!first && !reduced()) cur$.animate([{ opacity: 0.3, transform: "scale(.985)" }, { opacity: 1, transform: "none" }], { duration: 320, easing: "cubic-bezier(.23,1,.32,1)" });
      };
      if (c) {
        paint(c, true); cur$.hidden = false;
        cur$.addEventListener("click", (e) => {
          if (!e.target.closest("#cd-more")) return; vibe(6);
          let k; do { k = (Math.random() * ok.length) | 0; } while (k === shown && ok.length > 1); shown = k; paint(pickOf(ok[k]), false);
        });
      }
    } catch {}

    // --- passaport ---
    let visited = Object.keys((store.get("roma.progress", {}) || {}).checkins || {}).length, total = llocs.length, rankTxt = "";
    try {
      const p = await import("./progress.js"); await p.ready(); const s = await p.stats?.(); if (s) { visited = s.visited ?? visited; total = s.total ?? total; }
      const r = p.rankFor(p.xp()), days = p.get().streak.days; rankTxt = `${r.nom} · ${p.xp()} XP${days > 1 ? ` · ${days} dies seguits` : ""}`;
    } catch {}
    const frac = total ? visited / total : 0, C = 2 * Math.PI * 22;
    $("#pass", el).innerHTML = `<svg class="ring" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="22" class="rg-bg"/><circle cx="26" cy="26" r="22" class="rg-fg" style="stroke-dasharray:${(C * frac).toFixed(1)} ${C.toFixed(1)}"/></svg><span class="ps-ic">${ic("laurel", "ic-lg")}</span>
      <span class="ps-t"><b>Passaport</b><small>${rankTxt ? `${esc(rankTxt)}<br>` : ""}${visited} de ${total} llocs visitats</small></span><span class="ps-go">${ic("chevron-right")}</span>`;

    // --- a prop meu ---
    const near = $("#near", el);
    const drawNear = () => {
      if (!geo.pos) return;
      const a = llocs.filter((l) => l.coords).map((l) => [l, distKm(geo.pos, l.coords)]).sort((x, y) => x[1] - y[1]).slice(0, 6);
      near.innerHTML = `<div class="sec-h"><h2>A prop teu</h2><a href="#/a-prop">Tots</a></div><ul class="hscroll">${a.map(([l]) => placeCard(l, true).replace('<li class="pcard">', '<li class="pcard sm">')).join("")}</ul>`;
    };
    const ask = () => { near.innerHTML = `<div class="near-ask muted">${ic("locate")} Buscant la teva posició…</div>`; locate(() => { if (geo.pos) drawNear(); else near.innerHTML = `<div class="notice">${esc(geo.error || "No s'ha pogut obtenir la ubicació.")}</div>`; }); };
    if (geo.pos) drawNear();
    else {
      near.innerHTML = `<button class="near-btn" type="button">${ic("locate", "ic-lg")}<span><b>Què tinc a prop?</b><small>Ordena els llocs segons on ets</small></span></button>`;
      $(".near-btn", near).addEventListener("click", () => { vibe(8); ask(); });
      try { navigator.permissions?.query({ name: "geolocation" }).then((p) => { if (p.state === "granted") ask(); }).catch(() => {}); } catch {}
    }
  };
  return { html, mount, unmount: () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVis); }, title: "Roma Antiga", tab: "inici", cls: "hero" };
}

// ---------- Llocs ----------
export async function llocs(ctx, opts = {}) {
  const all = await getLlocs();
  const nearby = opts.nearby;
  const zones = [...new Set(all.map((l) => l.zona).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ca"));
  const tipus = [...new Set(all.map((l) => l.tipus).filter(Boolean))];
  const per = [...new Set(all.map((l) => l.periode).filter(Boolean))];
  const st = { q: ctx.params.q || "", zona: ctx.params.zona || "", tipus: ctx.params.tipus || "", periode: ctx.params.periode || "", ord: ctx.params.ord || (nearby ? "dist" : "nom") };
  const html = `<div class="view-in">
    <header class="page-h"><h1>${nearby ? "A prop meu" : "Llocs"}</h1><span class="count" id="count"></span></header>
    ${nearby ? `<div id="geomsg"></div>` : ""}
    <div class="searchbox"><span class="s-ic">${ic("search")}</span><input id="q" type="search" placeholder="Filtra per nom…" value="${esc(st.q)}" enterkeyhint="search" aria-label="Filtra per nom"></div>
    <div class="chips" id="c-tipus" role="group" aria-label="Tipus">
      <button type="button" class="chip-btn" data-v="" aria-pressed="${!st.tipus}">Tots</button>
      ${tipus.map((t) => `<button type="button" class="chip-btn" data-v="${esc(t)}" aria-pressed="${st.tipus === t}">${tipusIc(t)} ${esc(TIPUS[t] || t)}</button>`).join("")}</div>
    <div class="chips sm" id="c-per" role="group" aria-label="Període">
      <button type="button" class="chip-btn" data-v="" aria-pressed="${!st.periode}">Tots els temps</button>
      ${per.map((t) => `<button type="button" class="chip-btn" data-v="${esc(t)}" aria-pressed="${st.periode === t}">${esc(PERIODES[t] || t)}</button>`).join("")}</div>
    <div class="toolbar">
      <div class="seg" id="ord" role="group" aria-label="Ordena per"><button type="button" data-v="nom">Nom</button><button type="button" data-v="dist">${ic("locate")} Distància</button><button type="button" data-v="zona">Zona</button></div>
      <select id="f-zona" class="field zone-sel" aria-label="Zona"><option value="">Totes les zones</option>${zones.map((z) => `<option value="${esc(z)}"${z === st.zona ? " selected" : ""}>${esc(z)}</option>`).join("")}</select>
    </div>
    <ul class="pgrid" id="list"></ul>
  </div>`;
  const mount = (el) => {
    const list = $("#list", el), count = $("#count", el), gm = $("#geomsg", el);
    const sync = () => {
      const p = new URLSearchParams(); for (const k of ["q", "zona", "tipus", "periode", "ord"]) if (st[k] && !(k === "ord" && st[k] === (nearby ? "dist" : "nom"))) p.set(k, st[k]);
      try { history.replaceState(null, "", `#/${nearby ? "a-prop" : "llocs"}${p.toString() ? "?" + p : ""}`); } catch {}
    };
    const press = (box, key) => $$("button", box).forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.v ?? "") === st[key])));
    const draw = () => {
      let a = all.filter((l) =>
        (!st.zona || l.zona === st.zona) && (!st.tipus || l.tipus === st.tipus) && (!st.periode || l.periode === st.periode) &&
        (!st.q || norm([l.nom, l.nom_antic, l.zona, l.resum].join(" ")).includes(norm(st.q))));
      if (st.ord === "dist" && geo.pos) a.sort((x, y) => (x.coords ? distKm(geo.pos, x.coords) : 1e9) - (y.coords ? distKm(geo.pos, y.coords) : 1e9));
      else if (st.ord === "zona") a.sort((x, y) => (x.zona || "").localeCompare(y.zona || "", "ca") || x.nom.localeCompare(y.nom, "ca"));
      else a.sort((x, y) => x.nom.localeCompare(y.nom, "ca"));
      count.textContent = `${a.length} de ${all.length}`;
      list.innerHTML = a.length ? a.map((l) => placeCard(l)).join("") : `<li class="empty wide">Cap lloc amb aquests filtres.</li>`;
      stagger(list, ":scope > .pcard", 10);
      $$("#ord button", el).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === st.ord)));
      if (gm) gm.innerHTML = geo.pos ? "" : `<div class="notice">${esc(geo.error || "Cal permetre la ubicació per ordenar per distància.")}</div>`;
    };
    $("#q", el).addEventListener("input", (e) => { st.q = e.target.value; sync(); draw(); });
    $("#f-zona", el).addEventListener("change", (e) => { st.zona = e.target.value; sync(); draw(); });
    $("#c-tipus", el).addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; st.tipus = b.dataset.v; press($("#c-tipus", el), "tipus"); sync(); draw(); });
    $("#c-per", el).addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; st.periode = b.dataset.v; press($("#c-per", el), "periode"); sync(); draw(); });
    $("#ord", el).addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return; st.ord = b.dataset.v; sync();
      if (st.ord === "dist" && !geo.pos) { locate(draw); draw(); } else draw();
    });
    if ((nearby || st.ord === "dist") && !geo.pos) locate(draw);
    draw();
  };
  return { html, mount, title: nearby ? "A prop meu" : "Llocs", tab: nearby ? "inici" : "llocs" };
}

// ---------- Museus ----------
export async function museus() {
  const all = (await getLlocs()).filter((l) => l.tipus === "museu").sort((a, b) => a.nom.localeCompare(b.nom, "ca"));
  const html = `<div class="view-in"><header class="page-h"><h1>Museus</h1><span class="count">${all.length}</span></header>
    <ul class="pgrid">${all.map((l) => placeCard(l, false, `#/museu/${encodeURIComponent(l.id)}`, (l.obres || []).length ? `${l.obres.length} obres` : [l.zona, l.datacio].filter(Boolean).join(" · "))).join("") || `<li class="empty wide">Encara no hi ha museus a les dades.</li>`}</ul></div>`;
  return { html, mount: (el) => stagger($(".pgrid", el), ":scope > .pcard", 10), title: "Museus", tab: "llocs" };
}
export async function preferits() {
  const all = await getLlocs();
  const f = favs.all().map((id) => all.find((l) => l.id === id)).filter(Boolean);
  const html = `<div class="view-in"><header class="page-h"><h1>Preferits</h1><span class="count">${f.length || ""}</span></header>${f.length ? `<ul class="pgrid">${f.map((l) => placeCard(l)).join("")}</ul>` : `<div class="empty-state">${ic("favorites", "ic-xxl")}<p>Encara no tens cap preferit.</p><a class="btn" href="#/llocs">Explora els llocs</a></div>`}</div>`;
  return { html, mount: (el) => stagger($(".pgrid", el), ":scope > .pcard", 10), title: "Preferits", tab: "" };
}
