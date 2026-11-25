// Joc d'icones propi (sprite SVG: icons/set/sprite.svg). Ús: ic("laurel"), ic("pin", "ic-lg")
export const ICONS = [
  "home", "scroll", "map", "games", "places", "routes", "timeline", "practical", "favorites", "settings", "passport",
  "monument", "museum", "road", "church", "trip", "zone",
  "laurel", "helmet", "coin", "amphora", "column", "arch", "eagle", "sword", "shield", "crown", "chariot", "wolf", "torch", "mosaic", "sandal", "star", "owl", "temple",
  "check", "close", "chevron-left", "chevron-right", "arrow-right", "star-fill", "pin", "clock", "ticket", "share", "locate", "calendar", "lock", "menu", "search", "walk", "rotate", "image", "eye", "sparkle", "flag",
];
const SET = new Set(ICONS);
export const hasIcon = (n) => SET.has(n);

export function ic(name, cls = "") {
  if (!SET.has(name)) return "";
  return `<svg class="ic${cls ? " " + cls : ""}" aria-hidden="true" focusable="false"><use href="icons/set/sprite.svg#i-${name}"/></svg>`;
}

// Tipus de lloc -> icona
export const TIPUS_ICON = { monument: "monument", museu: "museum", via: "road", esglesia: "church", excursio: "trip", zona: "zone" };
export const tipusIc = (t, cls = "") => ic(TIPUS_ICON[t] || "pin", cls);
