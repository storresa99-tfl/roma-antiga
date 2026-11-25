// Fitxa de lloc i fitxa de museu (galeria d'obres)
import { $, esc, img, zoomImg, lbAttrs, creditLine, inline, paragraphs, hasValidar, link, safeUrl, TIPUS, PERIODES, mapsPlace, commonsUrl, toast } from "./util.js";
import { getLlocs } from "./data.js";
import { compareHTML, initCompare } from "./compare.js";
import { favs } from "./views-lists.js";

function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso || "";
}
const list = (arr) => `<ul class="dots">${arr.map((x) => `<li>${inline(x)}</li>`).join("")}</ul>`;

function practicHTML(p) {
  if (!p) return "";
  const rows = [["Horari", "horari"], ["Preu", "preu"], ["Reserva", "reserva"], ["Entrada combinada", "entrada_combinada"], ["Consell", "consell"]];
  const sant = p.setmana_santa_2027;
  const santRow = `<div class="row sant"><dt>Setmana Santa 2027 (21–26/3)</dt><dd>${sant ? inline(sant) : `Sense informació confirmada <mark class="val">[VALIDAR]</mark>`}</dd></div>`;
  return `<div class="practic"><dl>
    ${santRow}
    ${rows.filter(([, k]) => p[k]).map(([t, k]) => `<div class="row"><dt>${t}</dt><dd>${inline(p[k])}</dd></div>`).join("")}
    ${p.web ? `<div class="row"><dt>Web oficial</dt><dd>${link(p.web, p.web.replace(/^https?:\/\//, "").replace(/\/$/, ""))}</dd></div>` : ""}
  </dl>${p.comprovat ? `<p class="checked">Dades comprovades el <b>${esc(fmtDate(p.comprovat))}</b>. Torna-ho a mirar a la web oficial abans d'anar-hi.</p>` : `<p class="checked">Data de comprovació no indicada <mark class="val">[VALIDAR]</mark></p>`}</div>`;
}

function obraCard(o, nom) {
  return `<article class="work">${o.imatge ? zoomImg(o.imatge, o.nom, o.nom, [o.datacio, o.on].filter(Boolean).join(" · ") + (o.text ? "\n" + o.text : ""), o.credit, "", 1200).replace(/src="[^"]*"/, `src="${esc(commonsUrl(o.imatge, 400))}"`) : ""}
    <div class="wb"><h3>${esc(o.nom)}</h3><div class="muted">${esc([o.datacio, o.on].filter(Boolean).join(" · "))}</div>
    ${o.text ? `<p>${inline(o.text)}</p>` : ""}${o.credit ? `<div class="credit">${esc(o.credit)} · Wikimedia Commons</div>` : ""}</div></article>`;
}

export async function lloc(ctx) {
  const all = await getLlocs();
  const l = all.find((x) => x.id === ctx.id);
  if (!l) return { html: `<div class="view-in"><h1>Lloc no trobat</h1><p>No existeix cap fitxa amb l'id «${esc(ctx.id)}».</p><a class="btn" href="#/llocs">Veure tots els llocs</a></div>`, title: "No trobat", tab: "llocs" };
  const im = l.imatges || {};
  const hero = im.galeria?.[0] || im.despres || im.abans;
  const isFav = favs.has(l.id);
  const rel = (l.relacionats || []).map((id) => all.find((x) => x.id === id)).filter(Boolean);
  const html = `<article class="view-in">
    <div class="detail-hero">${hero?.fitxer ? zoomImg(hero.fitxer, hero.descripcio || l.nom, l.nom, hero.descripcio, hero.credit, hero.llicencia) + creditLine(hero.credit, hero.llicencia) : `<div class="ph">Sense imatge</div>`}</div>
    <div class="title-row"><div><h1>${esc(l.nom)}</h1>${l.nom_antic ? `<p class="subtitle">${esc(l.nom_antic)}</p>` : ""}</div>
      <button class="fav" id="fav" aria-pressed="${isFav}" aria-label="${isFav ? "Treu dels preferits" : "Afegeix als preferits"}">${isFav ? "★" : "☆"}</button></div>
    <div class="facts"><span class="chip t-${esc(l.tipus)}">${esc(TIPUS[l.tipus] || l.tipus || "")}</span>
      ${l.zona ? `<span>📍 ${esc(l.zona)}</span>` : ""}${l.datacio ? `<span>🗓 ${esc(l.datacio)}</span>` : ""}${l.epoca ? `<span>${esc(l.epoca)}${l.periode && PERIODES[l.periode] ? "" : ""}</span>` : ""}${l.temps_visita ? `<span>⏱ ${esc(l.temps_visita)}</span>` : ""}</div>
    <div class="actions">
      ${l.coords ? `<a class="btn" href="${esc(mapsPlace(l.coords))}" target="_blank" rel="noopener noreferrer">➜ Com arribar-hi</a><a class="btn ghost" href="#/mapa?lloc=${encodeURIComponent(l.id)}">⌖ Al mapa</a>` : ""}
      ${l.tipus === "museu" ? `<a class="btn ghost" href="#/museu/${encodeURIComponent(l.id)}">🏛 Galeria d'obres</a>` : ""}
    </div>
    ${l.resum ? `<p class="lead">${inline(l.resum)}</p>` : ""}
    ${compareHTML(im, l.nom)}
    ${l.historia ? `<h2>Història</h2><div class="text">${paragraphs(l.historia)}</div>` : ""}
    ${l.curiositats?.length ? `<h2>Curiositats</h2>${list(l.curiositats)}` : ""}
    ${l.que_mirar?.length ? `<h2>Què mirar</h2>${list(l.que_mirar)}` : ""}
    ${l.obres?.length ? `<h2>Obres</h2><div class="works" data-lbgroup>${l.obres.map((o) => obraCard(o, l.nom)).join("")}</div>` : ""}
    ${im.galeria?.length > 1 ? `<h2>Galeria</h2><div class="gallery" data-lbgroup>${im.galeria.map((g) => `<figure>${zoomImg(g.fitxer, g.descripcio || l.nom, l.nom, g.descripcio, g.credit, g.llicencia, 1200).replace(/src="[^"]*"/, `src="${esc(commonsUrl(g.fitxer, 400))}"`)}<figcaption>${esc(g.descripcio || "")}${creditLine(g.credit, g.llicencia)}</figcaption></figure>`).join("")}</div>` : ""}
    ${l.practic ? `<h2>Pràctic</h2>${practicHTML(l.practic)}` : ""}
    ${rel.length ? `<h2>Relacionats</h2><div class="rel">${rel.map((r) => `<a href="#/lloc/${encodeURIComponent(r.id)}">${esc(r.nom)}</a>`).join("")}</div>` : ""}
    ${l.fonts?.length ? `<h2>Fonts</h2><ul class="sources">${l.fonts.map((f) => `<li>${link(f.url, f.titol || f.url)}</li>`).join("")}</ul>` : ""}
    ${l.validar?.length ? `<details class="acc" style="margin-top:20px"><summary>Pendent de confirmar (${l.validar.length})</summary><div class="in">${list(l.validar)}</div></details>` : ""}
  </article>`;
  const mount = (el) => {
    initCompare(el);
    const b = $("#fav", el);
    b.addEventListener("click", () => {
      const on = favs.toggle(l.id);
      b.setAttribute("aria-pressed", on); b.textContent = on ? "★" : "☆";
      b.setAttribute("aria-label", on ? "Treu dels preferits" : "Afegeix als preferits");
      toast(on ? "Afegit als preferits" : "Tret dels preferits");
    });
  };
  return { html, mount, title: l.nom, tab: "llocs" };
}

export async function museu(ctx) {
  const all = await getLlocs();
  const l = all.find((x) => x.id === ctx.id);
  if (!l) return { html: `<div class="view-in"><h1>Museu no trobat</h1><a class="btn" href="#/museus">Veure els museus</a></div>`, title: "No trobat", tab: "llocs" };
  const obres = l.obres || [];
  const html = `<div class="view-in"><h1>${esc(l.nom)}</h1><p class="lead">${inline(l.resum || "")}</p>
    <div class="actions"><a class="btn" href="#/lloc/${encodeURIComponent(l.id)}">Fitxa completa i pràctic</a></div>
    <h2>Obres destacades (${obres.length})</h2>
    ${obres.length ? `<div class="art-grid" data-lbgroup>${obres.map((o) => `<button type="button" class="art-card" ${lbAttrs(o.imatge || "", o.nom, [o.datacio, o.on].filter(Boolean).join(" · ") + (o.text ? "\n" + o.text : ""), o.credit, "")}>
      ${o.imatge ? img(o.imatge, o.nom, 400) : ""}<div class="ab"><b>${esc(o.nom)}</b>${esc([o.datacio, o.on].filter(Boolean).join(" · "))}</div></button>`).join("")}</div>` : `<div class="empty">Aquest museu encara no té obres a les dades.</div>`}
  </div>`;
  return { html, title: l.nom, tab: "llocs" };
}
