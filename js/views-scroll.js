// «Descobreix»: feed vertical de curiositats a pantalla completa (scroll-snap, virtualitzat, infinit)
import { esc, inline, commonsUrl, PERIODES } from "./util.js";
import { llocsMap } from "./data.js";
import { getCuriositats } from "./data-jocs.js";
import * as P from "./progress.js";
import { loadCss, ico, HEART, countUp, fmtNum, feedback, haptic, pop, reduced, fxToast, spring } from "./fx.js";

const WIN_BEFORE = 1, WIN_AFTER = 3; // targetes al DOM: i-1 … i+3 (5)

// ---- número gran: «50.000», «53 milions», «330» → parteix prefix / valor / sufix ----
function parseXifra(x) {
  const m = /^(\D*?)(\d[\d.]*)(.*)$/.exec(String(x ?? "").trim());
  if (!m) return null;
  const n = Number(m[2].replace(/\./g, ""));
  return Number.isFinite(n) ? { pre: m[1], n, post: m[3] } : null;
}

function bgImg(i, w = 1200) {
  return i?.fitxer ? `<img class="sc-bg" src="${esc(commonsUrl(i.fitxer, w))}" alt="${esc(i.descripcio || "")}" decoding="async" draggable="false">` : "";
}

function bodyFor(c, ctx) {
  const lloc = c.lloc && ctx.llocs.get(c.lloc);
  const place = lloc ? `<a class="sc-place" href="#/lloc/${encodeURIComponent(lloc.id)}">${ico("pin")}<span>Veure el lloc</span><em>${esc(lloc.nom)}</em></a>` : "";
  const per = PERIODES[c.periode] ? `<span class="sc-chip">${esc(PERIODES[c.periode])}</span>` : "";
  const text = `<p class="sc-text">${inline(c.text || "")}</p>`;
  switch (c.tipus) {
    case "xifra": {
      const p = parseXifra(c.xifra);
      const done = ctx.counted.has(c.id);
      return `<div class="sc-body">${per}
        <div class="sc-num${String(c.xifra).length > 6 ? " long" : ""}" ${p ? `data-n="${p.n}" data-pre="${esc(p.pre)}" data-post="${esc(p.post)}"` : ""} aria-label="${esc(c.xifra)}"><span aria-hidden="true">${p ? esc(p.pre) + (done ? fmtNum(p.n) : "0") + esc(p.post) : esc(c.xifra)}</span></div>
        <h2 class="sc-title">${esc(c.titol)}</h2>${text}${place}</div>`;
    }
    case "cita": {
      const q = c.cita || {};
      return `<div class="sc-body"><div class="sc-plaque"><h2 class="sc-title">${esc(c.titol)}</h2>
        <blockquote><p>${inline(c.text || "")}</p><footer>${esc(q.autor || "")}${q.obra ? `<span>${esc(q.obra)}</span>` : ""}</footer></blockquote></div>${place}</div>`;
    }
    case "mite-o-realitat": {
      const a = P.getScrollMite(c.id);
      return `<div class="sc-body">${per}<div class="sc-q">Mite o realitat?</div>
        <h2 class="sc-title">${esc(c.titol)}</h2><p class="sc-claim">${inline(c.text || "")}</p>
        <div class="sc-choices" ${a ? `data-done data-chosen="${esc(a.choice)}"` : ""}>
          <button type="button" class="sc-choice mite" data-ans="mite">Mite</button>
          <button type="button" class="sc-choice real" data-ans="realitat">Realitat</button>
        </div>
        <div class="sc-reveal" aria-live="polite">${a ? revealHTML(c, a.choice, a.ok) : ""}</div>${place}</div>`;
    }
    case "abans-despres": {
      const ab = c.imatge_abans;
      return `<div class="sc-body"><div class="sc-cmp" data-pos="50" role="group" aria-label="Comparador abans i ara">
          <img class="sc-cmp-a" src="${esc(commonsUrl(c.imatge?.fitxer, 1000))}" alt="${esc(c.imatge?.descripcio || "Ara")}" draggable="false" decoding="async">
          ${ab ? `<img class="sc-cmp-b" src="${esc(commonsUrl(ab.fitxer, 1000))}" alt="${esc(ab.descripcio || "Abans")}" draggable="false" decoding="async">` : ""}
          <span class="sc-tag l">Abans</span><span class="sc-tag r">Ara</span>
          <div class="sc-cmp-line"><button type="button" class="sc-knob" role="slider" aria-label="Posició del comparador" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50">${ico("chevron-left")}${ico("chevron-right")}</button></div>
        </div>
        <h2 class="sc-title">${esc(c.titol)}</h2>${text}${place}</div>`;
    }
    case "personatge":
      return `<div class="sc-body"><div class="sc-portrait">${c.imatge?.fitxer ? `<img src="${esc(commonsUrl(c.imatge.fitxer, 900))}" alt="${esc(c.imatge.descripcio || "")}" decoding="async" draggable="false">` : ""}</div>
        <span class="sc-chip gold">Personatge</span><h2 class="sc-title">${esc(c.titol)}</h2>${text}${place}</div>`;
    case "vida-quotidiana":
      return `<div class="sc-body"><div class="sc-note"><span class="sc-chip">Vida quotidiana</span><h2 class="sc-title">${esc(c.titol)}</h2>${text}</div>${place}</div>`;
    default:
      return `<div class="sc-body">${per}<h2 class="sc-title">${esc(c.titol)}</h2>${text}${place}</div>`;
  }
}

function revealHTML(c, choice, ok) {
  const real = c.mite?.veritat;
  return `<div class="sc-verdict ${ok ? "ok" : "ko"}"><span class="sc-stamp ${real ? "real" : "mite"}">${real ? "Realitat" : "Mite"}</span>
    <p><b>${ok ? "Ben vist!" : "Ep, aquesta ha colat."}</b> ${inline(c.mite?.explicacio || "")}</p></div>`;
}

function cardHTML(c, i, ctx) {
  const liked = P.isCuriFav(c.id);
  const credit = c.imatge ? [c.imatge.credit, c.imatge.llicencia].filter(Boolean).join(" · ") : "";
  const bg = c.tipus === "abans-despres" ? bgImg(c.imatge, 600) : bgImg(c.imatge);
  const ans = c.tipus === "mite-o-realitat" ? P.getScrollMite(c.id) : null;
  return `<article class="sc-card t-${esc(c.tipus)}${ans ? (ans.ok ? " won" : " lost") : ""}" data-i="${i}" data-id="${esc(c.id)}" aria-roledescription="targeta" aria-label="${esc(c.titol)}">
    ${bg}<div class="sc-shade"></div>${bodyFor(c, ctx)}
    <div class="sc-rail">
      <button type="button" class="sc-btn like" data-act="like" aria-pressed="${liked}" aria-label="${liked ? "Treu l'm'agrada" : "M'agrada"}">${HEART}</button>
      <button type="button" class="sc-btn" data-act="share" aria-label="Comparteix">${ico("share")}</button>
    </div>
    ${credit ? `<div class="sc-credit">${esc(credit)} · Wikimedia Commons</div>` : ""}
  </article>`;
}

export async function scroll(ctx = {}) {
  await Promise.all([loadCss(), P.ready()]);
  const [cards, llocs] = await Promise.all([getCuriositats(), llocsMap()]);
  if (!cards.length) {
    return { html: `<div class="view-in"><h1>Descobreix</h1><div class="empty">Encara no hi ha curiositats carregades. Torna-hi aviat.</div></div>`, title: "Descobreix", tab: "scroll" };
  }
  const startId = ctx.params?.c || ctx.c;
  const html = `<section class="sc" aria-label="Curiositats de Roma">
      <div class="sc-hud" aria-live="polite"><span class="sc-pill" id="sc-seen">${ico("eye")}<b>0</b><i>vistes</i></span><span class="sc-pill gold" id="sc-xp"><b>0</b><i>XP</i><em></em></span></div>
      <div class="sc-view" tabindex="0" aria-label="Llisca cap amunt per veure la següent targeta"><div class="sc-sizer"></div></div>
      <div class="sc-hint" id="sc-hint" aria-hidden="true">${ico("chevron-right", "up")}<span>Llisca</span></div>
    </section>`;

  let ac, ro, seenTimer, unsub, cancelCount = () => {}, springs = new Set();
  return {
    html, title: "Descobreix", tab: "scroll", cls: "sc-main",
    mount(main) {
      ac = new AbortController(); const sig = { signal: ac.signal };
      const root = main.querySelector(".sc"), view = root.querySelector(".sc-view"), sizer = root.querySelector(".sc-sizer");
      const state = { llocs, counted: new Set() };
      const deck = [], nodes = new Map(), pre = new Set();
      let H = view.clientHeight || 600, idx = -1, hintGone = P.seenCount() > 5;
      const hint = root.querySelector("#sc-hint"); if (hintGone) hint.remove();

      // ---- baralla ponderada: sense repetir les recents, variant el tipus ----
      function pick() {
        const recentN = Math.min(30, cards.length - 1);
        const recent = new Set(deck.slice(-recentN).map((c) => c.id));
        const lastT = deck.slice(-2).map((c) => c.tipus);
        let pool = cards.filter((c) => !recent.has(c.id));
        if (!pool.length) pool = cards;
        const w = pool.map((c) => (P.hasSeen(c.id) ? 1 : 3) * (lastT.includes(c.tipus) ? 0.25 : 1));
        let r = Math.random() * w.reduce((a, b) => a + b, 0), k = 0;
        for (; k < pool.length - 1; k++) { r -= w[k]; if (r <= 0) break; }
        return pool[k];
      }
      function ensure(n) { while (deck.length < n) deck.push(pick()); }
      const first = cards.find((c) => c.id === startId);
      if (first) deck.push(first);
      ensure(10);

      function layout() {
        sizer.style.height = deck.length * H + "px";
        nodes.forEach((el, i) => { el.style.top = i * H + "px"; el.style.height = H + "px"; });
      }
      function make(i) {
        const t = document.createElement("div");
        t.innerHTML = cardHTML(deck[i], i, state);
        const el = t.firstElementChild;
        el.style.top = i * H + "px"; el.style.height = H + "px";
        view.appendChild(el); nodes.set(i, el);
        el.querySelectorAll("img.sc-bg").forEach((im) => { if (im.complete && im.naturalWidth) im.classList.add("ld"); });
        initCompare(el);
        if (i === idx) el.classList.add("on");
        return el;
      }
      function renderWindow() {
        ensure(idx + 10); layout();
        for (let j = idx - WIN_BEFORE; j <= idx + WIN_AFTER; j++) if (j >= 0 && !nodes.has(j)) make(j);
        nodes.forEach((el, j) => { if (j < idx - WIN_BEFORE || j > idx + WIN_AFTER) { el.remove(); nodes.delete(j); } });
        // precàrrega: la imatge següent abans que hi arribis
        for (let j = idx + 1; j <= idx + 4; j++) {
          const f = deck[j]?.imatge?.fitxer;
          if (f && !pre.has(f)) { pre.add(f); const im = new Image(); im.decoding = "async"; im.src = commonsUrl(f, 1200); }
        }
      }

      // ---- activació de la targeta visible ----
      function activate(i) {
        nodes.get(idx)?.classList.remove("on");
        idx = i;
        const el = nodes.get(i); el?.classList.add("on");
        renderWindow();
        const c = deck[i];
        clearTimeout(seenTimer);
        seenTimer = setTimeout(() => { if (idx === i) { P.markSeen(c.id); hud(); } }, 900);
        if (c.tipus === "xifra") runCount(nodes.get(i), c);
        if (c.tipus === "abans-despres") hintCompare(nodes.get(i), c);
        if (!hintGone && i > 0) { hintGone = true; hint.classList.add("gone"); setTimeout(() => hint.remove(), 400); }
      }
      function runCount(el, c) {
        const num = el?.querySelector(".sc-num[data-n]"); if (!num || state.counted.has(c.id)) return;
        state.counted.add(c.id);
        const span = num.firstElementChild, n = +num.dataset.n, pre = num.dataset.pre, post = num.dataset.post;
        cancelCount();
        cancelCount = countUp(span, n, { duration: 1100, format: (v) => pre + fmtNum(v) + post });
      }
      function hintCompare(el, c) {
        const cmp = el?.querySelector(".sc-cmp"); if (!cmp || cmp.dataset.hinted || reduced()) return;
        cmp.dataset.hinted = "1";
        const s = spring({ from: 64, to: 50, velocity: -160, stiffness: 120, damping: 9, onUpdate: (v) => setCmp(cmp, v), onDone: () => springs.delete(s) });
        springs.add(s);
      }

      // ---- HUD ----
      const seenEl = root.querySelector("#sc-seen b"), xpEl = root.querySelector("#sc-xp");
      let lastXp = P.xp();
      function hud() {
        seenEl.textContent = fmtNum(P.seenCount());
        const x = P.xp(), r = P.rankFor(x);
        xpEl.querySelector("b").textContent = fmtNum(x);
        xpEl.querySelector("em").textContent = r.nom;
        if (x > lastXp) { pop(xpEl, { scale: 1.12, ms: 300 }); }
        lastXp = x;
      }
      hud(); unsub = P.onChange(hud);

      // ---- scroll → targeta activa ----
      let raf = 0;
      view.addEventListener("scroll", () => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const i = Math.max(0, Math.round(view.scrollTop / H));
          if (i !== idx) activate(i);
        });
      }, { passive: true, ...sig });
      function go(i) { view.scrollTo({ top: Math.max(0, i) * H, behavior: reduced() ? "auto" : "smooth" }); }
      view.addEventListener("keydown", (e) => {
        if (e.target !== view) return;
        if (["ArrowDown", "PageDown", "j"].includes(e.key)) { e.preventDefault(); go(idx + 1); }
        else if (["ArrowUp", "PageUp", "k"].includes(e.key)) { e.preventDefault(); go(idx - 1); }
      }, sig);
      ro = new ResizeObserver(() => {
        const h = view.clientHeight; if (!h || h === H) return;
        H = h; layout(); view.scrollTo({ top: Math.max(0, idx) * H, behavior: "instant" });
      });
      ro.observe(view);
      view.addEventListener("load", (e) => { if (e.target.classList?.contains("sc-bg")) e.target.classList.add("ld"); }, { capture: true, ...sig });

      // ---- m'agrada, compartir, mite o realitat ----
      function like(c, el, on) {
        const was = P.isCuriFav(c.id);
        if (on === true && was) return;
        const now = P.toggleCuriFav(c.id);
        const b = el.querySelector(".like");
        b.setAttribute("aria-pressed", String(now)); b.setAttribute("aria-label", now ? "Treu l'm'agrada" : "M'agrada");
        if (now) { feedback("like"); pop(b, { scale: 1.3, ms: 340 }); } else haptic("tap");
        return now;
      }
      function burst(el, x, y) {
        const r = el.getBoundingClientRect();
        const h = document.createElement("div"); h.className = "sc-burst"; h.innerHTML = HEART;
        h.style.left = x - r.left + "px"; h.style.top = y - r.top + "px"; el.appendChild(h);
        const rot = (Math.random() - 0.5) * 24;
        if (reduced()) { h.animate([{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }], { duration: 600 }).onfinish = () => h.remove(); return; }
        h.animate([
          { transform: `translate(-50%,-50%) scale(.3) rotate(${rot}deg)`, opacity: 0 },
          { transform: `translate(-50%,-50%) scale(1.25) rotate(${rot}deg)`, opacity: 1, offset: 0.28 },
          { transform: `translate(-50%,-56%) scale(1) rotate(${rot}deg)`, opacity: 1, offset: 0.6 },
          { transform: `translate(-50%,-140%) scale(1.05) rotate(${rot}deg)`, opacity: 0 },
        ], { duration: 820, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }).onfinish = () => h.remove();
      }
      async function share(c) {
        const base = location.hash.split("?")[0] || "#/scroll";
        const url = `${location.href.split("#")[0]}${base}?c=${encodeURIComponent(c.id)}`;
        const data = { title: c.titol, text: `${c.titol}. ${c.text || ""}`.slice(0, 280), url };
        if (navigator.share) {
          try { await navigator.share(data); return; } catch (e) { if (e?.name === "AbortError") return; }
        }
        let ok = false;
        try { await navigator.clipboard.writeText(`${data.title}\n${url}`); ok = true; } catch {
          try { const t = document.createElement("textarea"); t.value = `${data.title}\n${url}`; t.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(t); t.select(); ok = document.execCommand("copy"); t.remove(); } catch {}
        }
        fxToast(ok ? "<span><b>Enllaç copiat</b><small>Ja el pots enganxar on vulguis.</small></span>" : "<span><b>No s'ha pogut compartir</b></span>", { ms: 2200 });
      }
      main.addEventListener("click", (e) => {
        const b = e.target.closest("[data-act], [data-ans]"); if (!b || !root.contains(b)) return;
        const el = b.closest(".sc-card"), c = deck[+el.dataset.i];
        if (b.dataset.act === "like") like(c, el);
        else if (b.dataset.act === "share") share(c);
        else if (b.dataset.ans) answer(c, el, b.dataset.ans);
      }, sig);
      function answer(c, el, choice) {
        const box = el.querySelector(".sc-choices"); if (box.hasAttribute("data-done")) return;
        const ok = (choice === "realitat") === !!c.mite?.veritat;
        box.setAttribute("data-done", ""); box.dataset.chosen = choice;
        P.setScrollMite(c.id, { choice, ok });
        const rv = el.querySelector(".sc-reveal"); rv.innerHTML = revealHTML(c, choice, ok);
        feedback(ok ? "ok" : "ko");
        P.recordMite(ok); P.addXP(ok ? 5 : 1, { silent: false });
        const st = rv.querySelector(".sc-stamp"), v = rv.firstElementChild;
        if (!reduced()) {
          v.animate([{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], { duration: 320, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
          st.animate([{ opacity: 0, transform: "scale(1.7) rotate(-14deg)" }, { opacity: 1, transform: "scale(1) rotate(-5deg)" }], { duration: 380, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "both" });
          if (!ok) el.querySelector(".sc-body").animate([{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(5px)" }, { transform: "translateX(0)" }], { duration: 280, easing: "ease-out" });
        }
        el.classList.add(ok ? "won" : "lost");
      }

      // ---- doble toc = m'agrada ----
      let last = null, down = null;
      view.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, t: e.timeStamp }; }, { passive: true, ...sig });
      view.addEventListener("pointercancel", () => { down = null; last = null; }, sig);
      view.addEventListener("pointerup", (e) => {
        if (!down) return;
        const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dur = e.timeStamp - down.t; down = null;
        if (moved > 10 || dur > 300) { last = null; return; }
        if (e.target.closest("button, a, .sc-cmp, .sc-choices")) { last = null; return; }
        if (last && e.timeStamp - last.t < 320 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 48) {
          const el = e.target.closest(".sc-card"); last = null;
          if (el) { const c = deck[+el.dataset.i]; like(c, el, true); burst(el, e.clientX, e.clientY); }
        } else last = { t: e.timeStamp, x: e.clientX, y: e.clientY };
      }, sig);

      // ---- comparador abans/després ----
      function setCmp(cmp, v) {
        v = Math.max(0, Math.min(100, v)); cmp.dataset.pos = v;
        cmp.style.setProperty("--p", v + "%");
        const b = cmp.querySelector(".sc-cmp-b"); if (b) b.style.clipPath = `inset(0 ${100 - v}% 0 0)`;
        cmp.querySelector(".sc-knob")?.setAttribute("aria-valuenow", String(Math.round(v)));
      }
      function initCompare(el) {
        const cmp = el.querySelector(".sc-cmp"); if (!cmp) return;
        setCmp(cmp, 50);
        let drag = null;
        const at = (e) => { const r = cmp.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * 100; };
        cmp.addEventListener("pointerdown", (e) => {
          drag = e.pointerId; cmp.setPointerCapture(e.pointerId); cmp.classList.add("drag");
          springs.forEach((s) => s.cancel()); springs.clear();
          setCmp(cmp, at(e)); haptic("tick");
        });
        cmp.addEventListener("pointermove", (e) => { if (drag === e.pointerId) setCmp(cmp, at(e)); });
        const end = (e) => { if (drag === e.pointerId) { drag = null; cmp.classList.remove("drag"); } };
        cmp.addEventListener("pointerup", end); cmp.addEventListener("pointercancel", end);
        cmp.querySelector(".sc-knob")?.addEventListener("keydown", (e) => {
          const d = e.key === "ArrowLeft" ? -5 : e.key === "ArrowRight" ? 5 : e.key === "Home" ? -100 : e.key === "End" ? 100 : 0;
          if (d) { e.preventDefault(); setCmp(cmp, +cmp.dataset.pos + d); }
        });
      }

      // ---- arrencada ----
      activate(0);
    },
    unmount() {
      ac?.abort(); ro?.disconnect(); unsub?.(); clearTimeout(seenTimer); cancelCount();
      springs.forEach((s) => s.cancel()); springs.clear();
    },
  };
}
