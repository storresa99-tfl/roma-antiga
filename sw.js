/* Service worker — Roma Antiga
 * - Shell i dades: s'abasten en instal·lar. Shell/dades: stale-while-revalidate.
 * - Vendor (Leaflet) i icones: cache-first.
 * - Imatges de Wikimedia Commons: cache-first en una cache pròpia que sobreviu a les versions.
 * - Tessel·les d'OpenStreetMap: sense intercepció (només en línia).
 * build.py actualitza VERSION automàticament.
 */
const VERSION = 'roma-06e2fd9728';
const SHELL = `roma-shell-${VERSION}`;
const IMG_CACHE = 'roma-img-v1'; // ha de coincidir amb js/offline.js

const SHELL_FILES = [
  './', 'index.html', 'manifest.webmanifest',
  'css/style.css',
  'js/app.js', 'js/util.js', 'js/data.js', 'js/compare.js', 'js/offline.js',
  'js/views-lists.js', 'js/views-place.js', 'js/views-map.js', 'js/views-time.js', 'js/views-settings.js',
  'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css',
  'vendor/leaflet/images/layers.png', 'vendor/leaflet/images/layers-2x.png',
  'vendor/leaflet/images/marker-icon.png', 'vendor/leaflet/images/marker-icon-2x.png', 'vendor/leaflet/images/marker-shadow.png',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png',
];
const DATA_FILES = ['llocs', 'cronologia', 'rutes', 'practic', 'imatges'].map((n) => `data/${n}.json`);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // Un a un: si falta un fitxer de dades, no es trenca la instal·lació
    await Promise.all([...SHELL_FILES, ...DATA_FILES].map(async (f) => {
      try { const r = await fetch(f, { cache: 'reload' }); if (r.ok) await cache.put(new Request(f, { credentials: 'same-origin' }), r); } catch (e) { /* sense xarxa o inexistent */ }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('roma-shell-') && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function staleWhileRevalidate(request, cacheName, fallbackKey) {
  const cache = await caches.open(cacheName);
  const hit = (await cache.match(request, { ignoreSearch: true })) || (fallbackKey ? await cache.match(fallbackKey) : undefined);
  const net = fetch(request).then((r) => { if (r && r.ok) cache.put(request, r.clone()); return r; }).catch(() => undefined);
  if (hit) { net.catch(() => {}); return hit; }
  return (await net) || new Response('Sense connexió', { status: 503, statusText: 'Offline', headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const r = await fetch(request);
  if (r && (r.ok || r.type === 'opaque')) cache.put(request, r.clone());
  return r;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Imatges de Commons (redirecció Special:FilePath): cache-first
  if (url.hostname === 'commons.wikimedia.org' && url.pathname.startsWith('/wiki/Special:FilePath/')) {
    event.respondWith(cacheFirst(req, IMG_CACHE).catch(() => Response.error()));
    return;
  }
  if (url.origin !== self.location.origin) return; // tessel·les OSM i altres: xarxa directa

  const path = url.pathname;
  if (req.mode === 'navigate') {
    event.respondWith(staleWhileRevalidate(req, SHELL, 'index.html').then((r) => r));
    return;
  }
  if (path.includes('/vendor/') || path.includes('/icons/')) { event.respondWith(cacheFirst(req, SHELL).catch(() => Response.error())); return; }
  event.respondWith(staleWhileRevalidate(req, SHELL));
});
