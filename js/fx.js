// Efectes: confeti, hàptics, sons curts (desactivats per defecte), count-up, toasts, molls i icones.
import { esc, store } from "./util.js";

export const reduced = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// ---------- CSS propi (s'injecta sol, no cal tocar index.html) ----------
let cssP;
export function loadCss() {
  if (cssP) return cssP;
  const href = new URL("../css/jocs.css", import.meta.url).href;
  const existing = document.querySelector(`link[data-jocs-css], link[href$="css/jocs.css"]`);
  if (existing) return (cssP = Promise.resolve());
  cssP = new Promise((res) => {
    const l = document.createElement("link");
    l.rel = "stylesheet"; l.href = href; l.dataset.jocsCss = "";
    l.onload = l.onerror = () => res();
    document.head.appendChild(l);
    setTimeout(res, 1500);
  });
  return cssP;
}

// ---------- icones (sprite del dissenyador: icons/set/sprite.svg, ids «i-nom») ----------
export function ico(name, cls = "") {
  return `<svg class="jx-ic ${cls}" aria-hidden="true" focusable="false"><use href="icons/set/sprite.svg#i-${esc(name)}"></use></svg>`;
}
export const HEART = `<svg class="jx-ic jx-heart" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.7 7.7 3.7 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.3 0 5.3 3.2 4.2 6.6-1.7 4.8-9.2 9.4-9.2 9.4z"/></svg>`;
// Medalló: icona del sprite si existeix; si no, monograma
export function medal(icona, nom, cls = "") {
  const letter = esc(String(nom || "?").trim().charAt(0).toUpperCase());
  const isEmoji = icona && /[^\x00-\x7f]/.test(icona);
  const inner = isEmoji ? `<span class="jx-medal-e">${esc(icona)}</span>` : icona ? `${ico(icona, "jx-medal-i")}` : "";
  return `<span class="jx-medal ${cls}" data-icon="${esc(icona || "")}"><span class="jx-medal-l">${letter}</span>${inner}</span>`;
}
// Si l'id d'icona no existeix al sprite, el <use> queda buit: detectem-ho i deixem només la lletra
const spriteIds = (async () => {
  try { const t = await (await fetch("icons/set/sprite.svg")).text(); return new Set([...t.matchAll(/id="i-([^"]+)"/g)].map((m) => m[1])); } catch { return null; }
})();
export async function fixMedals(root = document) {
  const ids = await spriteIds;
  root.querySelectorAll(".jx-medal[data-icon]").forEach((m) => {
    const id = m.dataset.icon;
    if (id && /^[\x00-\x7f]+$/.test(id) && (!ids || !ids.has(id))) m.querySelector(".jx-medal-i")?.remove();
    else if (id) m.classList.add("has-i");
  });
}

// ---------- hàptics i sons ----------
const prefs = () => store.get("roma.fx", { sound: false, haptics: true });
export const isSoundOn = () => !!prefs().sound;
export const isHapticsOn = () => prefs().haptics !== false;
export function setSound(on) { store.set("roma.fx", { ...prefs(), sound: !!on }); }
export function setHaptics(on) { store.set("roma.fx", { ...prefs(), haptics: !!on }); }

const PATTERNS = { tap: 8, ok: [14, 40, 14], ko: [38, 50, 38], big: [20, 30, 20, 30, 50], stamp: 40, snap: 10, tick: 4 };
export function haptic(kind = "tap") {
  if (!isHapticsOn() || (navigator.userActivation && !navigator.userActivation.hasBeenActive)) return;
  try { navigator.vibrate?.(PATTERNS[kind] ?? kind); } catch {}
}

let actx;
function tone(freq, t0, dur, type = "sine", gain = 0.12) {
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, actx.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(gain, actx.currentTime + t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + t0 + dur);
  o.connect(g).connect(actx.destination);
  o.start(actx.currentTime + t0); o.stop(actx.currentTime + t0 + dur + 0.02);
}
const SOUNDS = {
  ok: () => { tone(523, 0, 0.12); tone(784, 0.09, 0.2); },
  ko: () => { tone(196, 0, 0.18, "triangle", 0.14); tone(147, 0.1, 0.22, "triangle", 0.14); },
  win: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.25)); },
  stamp: () => { tone(110, 0, 0.16, "square", 0.1); tone(70, 0.02, 0.2, "sine", 0.16); },
  tap: () => tone(660, 0, 0.05, "sine", 0.06),
  like: () => { tone(740, 0, 0.08); tone(988, 0.07, 0.14); },
};
export function sound(kind) {
  if (!isSoundOn()) return;
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === "suspended") actx.resume();
    SOUNDS[kind]?.();
  } catch {}
}
// Feedback combinat: vibració + so, al mateix moment
export function feedback(kind) {
  haptic(kind === "win" ? "big" : kind);
  sound(kind);
}

// ---------- count-up ----------
export const fmtNum = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export function countUp(el, to, { from = 0, duration = 1000, format = fmtNum, suffix = "" } = {}) {
  if (!el) return () => {};
  if (reduced() || to === from) { el.textContent = format(to) + suffix; return () => {}; }
  let raf, t0;
  const step = (t) => {
    t0 ??= t;
    const p = Math.min(1, (t - t0) / duration);
    el.textContent = format(from + (to - from) * easeOutExpo(p)) + suffix;
    if (p < 1) raf = requestAnimationFrame(step);
  };
  el.textContent = format(from) + suffix;
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

// ---------- molla (per llançar targetes, tornar-les enrere…) ----------
// Integrador semi-implícit amb velocitat inicial (px/s): el moviment continua el gest sense salt.
export function spring({ from, to, velocity = 0, stiffness = 260, damping = 24, mass = 1, onUpdate, onDone }) {
  let x = from, v = velocity, raf, last, dead = false;
  const rest = 0.4;
  const frame = (t) => {
    if (dead) return;
    last ??= t;
    let dt = Math.min(0.032, (t - last) / 1000); last = t;
    while (dt > 0) {
      const h = Math.min(dt, 1 / 120);
      const a = (-stiffness * (x - to) - damping * v) / mass;
      v += a * h; x += v * h; dt -= h;
    }
    if (Math.abs(x - to) < rest && Math.abs(v) < 8) { x = to; onUpdate(x); dead = true; onDone?.(); return; }
    onUpdate(x);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return { cancel() { dead = true; cancelAnimationFrame(raf); }, get value() { return x; }, get velocity() { return v; } };
}

// ---------- confeti ----------
const PALETTE = ["#b98a2e", "#e0b955", "#9c4527", "#d9774f", "#4b6b3a", "#f1e3b8", "#ffffff", "#2f5d9e"];
export function confetti({ x = 0.5, y = 0.35, count = 140, power = 1 } = {}) {
  if (reduced()) return;
  const cv = document.createElement("canvas");
  cv.className = "jx-confetti"; cv.setAttribute("aria-hidden", "true");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = window.innerWidth, H = window.innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  document.body.appendChild(cv);
  const c = cv.getContext("2d"); c.scale(dpr, dpr);
  const ps = Array.from({ length: count }, () => {
    const a = (-Math.PI / 2) + (Math.random() - 0.5) * Math.PI * 1.1;
    const s = (6 + Math.random() * 11) * power;
    return { x: x * W, y: y * H, vx: Math.cos(a) * s, vy: Math.sin(a) * s, w: 5 + Math.random() * 6, h: 3 + Math.random() * 5,
      r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4, col: PALETTE[(Math.random() * PALETTE.length) | 0], round: Math.random() < 0.25, life: 0 };
  });
  let raf, last;
  const frame = (t) => {
    last ??= t; const dt = Math.min(2, (t - last) / 16.67); last = t;
    c.clearRect(0, 0, W, H);
    let alive = 0;
    for (const p of ps) {
      p.vy += 0.32 * dt; p.vx *= 0.992; p.vy *= 0.992;
      p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; p.life += dt;
      if (p.y < H + 20) alive++;
      c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.fillStyle = p.col;
      c.globalAlpha = Math.max(0, 1 - Math.max(0, p.life - 90) / 40);
      if (p.round) { c.beginPath(); c.arc(0, 0, p.w / 2.2, 0, 6.28); c.fill(); } else c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      c.restore();
    }
    if (alive && ps[0].life < 140) raf = requestAnimationFrame(frame); else { cancelAnimationFrame(raf); cv.remove(); }
  };
  raf = requestAnimationFrame(frame);
  return () => { cancelAnimationFrame(raf); cv.remove(); };
}

// ---------- toasts animats ----------
let toastBox;
const EASE = "cubic-bezier(0.23, 1, 0.32, 1)";
export function fxToast(html, { kind = "info", ms = 3200, role = "status" } = {}) {
  if (!toastBox || !toastBox.isConnected) {
    toastBox = document.createElement("div"); toastBox.className = "jx-toasts"; toastBox.setAttribute("aria-live", "polite");
    document.body.appendChild(toastBox);
  }
  while (toastBox.children.length >= 3) toastBox.firstElementChild.remove();
  const t = document.createElement("div");
  t.className = `jx-toast jx-toast-${kind}`; t.setAttribute("role", role); t.innerHTML = html;
  toastBox.appendChild(t);
  const rm = reduced();
  t.animate(rm ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: "translateY(-14px) scale(.96)" }, { opacity: 1, transform: "none" }], { duration: rm ? 150 : 320, easing: EASE, fill: "both" });
  const out = () => {
    if (!t.isConnected) return;
    t.animate(rm ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-10px) scale(.97)" }], { duration: 200, easing: "ease-out", fill: "both" }).onfinish = () => t.remove();
  };
  const id = setTimeout(out, ms);
  t.addEventListener("click", () => { clearTimeout(id); out(); });
  fixMedals(t);
  return out;
}

// ---------- animació puntual (WAAPI) ----------
export function pop(el, { scale = 1.18, ms = 260 } = {}) {
  if (!el || reduced()) return;
  el.animate([{ transform: "scale(1)" }, { transform: `scale(${scale})`, offset: 0.4 }, { transform: "scale(1)" }], { duration: ms, easing: EASE });
}
export function shake(el) {
  if (!el || reduced()) return;
  el.animate([{ transform: "translateX(0)" }, { transform: "translateX(-8px)" }, { transform: "translateX(7px)" }, { transform: "translateX(-5px)" }, { transform: "translateX(3px)" }, { transform: "translateX(0)" }], { duration: 360, easing: "ease-out" });
}
export const shuffle = (a) => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [r[i], r[j]] = [r[j], r[i]]; } return r; };
