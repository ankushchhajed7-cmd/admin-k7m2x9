/* ==================================================================
   SamuSignal Pro Admin — service worker
   ------------------------------------------------------------------
   Deliberately minimal. Its only job is to make the console
   installable and to cache the icons.

   The page itself is NEVER cached. An admin console that serves a
   stale copy of itself is worse than one that simply fails, and a
   cached admin page is exactly what caused so much confusion in the
   main app. Documents always go to the network.
   ================================================================== */

const CACHE = 'spa-admin-v1';
const ICONS = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './favicon.png'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(ICONS.map(u => c.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) {
      if (k !== CACHE) await caches.delete(k);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }

  /* Firebase and Google auth: always straight to the network */
  if (url.origin !== self.location.origin) return;

  /* The console itself: network only, never cached, no stale copies */
  const isDoc = req.mode === 'navigate' ||
                (req.headers.get('accept') || '').includes('text/html');
  if (isDoc) {
    e.respondWith(
      fetch(req, { cache: 'no-store' }).catch(() => new Response(
        '<!DOCTYPE html><meta charset="utf-8">' +
        '<body style="background:#140e03;color:#e8b45a;font-family:monospace;' +
        'padding:44px 20px;text-align:center">' +
        '<h2 style="letter-spacing:3px">SPA</h2>' +
        '<p>No connection. The admin console needs to be online.</p>' +
        '<p><a style="color:#e8b45a" href="./">Try again</a></p>',
        { status: 503, headers: { 'Content-Type': 'text/html' } }
      ))
    );
    return;
  }

  /* icons and manifest: cache first, they never change */
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(req);
    if (hit) return hit;
    try {
      const net = await fetch(req);
      if (net && net.ok && net.type === 'basic') c.put(req, net.clone());
      return net;
    } catch (err) {
      return new Response('', { status: 504 });
    }
  })());
});
