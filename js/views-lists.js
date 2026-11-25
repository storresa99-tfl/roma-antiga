// Inici, llistat de llocs, museus, preferits, "a prop meu"
import { $, $$, esc, img, norm, TIPUS, PERIODES, commonsUrl, distKm, fmtDist, store, inline } from "./util.js";
import { getLlocs, geo, locate } from "./data.js";

export const favs = {
  all: () => store.get("roma.fav", []),
  has: (id) => favs.all().includes(id),
  toggle(id) { const a = favs.all(); const i = a.indexOf(id); if (i >= 0) a.splice(i, 1); else a.push(id); store.set("roma.fav", a); return i < 0; },
};

export function thumbOf(l) {
  const im = l.imatges || {};
  return im.despres?.fitxer || im.abans?.fitxer || im.galeria?.[0]?.fitxer || l.obres?.find((o) => o.imatge)?.imatge || "";
}

export function placeCard(l, withDist = true) {
  const t = thumbOf(l);
  const d = withDist && geo.pos && l.coords ? distKm(geo.pos, l.coords) : null;
  return `<li><a class="place" href="#/lloc/${encodeURIComponent(l.id)}">
    ${t ? `<div class="thumb" role="img" aria-label="" style="background-image:url('${esc(commonsUrl(t, 400))}')"></div>` : ""}
    <div class="body${t ? "" : " nothumb"}">
      <h3>${esc(l.nom)}</h3>
      <div class="meta"><span class="chip t-${esc(l.tipus)}">${esc(TIPUS[l.tipus] || l.tipus || "")}</span>${esc(l.zona || "")}${l.datacio ? " · " + esc(l.datacio) : ""}${d != null ? ` · <span class="dist">${fmtDist(d)}</span>` : ""}</div>
      ${l.resum ? `<div class="sum">${inline(l.resum)}</div>` : ""}
    </div></a></li>`;
}

// ---------- Inici ----------
export async function home() {
  const llocs = await getLlocs();
  const html = `<div class="view-in">
    <div class="hero"><div class="eyebrow" style="color:#f0d27a">Viatge · Setmana Santa 2027</div><h1>Roma Antiga</h1><p>Monuments, museus, mapes i rutes per descobrir la ciutat dels cèsars. Funciona sense connexió.</p></div>
    <div class="searchbox"><input id="q" type="search" placeholder="Cerca un lloc, una obra, una zona…" autocomplete="off" aria-label="Cerca"></div>
    <div id="res" class="results" aria-live="polite"></div>
    <div class="grid">
      <a class="tile accent" href="#/a-prop"><span class="ico">◎</span><b>A prop meu</b><small>Llocs ordenats per distància</small></a>
      <a class="tile" href="#/llocs"><span class="ico">▥</span><b>Llocs</b><small>${llocs.length || "—"} fitxes amb història</small></a>
      <a class="tile" href="#/mapa"><span class="ico">⌖</span><b>Mapa</b><small>Tots els llocs i tu</small></a>
      <a class="tile" href="#/cronologia"><span class="ico">⌛</span><b>Cronologia</b><small>De la monarquia a l'Imperi</small></a>
      <a class="tile" href="#/rutes"><span class="ico">⇢</span><b>Rutes</b><small>6 dies, parada a parada</small></a>
      <a class="tile" href="#/museus"><span class="ico">🏛</span><b>Museus</b><small>Galeria d'obres</small></a>
      <a class="tile" href="#/practic"><span class="ico">ℹ</span><b>Pràctic</b><small>Entrades, horaris, consells</small></a>
      <a class="tile" href="#/preferits"><span class="ico">★</span><b>Preferits</b><small>El teu llistat</small></a>
    </div>
    ${llocs.length ? "" : `<div class="notice">Encara no hi ha dades de llocs. Executa <code>python3 scripts/build.py</code>.</div>`}
    <details class="acc"><summary>Com instal·lar-la al mòbil</summary><div class="in sans">
      <h3>Android (Chrome)</h3>
      <ol class="steps"><li>Obre aquesta adreça amb Chrome.</li><li>Toca el menú <b>⋮</b> (a dalt a la dreta).</li><li>Tria <b>Instal·la l'aplicació</b> (o <b>Afegeix a la pantalla d'inici</b>).</li><li>Confirma. Apareixerà la icona «Roma Antiga».</li></ol>
      <h3>iPhone (Safari)</h3>
      <ol class="steps"><li>Obre l'adreça amb <b>Safari</b> (no funciona des d'altres navegadors).</li><li>Toca el botó <b>Comparteix</b> (quadrat amb fletxa amunt).</li><li>Baixa i tria <b>Afegeix a la pantalla d'inici</b>.</li><li>Toca <b>Afegeix</b>.</li></ol>
      <p class="muted">Després, a <a href="#/ajustos">Ajustos</a> pots descarregar-ho tot per usar-la sense connexió (a Roma, sense dades mòbils).</p>
    </div></details>
  </div>`;
  const mount = (el) => {
    const q = $("#q", el), res = $("#res", el);
    q.addEventListener("input", () => {
      const t = norm(q.value.trim());
      if (t.length < 2) { res.innerHTML = ""; return; }
      const hits = [];
      for (const l of llocs) {
        const hay = norm([l.nom, l.nom_antic, l.zona, l.resum, TIPUS[l.tipus]].join(" "));
        if (hay.includes(t)) hits.push({ l, why: "" });
        else {
          const o = (l.obres || []).find((o) => norm(o.nom).includes(t));
          if (o) hits.push({ l, why: `Obra: ${o.nom}` });
        }
      }
      res.innerHTML = hits.length
        ? `<ul class="card-list">${hits.slice(0, 8).map(({ l, why }) => placeCard(l, false).replace("</div></a></li>", `${why ? `<div class="meta">${esc(why)}</div>` : ""}</div></a></li>`)).join("")}</ul>${hits.length > 8 ? `<p class="muted">… i ${hits.length - 8} més. <a href="#/llocs?q=${encodeURIComponent(q.value)}">Veure-ho tot</a></p>` : ""}`
        : `<div class="empty">Cap resultat per «${esc(q.value)}».</div>`;
    });
  };
  return { html, mount, title: "Roma Antiga", tab: "inici" };
}

// ---------- Llocs ----------
export async function llocs(ctx, opts = {}) {
  const all = await getLlocs();
  const nearby = opts.nearby;
  const zones = [...new Set(all.map((l) => l.zona).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ca"));
  const tipus = [...new Set(all.map((l) => l.tipus).filter(Boolean))];
  const per = [...new Set(all.map((l) => l.periode).filter(Boolean))];
  const st = { q: ctx.params.q || "", zona: ctx.params.zona || "", tipus: ctx.params.tipus || "", periode: ctx.params.periode || "", ord: ctx.params.ord || (nearby ? "dist" : "nom") };
  const opt = (v, t, sel) => `<option value="${esc(v)}"${sel ? " selected" : ""}>${esc(t)}</option>`;
  const html = `<div class="view-in">
    <h1>${nearby ? "A prop meu" : "Llocs"}</h1>
    ${nearby ? `<p class="lead">Llocs ordenats per distància respecte a la teva posició.</p><div id="geomsg"></div>` : ""}
    <div class="searchbox"><input id="q" type="search" placeholder="Filtra per nom…" value="${esc(st.q)}" aria-label="Filtra per nom"></div>
    <div class="filters">
      <select id="f-zona" aria-label="Zona"><option value="">Totes les zones</option>${zones.map((z) => opt(z, z, z === st.zona)).join("")}</select>
      <select id="f-tipus" aria-label="Tipus"><option value="">Tots els tipus</option>${tipus.map((t) => opt(t, TIPUS[t] || t, t === st.tipus)).join("")}</select>
      <select id="f-per" aria-label="Període"><option value="">Tots els períodes</option>${per.map((t) => opt(t, PERIODES[t] || t, t === st.periode)).join("")}</select>
    </div>
    <div class="toolbar"><label class="muted" for="ord">Ordena per</label>
      <select id="ord" class="field" style="width:auto" aria-label="Ordre"><option value="nom"${st.ord === "nom" ? " selected" : ""}>Nom</option><option value="dist"${st.ord === "dist" ? " selected" : ""}>Distància</option><option value="zona"${st.ord === "zona" ? " selected" : ""}>Zona</option></select>
      <button class="btn ghost small" id="gps" type="button">◎ Usa la meva ubicació</button>
      <span class="muted" id="count"></span></div>
    <ul class="card-list" id="list"></ul>
  </div>`;
  const mount = (el) => {
    const list = $("#list", el), count = $("#count", el), gm = $("#geomsg", el);
    const draw = () => {
      let a = all.filter((l) =>
        (!st.zona || l.zona === st.zona) && (!st.tipus || l.tipus === st.tipus) && (!st.periode || l.periode === st.periode) &&
        (!st.q || norm([l.nom, l.nom_antic, l.zona, l.resum].join(" ")).includes(norm(st.q))));
      if (st.ord === "dist" && geo.pos) a.sort((x, y) => (x.coords ? distKm(geo.pos, x.coords) : 1e9) - (y.coords ? distKm(geo.pos, y.coords) : 1e9));
      else if (st.ord === "zona") a.sort((x, y) => (x.zona || "").localeCompare(y.zona || "", "ca") || x.nom.localeCompare(y.nom, "ca"));
      else a.sort((x, y) => x.nom.localeCompare(y.nom, "ca"));
      count.textContent = `${a.length} de ${all.length}`;
      list.innerHTML = a.length ? a.map((l) => placeCard(l)).join("") : `<li class="empty">Cap lloc amb aquests filtres.</li>`;
      if (gm) gm.innerHTML = geo.pos ? "" : `<div class="notice">${esc(geo.error || "Cal permetre la ubicació per ordenar per distància.")}</div>`;
      if (st.ord === "dist" && !geo.pos && !gm) count.textContent += " · sense ubicació (ordre per nom)";
    };
    const sync = () => {
      const p = new URLSearchParams(); for (const k of ["q", "zona", "tipus", "periode", "ord"]) if (st[k] && !(k === "ord" && st[k] === (nearby ? "dist" : "nom"))) p.set(k, st[k]);
      try { history.replaceState(null, "", `#/${nearby ? "a-prop" : "llocs"}${p.toString() ? "?" + p : ""}`); } catch {}
    };
    const bind = (sel, key) => $(sel, el).addEventListener("input", (e) => { st[key] = e.target.value; sync(); draw(); });
    bind("#q", "q"); bind("#f-zona", "zona"); bind("#f-tipus", "tipus"); bind("#f-per", "periode");
    $("#ord", el).addEventListener("change", (e) => {
      st.ord = e.target.value; sync();
      if (st.ord === "dist" && !geo.pos) locate(draw); else draw();
    });
    $("#gps", el).addEventListener("click", () => { st.ord = "dist"; $("#ord", el).value = "dist"; sync(); locate(draw); });
    if ((nearby || st.ord === "dist") && !geo.pos) locate(draw);
    draw();
  };
  return { html, mount, title: nearby ? "A prop meu" : "Llocs", tab: nearby ? "inici" : "llocs" };
}

// ---------- Museus ----------
export async function museus() {
  const all = (await getLlocs()).filter((l) => l.tipus === "museu").sort((a, b) => a.nom.localeCompare(b.nom, "ca"));
  const html = `<div class="view-in"><h1>Museus</h1><p class="lead">Col·leccions per mirar abans d'entrar-hi: obres destacades i què cal buscar.</p>
    <ul class="card-list">${all.map((l) => placeCard(l, false).replace("href=\"#/lloc/", "href=\"#/museu/").replace("</div></a></li>", `<div class="meta">${(l.obres || []).length} obres destacades</div></div></a></li>`)).join("") || `<li class="empty">Encara no hi ha museus a les dades.</li>`}</ul></div>`;
  return { html, title: "Museus", tab: "llocs" };
}
export async function preferits() {
  const all = await getLlocs();
  const f = favs.all().map((id) => all.find((l) => l.id === id)).filter(Boolean);
  const html = `<div class="view-in"><h1>Preferits</h1>${f.length ? `<ul class="card-list">${f.map((l) => placeCard(l)).join("")}</ul>` : `<div class="empty">Encara no tens cap preferit.<br>Toca l'estrella ★ d'una fitxa per afegir-lo.</div>`}</div>`;
  return { html, title: "Preferits", tab: "inici" };
}
