import { $, esc, toast } from "./util.js";
import { getImatges } from "./data.js";
import { plan, downloadAll, cachedCount, clearImages, supported } from "./offline.js";

export async function ajustos() {
  const im = await getImatges();
  const html = `<div class="view-in"><h1>Ajustos</h1>
    <div class="panel"><h3>Ús sense connexió</h3>
      <p>El text, les dades i el mapa de llocs ja es desen en instal·lar l'app. Les <b>imatges</b> es baixen a part: descarrega-les amb wifi abans de viatjar.</p>
      <div id="off-status" class="muted">Calculant…</div>
      <div class="progress" aria-hidden="true"><i id="bar"></i></div>
      <div id="off-prog" class="muted" role="status" aria-live="polite"></div>
      <div class="toolbar"><button class="btn" id="dl" type="button" disabled>⬇ Descarregar-ho tot per a ús offline</button>
        <button class="btn ghost small" id="stop" type="button" hidden>Atura</button>
        <button class="btn ghost small" id="clr" type="button">Esborra les imatges descarregades</button></div>
      <p class="muted">La mida és aproximada: el navegador no permet saber el pes exacte d'aquestes imatges. El mapa de fons (OpenStreetMap) necessita connexió; sense ella veuràs la llista de llocs per distància.</p>
    </div>
    <div class="panel"><h3>Estat</h3><ul class="steps" id="state"></ul></div>
    <div class="panel"><h3>Crèdits i llicències</h3><p>Imatges: Wikimedia Commons, cadascuna amb el seu autor i llicència sota la imatge. Mapa: © col·laboradors d'OpenStreetMap. Mapa interactiu: Leaflet.</p></div>
  </div>`;
  const mount = async (el) => {
    const st = $("#off-status", el), dl = $("#dl", el), bar = $("#bar", el), prog = $("#off-prog", el), stop = $("#stop", el), clr = $("#clr", el), state = $("#state", el);
    let ctl = { cancel: false };
    const fmtMB = (x) => (x < 1 ? "< 1" : x < 10 ? x.toFixed(1).replace(".", ",") : Math.round(x)) + " MB";
    const refresh = async () => {
      if (!supported()) { st.textContent = "Aquest navegador no admet ús sense connexió (service worker / Cache API)."; dl.disabled = true; return; }
      const p = await plan();
      st.innerHTML = p.total ? `Imatges: <b>${p.cached}</b> de <b>${p.total}</b> ja descarregades.${p.pending.length ? ` Falten ${p.pending.length} (≈ ${fmtMB(p.estMB)}).` : " Tot descarregat."}` : "Encara no hi ha llista d'imatges (executa build.py).";
      bar.style.width = p.total ? (p.cached / p.total) * 100 + "%" : "0";
      dl.disabled = !p.pending.length; dl.dataset.n = p.pending.length;
      const ctrl = !!navigator.serviceWorker.controller;
      state.innerHTML = `<li>Service worker: ${ctrl ? "actiu ✓" : "encara no controla aquesta pàgina (recarrega-la una vegada)"}</li><li>Connexió: ${navigator.onLine ? "en línia" : "sense connexió"}</li><li>Imatges a la memòria cau: ${await cachedCount()}</li>`;
    };
    dl.addEventListener("click", async () => {
      const p = await plan(); if (!p.pending.length) return;
      if (!navigator.onLine) { toast("Cal connexió per descarregar"); return; }
      if (p.estMB > 150 && !confirm(`Es descarregaran unes ${fmtMB(p.estMB)}. Continuar?`)) return;
      ctl = { cancel: false }; dl.disabled = true; stop.hidden = false;
      const r = await downloadAll(p.pending, ({ done, total, failed }) => {
        bar.style.width = ((p.cached + done) / p.total) * 100 + "%";
        prog.textContent = `Descarregant… ${done} de ${total}${failed ? ` (${failed} errors)` : ""}`;
      }, ctl);
      stop.hidden = true;
      prog.textContent = r.cancelled ? `Aturat: ${r.done} de ${r.total}.` : `Fet: ${r.done - r.failed} descarregades${r.failed ? `, ${r.failed} amb error (torna-ho a provar)` : ""}.`;
      refresh();
    });
    stop.addEventListener("click", () => { ctl.cancel = true; });
    clr.addEventListener("click", async () => { if (confirm("Vols esborrar les imatges descarregades d'aquest dispositiu?")) { await clearImages(); prog.textContent = "Imatges esborrades."; refresh(); } });
    refresh();
  };
  return { html, mount, title: "Ajustos", tab: "inici" };
}
