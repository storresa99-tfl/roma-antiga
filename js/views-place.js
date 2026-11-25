// Fitxa de lloc (hero amb parallax, xips, «En 30 segons», comparador, història en capítols, què mirar, curiositats que giren, galeria) i fitxa de museu
import { $, $$, esc, img, zoomImg, lbAttrs, creditLine, inline, paragraphs, link, TIPUS, PERIODES, mapsPlace, commonsUrl, toast, store, roman, distKm, fmtDist, firstSentence } from "./util.js";
import { getLlocs, geo } from "./data.js";
import { compareHTML, initCompare } from "./compare.js";
import { favs, placeCard } from "./views-lists.js";
import { ic, tipusIc } from "./icons.js";
import { vibe, pop, parallax, carouselIndex, reduced } from "./ui.js";
import { openGallery } from "./lightbox.js";

function fmtDate(iso) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); return m ? `${m[3]}/${m[2]}/${m[1]}` : iso || ""; }

function practicHTML(p) {
  if (!p) return "";
  const rows = [["Horari", "horari", "clock"], ["Preu", "preu", "ticket"], ["Reserva", "reserva", "calendar"], ["Entrada combinada", "entrada_combinada", "ticket"], ["Consell", "consell", "sparkle"]];
  const sant = p.setmana_santa_2027;
  return `<div class="practic"><dl>
    <div class="row sant"><dt>${ic("calendar")} Setmana Santa 2027 (21–26/3)</dt><dd>${sant ? inline(sant) : `Sense informació confirmada <mark class="val">[VALIDAR]</mark>`}</dd></div>
    ${rows.filter(([, k]) => p[k]).map(([t, k, i]) => `<div class="row"><dt>${ic(i)} ${t}</dt><dd>${inline(p[k])}</dd></div>`).join("")}
    ${p.web ? `<div class="row"><dt>${ic("share")} Web oficial</dt><dd>${link(p.web, p.web.replace(/^https?:\/\//, "").replace(/\/$/, ""))}</dd></div>` : ""}
  </dl>${p.comprovat ? `<p class="checked">Dades comprovades el <b>${esc(fmtDate(p.comprovat))}</b>. Torna-ho a mirar a la web oficial abans d'anar-hi.</p>` : `<p class="checked">Data de comprovació no indicada <mark class="val">[VALIDAR]</mark></p>`}</div>`;
}

// ---- Check-in (usa progress.js si existeix; si no, desa a roma.progress) ----
async function doCheckIn(l) {
  let p = null; try { p = await import("./progress.js"); } catch {}
  if (p?.checkIn) return p.checkIn(l.id, { gps: true });
  return new Promise((res) => {
    if (!navigator.geolocation) return res({ ok: false, error: "El dispositiu no ofereix geolocalització." });
    navigator.geolocation.getCurrentPosition((g) => {
      const d = distKm({ lat: g.coords.latitude, lng: g.coords.longitude }, l.coords) * 1000;
      if (d > 150) return res({ ok: false, distM: Math.round(d) });
      res(save(l.id));
    }, () => res({ ok: false, error: "No s'ha pogut obtenir la ubicació (cal permís)." }), { enableHighAccuracy: true, timeout: 15000 });
  });
}
function save(id) { const s = store.get("roma.progress", {}) || {}; s.checkins = s.checkins || {}; const already = !!s.checkins[id]; if (!already) s.checkins[id] = Date.now(); store.set("roma.progress", s); return { ok: true, already }; }
async function manualCheckIn(l) { try { const p = await import("./progress.js"); if (p?.checkIn) return p.checkIn(l.id, { gps: false }); } catch {} return save(l.id); }
async function isVisited(id) { try { const p = await import("./progress.js"); if (p?.isVisited) return !!p.isVisited(id); } catch {} return !!((store.get("roma.progress", {}) || {}).checkins || {})[id]; }

const MIRAR = "roma.mirar";

export async function lloc(ctx) {
  const all = await getLlocs();
  const l = all.find((x) => x.id === ctx.id);
  if (!l) return { html: `<div class="view-in"><h1>Lloc no trobat</h1><p>No existeix cap fitxa amb l'id «${esc(ctx.id)}».</p><a class="btn" href="#/llocs">Veure tots els llocs</a></div>`, title: "No trobat", tab: "llocs" };
  const im = l.imatges || {};
  // Pool d'imatges úniques (hero, capítols, curiositats, galeria)
  const seen = new Set(), pool = [];
  for (const x of [im.galeria?.[0], im.despres, im.abans, ...(im.galeria || []), ...(l.obres || []).filter((o) => o.imatge).map((o) => ({ fitxer: o.imatge, descripcio: o.nom, credit: o.credit }))]) {
    if (x?.fitxer && !seen.has(x.fitxer)) { seen.add(x.fitxer); pool.push(x); }
  }
  const hero = pool[0];
  const isFav = favs.has(l.id);
  const rel = (l.relacionats || []).map((id) => all.find((x) => x.id === id)).filter(Boolean);
  const p = l.practic || {};
  const short = (s, n) => (s && s.length <= n ? s : "");
  const preu = short(p.preu, 34), reserva = short(p.reserva, 28);
  const chip = (icn, txt, cls = "") => `<li class="fact ${cls}">${ic(icn)}<span>${esc(txt)}</span></li>`;
  const facts = [
    l.datacio && chip("calendar", l.datacio.replace(/\s*\(.*$/, "")),
    l.temps_visita && chip("clock", l.temps_visita),
    preu ? chip("ticket", preu) : p.preu ? `<li class="fact link" data-open="prac">${ic("ticket")}<span>Preus i entrades</span></li>` : "",
    reserva ? chip("lock", `Reserva ${reserva.toLowerCase().replace(/^reserva\s*/, "")}`, /oblig/i.test(reserva) ? "warn" : "") : "",
    l.zona && chip("pin", l.zona),
  ].filter(Boolean);

  const caps = (l.historia || "").split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  const imgFor = (i, off = 1) => (pool.length > 1 ? pool[(i + off) % pool.length] : pool[0]);
  const chapHTML = caps.map((t, i) => {
    const g = pool.length ? imgFor(i, 1) : null;
    const long = t.length > 430;
    return `<article class="chap" id="ch${i}"><div class="ch-n" aria-hidden="true">${roman(i + 1)}</div>
      ${g ? `<div class="ch-img">${zoomImg(g.fitxer, g.descripcio || l.nom, l.nom, g.descripcio, g.credit, g.llicencia, 400).replace(/src="[^"]*"/, `src="${esc(commonsUrl(g.fitxer, 800))}"`)}</div>` : ""}
      <div class="ch-t${long ? " clamp" : ""}"><p>${inline(t)}</p></div>${long ? `<button type="button" class="more" aria-expanded="false">Llegeix-ne més</button>` : ""}</article>`;
  }).join("");

  const curs = l.curiositats || [];
  const flips = curs.map((c, i) => {
    const g = pool.length ? imgFor(i, 2) : null;
    const tease = String(c).replace(/\*\*/g, "").split(/\s+/).slice(0, 5).join(" ") + "…";
    return `<button type="button" class="flip" aria-pressed="false" aria-label="Curiositat ${i + 1}. Toca per girar la carta">
      <span class="f-in"><span class="f-front">${g ? img(g.fitxer, "", 400) : ""}<span class="f-shade"></span><span class="f-n">${roman(i + 1)}</span><span class="f-tease">${esc(tease)}</span><span class="f-hint">${ic("rotate")}</span></span>
      <span class="f-back"><span class="f-n">${roman(i + 1)}</span><span class="f-txt">${inline(c)}</span></span></span></button>`;
  }).join("");

  const mirar = l.que_mirar || [];
  const done = new Set((store.get(MIRAR, {}) || {})[l.id] || []);
  const lookHTML = mirar.map((t, i) => `<li><button type="button" class="lk" data-i="${i}" aria-pressed="${done.has(i)}"><span class="lk-box">${ic("check")}</span><span class="lk-t">${inline(t)}</span></button></li>`).join("");

  const cmp = (im.abans?.fitxer && im.despres?.fitxer) || im.abans?.fitxer ? compareHTML(im, l.nom) : "";
  const gal = im.galeria || [];
  const html = `<article class="view-in place">
    <header class="p-hero" id="phero">
      ${hero ? `<img class="im vt-img" style="view-transition-name:hero" src="${esc(commonsUrl(hero.fitxer, 1200))}" alt="${esc(hero.descripcio || l.nom)}" fetchpriority="high" decoding="async">` : `<div class="p-hero-none">${tipusIc(l.tipus, "ic-xxl")}</div>`}
      <div class="p-shade"></div>
      <button class="fav" id="fav" type="button" aria-pressed="${isFav}" aria-label="${isFav ? "Treu dels preferits" : "Afegeix als preferits"}">${ic(isFav ? "star-fill" : "favorites")}</button>
      ${pool.length > 1 ? `<button class="p-photos" id="photos" type="button" aria-label="Veure les ${pool.length} imatges">${ic("image")} ${pool.length}</button>` : ""}
      <div class="p-title"><span class="p-type">${tipusIc(l.tipus)} ${esc(TIPUS[l.tipus] || l.tipus || "")}${l.periode && PERIODES[l.periode] ? ` · ${esc(PERIODES[l.periode])}` : ""}</span>
        <h1>${esc(l.nom)}</h1>${l.nom_antic ? `<p class="subtitle">${esc(l.nom_antic)}</p>` : ""}</div>
    </header>
    <ul class="facts" aria-label="Dades clau">${facts.join("")}</ul>
    <div class="p-actions">
      <button class="btn checkin" id="ci" type="button" ${l.coords ? "" : "disabled"}><span class="ci-ic">${ic("flag")}</span><span class="ci-t">Hi sóc</span></button>
      ${l.coords ? `<a class="btn ghost" href="${esc(mapsPlace(l.coords))}" target="_blank" rel="noopener noreferrer">${ic("routes")} Com arribar-hi</a><a class="btn ghost sq" href="#/mapa?lloc=${encodeURIComponent(l.id)}" aria-label="Veure al mapa">${ic("map")}</a>` : ""}
      ${l.tipus === "museu" ? `<a class="btn ghost" href="#/museu/${encodeURIComponent(l.id)}">${ic("museum")} Obres</a>` : ""}
    </div>
    <div id="ci-msg" class="ci-msg" role="status" aria-live="polite"></div>
    ${l.resum ? `<section class="s30"><h2>${ic("clock")} En 30 segons</h2><p>${inline(l.resum)}</p></section>` : ""}
    ${cmp ? `<section class="cmp-sec"><h2>${im.abans?.fitxer && im.despres?.fitxer ? "Abans i després" : "Com era"}</h2>${cmp}</section>` : ""}
    ${caps.length ? `<section class="sec"><h2>Història</h2><div class="chap-track" id="chaps" data-lbgroup>${chapHTML}</div>
      ${caps.length > 1 ? `<div class="chap-nav" id="chapnav" role="group" aria-label="Capítols">${caps.map((_, i) => `<button type="button" data-i="${i}" aria-label="Capítol ${i + 1}" aria-current="${i === 0}">${roman(i + 1)}</button>`).join("")}</div>` : ""}</section>` : ""}
    ${mirar.length ? `<section class="sec"><div class="sec-h"><h2>Què mirar</h2><span class="tally" id="tally"></span></div><div class="progress thin" aria-hidden="true"><i id="tbar"></i></div><ul class="look" id="look">${lookHTML}</ul></section>` : ""}
    ${curs.length ? `<section class="sec"><div class="sec-h"><h2>Curiositats</h2><span class="muted">Toca una carta</span></div><div class="hscroll flips" id="flips">${flips}</div></section>` : ""}
    ${l.obres?.length ? `<section class="sec"><div class="sec-h"><h2>Obres</h2><span class="muted">${l.obres.length}</span></div><div class="hscroll works" data-lbgroup>${l.obres.map((o) => `<button type="button" class="art" ${lbAttrs(o.imatge || "", o.nom, [o.datacio, o.on].filter(Boolean).join(" · ") + (o.text ? "\n" + o.text : ""), o.credit, "")}>${o.imatge ? img(o.imatge, o.nom, 400) : ""}<span class="art-p"><b>${esc(o.nom)}</b><small>${esc(o.datacio || "")}</small></span></button>`).join("")}</div></section>` : ""}
    ${gal.length > 1 ? `<section class="sec"><div class="sec-h"><h2>Galeria</h2><span class="muted">${gal.length}</span></div><div class="mosaic" data-lbgroup>${gal.map((g) => `<figure>${zoomImg(g.fitxer, g.descripcio || l.nom, l.nom, g.descripcio, g.credit, g.llicencia, 400).replace(/src="[^"]*"/, `src="${esc(commonsUrl(g.fitxer, 400))}"`)}</figure>`).join("")}</div></section>` : ""}
    ${l.practic ? `<details class="acc prac" id="prac"><summary>${ic("ticket")} Horari, preu i reserva</summary><div class="in">${practicHTML(l.practic)}</div></details>` : ""}
    ${rel.length ? `<section class="sec"><div class="sec-h"><h2>Relacionats</h2></div><ul class="hscroll">${rel.map((r) => placeCard(r, false).replace('<li class="pcard">', '<li class="pcard sm">')).join("")}</ul></section>` : ""}
    ${l.fonts?.length ? `<details class="acc"><summary>${ic("scroll")} Fonts (${l.fonts.length})</summary><div class="in"><ul class="sources">${l.fonts.map((f) => `<li>${link(f.url, f.titol || f.url)}</li>`).join("")}</ul></div></details>` : ""}
    ${l.validar?.length ? `<details class="acc"><summary>Pendent de confirmar (${l.validar.length})</summary><div class="in"><ul class="dots">${l.validar.map((x) => `<li>${inline(x)}</li>`).join("")}</ul></div></details>` : ""}
  </article>`;

  let offs = [];
  const mount = async (el) => {
    const hero = $("#phero", el); if (hero) offs.push(parallax(hero));
    initCompare(el);
    // preferit
    const fb = $("#fav", el);
    fb.addEventListener("click", () => {
      const on = favs.toggle(l.id);
      fb.setAttribute("aria-pressed", on); fb.innerHTML = ic(on ? "star-fill" : "favorites"); pop(fb); vibe(on ? [10, 30, 10] : 8);
      fb.setAttribute("aria-label", on ? "Treu dels preferits" : "Afegeix als preferits");
      toast(on ? "Afegit als preferits" : "Tret dels preferits");
    });
    $("#photos", el)?.addEventListener("click", () => openGallery(pool.map((g) => ({ file: g.fitxer, title: l.nom, text: g.descripcio || "", credit: [g.credit, g.llicencia].filter(Boolean).join(" · ") })), 0));
    $$("[data-open]", el).forEach((b) => b.addEventListener("click", () => { const d = $("#prac", el); if (d) { d.open = true; d.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "center" }); } }));

    // check-in
    const ci = $("#ci", el), msg = $("#ci-msg", el);
    const paint = (v) => { ci.classList.toggle("done", v); ci.querySelector(".ci-t").textContent = v ? "Visitat" : "Hi sóc"; ci.querySelector(".ci-ic").innerHTML = ic(v ? "check" : "flag"); ci.setAttribute("aria-pressed", String(v)); };
    paint(await isVisited(l.id));
    ci.addEventListener("click", async () => {
      if (ci.classList.contains("done")) { toast("Ja has estat aquí"); return; }
      ci.disabled = true; ci.querySelector(".ci-t").textContent = "Buscant posició…"; msg.innerHTML = "";
      const r = await doCheckIn(l); ci.disabled = false;
      if (r.ok) { paint(true); pop(ci, "stamp"); vibe([14, 40, 20]); toast(r.already ? "Ja el tenies al passaport" : `Check-in fet a ${l.nom}`); }
      else {
        paint(false);
        msg.innerHTML = `<div class="notice">${r.distM != null ? `Ets a ${fmtDist(r.distM / 1000)}. Cal ser a menys de 150 m per fer el check-in.` : esc(r.error || "No s'ha pogut fer el check-in.")}
          <button type="button" class="link-btn" id="ci-force">Marca'l igualment</button></div>`;
        $("#ci-force", el)?.addEventListener("click", async () => { const m = await manualCheckIn(l); if (m.ok) { paint(true); pop(ci, "stamp"); vibe([14, 40, 20]); msg.innerHTML = ""; toast("Marcat com a visitat"); } });
      }
    });

    // capítols: índex + llegir més
    const track = $("#chaps", el);
    if (track) {
      const nav = $("#chapnav", el);
      if (nav) {
        offs.push(carouselIndex(track, (i) => $$("button", nav).forEach((b, k) => b.setAttribute("aria-current", String(k === i)))));
        nav.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; const c = track.children[+b.dataset.i]; track.scrollTo({ left: c.offsetLeft - track.offsetLeft - 16, behavior: reduced() ? "auto" : "smooth" }); });
      }
      track.addEventListener("click", (e) => {
        const m = e.target.closest(".more"); if (!m) return; const t = m.previousElementSibling, open = t.classList.toggle("clamp") === false;
        m.setAttribute("aria-expanded", String(open)); m.textContent = open ? "Mostra'n menys" : "Llegeix-ne més";
      });
    }

    // què mirar
    const look = $("#look", el);
    if (look) {
      const tally = $("#tally", el), bar = $("#tbar", el);
      const upd = () => { const n = $$(".lk[aria-pressed='true']", look).length; tally.textContent = `${n} de ${mirar.length}`; bar.style.width = (n / mirar.length) * 100 + "%"; return n; };
      upd();
      look.addEventListener("click", (e) => {
        const b = e.target.closest(".lk"); if (!b) return;
        const on = b.getAttribute("aria-pressed") !== "true"; b.setAttribute("aria-pressed", String(on)); pop(b.querySelector(".lk-box")); vibe(on ? 10 : 6);
        const s = store.get(MIRAR, {}) || {}; const set = new Set(s[l.id] || []); on ? set.add(+b.dataset.i) : set.delete(+b.dataset.i); s[l.id] = [...set]; store.set(MIRAR, s);
        if (upd() === mirar.length && on) { vibe([12, 40, 12, 40, 24]); toast("Ho has vist tot"); }
      });
    }
    // cartes que giren: la primera es gira una mica en arribar-hi, perquè es vegi que és una carta
    const flipsEl = $("#flips", el), firstIn = flipsEl?.querySelector(".f-in");
    if (flipsEl && firstIn && !reduced() && "IntersectionObserver" in window) {
      const io = new IntersectionObserver(([en]) => {
        if (!en.isIntersecting) return; io.disconnect();
        firstIn.animate([{ transform: "rotateY(0deg)" }, { transform: "rotateY(-26deg)", offset: 0.35 }, { transform: "rotateY(6deg)", offset: 0.7 }, { transform: "rotateY(0deg)" }], { duration: 1000, delay: 350, easing: "cubic-bezier(.23,1,.32,1)" });
      }, { threshold: 0.7 });
      io.observe(flipsEl); offs.push(() => io.disconnect());
    }
    flipsEl?.addEventListener("click", (e) => {
      const f = e.target.closest(".flip"); if (!f) return;
      const on = f.getAttribute("aria-pressed") !== "true"; f.setAttribute("aria-pressed", String(on)); vibe(8);
    });
  };
  return { html, mount, unmount: () => { offs.forEach((f) => f()); offs = []; }, title: l.nom, tab: "llocs", cls: "hero" };
}

export async function museu(ctx) {
  const all = await getLlocs();
  const l = all.find((x) => x.id === ctx.id);
  if (!l) return { html: `<div class="view-in"><h1>Museu no trobat</h1><a class="btn" href="#/museus">Veure els museus</a></div>`, title: "No trobat", tab: "llocs" };
  const obres = l.obres || [];
  const html = `<div class="view-in"><header class="page-h"><h1>${esc(l.nom)}</h1><span class="count">${obres.length} obres</span></header>
    <div class="p-actions"><a class="btn" href="#/lloc/${encodeURIComponent(l.id)}">${ic("museum")} Fitxa i pràctic</a></div>
    ${obres.length ? `<div class="mosaic art-wall" data-lbgroup>${obres.map((o) => `<button type="button" class="art" ${lbAttrs(o.imatge || "", o.nom, [o.datacio, o.on].filter(Boolean).join(" · ") + (o.text ? "\n" + o.text : ""), o.credit, "")}>
      ${o.imatge ? img(o.imatge, o.nom, 400) : `<span class="art-none">${ic("amphora", "ic-xl")}</span>`}<span class="art-p"><b>${esc(o.nom)}</b><small>${esc([o.datacio, o.on].filter(Boolean).join(" · "))}</small></span></button>`).join("")}</div>` : `<div class="empty">Aquest museu encara no té obres a les dades.</div>`}
  </div>`;
  return { html, title: l.nom, tab: "llocs" };
}
