// Jocs: selecció + Quiz, Mite o realitat (targetes que es llisquen), On és? (foto amb zoom) i Ordena (arrossega)
import { esc, inline, commonsUrl, fmtYear, safeUrl } from "./util.js";
import { llocsMap } from "./data.js";
import { getQuiz, getCuriositats, getJocs } from "./data-jocs.js";
import * as P from "./progress.js";
import { loadCss, ico, countUp, fmtNum, feedback, haptic, confetti, pop, shake, shuffle, reduced, spring } from "./fx.js";

const GAMES = [
  { id: "quiz", nom: "Quiz", sub: "Deu preguntes i el rellotge no s'atura.", icon: "helmet" },
  { id: "mite", nom: "Mite o realitat", sub: "Llisca la targeta: esquerra mite, dreta realitat.", icon: "scroll" },
  { id: "on-es", nom: "On és?", sub: "Una foto, quatre llocs. Tu tries.", icon: "map" },
  { id: "ordena", nom: "Ordena", sub: "Posa la història en ordre, de més antic a més nou.", icon: "timeline" },
];
const EASE = "cubic-bezier(0.23, 1, 0.32, 1)";
const back = `<a class="jg-back" href="#/jocs">${ico("chevron-left")}<span>Jocs</span></a>`;

function record(id) {
  const g = P.get().games[id] || {};
  if (!g.played) return "Encara cap partida";
  if (id === "quiz") return `Rècord: ${g.best}/10 · ${fmtNum(g.bestPts || 0)} punts`;
  if (id === "mite") return `Millor ratxa: ${g.bestStreak || 0} · millor ronda ${g.best}/10`;
  if (id === "on-es") return `Rècord: ${fmtNum(g.bestPts || 0)} punts`;
  return `${g.perfect || 0} ordres perfectes`;
}

function hubHTML() {
  const r = P.rankFor(P.xp());
  return `<div class="jg-hub view-in">
    <div class="jg-hub-head"><h1>Jocs</h1>
      <a class="jg-rank" href="#/passaport" aria-label="Obre el passaport">${ico("star")}<b>${esc(r.nom)}</b><i>${fmtNum(P.xp())} XP</i></a></div>
    <p class="lead">Quatre maneres de fer treballar la memòria (i un pèl l'orgull).</p>
    <div class="jg-cards">${GAMES.map((g, i) => `<a class="jg-card g-${g.id}" href="#/jocs?joc=${g.id}" style="--i:${i}">
      <span class="jg-art" aria-hidden="true">${ico(g.icon)}</span>
      <span class="jg-card-t"><b>${g.nom}</b><span>${g.sub}</span></span>
      <span class="jg-rec">${esc(record(g.id))}</span><span class="jg-play">Juga ${ico("chevron-right")}</span></a>`).join("")}</div></div>`;
}

export async function jocs(ctx = {}) {
  await Promise.all([loadCss(), P.ready()]);
  const joc = ctx.params?.joc || ctx.joc || "";
  const g = GAMES.find((x) => x.id === joc);
  if (!g) return { html: hubHTML(), title: "Jocs", tab: "jocs" };
  let env;
  return {
    html: `<div class="jg ${g.id === "mite" || g.id === "on-es" ? "jg-fit" : ""}" id="jg" data-joc="${g.id}"><div class="jg-stage"></div></div>`,
    title: g.nom, tab: "jocs", cls: "jg-main",
    async mount(main) {
      const run = { quiz: playQuiz, mite: playMite, "on-es": playOnEs, ordena: playOrdena }[g.id];
      let stage = main.querySelector(".jg-stage");
      const start = async () => {
        env?.dispose(); env = makeEnv();
        const fresh = stage.cloneNode(false); stage.replaceWith(fresh); stage = fresh; window.scrollTo(0, 0);
        try { await run(stage, env, start); } catch (e) { console.error(e); stage.innerHTML = `<div class="notice">Aquest joc no s'ha pogut carregar.</div>${back}`; }
      };
      await start();
    },
    unmount() { env?.dispose(); },
  };
}

function makeEnv() {
  const timers = new Set(), sp = new Set(), anims = new Set(), cleanups = [], ac = new AbortController();
  return {
    sig: ac.signal,
    later(fn, ms) { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; },
    spring(o) { const s = spring({ ...o, onDone: () => { sp.delete(s); o.onDone?.(); } }); sp.add(s); return s; },
    anim(a) { anims.add(a); return a; },
    onDispose(f) { cleanups.push(f); },
    dispose() { ac.abort(); timers.forEach(clearTimeout); sp.forEach((s) => s.cancel()); anims.forEach((a) => { try { a.cancel(); } catch {} }); cleanups.forEach((f) => { try { f(); } catch {} }); },
  };
}
const $ = (s, el) => el.querySelector(s);
const $$ = (s, el) => [...el.querySelectorAll(s)];
const slideIn = (el, y = 18) => { if (!reduced()) el.animate([{ opacity: 0, transform: `translateY(${y}px)` }, { opacity: 1, transform: "none" }], { duration: 320, easing: EASE }); };

// ---------- pantalla de resultats comuna ----------
function showResult(env, root, o) {
  const before = P.rankFor(P.xp());
  P.addXP(o.xp);
  const after = P.rankFor(P.xp());
  const rankUp = after.idx > before.idx;
  root.innerHTML = `<div class="jg-result"><div class="jg-medalbig">${ico(o.icon || "laurel")}</div>
    <h1>${esc(o.msg)}</h1>${o.newRecord ? `<div class="jg-newrec">${ico("sparkle")}Nou rècord</div>` : ""}
    <div class="jg-score"><b data-big>0</b>${o.total != null ? `<span>/${o.total}</span>` : ""}</div>
    ${o.pts != null ? `<div class="jg-pts">${ico("star")}<b data-pts>0</b> punts</div>` : ""}
    <ul class="jg-lines">${(o.lines || []).map((l) => `<li>${l}</li>`).join("")}</ul>
    <div class="jg-xpbox"><div class="jg-xprow"><span>+<b data-xp>0</b> XP</span><span class="jg-rankn">${esc(after.nom)}</span></div>
      <div class="jg-bar" role="progressbar" aria-valuenow="${Math.round(after.pct * 100)}" aria-valuemin="0" aria-valuemax="100"><i></i></div>
      <small>${after.next ? `Et falten ${fmtNum(after.falta)} XP per ser ${esc(after.next.nom)}.` : "Has arribat al cim. Ave, Cèsar."}</small></div>
    <div class="jg-actions"><button type="button" class="btn" data-again>Torna-ho a provar</button><a class="btn ghost" href="#/jocs">Tots els jocs</a></div></div>`;
  slideIn(root.firstElementChild, 24);
  const c1 = countUp($("[data-big]", root), o.value, { duration: 900 }); env.onDispose(c1);
  if (o.pts != null) env.onDispose(countUp($("[data-pts]", root), o.pts, { duration: 1100 }));
  env.onDispose(countUp($("[data-xp]", root), o.xp, { duration: 900 }));
  const bar = $(".jg-bar i", root);
  const from = rankUp ? 0 : before.pct;
  bar.style.transform = `scaleX(${after.pct})`;
  if (!reduced()) env.anim(bar.animate([{ transform: `scaleX(${from})` }, { transform: `scaleX(${after.pct})` }], { duration: 900, delay: 250, easing: EASE, fill: "backwards" }));
  if (o.confetti) { env.later(() => confetti({ y: 0.28, count: 70 + o.confetti * 60, power: 0.9 + o.confetti * 0.2 }), 250); feedback("win"); }
  $("[data-again]", root).addEventListener("click", o.again, { signal: env.sig });
}
const head = (t, right = "") => `<div class="jg-head">${back}<h1>${t}</h1><span class="jg-head-r">${right}</span></div>`;

/* =====================================================================
   QUIZ
   ===================================================================== */
const human = (t) => { const x = String(t || "").replace(/-/g, " "); return x.charAt(0).toUpperCase() + x.slice(1); };
const DIF = { 1: "Fàcil", 2: "Mitjà", 3: "Difícil" };
const ROUND = 10, SECS = 15;

async function playQuiz(root, env, restart) {
  const all = await getQuiz();
  if (all.length < 4) { root.innerHTML = head("Quiz") + `<div class="empty">Encara no hi ha prou preguntes. Torna-hi aviat.</div>`; return; }
  const temes = [...new Set(all.map((q) => q.tema).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ca"));
  const difs = [...new Set(all.map((q) => q.dificultat).filter(Boolean))].sort();
  let mode = "rand", sel = "", phase, phaseAc;
  const newPhase = () => { phaseAc?.abort(); phaseAc = new AbortController(); env.onDispose(() => phaseAc.abort()); return phaseAc.signal; };

  function setup() {
    root.innerHTML = head("Quiz") + `<p class="lead">Deu preguntes. Respon ràpid i encadena encerts: la ratxa suma punts.</p>
      <div class="jg-seg" role="group" aria-label="Mode de joc">
        <button type="button" data-mode="rand" aria-pressed="${mode === "rand"}">Aleatori</button>
        <button type="button" data-mode="tema" aria-pressed="${mode === "tema"}">Per tema</button>
        <button type="button" data-mode="dif" aria-pressed="${mode === "dif"}">Per dificultat</button></div>
      <div class="jg-chips" id="chips" aria-live="polite"></div>
      <button type="button" class="btn jg-go" id="go">Comença</button>`;
    const chips = $("#chips", root);
    function drawChips() {
      if (mode === "rand") { chips.innerHTML = `<p class="muted">Preguntes de tots els temes i dificultats, barrejades.</p>`; return; }
      const items = mode === "tema" ? temes.map((t) => [t, human(t), all.filter((q) => q.tema === t).length]) : difs.map((d) => [String(d), DIF[d] || `Nivell ${d}`, all.filter((q) => q.dificultat === d).length]);
      if (!items.some(([v]) => v === sel)) sel = items[0]?.[0] || "";
      chips.innerHTML = items.map(([v, l, n]) => `<button type="button" class="jg-chip" data-v="${esc(v)}" aria-pressed="${v === sel}">${esc(l)} <i>${n}</i></button>`).join("");
    }
    drawChips();
    phase = newPhase();
    root.addEventListener("click", (e) => {
      const m = e.target.closest("[data-mode]"), c = e.target.closest(".jg-chip");
      if (m) { mode = m.dataset.mode; $$("[data-mode]", root).forEach((b) => b.setAttribute("aria-pressed", String(b === m))); haptic("tap"); drawChips(); }
      else if (c) { sel = c.dataset.v; $$(".jg-chip", root).forEach((b) => b.setAttribute("aria-pressed", String(b === c))); haptic("tap"); }
      else if (e.target.closest("#go")) start();
    }, { signal: phase });
  }

  function start() {
    let pool = all;
    if (mode === "tema") pool = all.filter((q) => q.tema === sel);
    if (mode === "dif") pool = all.filter((q) => String(q.dificultat) === sel);
    const qs = shuffle(pool).slice(0, ROUND);
    run(qs);
  }

  function run(qs) {
    const N = qs.length;
    let i = 0, correct = 0, pts = 0, combo = 0, bestCombo = 0, answered = false, timerAnim = null, colorAnim = null, shown = null, left = 0, results = [];
    const prevBest = P.get().games.quiz?.played ? P.get().games.quiz.best || 0 : Infinity;
    const sigR = newPhase();

    function pause() { timerAnim?.pause(); colorAnim?.pause(); }
    function resume() { if (!answered) { timerAnim?.play(); colorAnim?.play(); } }
    document.addEventListener("visibilitychange", () => (document.hidden ? pause() : resume()), { signal: sigR });

    function draw() {
      const q = qs[i]; answered = false;
      // opcions barrejades; guardem quina és la correcta
      const order = shuffle(q.opcions.map((t, k) => ({ t, k })));
      shown = { q, order };
      root.innerHTML = `<div class="jg-qbar">
          <div class="jg-dots" aria-label="Pregunta ${i + 1} de ${N}">${qs.map((_, k) => `<i class="${k < i ? (results[k] ? "ok" : "ko") : k === i ? "cur" : ""}"></i>`).join("")}</div>
          <span class="jg-combo" id="combo" ${combo >= 2 ? "" : "hidden"}>${ico("sparkle")}Ratxa ×<b>${combo}</b></span>
          <span class="jg-livepts">${ico("star")}<b id="pts">${fmtNum(pts)}</b></span></div>
        <div class="jg-timer" aria-hidden="true"><i></i></div>
        <div class="jg-qn">Pregunta ${i + 1} de ${N}${q.tema ? ` · ${esc(human(q.tema))}` : ""}${q.dificultat ? ` · ${DIF[q.dificultat] || ""}` : ""}</div>
        <h2 class="jg-q" id="q">${esc(q.pregunta)}</h2>
        <div class="jg-answers" role="group" aria-labelledby="q">${order.map((o, n) => `<button type="button" class="jg-ans" data-n="${n}"><span class="k">${"ABCD"[n]}</span><span class="t">${esc(o.t)}</span></button>`).join("")}</div>
        <div class="jg-expl" hidden></div>`;
      const bar = $(".jg-timer i", root);
      {
        timerAnim = env.anim(bar.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], { duration: SECS * 1000, easing: "linear", fill: "forwards" }));
        colorAnim = env.anim(bar.animate([{ backgroundColor: "var(--gold)" }, { backgroundColor: "var(--gold)", offset: 0.55 }, { backgroundColor: "var(--terra)" }], { duration: SECS * 1000, easing: "linear", fill: "forwards" }));
        timerAnim.onfinish = () => { if (!answered) pick(-1); };
      }
      slideIn($(".jg-q", root), 10);
    }

    function pick(n) {
      if (answered) return; answered = true;
      const { q, order } = shown;
      const frac = timerAnim ? Math.max(0, 1 - (timerAnim.currentTime || 0) / (SECS * 1000)) : 0;
      timerAnim?.pause(); colorAnim?.pause();
      const ci = order.findIndex((o) => o.k === q.correcta);
      const ok = n >= 0 && order[n].k === q.correcta;
      const btns = $$(".jg-ans", root);
      btns[ci].classList.add("ok");
      let gain = 0;
      if (ok) {
        correct++; combo++; bestCombo = Math.max(bestCombo, combo);
        gain = 100 + Math.round(frac * 50) + Math.min(4, combo - 1) * 10;
        pts += gain; feedback("ok"); pop(btns[n], { scale: 1.04, ms: 280 });
      } else {
        combo = 0; feedback("ko");
        if (n >= 0) { btns[n].classList.add("ko"); shake(btns[n]); }
      }
      results[i] = ok;
      P.recordQuizAnswer(q.id, ok);
      btns.forEach((b, k) => { if (k !== ci && k !== n) b.classList.add("gone"); b.disabled = true; });
      $$(".jg-dots i", root)[i].className = ok ? "ok" : "ko";
      env.onDispose(countUp($("#pts", root), pts, { from: pts - gain, duration: 500 }));
      const cb = $("#combo", root);
      if (combo >= 2) { cb.hidden = false; $("b", cb).textContent = combo; pop(cb, { scale: 1.25, ms: 360 }); } else cb.hidden = true;
      const ex = $(".jg-expl", root);
      const last = i === N - 1;
      ex.innerHTML = `<div class="jg-verdict ${ok ? "ok" : "ko"}">${ok ? `<b>Correcte!</b>${gain ? ` <span>+${gain}</span>` : ""}` : `<b>${n < 0 ? "S'ha acabat el temps." : "Ups."}</b> <span>Era «${esc(q.opcions[q.correcta])}».</span>`}</div>
        ${q.imatge?.fitxer ? `<figure class="jg-fig"><img src="${esc(commonsUrl(q.imatge.fitxer, 700))}" alt="${esc(q.imatge.descripcio || "")}" loading="lazy" decoding="async"><figcaption>${esc([q.imatge.credit, q.imatge.llicencia].filter(Boolean).join(" · "))} · Wikimedia Commons</figcaption></figure>` : ""}
        <p class="jg-why">${inline(q.explicacio || "")}</p>
        <button type="button" class="btn jg-next" id="next">${last ? "Veure el resultat" : "Següent"}</button>`;
      ex.hidden = false;
      env.later(() => slideIn(ex, 22), 0);
      env.later(() => ex.scrollIntoView({ block: "nearest", behavior: reduced() ? "auto" : "smooth" }), 260);
      $("#next", root).focus({ preventScroll: true });
    }

    function next() {
      if (!answered) return;
      if (++i < N) draw(); else finish();
    }
    function finish() {
      const perfect = correct === N && N >= 5;
      const xp = correct * 10 + 20 + (perfect ? 30 : 0);
      const newRecord = correct > prevBest && correct > 0;
      P.recordGame("quiz", { score: correct, pts });
      const msg = correct >= 9 ? "Digne d'un senador!" : correct >= 7 ? "Bona feina, legionari." : correct >= 4 ? "Anem fent camí." : "Cal repassar la lliçó (sense càstigs).";
      showResult(env, root, { msg, value: correct, total: N, pts, xp, newRecord, icon: "laurel", confetti: correct >= 7 ? (correct >= 9 ? 2 : 1) : 0,
        lines: [`Millor ratxa: <b>${bestCombo}</b> encert${bestCombo === 1 ? "" : "s"} seguit${bestCombo === 1 ? "" : "s"}`, `Encerts: <b>${correct}</b> de ${N}`], again: restart });
    }
    root.addEventListener("click", (e) => {
      const a = e.target.closest(".jg-ans"); if (a) { pick(+a.dataset.n); return; }
      if (e.target.closest("#next")) next();
    }, { signal: sigR });
    document.addEventListener("keydown", (e) => {
      if (e.target.closest?.("input,textarea")) return;
      if (/^[1-4]$/.test(e.key) && !answered) pick(+e.key - 1);
      else if (e.key === "Enter" && answered && document.activeElement?.id !== "next") { e.preventDefault(); next(); }
    }, { signal: sigR });
    draw();
  }
  setup();
}

/* =====================================================================
   MITE O REALITAT — targetes que es llisquen
   ===================================================================== */
async function playMite(root, env, restart) {
  const deck = shuffle((await getCuriositats()).filter((c) => c.tipus === "mite-o-realitat" && c.mite)).slice(0, 10);
  if (deck.length < 2) { root.innerHTML = head("Mite o realitat") + `<div class="empty">Encara no hi ha prou targetes de mite o realitat.</div>`; return; }
  const N = deck.length;
  let i = 0, correct = 0, streak = 0, best = 0, busy = false, revealing = false, drag = null, cur = null;
  const prevBest = P.get().games.mite?.played ? P.get().games.mite.best || 0 : Infinity;

  root.innerHTML = `${head("Mite o realitat", `<span class="jg-livepts">${ico("sparkle")}<b id="st">0</b></span>`)}
    <div class="jg-prog"><i></i></div>
    <div class="jg-stack" id="stack"></div>
    <div class="jg-swbtns"><button type="button" class="jg-sw mite" data-d="-1"><span>${ico("chevron-left")}</span>Mite</button><button type="button" class="jg-sw real" data-d="1">Realitat<span>${ico("chevron-right")}</span></button></div>
    <div class="jg-hintline">Llisca la targeta, toca un botó o fes servir les fletxes.</div>`;
  const stack = $("#stack", root), prog = $(".jg-prog i", root);
  const W = () => stack.clientWidth;

  function cardEl(c, depth) {
    const el = document.createElement("div");
    el.className = "jg-tcard"; el.dataset.d = depth;
    el.innerHTML = `${c.imatge?.fitxer ? `<img src="${esc(commonsUrl(c.imatge.fitxer, 900))}" alt="${esc(c.imatge.descripcio || "")}" draggable="false" decoding="async">` : ""}
      <div class="jg-tbody"><div class="jg-tq">${esc(c.titol)}</div><p>${inline(c.text || "")}</p></div>
      <span class="jg-lab l">Mite</span><span class="jg-lab r">Realitat</span>`;
    return el;
  }
  const place = (el, depth) => { el.style.transform = `translateY(${depth * 12}px) scale(${1 - depth * 0.05})`; el.style.opacity = depth > 2 ? 0 : 1; el.style.zIndex = 10 - depth; };
  function build() {
    stack.innerHTML = "";
    for (let k = Math.min(i + 2, N - 1); k >= i; k--) { const el = cardEl(deck[k], k - i); stack.appendChild(el); place(el, k - i); el.classList.toggle("top", k === i); }
    cur = stack.querySelector(".top");
    prog.style.transform = `scaleX(${i / N})`;
  }
  const rot = (x) => x * 0.05;
  function setX(x, y = 0) {
    cur.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rot(x)}deg)`;
    const p = Math.min(1, Math.abs(x) / 110);
    $(".l", cur).style.opacity = x < 0 ? p : 0; $(".r", cur).style.opacity = x > 0 ? p : 0;
    const behind = [...stack.children].filter((e) => e !== cur);
    behind.forEach((e) => { const d = +e.dataset.d - p; place(e, Math.max(0, d)); });
  }

  function commit(dir, vx = 0, fromX = 0) {
    if (busy || revealing) return; busy = true;
    const c = deck[i], ok = (dir > 0) === !!c.mite.veritat;
    const el = cur, target = dir * (W() + 260);
    haptic("snap");
    env.spring({ from: fromX, to: target, velocity: vx || dir * 1100, stiffness: 150, damping: 20,
      onUpdate: (x) => { el.style.transform = `translate3d(${x}px, ${Math.abs(x) * 0.08}px, 0) rotate(${rot(x)}deg)`; },
      onDone: () => el.remove() });
    // revelació: ho sabem a l'instant
    ok ? (correct++, streak++) : (streak = 0);
    best = Math.max(best, streak);
    $("#st", root).textContent = streak;
    feedback(ok ? "ok" : "ko");
    P.recordMite(ok);
    env.later(() => reveal(c, dir, ok), 160);
  }
  function reveal(c, dir, ok) {
    revealing = true;
    const last = i === N - 1, real = !!c.mite.veritat;
    const rv = document.createElement("div"); rv.className = `jg-reveal ${ok ? "ok" : "ko"}`;
    rv.innerHTML = `<div class="jg-rv-top"><span class="jg-stamp ${real ? "real" : "mite"}">${real ? "Realitat" : "Mite"}</span>
        <b>${ok ? (streak >= 3 ? `Ratxa de ${streak}!` : "Ben vist!") : "Aquesta ha colat."}</b></div>
      <p>${inline(c.mite.explicacio || "")}</p>
      ${c.font?.url && safeUrl(c.font.url) ? `<a class="jg-src" href="${esc(safeUrl(c.font.url))}" target="_blank" rel="noopener noreferrer">Font: ${esc(c.font.titol || "enllaç")}</a>` : ""}
      <button type="button" class="btn" id="rvnext">${last ? "Veure el resultat" : "Següent targeta"}</button>`;
    stack.appendChild(rv);
    if (!reduced()) {
      rv.animate([{ opacity: 0, transform: "translateY(40px) scale(.96)" }, { opacity: 1, transform: "none" }], { duration: 380, easing: EASE });
      const st = $(".jg-stamp", rv); st.animate([{ opacity: 0, transform: "scale(1.8) rotate(-14deg)" }, { opacity: 1, transform: "scale(1) rotate(-5deg)" }], { duration: 380, delay: 120, easing: EASE, fill: "backwards" });
      if (!ok) shake(rv);
    }
    $("#rvnext", rv).focus({ preventScroll: true });
    stack.classList.add("dim");
  }
  function advance() {
    if (!revealing) return;
    const rv = $(".jg-reveal", stack);
    const done = () => {
      rv?.remove(); revealing = false; busy = false; stack.classList.remove("dim");
      if (++i >= N) return finish();
      build();
    };
    if (reduced()) done(); else rv.animate([{ opacity: 1 }, { opacity: 0, transform: "translateY(20px)" }], { duration: 180, easing: "ease-out", fill: "forwards" }).onfinish = done;
  }
  function finish() {
    const xp = correct * 5 + 15 + (correct >= N - 1 ? 25 : 0);
    P.recordGame("mite", { score: correct, streak: best });
    showResult(env, root, { msg: correct >= 9 ? "Cap mite se't resisteix." : correct >= 6 ? "Bon olfacte històric." : "Els mites són dura de pelar.", value: correct, total: N, xp, newRecord: correct > prevBest && correct > 0,
      icon: "scroll", confetti: correct >= 7 ? 1 : 0, lines: [`Millor ratxa: <b>${best}</b>`, `Encerts: <b>${correct}</b> de ${N}`], again: restart });
  }

  // ---- gest: pointer events, mostres per calcular la velocitat de llançament ----
  stack.addEventListener("pointerdown", (e) => {
    if (busy || revealing || !cur || !cur.contains(e.target) || e.button > 0) return;
    cur.setPointerCapture(e.pointerId);
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, s: [{ t: e.timeStamp, x: e.clientX }], x: 0 };
    cur.classList.add("drag");
  }, { signal: env.sig });
  stack.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.x = e.clientX - drag.x0;
    drag.s.push({ t: e.timeStamp, x: e.clientX }); if (drag.s.length > 6) drag.s.shift();
    setX(drag.x, (e.clientY - drag.y0) * 0.35);
  }, { signal: env.sig });
  const up = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const s = drag.s, a = s[0], b = s[s.length - 1];
    const v = b.t > a.t ? ((b.x - a.x) / (b.t - a.t)) * 1000 : 0; // px/s
    const x = drag.x, proj = x + v * 0.2; drag = null; cur.classList.remove("drag");
    if (Math.abs(proj) > 120 && Math.abs(x) > 24) commit(proj > 0 ? 1 : -1, v, x);
    else { // torna enrere amb la velocitat del gest
      const el = cur;
      env.spring({ from: x, to: 0, velocity: v, stiffness: 320, damping: 26, onUpdate: (xx) => { if (el === cur) setX(xx); } });
    }
  };
  stack.addEventListener("pointerup", up, { signal: env.sig });
  stack.addEventListener("pointercancel", up, { signal: env.sig });
  root.addEventListener("click", (e) => {
    const b = e.target.closest(".jg-sw"); if (b) commit(+b.dataset.d, 0, 0);
    if (e.target.closest("#rvnext")) advance();
  }, { signal: env.sig });
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") commit(-1); else if (e.key === "ArrowRight") commit(1);
    else if (e.key === "Enter" && revealing && document.activeElement?.id !== "rvnext") advance();
  }, { signal: env.sig });
  build();
}

/* =====================================================================
   ON ÉS? — foto a pantalla completa amb zoom limitat
   ===================================================================== */
async function playOnEs(root, env, restart) {
  const [{ on_es }, llocs] = await Promise.all([getJocs(), llocsMap()]);
  const items = shuffle(on_es.filter((o) => o.imatge?.fitxer && llocs.get(o.lloc))).slice(0, 8);
  if (items.length < 2) { root.innerHTML = head("On és?") + `<div class="empty">Encara no hi ha prou fotos per jugar.</div>`; return; }
  const N = items.length;
  let i = 0, total = 0, hits = 0, pts = 0, attempts = 0, hinted = false, done = false, zoom = null;
  const prevBest = P.get().games["on-es"]?.played ? P.get().games["on-es"].bestPts || 0 : Infinity;

  function draw() {
    const it = items[i], l = llocs.get(it.lloc);
    attempts = 0; hinted = false; done = false;
    const names = shuffle([it.lloc, ...(it.distractors || []).filter((d) => llocs.get(d) && d !== it.lloc).slice(0, 3)]);
    root.innerHTML = `<div class="jg-pic" id="pic"><div class="jg-skel"></div><img alt="Foto d'un lloc de Roma" src="${esc(commonsUrl(it.imatge.fitxer, 1600))}" draggable="false"></div>
      <div class="jg-ohud">${back}<span class="jg-ocount">${i + 1}/${N}</span><span class="jg-livepts">${ico("star")}<b>${fmtNum(total)}</b></span></div>
      <div class="jg-hintchip" id="hintchip" hidden></div>
      <div class="jg-zoomhint" id="zh">Pessiga per ampliar</div>
      <div class="jg-sheet" id="sheet"><div class="jg-sheet-h"><b>On és?</b><button type="button" class="jg-hintbtn" id="hint">${ico("sparkle")}Pista <i>−40</i></button></div>
        <div class="jg-opts">${names.map((id) => `<button type="button" class="jg-opt" data-id="${esc(id)}">${esc(llocs.get(id).nom)}</button>`).join("")}</div></div>`;
    zoom = zoomPic($("#pic", root), $("#pic img", root), env);
    env.later(() => $("#zh", root)?.classList.add("gone"), 3200);
  }

  function answer(btn) {
    if (done) return;
    const it = items[i], id = btn.dataset.id;
    if (id !== it.lloc) {
      attempts++; btn.classList.add("ko"); btn.disabled = true; shake(btn); feedback("ko"); return;
    }
    done = true; zoom?.reset();
    const gain = Math.max(10, 100 - (hinted ? 40 : 0) - attempts * 30);
    pts += gain; total += gain; hits++; feedback("ok"); P.recordOnEs();
    btn.classList.add("ok");
    const l = llocs.get(it.lloc), last = i === N - 1, c = it.imatge;
    const sh = $("#sheet", root);
    sh.innerHTML = `<div class="jg-found"><div class="jg-found-t"><span class="jg-tick">${ico("check")}</span><div><b>${esc(l.nom)}</b><small>${esc(l.zona || "")}${l.datacio ? ` · ${esc(l.datacio)}` : ""}</small></div><span class="jg-gain">+${gain}</span></div>
      ${l.resum ? `<p>${inline(l.resum)}</p>` : ""}
      <div class="jg-found-a"><a class="btn ghost small" href="#/lloc/${encodeURIComponent(l.id)}">Obre la fitxa</a><button type="button" class="btn small" id="onext">${last ? "Veure el resultat" : "Següent foto"}</button></div>
      <div class="jg-cr">${esc([c.credit, c.llicencia].filter(Boolean).join(" · "))} · Wikimedia Commons</div></div>`;
    slideIn(sh.firstElementChild, 20);
    $("#hintchip", root).hidden = true;
    $("#onext", root).focus({ preventScroll: true });
    $(".jg-livepts b", root).textContent = fmtNum(total);
    pop($(".jg-livepts", root), { scale: 1.2 });
  }
  function hint() {
    if (hinted || done) return; hinted = true;
    const ch = $("#hintchip", root); ch.textContent = items[i].pista || "Mira bé els detalls."; ch.hidden = false; slideIn(ch, -8);
    const b = $("#hint", root); b.disabled = true; haptic("tap");
  }
  function finish() {
    const xp = hits * 8 + 15;
    P.recordGame("on-es", { score: hits, pts });
    showResult(env, root, { msg: hits === N ? "Coneixes Roma com el palmell de la mà." : hits >= N / 2 ? "Bon ull, viatger." : "Roma encara guarda secrets.", value: hits, total: N, pts, xp, newRecord: pts > prevBest,
      icon: "map", confetti: hits >= N - 1 ? 1 : 0, lines: [`Llocs reconeguts: <b>${hits}</b> de ${N}`], again: restart });
  }
  root.addEventListener("click", (e) => {
    const o = e.target.closest(".jg-opt"); if (o) return answer(o);
    if (e.target.closest("#hint")) return hint();
    if (e.target.closest("#onext")) { if (++i < N) draw(); else finish(); }
  }, { signal: env.sig });
  draw();
}

// Zoom limitat (1×–3×): pessic amb dos dits, arrossegament, doble toc i roda
function zoomPic(box, img, env) {
  let z = 1, x = 0, y = 0, bw = 0, bh = 0, cw = 0, ch = 0;
  const MAX = 3, ptrs = new Map();
  let pinch = null, lastTap = 0, moved = 0;
  const clamp = () => { const mx = Math.max(0, (bw * z - cw) / 2), my = Math.max(0, (bh * z - ch) / 2); x = Math.min(mx, Math.max(-mx, x)); y = Math.min(my, Math.max(-my, y)); };
  const apply = () => { img.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${z})`; };
  function fit() {
    cw = box.clientWidth; ch = box.clientHeight;
    const iw = img.naturalWidth || 1200, ih = img.naturalHeight || 800, s = Math.max(cw / iw, ch / ih);
    bw = iw * s; bh = ih * s; img.style.width = bw + "px"; img.style.height = bh + "px"; clamp(); apply();
  }
  function zoomAt(nz, px, py) { nz = Math.min(MAX, Math.max(1, nz)); const k = nz / z; x = px - (px - x) * k; y = py - (py - y) * k; z = nz; clamp(); apply(); }
  const rel = (e) => { const r = box.getBoundingClientRect(); return [e.clientX - r.left - cw / 2, e.clientY - r.top - ch / 2]; };
  img.addEventListener("load", () => { fit(); img.classList.add("ld"); }, { signal: env.sig });
  if (img.complete && img.naturalWidth) { fit(); img.classList.add("ld"); }
  const ro = new ResizeObserver(fit); ro.observe(box); env.onDispose(() => ro.disconnect());
  box.addEventListener("pointerdown", (e) => {
    box.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0;
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z }; }
  }, { signal: env.sig });
  box.addEventListener("pointermove", (e) => {
    const p = ptrs.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; moved += Math.abs(dx) + Math.abs(dy);
    p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 2 && pinch) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), r = box.getBoundingClientRect();
      zoomAt(pinch.z * (d / pinch.d), (a.x + b.x) / 2 - r.left - cw / 2, (a.y + b.y) / 2 - r.top - ch / 2);
    } else if (ptrs.size === 1) { x += dx; y += dy; clamp(); apply(); }
  }, { signal: env.sig });
  const end = (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId); pinch = null;
    if (ptrs.size === 0 && moved < 8 && e.type === "pointerup") {
      if (e.timeStamp - lastTap < 320) { const [px, py] = rel(e); zoomAt(z > 1.2 ? 1 : 2.5, px, py); haptic("tick"); lastTap = 0; } else lastTap = e.timeStamp;
    }
  };
  box.addEventListener("pointerup", end, { signal: env.sig });
  box.addEventListener("pointercancel", end, { signal: env.sig });
  box.addEventListener("wheel", (e) => { e.preventDefault(); const [px, py] = rel(e); zoomAt(z * (e.deltaY < 0 ? 1.15 : 0.87), px, py); }, { passive: false, signal: env.sig });
  return { reset() { z = 1; x = y = 0; img.style.transition = "transform .35s cubic-bezier(0.23, 1, 0.32, 1)"; apply(); setTimeout(() => { img.style.transition = ""; }, 400); } };
}

/* =====================================================================
   ORDENA — arrossega per ordenar (pointer events + teclat)
   ===================================================================== */
async function playOrdena(root, env, restart) {
  const sets = shuffle((await getJocs()).ordena.filter((s) => s.items?.length >= 3)).slice(0, 3);
  if (!sets.length) { root.innerHTML = head("Ordena") + `<div class="empty">Encara no hi ha cronologies per ordenar.</div>`; return; }
  const R = sets.length;
  let r = 0, totalOk = 0, totalItems = 0, perfect = 0, xpAcc = 0;

  function round() {
    const set = sets[r];
    const n = set.items.length;
    let order = shuffle(set.items.map((it, k) => ({ ...it, k })));
    const sorted = () => order.every((o, p) => p === 0 || order[p - 1].any <= o.any);
    let guard = 0; while (sorted() && guard++ < 10) order = shuffle(order);
    let checked = false, grab = null;
    root.innerHTML = `${head("Ordena", `<span class="jg-ocount">Ronda ${r + 1}/${R}</span>`)}
      <h2 class="jg-ord-t">${esc(set.titol)}</h2>
      <p class="muted jg-ord-h">Arrossega des de la nansa de l'esquerra, o fes servir el teclat: espai per agafar, fletxes per moure.</p>
      <ol class="jg-list" id="list" aria-label="${esc(set.titol)}">${order.map((o) => `<li class="jg-row" data-k="${o.k}"><button type="button" class="jg-grip" aria-label="${esc(o.text)}. Mou-lo amb espai i les fletxes" aria-pressed="false"><svg viewBox="0 0 24 24" class="jx-ic" aria-hidden="true"><path d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01" stroke-width="3"/></svg></button><span class="t">${esc(o.text)}</span><span class="y" aria-hidden="true">${esc(fmtYear(o.any))}</span></li>`).join("")}</ol>
      <div class="jg-live" id="live" aria-live="polite"></div>
      <div class="jg-ord-a"><button type="button" class="btn jg-check" id="check">Comprova</button></div>`;
    const list = $("#list", root), live = $("#live", root);
    const rows = () => $$(".jg-row", list);
    const itemOf = (row) => set.items[+row.dataset.k];

    // FLIP: mesura, canvia el DOM, i anima des d'on era fins on és
    function flip(mutate, dur = 240) {
      const rs = rows(), first = new Map(rs.map((e) => [e, e.getBoundingClientRect().top]));
      mutate();
      rows().forEach((e) => {
        const d = first.get(e) - e.getBoundingClientRect().top;
        if (d && !reduced()) env.anim(e.animate([{ transform: `translateY(${d}px)` }, { transform: "none" }], { duration: dur, easing: EASE }));
      });
    }

    // ---- arrossegament amb el dit/ratolí ----
    let dr = null;
    list.addEventListener("pointerdown", (e) => {
      const g = e.target.closest(".jg-grip"); if (!g || checked || dr) return;
      e.preventDefault();
      const row = g.closest(".jg-row"), rs = rows(), rects = rs.map((x) => x.getBoundingClientRect());
      const i0 = rs.indexOf(row);
      dr = { row, rs, rects, i0, t: i0, y0: e.clientY, id: e.pointerId, h: rects[i0].height + (rects[1] ? rects[1].top - rects[0].bottom : 8) };
      g.setPointerCapture(e.pointerId); row.classList.add("lift"); haptic("tap");
      rs.forEach((x) => { if (x !== row) x.classList.add("shifty"); });
    }, { signal: env.sig });
    list.addEventListener("pointermove", (e) => {
      if (!dr || e.pointerId !== dr.id) return;
      const { row, rs, rects, i0, h } = dr, dy = e.clientY - dr.y0;
      row.style.transform = `translateY(${dy}px) scale(1.02)`;
      const cy = rects[i0].top + rects[i0].height / 2 + dy;
      let t = 0; rs.forEach((x, j) => { if (j !== i0 && rects[j].top + rects[j].height / 2 < cy) t++; });
      if (t !== dr.t) { dr.t = t; haptic("tick"); }
      rs.forEach((x, j) => { if (j === i0) return; x.style.transform = i0 < j && j <= t ? `translateY(${-h}px)` : t <= j && j < i0 ? `translateY(${h}px)` : ""; });
    }, { signal: env.sig });
    const drop = (e) => {
      if (!dr || e.pointerId !== dr.id) return;
      const { row, rs, i0, t } = dr; dr = null;
      const rowTop = row.getBoundingClientRect().top;
      const firsts = new Map(rs.map((x) => [x, x === row ? rowTop : x.getBoundingClientRect().top]));
      rs.forEach((x) => { x.classList.remove("shifty"); x.style.transform = ""; }); row.classList.remove("lift");
      if (t !== i0) { const ref = rs.filter((x) => x !== row)[t]; if (ref) list.insertBefore(row, ref); else list.appendChild(row); }
      rows().forEach((x) => { const d = firsts.get(x) - x.getBoundingClientRect().top; if (d && !reduced()) env.anim(x.animate([{ transform: `translateY(${d}px)` }, { transform: "none" }], { duration: 260, easing: EASE })); });
      if (t !== i0) { feedback("snap"); announce(row); }
    };
    list.addEventListener("pointerup", drop, { signal: env.sig });
    list.addEventListener("pointercancel", drop, { signal: env.sig });

    // ---- teclat ----
    function announce(row) { const p = rows().indexOf(row) + 1; live.textContent = `${itemOf(row).text}, posició ${p} de ${n}`; }
    list.addEventListener("keydown", (e) => {
      const g = e.target.closest(".jg-grip"); if (!g || checked) return;
      const row = g.closest(".jg-row");
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); grab = grab === row ? null : row; g.setAttribute("aria-pressed", String(grab === row)); row.classList.toggle("lift", grab === row); if (grab) announce(row); }
      else if (grab === row && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        const rs = rows(), p = rs.indexOf(row), q = e.key === "ArrowUp" ? p - 1 : p + 1;
        if (q < 0 || q >= rs.length) return;
        flip(() => { if (e.key === "ArrowUp") list.insertBefore(row, rs[q]); else list.insertBefore(rs[q], row); });
        g.focus(); announce(row); haptic("tick");
      } else if (grab === row && e.key === "Escape") { grab = null; g.setAttribute("aria-pressed", "false"); row.classList.remove("lift"); }
    }, { signal: env.sig });
    list.addEventListener("focusout", (e) => { const g = e.target.closest?.(".jg-grip"); if (g && grab === g.closest(".jg-row")) { grab.classList.remove("lift"); g.setAttribute("aria-pressed", "false"); grab = null; } }, { signal: env.sig });

    // ---- correcció ----
    $("#check", root).addEventListener("click", () => {
      if (!checked) check(); else if (r + 1 < R) { r++; round(); } else finish();
    }, { signal: env.sig });
    function check() {
      checked = true;
      const rs = rows(), years = set.items.map((x) => x.any).sort((a, b) => a - b);
      const ok = rs.map((row, p) => itemOf(row).any === years[p]);
      const good = ok.filter(Boolean).length, perf = good === n;
      totalOk += good; totalItems += n; if (perf) perfect++;
      xpAcc += good * 5 + (perf ? 25 : 0);
      $$(".jg-grip", list).forEach((g) => (g.disabled = true));
      const btn = $("#check", root); btn.disabled = true;
      rs.forEach((row, p) => {
        env.later(() => {
          row.classList.add("revealed", ok[p] ? "ok" : "ko");
          const y = $(".y", row); if (!reduced()) y.animate([{ opacity: 0, transform: "scale(.7)" }, { opacity: 1, transform: "none" }], { duration: 300, easing: EASE });
          if (ok[p]) haptic("tick"); else shake(row);
        }, p * 130);
      });
      const tEnd = n * 130 + 350;
      env.later(() => {
        if (!perf) {
          flip(() => { [...rs].sort((a, b) => itemOf(a).any - itemOf(b).any || (+a.dataset.k - +b.dataset.k)).forEach((row) => list.appendChild(row)); }, 520);
          rs.forEach((row) => row.classList.add("settled"));
          live.textContent = `${good} de ${n} al lloc. Ordre correcte mostrat.`;
        } else { confetti({ y: 0.5, count: 80 }); live.textContent = "Ordre perfecte!"; }
        feedback(perf ? "win" : good >= n / 2 ? "ok" : "ko");
        const msg = document.createElement("div"); msg.className = `jg-ordmsg ${perf ? "ok" : ""}`;
        msg.textContent = perf ? "Ordre perfecte. Ni un error!" : good === 0 ? "Cap al lloc. Mira l'ordre correcte i en traiem la lliçó." : `${good} de ${n} al lloc.`;
        $(".jg-ord-a", root).prepend(msg); slideIn(msg, 8);
        btn.disabled = false; btn.textContent = r + 1 < R ? "Següent ronda" : "Veure el resultat"; btn.focus({ preventScroll: true });
      }, tEnd);
    }
  }
  function finish() {
    const xp = xpAcc + 10;
    const prevBest = P.get().games.ordena?.played ? P.get().games.ordena.best || 0 : Infinity;
    P.recordGame("ordena", { score: totalOk, perfect });
    showResult(env, root, { msg: perfect === R ? "Cronista impecable." : totalOk >= totalItems * 0.6 ? "Tens bon sentit del temps." : "El temps és relatiu… sobretot el romà.", value: totalOk, total: totalItems, xp, newRecord: totalOk > prevBest && perfect === R,
      icon: "timeline", confetti: perfect === R ? 2 : 0, lines: [`Rondes perfectes: <b>${perfect}</b> de ${R}`, `Peces al lloc: <b>${totalOk}</b> de ${totalItems}`], again: restart });
  }
  round();
}
