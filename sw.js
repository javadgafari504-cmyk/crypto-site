const CACHE_NAME = 'crypto-pro-v1';
const RUNTIME_CACHE = 'crypto-pro-runtime-v1';

const ASSETS = [
    './',
    './index.html',
    './markets.html',
    './portfolio.html',
    './calculator.html',
    './compare.html',
    './news.html',
    './alerts.html',
    './coin.html',
    './style.css',
    './script.js',
    './manifest.json'
];

// نصب
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS).catch(err => console.log('Cache error:', err)))
            .then(() => self.skipWaiting())
    );
});

// فعال‌سازی
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME && name !== RUNTIME_CACHE)
                    .map(name => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch
self.addEventListener('fetch', (event) => {
    const { request } = event;
    
    // فقط GET
    if (request.method !== 'GET') return;
    
    const url = new URL(request.url);
    
    // API ها رو کش نکن
    if (url.hostname.includes('coingecko') ||
        url.hostname.includes('alternative.me') ||
        url.hostname.includes('currency-api') ||
        url.hostname.includes('cryptocompare')) {
        return;
    }
    
    // صفحه HTML - Network First
    if (request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    const clone = response.clone();
                    caches.open(RUNTIME_CACHE).then(cache => cache.put(request, clone));
                    return response;
                })
                .catch(() => caches.match(request).then(cached => cached || caches.match('./index.html')))
        );
        return;
    }
    
    // CSS/JS/تصاویر - Cache First
    event.respondWith(
        caches.match(request).then(cached => {
            if (cached) return cached;
            return fetch(request).then(response => {
                if (response.ok && response.type === 'basic') {
                    const clone = response.clone();
                    caches.open(RUNTIME_CACHE).then(cache => cache.put(request, clone));
                }
                return response;
            }).catch(() => caches.match('./index.html'));
        })
    );
});

// پیام‌ها
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});