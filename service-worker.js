const CACHE_NAME = 'pwa-cache-v2';
// Daftar lengkap semua file yang dibutuhkan aplikasi untuk berjalan offline
const URLS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  // Menambahkan semua file dari CDN
  'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// Event 'install': Menyimpan semua file yang dibutuhkan ke dalam cache
self.addEventListener('install', e => {
  console.log('Service Worker: Installing...');
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching all assets');
        return cache.addAll(URLS_TO_CACHE);
      })
      .then(() => self.skipWaiting()) // Memaksa service worker baru untuk aktif
  );
});

// Event 'activate': Membersihkan cache lama
self.addEventListener('activate', e => {
  console.log('Service Worker: Activating...');
  e.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// Event 'fetch': Menyajikan file dari cache jika tersedia (Cache First Strategy)
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(response => {
      // Jika request ada di cache, kembalikan dari cache. Jika tidak, ambil dari network.
      return response || fetch(e.request);
    })
  );
});