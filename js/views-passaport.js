// Passaport: rang i XP, segells de tinta (check-ins amb GPS), assoliments i estadístiques
import { esc } from "./util.js";
import { getLlocs } from "./data.js";
import { getJocs } from "./data-jocs.js";
import * as P from "./progress.js";
import { loadCss, ico, medal, fixMedals, countUp, fmtNum, feedback, confetti, reduced, shake } from "./fx.js";

const EASE = "cubic-bezier(0.23, 1, 0.32, 1)";
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const TIPUS_ICON = { monument: "monument", museu: "museum", via: "road", esglesia: "church", excursio: "trip", zona: "zone" };
const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const fmtDate = (t) => { const d = new Date(t); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`; };
const fmtM = (m) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0).replace(".", ",")} km`);

// ---- segell de tinta (SVG): vora irregular amb turbulència, nom en arc, icona i data ----
function stamp(l, t, isNew = false) {
  const h = hash(l.id), rot = ((h % 21) - 10) * 0.9, ink = h % 4, seed = h % 90;
  const nom = String(l.nom).toUpperCase().replace(/\s*\(.*\)\s*$/, "");
  const txt = nom.length > 26 ? nom.slice(0, 25) + "…" : nom;
  const fs = txt.length <= 12 ? 11 : txt.length <= 18 ? 9.2 : 7.6;
  const id = "s" + h;
  return `<figure class="pp-stamp ink-${ink}${isNew ? " is-new" : ""}" style="--rot:${rot}deg" data-id="${esc(l.id)}">
    <svg viewBox="0 0 120 120" role="img" aria-label="Segell de ${esc(l.nom)}, ${fmtDate(t)}">
      <defs><path id="a${id}" d="M60 60m-41 0a41 41 0 1 1 82 0a41 41 0 1 1-82 0"/><filter id="f${id}" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="${seed}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.6"/></filter></defs>
      <g filter="url(#f${id})" fill="none" stroke="currentColor">
        <circle cx="60" cy="60" r="56" stroke-width="3.4"/><circle cx="60" cy="60" r="50" stroke-width="1"/><circle cx="60" cy="60" r="30" stroke-width="1"/>
        <text fill="currentColor" stroke="none" font-size="${fs}" font-weight="700" letter-spacing="1.4" text-anchor="middle"><textPath href="#a${id}" startOffset="25%">${esc(txt)}</textPath></text>
        <use href="icons/set/sprite.svg#i-${TIPUS_ICON[l.tipus] || "monument"}" x="42" y="38" width="36" height="36" stroke-width="1.7"/>
        <text x="60" y="95" fill="currentColor" stroke="none" font-size="8.4" font-weight="700" letter-spacing="1" text-anchor="middle">${fmtDate(t)}</text>
        <text x="60" y="107" fill="currentColor" stroke="none" font-size="6" letter-spacing="2.2" text-anchor="middle">ROMA</text>
      </g></svg><figcaption>${esc(l.nom)}</figcaption></figure>`;
}

export async function passaport(ctx = {}) {
  await Promise.all([loadCss(), P.ready()]);
  const [llocs, { assoliments }] = await Promise.all([getLlocs(), getJocs()]);
  const byId = new Map(llocs.map((l) => [l.id, l]));
  let unsub, ac, debounce, cancel = [];

  const secHero = () => {
    const s = P.get(), x = P.xp(), r = P.rankFor(x);
    return `<div class="pp-medal">${ico("laurel")}<span>${ROMAN[r.idx + 1] || r.idx + 1}</span></div>
      <p class="pp-kick">El teu rang</p><h1 class="pp-rank">${esc(r.nom)}</h1>
      <div class="pp-xp"><b data-xp>${fmtNum(x)}</b> XP</div>
      <div class="jg-bar pp-bar" role="progressbar" aria-valuenow="${Math.round(r.pct * 100)}" aria-valuemin="0" aria-valuemax="100" aria-label="Progrés cap al rang següent"><i style="transform:scaleX(${r.pct})"></i></div>
      <p class="pp-next">${r.next ? `Et falten <b>${fmtNum(r.falta)} XP</b> per ser ${esc(r.next.nom)}.` : "Has arribat al cim. Ave, Cèsar."}</p>
      <ol class="pp-ladder" aria-label="Tots els rangs">${P.RANGS.map((g, i) => `<li class="${i < r.idx ? "past" : i === r.idx ? "cur" : ""}"${i === r.idx ? ' aria-current="true"' : ""}><i></i><span>${esc(g.nom)}</span></li>`).join("")}</ol>
      ${s.streak.days > 0 ? `<div class="pp-streak">${ico("sparkle")}<b>${s.streak.days}</b> ${s.streak.days === 1 ? "dia" : "dies"} seguit${s.streak.days === 1 ? "" : "s"}${s.streak.best > s.streak.days ? ` · millor ratxa ${s.streak.best}` : ""}</div>` : ""}`;
  };

  const secStamps = (newId) => {
    const ci = P.get().checkins;
    const vis = Object.entries(ci).map(([id, t]) => [byId.get(id), t]).filter(([l]) => l).sort((a, b) => b[1] - a[1]);
    const ghosts = Math.max(0, Math.min(3 - (vis.length % 3 || 3), llocs.length - vis.length));
    return `<div class="pp-sec-h"><h2>Segells</h2><span class="pp-count"><b>${vis.length}</b>/${llocs.length} llocs</span></div>
      <div class="pp-checkin"><button type="button" class="btn pp-here" id="here">${ico("locate")}<span>Hi sóc: fes check-in</span></button>
        <p class="pp-msg" id="msg" role="status" aria-live="polite">Cal ser a menys de ${P.CHECKIN_M} m del lloc. Només es fa servir la posició en el moment de tocar el botó.</p></div>
      ${vis.length ? `<div class="pp-stamps">${vis.map(([l, t]) => stamp(l, t, l.id === newId)).join("")}${Array.from({ length: ghosts }, () => `<div class="pp-ghost" aria-hidden="true"></div>`).join("")}</div>`
        : `<div class="pp-blank"><div class="pp-ghost big" aria-hidden="true">${ico("pin")}</div><p><b>El passaport és en blanc.</b><br>Visita un lloc i toca «Hi sóc» per segellar-lo.</p></div>`}
      <details class="pp-all acc"><summary>Tots els llocs (${llocs.length})</summary><ul class="pp-places">${[...llocs].sort((a, b) => (a.zona || "").localeCompare(b.zona || "", "ca") || a.nom.localeCompare(b.nom, "ca")).map((l) => {
        const t = ci[l.id];
        return `<li data-id="${esc(l.id)}"><div class="pp-pl"><b>${esc(l.nom)}</b><small>${esc(l.zona || "")}</small></div>${t ? `<span class="pp-done">${ico("check")}${fmtDate(t)}</span>` : l.coords ? `<button type="button" class="btn small ghost" data-ci="${esc(l.id)}">Check-in</button>` : `<span class="pp-done muted">Sense coordenades</span>`}<p class="pp-pmsg" role="status"></p></li>`;
      }).join("")}</ul></details>`;
  };

  const secAch = () => {
    const s = P.get();
    const got = assoliments.filter((a) => s.achievements[a.id]).length;
    return `<div class="pp-sec-h"><h2>Assoliments</h2><span class="pp-count"><b>${got}</b>/${assoliments.length}</span></div>
      <ul class="pp-ach">${assoliments.map((a) => {
        const have = s.achievements[a.id], cur = P.metric(a.condicio?.tipus, a.condicio), need = a.condicio?.valor || 1;
        const pct = Math.min(1, cur / need);
        return `<li class="${have ? "on" : "off"}" aria-label="${esc(a.nom)}: ${have ? "aconseguit" : `${Math.min(cur, need)} de ${need}`}">
          <div class="pp-ach-m">${medal(a.icona, a.nom)}${have ? "" : `<span class="pp-lock">${ico("lock")}</span>`}</div>
          <b>${esc(a.nom)}</b><small>${esc(a.descripcio || "")}</small>
          ${have ? `<em>${fmtDate(have)}</em>` : `<div class="pp-mini"><i style="transform:scaleX(${pct})"></i></div><em>${Math.min(cur, need)}/${need}</em>`}</li>`;
      }).join("")}</ul>`;
  };

  const secStats = () => {
    const s = P.get(), g = s.games, played = Object.values(g).reduce((a, b) => a + (b.played || 0), 0);
    const rows = [["Targetes vistes", s.seenCount], ["Preguntes encertades", s.quizCorrect], ["Partides jugades", played], ["Llocs visitats", Object.keys(s.checkins).length],
      ["M'agrada", P.curiFavs().length], ["Millor ratxa diària", s.streak.best || 0]];
    return `<div class="pp-sec-h"><h2>Estadístiques</h2></div>
      <dl class="pp-stats">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${fmtNum(v)}</dd></div>`).join("")}</dl>
      <ul class="pp-recs">
        <li><span>Quiz</span><b>${g.quiz?.played ? `${g.quiz.best}/10 · ${fmtNum(g.quiz.bestPts || 0)} pts` : "—"}</b></li>
        <li><span>Mite o realitat</span><b>${g.mite?.played ? `ratxa ${g.mite.bestStreak || 0}` : "—"}</b></li>
        <li><span>On és?</span><b>${g["on-es"]?.played ? `${fmtNum(g["on-es"].bestPts || 0)} pts` : "—"}</b></li>
        <li><span>Ordena</span><b>${g.ordena?.played ? `${g.ordena.perfect || 0} perfectes` : "—"}</b></li></ul>
      <p class="muted pp-since">Al passaport des del ${fmtDate(s.since)}. Les dades només viuen en aquest dispositiu.</p>`;
  };

  const html = `<div class="pp view-in">
    <section class="pp-hero" id="pp-hero">${secHero()}</section>
    <section class="pp-sec" id="pp-stamps">${secStamps()}</section>
    <section class="pp-sec" id="pp-ach">${secAch()}</section>
    <section class="pp-sec" id="pp-stats">${secStats()}</section></div>`;

  return {
    html, title: "Passaport", tab: "passaport",
    mount(main) {
      ac = new AbortController(); const sig = { signal: ac.signal };
      const $ = (s) => main.querySelector(s);
      const hero = $("#pp-hero"), stamps = $("#pp-stamps"), ach = $("#pp-ach"), stats = $("#pp-stats");
      const animateHero = () => {
        cancel.forEach((f) => f()); cancel = [];
        const r = P.rankFor(P.xp()), el = hero.querySelector("[data-xp]");
        cancel.push(countUp(el, P.xp(), { duration: 1000 }));
        const i = hero.querySelector(".pp-bar i");
        if (i && !reduced()) i.animate([{ transform: "scaleX(0)" }, { transform: `scaleX(${r.pct})` }], { duration: 900, delay: 150, easing: EASE, fill: "backwards" });
      };
      animateHero(); fixMedals(main);
      unsub = P.onChange(() => {
        clearTimeout(debounce);
        debounce = setTimeout(() => { hero.innerHTML = secHero(); ach.innerHTML = secAch(); stats.innerHTML = secStats(); fixMedals(ach); }, 450);
      });

      const msg = (t, kind = "") => { const m = $("#msg"); if (m) { m.textContent = t; m.className = `pp-msg ${kind}`; } };
      function stampIn(id) {
        const s = stamps.querySelector(`.pp-stamp[data-id="${CSS.escape(id)}"]`); if (!s) return;
        s.scrollIntoView({ block: "center", behavior: reduced() ? "auto" : "smooth" });
        if (reduced()) return;
        s.animate([{ opacity: 0, transform: "scale(1.9) rotate(-18deg)" }, { opacity: 1, transform: "scale(.94) rotate(var(--rot))", offset: 0.55 }, { opacity: 1, transform: "scale(1) rotate(var(--rot))" }], { duration: 520, easing: EASE });
      }
      function success(res) {
        feedback("stamp"); confetti({ y: 0.4, count: 70 });
        const open = stamps.querySelector(".pp-all")?.open;
        stamps.innerHTML = secStamps(res.id); if (open) stamps.querySelector(".pp-all").open = true;
        msg(`Segell de ${res.nom}! +${res.xp} XP`, "ok");
        stampIn(res.id);
      }
      async function nearestCheck(btn) {
        btn.disabled = true; btn.classList.add("busy"); msg("Buscant-te al mapa…");
        try {
          const pos = await P.locate();
          const n = await P.nearest(pos);
          if (!n) return msg("No hi ha cap lloc amb coordenades.", "ko");
          if (n.distM > P.CHECKIN_M) { msg(`Ets a ${fmtM(n.distM)} de ${n.lloc.nom}, el lloc més proper. Cal estar a menys de ${P.CHECKIN_M} m.`, "ko"); shake(btn); feedback("ko"); return; }
          const res = await P.checkIn(n.lloc.id, { gps: false });
          if (res.already) return msg(`Ja tens el segell de ${n.lloc.nom}. Passeja una mica més!`);
          res.id = n.lloc.id; success(res);
        } catch (e) { msg(e.message || "No s'ha pogut obtenir la ubicació.", "ko"); shake(btn); }
        finally { btn.disabled = false; btn.classList.remove("busy"); }
      }
      async function placeCheck(btn) {
        const li = btn.closest("li"), pm = li.querySelector(".pp-pmsg");
        btn.disabled = true; pm.textContent = "Buscant-te…"; pm.className = "pp-pmsg";
        const res = await P.checkIn(btn.dataset.ci);
        btn.disabled = false;
        if (res.ok && !res.already) { res.id = btn.dataset.ci; success(res); return; }
        if (res.already) { pm.textContent = "Ja el tens."; return; }
        pm.className = "pp-pmsg ko";
        pm.textContent = res.distM != null ? `Ets a ${fmtM(res.distM)} de ${res.nom}. Cal estar a menys de ${P.CHECKIN_M} m.` : res.error || "No s'ha pogut fer el check-in.";
        shake(li); feedback("ko");
      }
      main.addEventListener("click", (e) => {
        const here = e.target.closest("#here"); if (here) return nearestCheck(here);
        const ci = e.target.closest("[data-ci]"); if (ci) placeCheck(ci);
      }, sig);
    },
    unmount() { ac?.abort(); unsub?.(); clearTimeout(debounce); cancel.forEach((f) => f()); },
  };
}
