// Service Worker — auto-update ringan (BUKAN PWA: tidak ada cache/offline).
//
// Tugasnya hanya memastikan versi terbaru cepat aktif: skipWaiting + claim,
// dan membersihkan cache lama bila ada. Deteksi versi & reload pintar
// ditangani oleh poll version.json di App.jsx, jadi SW ini tidak meng-cache
// aset apa pun dan tidak memunculkan prompt update sendiri.

const CACHE_NAME = 'nuranantoscans-v1';

self.addEventListener('install', () => {
  // Langsung aktif tanpa nunggu tab lama ditutup
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    // Hapus cache lama (jika ada sisa dari versi sebelumnya)
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Saat ada versi baru, beritahu semua tab yang terbuka
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
