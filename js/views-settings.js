import { $, esc, toast, store } from "./util.js";
import { ic } from "./icons.js";
import { vibe } from "./ui.js";
import * as off from "./offline.js";

let offs = [];
export async function ajustos() {
  const html = `<div class="view-in"><header class="page-h"><h1>Ajustos</h1></header>
    <div class="panel off"><h3>Ús sense connexió</h3>
      <p>El text, les dades, les icones i el programa ja es desen en instal·lar l'app. Les <b>imatges</b> es baixen a part: tria què vols tenir al mòbil i baixa-les amb wifi abans de viatjar.</p>
      <div class="off-modes" id="modes" role="group" aria-label="Mode de descàrrega"></div>
      <div class="progress" aria-hidden="true"><i id="bar"></i></div>
      <div id="off-prog" class="muted" role="status" aria-live="polite"></div>
      <div class="toolbar"><button class="btn small ghost" id="stop" type="button" hidden>${ic("close")} Atura</button>
        <button class="btn ghost small" id="clr" type="button">Esborra les imatges descarregades</button></div>
      <p class="muted" id="off-info"></p>
      <p class="muted">Les mides són aproximades. Les imatges que no baixis es veuran en línia; si no hi ha connexió, l'app mostra la versió més petita que tingui. El mapa de fons (OpenStreetMap) necessita connexió; sense ella veuràs la llista de llocs per distància.</p>
    </div>
    <div class="panel"><h3>Vibració</h3>
      <label class="switch"><input type="checkbox" id="hap" ${store.get("roma.haptics", true) !== false ? "checked" : ""}><span class="sw-t">Vibració lleu en tocar i marcar (només Android)</span><i class="sw-k" aria-hidden="true"></i></label></div>
    <details class="acc"><summary>${ic("practical")} Com instal·lar-la al mòbil</summary><div class="in sans">
      <h3>Android (Chrome)</h3>
      <ol class="steps"><li>Obre l'adreça amb Chrome.</li><li>Menú ⋮ (dalt a la dreta).</li><li><b>Instal·la l'aplicació</b> o <b>Afegeix a la pantalla d'inici</b>.</li></ol>
      <h3>iPhone (Safari)</h3>
      <ol class="steps"><li>Obre l'adreça amb <b>Safari</b>.</li><li>Botó <b>Comparteix</b> (quadrat amb fletxa).</li><li><b>Afegeix a la pantalla d'inici</b> i <b>Afegeix</b>.</li></ol></div></details>
    <div class="panel"><h3>Estat</h3><ul class="steps" id="state"></ul></div>
    <div class="panel"><h3>Crèdits i llicències</h3><p>Imatges: Wikimedia Commons, cadascuna amb el seu autor i llicència a la galeria. Mapa: © col·laboradors d'OpenStreetMap. Mapa interactiu: Leaflet. Tipografies: Cinzel, EB Garamond i Alegreya Sans (llicència OFL). Icones: dibuix propi.</p></div>
  </div>`;
  const mount = async (el) => {
    const modesEl = $("#modes", el), bar = $("#bar", el), prog = $("#off-prog", el), stop = $("#stop", el), clr = $("#clr", el), state = $("#state", el), info = $("#off-info", el);
    $("#hap", el).addEventListener("change", (e) => { store.set("roma.haptics", e.target.checked); if (e.target.checked) vibe(12); });
    const fmtMB = (x) => (x < 1 ? "< 1" : x < 10 ? x.toFixed(1).replace(".", ",") : Math.round(x)) + " MB";
    let plans = null, unsub = null;
    const running = () => off.job.state === "running";
    const paintJob = (j) => {
      if (!el.isConnected) return;
      const p = plans?.[j.mode];
      if (j.state === "running") {
        bar.style.width = (p ? ((p.cached + j.done) / p.total) * 100 : 0) + "%";
        prog.textContent = `Descarregant ${off.MODES[j.mode].nom.toLowerCase()}… ${j.done} de ${j.total}${j.failed ? ` (${j.failed} errors)` : ""}`;
      }
    };
    const refresh = async () => {
      if (!off.supported()) { modesEl.innerHTML = `<div class="notice">Aquest navegador no admet ús sense connexió (service worker / Cache API).</div>`; return; }
      plans = await off.plan();
      const j = off.job, busy = running();
      modesEl.innerHTML = Object.entries(off.MODES).map(([m, d]) => {
        const p = plans[m], full = !p.pending.length, part = p.cached > 0 && !full;
        const act = busy && j.mode === m ? "En curs…" : full ? "Tot descarregat" : part ? `Reprèn (≈ ${fmtMB(p.estMB)})` : `Descarrega (≈ ${fmtMB(p.estMB)})`;
        return `<div class="off-mode${full ? " full" : ""}"><div class="om-h"><b>${d.nom}</b><span>≈ ${fmtMB(p.totalMB)}</span></div><p>${d.desc}</p>
          <div class="om-s">${p.cached} de ${p.total} fitxers${full ? " ✓" : ""}</div>
          <button class="btn${m === "lleuger" ? "" : " ghost"}" type="button" data-m="${m}" ${full || busy ? "disabled" : ""}>${ic("arrow-right")} ${act}</button></div>`;
      }).join("");
      const lp = plans.lleuger, cp = plans.complet;
      bar.style.width = (busy ? 0 : Math.max(cp.cached / cp.total, 0)) * 100 + "%";
      if (!busy) bar.style.width = (cp.total ? cp.cached / cp.total * 100 : 0) + "%";
      stop.hidden = !busy;
      const si = await off.storageInfo();
      info.textContent = si && si.quota ? `Espai: ${fmtMB(si.usage / 1048576)} en ús de ${fmtMB(si.quota / 1048576)} disponibles per a aquesta app.` : "";
      const ctrl = !!navigator.serviceWorker.controller;
      state.innerHTML = `<li>Service worker: ${ctrl ? "actiu ✓" : "encara no controla aquesta pàgina (recarrega-la una vegada)"}</li><li>Connexió: ${navigator.onLine ? "en línia" : "sense connexió"}</li><li>Imatges a la memòria cau: ${plans.count}</li>`;
      if (!busy && j.state !== "idle") {
        prog.textContent = j.state === "done" ? `Fet: ${j.done} fitxers descarregats${j.failed ? `, ${j.failed} amb error (torna-ho a provar)` : ""}.`
          : j.state === "cancelled" ? `Aturat: ${j.done} de ${j.total}. Pots reprendre quan vulguis.`
          : `Pausat: ${j.done} de ${j.total}. ${j.error || ""} Torna-ho a provar amb connexió.`;
      }
    };
    modesEl.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-m]"); if (!b || b.disabled) return;
      const m = b.dataset.m, p = plans?.[m]; if (!p?.pending.length) return;
      if (!navigator.onLine) { toast("Cal connexió per descarregar"); return; }
      const c = navigator.connection;
      if ((c?.saveData || c?.type === "cellular") && !confirm(`Sembla que no ets en wifi. Es baixaran unes ${fmtMB(p.estMB)}. Continuar?`)) return;
      else if (p.estMB > 150 && !confirm(`Es baixaran unes ${fmtMB(p.estMB)}. Continuar?`)) return;
      vibe(10);
      const run = off.start(m, p.pending);
      await Promise.resolve(); await refresh(); paintJob(off.job);
      await run; refresh();
    });
    stop.addEventListener("click", () => { off.cancel(); stop.disabled = true; setTimeout(() => { stop.disabled = false; }, 800); });
    clr.addEventListener("click", async () => {
      if (running()) { toast("Atura primer la descàrrega"); return; }
      if (confirm("Vols esborrar les imatges descarregades d'aquest dispositiu?")) { await off.clearImages(); off.job.state = "idle"; prog.textContent = "Imatges esborrades."; refresh(); }
    });
    unsub = off.subscribe((j) => { paintJob(j); if (j.state !== "running") refresh(); });
    await refresh(); if (running()) paintJob(off.job);
    offs.push(() => unsub?.());
  };
  return { html, mount, unmount: () => { offs.forEach((f) => f()); offs = []; }, title: "Ajustos", tab: "" };
}
