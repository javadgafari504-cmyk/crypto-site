const CACHE_NAME = 'crypto-site-v1';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './compare.html',
    './calculator.html',
    './about.html'
];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).catch(() => {}));
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') return;
    // API ها رو کش نکن
    if (e.request.url.includes('api.coingecko.com') || e.request.url.includes('alternative.me') || e.request.url.includes('currency-api')) return;
    e.respondWith(
        caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
            if (res.ok) {
                const clone = res.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
            }
            return res;
        }).catch(() => caches.match('./index.html')))
    );
});