// Mapa amb Leaflet (OpenStreetMap). Sense connexió: avís + llista per distància.
import { $, esc, TIPUS, TIPUS_COLOR, distKm } from "./util.js";
import { getLlocs, geo, locate, stopWatch } from "./data.js";
import { placeCard } from "./views-lists.js";

export async function mapa(ctx) {
  const all = await getLlocs();
  const html = `<div class="view-in map-wrap">
    <div id="map" role="application" aria-label="Mapa dels llocs"></div>
    <div class="map-msg" id="mapmsg"></div>
    <div class="map-ctl"><button class="btn" id="me" type="button" aria-label="Centra el mapa a la meva posició">◎ Jo</button><button class="btn ghost" id="all" type="button" style="background:var(--surface)">Tot</button></div>
    <div class="legend" id="legend"></div>
    <div id="near" hidden style="padding:12px 16px"><h2 style="margin-top:.4em">Llocs per distància</h2><ul class="card-list" id="nearlist"></ul></div>
  </div>`;
  let map, cleanup = () => {};
  const mount = (el) => {
    if (typeof L === "undefined") { $("#mapmsg", el).innerHTML = `<div class="notice">No s'ha pogut carregar el mapa (Leaflet).</div>`; return; }
    map = L.map("map", { zoomControl: true, attributionControl: true }).setView([41.8925, 12.4853], 13);
    let tileErr = 0, ok = false;
    const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
    const msg = $("#mapmsg", el), near = $("#near", el), nearlist = $("#nearlist", el), mapDiv = $("#map", el);
    const drawNear = () => {
      const a = all.filter((l) => l.coords).slice();
      if (geo.pos) a.sort((x, y) => distKm(geo.pos, x.coords) - distKm(geo.pos, y.coords));
      else a.sort((x, y) => x.nom.localeCompare(y.nom, "ca"));
      nearlist.innerHTML = a.map((l) => placeCard(l)).join("");
    };
    const offlineUI = () => {
      const off = !navigator.onLine || (tileErr >= 4 && !ok);
      msg.innerHTML = off ? `<div class="notice">Sense connexió: el mapa de fons no es pot carregar. Pots veure els llocs per distància aquí sota${geo.pos ? "" : " (activa la ubicació per ordenar-los)"}.</div>` : "";
      near.hidden = !off; mapDiv.style.height = off ? "45dvh" : ""; if (off) { drawNear(); } map.invalidateSize();
    };
    tiles.on("tileerror", () => { tileErr++; offlineUI(); });
    tiles.on("tileload", () => { ok = true; if (tileErr) { tileErr = 0; offlineUI(); } });
    window.addEventListener("offline", offlineUI); window.addEventListener("online", offlineUI);

    // marcadors per tipus
    const layers = {}, bounds = [];
    const icon = (t) => L.divIcon({ className: "pin-wrap", html: `<div class="pin" style="background:${TIPUS_COLOR[t] || "#9c4527"}"></div>`, iconSize: [26, 26], iconAnchor: [13, 26], popupAnchor: [0, -24] });
    const markers = {};
    for (const l of all) {
      if (!l.coords || typeof l.coords.lat !== "number") continue;
      const t = l.tipus || "monument";
      (layers[t] ||= L.layerGroup().addTo(map));
      const m = L.marker([l.coords.lat, l.coords.lng], { icon: icon(t), title: l.nom, alt: l.nom, keyboard: true })
        .bindPopup(`<b>${esc(l.nom)}</b><br>${esc(TIPUS[t] || t)}${l.zona ? " · " + esc(l.zona) : ""}<br><a class="pp" href="#/lloc/${encodeURIComponent(l.id)}">Obre la fitxa →</a>`);
      m.addTo(layers[t]); markers[l.id] = m; bounds.push([l.coords.lat, l.coords.lng]);
    }
    const fitAll = () => bounds.length ? map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 }) : null;
    // vista inicial: el centre històric (els llocs a menys de 4 km del Fòrum), no les excursions
    const centre = L.latLng(41.8925, 12.4853);
    const prop = bounds.filter((b) => centre.distanceTo(b) < 4000);
    if (prop.length) map.fitBounds(prop, { padding: [30, 30], maxZoom: 15 }); else fitAll();
    if (ctx.params.lloc && markers[ctx.params.lloc]) { const m = markers[ctx.params.lloc]; map.setView(m.getLatLng(), 16); m.openPopup(); }

    // llegenda / filtre per tipus
    const lg = $("#legend", el);
    lg.innerHTML = Object.keys(layers).map((t) => `<label><input type="checkbox" data-t="${t}" checked> <i style="background:${TIPUS_COLOR[t] || "#9c4527"}"></i>${esc(TIPUS[t] || t)}</label>`).join("");
    lg.addEventListener("change", (e) => { const t = e.target.dataset.t; if (!t) return; e.target.checked ? layers[t].addTo(map) : map.removeLayer(layers[t]); });

    // posició de l'usuari
    let me, circle, centered = false;
    const showMe = () => {
      if (!geo.pos) { if (geo.error) msg.innerHTML = `<div class="notice">${esc(geo.error)}</div>`; return; }
      const ll = [geo.pos.lat, geo.pos.lng];
      if (!me) { me = L.marker(ll, { icon: L.divIcon({ className: "pin-wrap", html: '<div class="pin-me"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }), zIndexOffset: 1000, keyboard: false }).addTo(map).bindPopup("Ets aquí"); circle = L.circle(ll, { radius: geo.pos.acc || 30, color: "#2a7de1", weight: 1, fillOpacity: .08 }).addTo(map); }
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
