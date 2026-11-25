// Dades de la fase 2: curiositats, quiz i jocs (JSON estàtics; si falten, valors buits)
const cache = {};
async function load(name, def) {
  if (name in cache) return cache[name];
  try {
    const r = await fetch(`data/${name}.json`);
    if (!r.ok) throw new Error(r.status);
    cache[name] = await r.json();
  } catch { cache[name] = def; }
  return cache[name];
}
export const getCuriositats = async () => (await load("curiositats", { targetes: [] })).targetes || [];
export const getQuiz = async () => (await load("quiz", { preguntes: [] })).preguntes || [];
export const getJocs = async () => {
  const j = await load("jocs", {});
  return { on_es: j.on_es || [], ordena: j.ordena || [], assoliments: j.assoliments || [], rangs: j.rangs || [] };
};
