// Mapa amb Leaflet (OpenStreetMap): marcadors amb icones pròpies i fitxa ràpida inferior. Sense connexió: avís + llista per distància.
import { $, esc, TIPUS, TIPUS_COLOR, distKm, fmtDist, placeThumb, img, mapsPlace, toast } from "./util.js";
import { getLlocs, geo, locate, stopWatch } from "./data.js";
import { placeCard, favs } from "./views-lists.js";
import { ic, tipusIc, TIPUS_ICON } from "./icons.js";
import { dragDown, vibe, reduced } from "./ui.js";

export async function mapa(ctx) {
  const all = await getLlocs();
  const tipus = [...new Set(all.map((l) => l.tipus).filter(Boolean))];
  const html = `<div class="view-in map-wrap">
    <div id="map" role="application" aria-label="Mapa dels llocs"></div>
    <div class="map-chips" id="legend" role="group" aria-label="Filtra per tipus">${tipus.map((t) => `<button type="button" class="chip-btn on" data-t="${esc(t)}" aria-pressed="true" style="--c:${TIPUS_COLOR[t] || "#8c2a22"}">${tipusIc(t)} ${esc(TIPUS[t] || t)}</button>`).join("")}</div>
    <div class="map-msg" id="mapmsg"></div>
    <div class="map-ctl"><button class="map-btn" id="me" type="button" aria-label="Centra el mapa a la meva posició">${ic("locate", "ic-lg")}</button><button class="map-btn" id="all" type="button" aria-label="Mostra tots els llocs">${ic("zone", "ic-lg")}</button></div>
    <div class="qs" id="qs" hidden></div>
    <div id="near" hidden class="near-list"><h2>Llocs per distància</h2><ul class="pgrid" id="nearlist"></ul></div>
  </div>`;
  let map, cleanup = () => {};
  const mount = (el) => {
    if (typeof L === "undefined") { $("#mapmsg", el).innerHTML = `<div class="notice">No s'ha pogut carregar el mapa (Leaflet).</div>`; return; }
    map = L.map("map", { zoomControl: false, attributionControl: true }).setView([41.8925, 12.4853], 13);
    L.control.zoom({ position: "topright" }).addTo(map);
    let tileErr = 0, ok = false;
    const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
    const msg = $("#mapmsg", el), near = $("#near", el), nearlist = $("#nearlist", el), mapDiv = $("#map", el), qs = $("#qs", el);
    const drawNear = () => {
      const a = all.filter((l) => l.coords).slice();
      if (geo.pos) a.sort((x, y) => distKm(geo.pos, x.coords) - distKm(geo.pos, y.coords)); else a.sort((x, y) => x.nom.localeCompare(y.nom, "ca"));
      nearlist.innerHTML = a.map((l) => placeCard(l)).join("");
    };
    const offlineUI = () => {
      const off = !navigator.onLine || (tileErr >= 4 && !ok);
      msg.innerHTML = off ? `<div class="notice">Sense connexió: no es pot carregar el mapa de fons. Aquí sota tens els llocs per distància${geo.pos ? "" : " (activa la ubicació per ordenar-los)"}.</div>` : "";
      near.hidden = !off; mapDiv.style.height = off ? "45dvh" : ""; if (off) drawNear(); map.invalidateSize();
    };
    tiles.on("tileerror", () => { tileErr++; offlineUI(); });
    tiles.on("tileload", () => { ok = true; if (tileErr) { tileErr = 0; offlineUI(); } });
    window.addEventListener("offline", offlineUI); window.addEventListener("online", offlineUI);

    // marcadors amb la icona de cada tipus
    const layers = {}, bounds = [], markers = {};
    const icon = (t, on) => L.divIcon({ className: "mk-wrap", html: `<div class="mk${on ? " sel" : ""}" style="--c:${TIPUS_COLOR[t] || "#8c2a22"}">${ic(TIPUS_ICON[t] || "pin")}</div>`, iconSize: [36, 44], iconAnchor: [18, 42] });
    let selected = null;
    const sheet = {
      show(l) {
        if (selected) markers[selected.id]?.setIcon(icon(selected.tipus || "monument", false));
        selected = l; markers[l.id].setIcon(icon(l.tipus || "monument", true));
        const t = placeThumb(l), d = geo.pos && l.coords ? distKm(geo.pos, l.coords) : null, f = favs.has(l.id);
        qs.innerHTML = `<div class="qs-grip"><i></i></div><div class="qs-row">
          <a class="qs-img" href="#/lloc/${encodeURIComponent(l.id)}" data-vt>${t ? img(t, "", 400, "vt-img") : tipusIc(l.tipus, "ic-xl")}</a>
          <div class="qs-b"><h3>${esc(l.nom)}</h3><div class="qs-m">${tipusIc(l.tipus)} ${esc(TIPUS[l.tipus] || "")}${l.zona ? " · " + esc(l.zona) : ""}${d != null ? ` · <b>${fmtDist(d)}</b>` : ""}</div>
          <div class="qs-act"><a class="btn small" href="#/lloc/${encodeURIComponent(l.id)}">Obre la fitxa</a><a class="btn small ghost" href="${esc(mapsPlace(l.coords))}" target="_blank" rel="noopener noreferrer" aria-label="Com arribar-hi">${ic("routes")}</a>
          <button class="btn small ghost" id="qs-fav" type="button" aria-pressed="${f}" aria-label="${f ? "Treu dels preferits" : "Afegeix als preferits"}">${ic(f ? "star-fill" : "favorites")}</button></div></div></div>`;
        qs.hidden = false; requestAnimationFrame(() => qs.classList.add("on")); vibe(6);
        $("#qs-fav", qs).addEventListener("click", (e) => { const on = favs.toggle(l.id); e.currentTarget.innerHTML = ic(on ? "star-fill" : "favorites"); e.currentTarget.setAttribute("aria-pressed", on); toast(on ? "Afegit als preferits" : "Tret dels preferits"); });
      },
      hide() {
        if (selected) markers[selected.id]?.setIcon(icon(selected.tipus || "monument", false)); selected = null;
        qs.classList.remove("on"); setTimeout(() => { if (!selected) qs.hidden = true; }, reduced() ? 0 : 260);
      },
    };
    dragDown(qs, qs, () => sheet.hide(), ".qs-grip");
    qs.addEventListener("click", (e) => { if (e.target.closest("a")) sheet.hide(); });
    map.on("click", () => sheet.hide());

    for (const l of all) {
      if (!l.coords || typeof l.coords.lat !== "number") continue;
      const t = l.tipus || "monument";
      (layers[t] ||= L.layerGroup().addTo(map));
      const m = L.marker([l.coords.lat, l.coords.lng], { icon: icon(t, false), title: l.nom, alt: l.nom, keyboard: true }).on("click", () => { map.panTo([l.coords.lat, l.coords.lng], { animate: !reduced() }); sheet.show(l); });
      m.addTo(layers[t]); markers[l.id] = m; bounds.push([l.coords.lat, l.coords.lng]);
    }
    const fitAll = () => bounds.length ? map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 }) : null;
    const centre = L.latLng(41.8925, 12.4853);
    const prop = bounds.filter((b) => centre.distanceTo(b) < 4000);
    if (prop.length) map.fitBounds(prop, { padding: [30, 30], maxZoom: 15 }); else fitAll();
    if (ctx.params.lloc && markers[ctx.params.lloc]) { const l = all.find((x) => x.id === ctx.params.lloc); map.setView(markers[l.id].getLatLng(), 16); sheet.show(l); }

    // filtre per tipus
    $("#legend", el).addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return; const t = b.dataset.t, on = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", on); b.classList.toggle("on", on); on ? layers[t]?.addTo(map) : map.removeLayer(layers[t]);
      if (!on && selected?.tipus === t) sheet.hide();
    });

    // posició de l'usuari
    let me, circle, centered = false;
    const showMe = () => {
      if (!geo.pos) { if (geo.error) msg.innerHTML = `<div class="notice">${esc(geo.error)}</div>`; return; }
      const ll = [geo.pos.lat, geo.pos.lng];
      if (!me) { me = L.marker(ll, { icon: L.divIcon({ className: "mk-wrap", html: '<div class="pin-me"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }), zIndexOffset: 1000, keyboard: false }).addTo(map).bindPopup("Ets aquí"); circle = L.circle(ll, { radius: geo.pos.acc || 30, color: "#2a7de1", weight: 1, fillOpacity: 0.08 }).addTo(map); }
      else { me.setLatLng(ll); circle.setLatLng(ll).setRadius(geo.pos.acc || 30); }
      if (centered === "want") { map.setView(ll, Math.max(map.getZoom(), 15)); centered = true; }
      if (near && !near.hidden) drawNear();
    };
    $("#me", el).addEventListener("click", () => { centered = "want"; if (geo.pos) showMe(); locate(showMe, { watch: true }); });
    $("#all", el).addEventListener("click", fitAll);
    locate(showMe, { watch: true });
    offlineUI();
    cleanup = () => { stopWatch(); window.removeEventListener("offline", offlineUI); window.removeEventListener("online", offlineUI); map.remove(); };
  };
  return { html, mount, unmount: () => cleanup(), title: "Mapa", tab: "mapa", cls: "full" };
}
