const CACHE = 'pokemon-sleep-ai-v0.3.26-identity-merge-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/app.css',
  './assets/css/editor.css',
  './assets/js/bootstrap.js',
  './assets/js/app.js',
  './assets/js/database.js',
  './assets/js/storage.js',
  './assets/js/schema.js',
  './assets/js/importer.js',
  './assets/js/seed-data.js',
  './assets/js/pokemon-detail.js',
  './assets/js/ai-workflow.js',
  './assets/js/manual-editor.js',
  './assets/js/prompt-catalog.js',
  './assets/js/g3-planning.js',
  './assets/js/ingredient-gap-engine.js',
  './assets/js/time-utils.js',
  './assets/js/identity-review.js',
  './assets/js/identity-convergence.js',
  './assets/js/identity-dedup.js',
  './assets/js/update-center-ui-guard.js',
  './assets/js/shared-master-schema.js',
  './assets/js/shared-master-data.js',
  './assets/js/shared-knowledge-ui.js',
  './assets/js/recipe-render-guard.js',
  './assets/icons/icon.svg',
  'https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/sql-wasm.js',
  'https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/sql-wasm.wasm',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const networkFirst =
    url.origin === self.location.origin &&
    (event.request.mode === 'navigate' || url.pathname.endsWith('.js') || url.pathname.endsWith('.html'));
  if (networkFirst) {
    event.respondWith(
      fetch(event.request, {cache: 'no-store'})
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then((hit) => hit || caches.match('./index.html'))),
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((hit) =>
      hit || fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      }),
    ),
  );
});
