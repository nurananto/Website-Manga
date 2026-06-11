// Service Worker — force reload saat ada versi baru
// Versi di-inject otomatis oleh GitHub Action

const CACHE_NAME = 'nuranantoscans-v1';

self.addEventListener('install', () => {
  // Langsung aktif tanpa nunggu tab lama ditutup
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    // Hapus cache lama
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Saat ada versi baru, beritahu semua tab yang terbuka
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
