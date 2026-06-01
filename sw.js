// Service Worker — Chat Interno
// Estratégia: Cache-first para assets, network-first para API, push real.

const CACHE_NAME = 'chatinterno-v9-plantao-semanal';
const STATIC_ASSETS = ['/manifest.json'];

// ── Install ────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: limpar caches antigos ───────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ──────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar socket.io e métodos não-GET
  if (request.method !== 'GET' || url.pathname.startsWith('/socket.io')) return;

  // API e uploads: network-first sem cache
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ erro: 'Sem conexão' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Páginas HTML: network-first para evitar tela antiga após deploy.
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // Assets estáticos: cache-first. CSS/JS versionados atualizam pelo novo URL.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => cached || new Response('Offline', { status: 503 }));
    })
  );
});

// ── Push: notificação real ─────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'Nova mensagem', body: '' };
  try { data = { ...data, ...event.data.json() }; } catch (_e) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: data.tag || 'chatinterno',
      renotify: true,
      vibrate: [150, 50, 150]
    })
  );
});

// ── Notification click ─────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existingClient = allClients.find((c) => c.url.includes(self.location.origin));
    if (existingClient) { await existingClient.focus(); return; }
    await self.clients.openWindow('/');
  })());
});
