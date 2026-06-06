// Advanced Service Worker with Auto-Update
const CACHE_VERSION = 'v2'; // Incrementa quando há updates
const CACHE_NAME = `financas-${CACHE_VERSION}`;

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install - Cache assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        // Skip waiting - força activação imediata
        console.log('[SW] Skip waiting');
        return self.skipWaiting();
      })
  );
});

// Activate - Limpa caches antigos e assume controlo
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        // Apaga caches antigos
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('financas-') && name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        // Assume controlo de todos os clientes imediatamente
        console.log('[SW] Claiming clients');
        return self.clients.claim();
      })
  );
});

// Fetch - Network first, cache fallback
// API calls (/api/*) and Supabase requests are never cached — they must always
// be fresh (financial data, AI analysis, quotes).
const NO_CACHE_PATTERNS = ['/api/', 'supabase.co'];

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Pass-through: never cache API or Supabase responses
  if (NO_CACHE_PATTERNS.some(p => url.includes(p))) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clona response para cache
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // Se network falha, usa cache
        return caches.match(event.request);
      })
  );
});

// Message handler - Força update quando recebe mensagem
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    console.log('[SW] Force skip waiting');
    self.skipWaiting();
  }
});
