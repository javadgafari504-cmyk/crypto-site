/* ============================================
   کریپتو پرو - اسکریپت اصلی
   نسخه: 5.0
   ============================================ */

/* ===== متغیرهای سراسری ===== */
let allCoins = [];
let globalData = null;
let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
let alerts = JSON.parse(localStorage.getItem('alerts') || '[]');
let currentView = 'all';
let currentSort = 'market_cap_desc';
let usdToTomanRate = 0;
let currentPage = 1;
let currentChartCoin = null;
let currentChartDays = 7;
let currentMoverTab = '24h';
let viewMode = localStorage.getItem('viewMode') || 'grid';

const ITEMS_PER_PAGE = 24;
const API_BASE = 'https://api.coingecko.com/api/v3';

const NETWORKS = {
    '0x1': 'Ethereum Mainnet',
    '0x5': 'Goerli Testnet',
    '0xaa36a7': 'Sepolia Testnet',
    '0x89': 'Polygon',
    '0x13881': 'Mumbai Testnet',
    '0x38': 'BNB Smart Chain',
    '0x61': 'BNB Testnet',
    '0xa4b1': 'Arbitrum One',
    '0xa': 'Optimism',
    '0x2105': 'Base'
};

/* ============================================
   ۱. راه‌اندازی اولیه
   ============================================ */
window.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 کریپتو پرو شروع شد');
    
    // مخفی کردن لودر بعد از ۱ ثانیه
    setTimeout(() => {
        document.getElementById('initial-loader')?.classList.add('hidden');
    }, 1000);
    
    // بررسی سیستم تم
    setupTheme();
    setupMobileMenu();
    setupSearch();
    setupFilterButtons();
    setupSort();
    setupViewToggle();
    setupPagination();
    setupChartModal();
    setupAlertModal();
    setupWallet();
    setupMoversTabs();
    setupScrollTop();
    setupKeyboardShortcuts();
    
    // تنظیم view mode
    if (viewMode === 'list') {
        document.getElementById('crypto-grid')?.classList.add('list-view');
        document.getElementById('view-list')?.classList.add('active');
        document.getElementById('view-grid')?.classList.remove('active');
    }
    
    // به‌روزرسانی تعداد علاقه‌مندی
    updateFavCount();
    
    // دریافت داده‌ها به‌صورت موازی
    await Promise.all([
        fetchGlobalData(),
        fetchPrices(),
        fetchFearGreed(),
        fetchTrending()
    ]);
    
    // بررسی هشدارها
    checkAlerts();
    
    // شروع به‌روزرسانی خودکار
    setInterval(() => {
        fetchPrices();
        checkAlerts();
    }, 60000);
    
    setInterval(fetchFearGreed, 600000);
    setInterval(fetchGlobalData, 300000);
    
    // ثبت Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(e => console.log('SW:', e));
    }
});

/* ============================================
   ۲. تم شب/روز
   ============================================ */
function setupTheme() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    
    // بررسی ترجیح سیستم
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const saved = localStorage.getItem('theme');
    
    if (saved === 'light' || (!saved && !prefersDark)) {
        document.body.classList.add('light-mode');
        btn.textContent = '☀️';
    } else {
        btn.textContent = '🌙';
    }
    
    btn.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        const isLight = document.body.classList.contains('light-mode');
        btn.textContent = isLight ? '☀️' : '🌙';
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
        
        // به‌روزرسانی نمودار
        if (currentChartCoin) loadChart(currentChartCoin.id, currentChartDays);
    });
    
    // گوش دادن به تغییرات سیستم
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            document.body.classList.toggle('light-mode', !e.matches);
        }
    });
}

/* ============================================
   ۳. منوی موبایل
   ============================================ */
function setupMobileMenu() {
    const btn = document.getElementById('menu-toggle');
    const nav = document.getElementById('main-nav');
    
    btn?.addEventListener('click', () => {
        nav?.classList.toggle('open');
        btn.textContent = nav?.classList.contains('open') ? '✖' : '☰';
    });
}

/* ============================================
   ۴. نرخ تومان
   ============================================ */
async function fetchTomanRate() {
    try {
        const res = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/irr.json');
        const data = await res.json();
        if (data.irr?.usd > 0) {
            usdToTomanRate = (1 / data.irr.usd) / 10;
        }
    } catch (e) {
        console.error('خطا در نرخ تومان:', e);
    }
}

/* ============================================
   ۵. داده‌های جهانی بازار
   ============================================ */
async function fetchGlobalData() {
    try {
        const res = await fetch(`${API_BASE}/global`);
        const data = await res.json();
        globalData = data.data;
        
        // به‌روزرسانی نوار بازار
        const mcap = data.data.total_market_cap.usd;
        const volume = data.data.total_volume.usd;
        const btcDom = data.data.market_cap_percentage.btc;
        
        document.getElementById('total-mcap').textContent = formatLargeNumber(mcap);
        document.getElementById('total-volume').textContent = formatLargeNumber(volume);
        document.getElementById('btc-dominance').textContent = btcDom.toFixed(1) + '%';
        document.getElementById('coins-count').textContent = data.data.active_cryptocurrencies.toLocaleString('fa-IR');
        
    } catch (e) {
        console.error('خطا در داده‌های جهانی:', e);
    }
}

function formatLargeNumber(num) {
    if (num >= 1e12) return '$' + (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return '$' + (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return '$' + (num / 1e6).toFixed(2) + 'M';
    return '$' + num.toLocaleString('en-US');
}

/* ============================================
   ۶. شاخص ترس و طمع
   ============================================ */
async function fetchFearGreed() {
    const box = document.getElementById('fear-greed-box');
    if (!box) return;
    
    try {
        const res = await fetch('https://api.alternative.me/fng/?limit=1');
        const data = await res.json();
        const fg = data.data[0];
        const value = parseInt(fg.value);
        
        const translations = {
            'Extreme Fear': 'ترس شدید',
            'Fear': 'ترس',
            'Neutral': 'خنثی',
            'Greed': 'طمع',
            'Extreme Greed': 'طمع شدید'
        };
        const labelFa = translations[fg.value_classification] || fg.value_classification;
        
        let color = '#f0b90b';
        if (value <= 25) color = '#f6465d';
        else if (value <= 45) color = '#ff8c42';
        else if (value <= 75) color = '#8dd35f';
        else color = '#0ecb81';
        
        const time = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
        
        box.innerHTML = `
            <div class="fg-content">
                <div class="fg-value" style="color: ${color};">${value}</div>
                <div class="fg-label" style="color: ${color};">${labelFa}</div>
                <div class="fg-bar-container">
                    <div class="fg-pointer" style="right: ${value}%;"></div>
                </div>
                <div class="fg-labels-row">
                    <span>😱 ترس شدید</span>
                    <span>😐 خنثی</span>
                    <span>🤑 طمع شدید</span>
                </div>
                <p class="fg-update">آخرین به‌روزرسانی: ${time}</p>
            </div>
        `;
    } catch (e) {
        box.innerHTML = '<p class="loading-text">❌ خطا در دریافت شاخص</p>';
    }
}

/* ============================================
   ۷. ارزهای ترند
   ============================================ */
async function fetchTrending() {
    const grid = document.getElementById('trending-grid');
    if (!grid) return;
    
    try {
        const res = await fetch(`${API_BASE}/search/trending`);
        const data = await res.json();
        
        grid.innerHTML = '';
        data.coins.slice(0, 6).forEach((item, i) => {
            const coin = item.item;
            const card = document.createElement('div');
            card.className = 'trending-card';
            card.innerHTML = `
                <span class="trending-rank">#${i + 1}</span>
                <img src="${coin.small}" alt="${coin.name}" 
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🪙</text></svg>'">
                <h4>${coin.name}</h4>
                <p class="trend-symbol">${coin.symbol}</p>
            `;
            card.addEventListener('click', () => {
                const input = document.getElementById('search-input');
                if (input) {
                    input.value = coin.name;
                    currentPage = 1;
                    currentView = 'all';
                    applyFilters();
                    window.scrollTo({ top: 1000, behavior: 'smooth' });
                }
            });
            grid.appendChild(card);
        });
    } catch (e) {
        console.error('خطا در ترند:', e);
    }
}

/* ============================================
   ۸. دریافت قیمت‌ها
   ============================================ */
async function fetchPrices() {
    try {
        if (usdToTomanRate === 0) await fetchTomanRate();
        
        const res = await fetch(
            `${API_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&price_change_percentage=24h,7d,30d`
        );
        
        if (!res.ok) throw new Error('خطای شبکه');
        
        allCoins = await res.json();
        applyFilters();
        renderMovers();
        
        const now = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
        console.log(`✅ ${allCoins.length} ارز دریافت شد - ${now}`);
        
    } catch (e) {
        console.error('خطا:', e);
        const grid = document.getElementById('crypto-grid');
        if (grid) {
            grid.innerHTML = '<p style="text-align:center; grid-column:1/-1; padding:40px;">❌ خطا در دریافت اطلاعات</p>';
        }
    }
}

/* ============================================
   ۹. اعمال فیلترها
   ============================================ */
function applyFilters() {
    const input = document.getElementById('search-input');
    const term = (input?.value || '').toLowerCase().trim();
    
    let result = [...allCoins];
    
    // فیلتر
    if (currentView === 'favorites') {
        result = result.filter(c => favorites.includes(c.id));
    } else if (currentView === 'gainers') {
        result = result.filter(c => (c.price_change_percentage_24h || 0) > 0);
    } else if (currentView === 'losers') {
        result = result.filter(c => (c.price_change_percentage_24h || 0) < 0);
    }
    
    // جستجو
    if (term) {
        result = result.filter(c =>
            c.name.toLowerCase().includes(term) ||
            c.symbol.toLowerCase().includes(term) ||
            c.id.toLowerCase().includes(term)
        );
    }
    
    // مرتب‌سازی
    switch (currentSort) {
        case 'market_cap_desc': result.sort((a, b) => b.market_cap - a.market_cap); break;
        case 'market_cap_asc': result.sort((a, b) => a.market_cap - b.market_cap); break;
        case 'price_desc': result.sort((a, b) => b.current_price - a.current_price); break;
        case 'price_asc': result.sort((a, b) => a.current_price - b.current_price); break;
        case 'change_desc': result.sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0)); break;
        case 'change_asc': result.sort((a, b) => (a.price_change_percentage_24h || 0) - (b.price_change_percentage_24h || 0)); break;
    }
    
    // رندر
    renderCoins(result);
    updatePaginationButtons(result.length);
}

/* ============================================
   ۱۰. رندر کارت‌ها
   ============================================ */
function renderCoins(coinsList) {
    const grid = document.getElementById('crypto-grid');
    const emptyState = document.getElementById('empty-state');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    if (coinsList.length === 0) {
        grid.style.display = 'none';
        if (emptyState) {
            emptyState.style.display = 'block';
            if (currentView === 'favorites') {
                emptyState.querySelector('h3').textContent = 'هنوز علاقه‌مندی نداری';
                emptyState.querySelector('p').textContent = 'روی ستاره هر کارت بزن';
                emptyState.querySelector('.empty-icon').textContent = '⭐';
            } else {
                emptyState.querySelector('h3').textContent = 'چیزی پیدا نشد';
                emptyState.querySelector('p').textContent = 'یه کلمه دیگه امتحان کن';
                emptyState.querySelector('.empty-icon').textContent = '🔍';
            }
        }
        return;
    }
    
    grid.style.display = 'grid';
    if (emptyState) emptyState.style.display = 'none';
    
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const pageCoins = coinsList.slice(start, start + ITEMS_PER_PAGE);
    
    pageCoins.forEach((coin, i) => {
        const card = createCoinCard(coin);
        card.style.animationDelay = `${i * 0.02}s`;
        grid.appendChild(card);
    });
    
    // ذخیره لیست فعلی برای هشدارها
    window._currentCoins = coinsList;
}

/* ============================================
   ۱۱. ساخت کارت ارز
   ============================================ */
function createCoinCard(coin) {
    const rank = allCoins.indexOf(coin) + 1;
    const price = coin.current_price.toLocaleString('en-US', {
        maximumFractionDigits: coin.current_price < 1 ? 6 : 2
    });
    const change = coin.price_change_percentage_24h || 0;
    const cls = change >= 0 ? 'positive' : 'negative';
    const sign = change >= 0 ? '▲ +' : '▼ ';
    
    let toman = '';
    if (usdToTomanRate > 0) {
        const t = coin.current_price * usdToTomanRate;
        if (t >= 1) toman = t.toLocaleString('fa-IR', { maximumFractionDigits: 0 }) + ' تومان';
    }
    
    const isFav = favorites.includes(coin.id);
    
    const card = document.createElement('div');
    card.className = 'crypto-card';
    card.dataset.id = coin.id;
    card.innerHTML = `
        <button class="favorite-btn ${isFav ? 'active' : ''}" data-id="${coin.id}">
            ${isFav ? '⭐' : '☆'}
        </button>
        <span class="rank">#${rank}</span>
        <img src="${coin.image}" alt="${coin.name}" class="coin-logo" loading="lazy"
             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🪙</text></svg>'">
        <h3>${coin.name}</h3>
        <p class="symbol">${coin.symbol.toUpperCase()}</p>
        <p class="price">$${price}</p>
        ${toman ? `<p class="price-toman">${toman}</p>` : ''}
        <p class="change ${cls}">${sign}${Math.abs(change).toFixed(2)}%</p>
    `;
    
    card.querySelector('.favorite-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(coin.id);
    });
    
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.favorite-btn')) openChart(coin);
    });
    
    return card;
}

/* ============================================
   ۱۲. صفحه‌بندی
   ============================================ */
function updatePaginationButtons(totalItems) {
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const pag = document.getElementById('pagination');
    const infoBar = document.getElementById('page-info-bar');
    
    if (!pag) return;
    
    if (totalPages <= 1) {
        pag.style.display = 'none';
        if (infoBar) infoBar.style.display = 'none';
        return;
    }
    
    pag.style.display = 'flex';
    if (infoBar) infoBar.style.display = 'flex';
    
    // دکمه‌های قبلی/بعدی
    document.getElementById('prev-page').disabled = currentPage === 1;
    document.getElementById('next-page').disabled = currentPage === totalPages;
    document.getElementById('first-page').disabled = currentPage === 1;
    document.getElementById('last-page').disabled = currentPage === totalPages;
    
    // شماره صفحات
    const nums = document.getElementById('page-numbers');
    nums.innerHTML = '';
    
    const range = 2;
    const start = Math.max(1, currentPage - range);
    const end = Math.min(totalPages, currentPage + range);
    
    if (start > 1) {
        nums.innerHTML += `<button class="page-number" data-page="1">۱</button>`;
        if (start > 2) nums.innerHTML += `<span style="padding:8px;">...</span>`;
    }
    
    for (let i = start; i <= end; i++) {
        const btn = document.createElement('button');
        btn.className = `page-number ${i === currentPage ? 'active' : ''}`;
        btn.textContent = i.toLocaleString('fa-IR');
        btn.dataset.page = i;
        btn.addEventListener('click', () => goToPage(i));
        nums.appendChild(btn);
    }
    
    if (end < totalPages) {
        if (end < totalPages - 1) nums.innerHTML += `<span style="padding:8px;">...</span>`;
        nums.innerHTML += `<button class="page-number" data-page="${totalPages}">${totalPages.toLocaleString('fa-IR')}</button>`;
    }
    
    // فعال‌سازی کلیک روی شماره‌ها
    nums.querySelectorAll('.page-number').forEach(btn => {
        btn.addEventListener('click', () => goToPage(parseInt(btn.dataset.page)));
    });
    
    // اطلاعات
    document.getElementById('page-info').textContent = `صفحه ${currentPage.toLocaleString('fa-IR')} از ${totalPages.toLocaleString('fa-IR')}`;
    const from = ((currentPage - 1) * ITEMS_PER_PAGE + 1).toLocaleString('fa-IR');
    const to = Math.min(currentPage * ITEMS_PER_PAGE, totalItems).toLocaleString('fa-IR');
    document.getElementById('results-info').textContent = `نمایش ${from} تا ${to} از ${totalItems.toLocaleString('fa-IR')}`;
}

function goToPage(page) {
    currentPage = page;
    applyFilters();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setupPagination() {
    document.getElementById('prev-page')?.addEventListener('click', () => {
        if (currentPage > 1) { currentPage--; applyFilters(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    });
    document.getElementById('next-page')?.addEventListener('click', () => {
        currentPage++; applyFilters(); window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.getElementById('first-page')?.addEventListener('click', () => goToPage(1));
    document.getElementById('last-page')?.addEventListener('click', () => {
        const total = Math.ceil((window._currentCoins?.length || 0) / ITEMS_PER_PAGE);
        goToPage(total);
    });
}

/* ============================================
   ۱۳. علاقه‌مندی
   ============================================ */
function toggleFavorite(coinId) {
    const idx = favorites.indexOf(coinId);
    if (idx === -1) favorites.push(coinId);
    else favorites.splice(idx, 1);
    
    localStorage.setItem('favorites', JSON.stringify(favorites));
    updateFavCount();
    applyFilters();
    
    // به‌روزرسانی مودال اگه بازه
    if (currentChartCoin?.id === coinId) {
        const btn = document.getElementById('modal-fav-btn');
        if (btn) {
            const isFav = favorites.includes(coinId);
            btn.textContent = isFav ? '⭐ علاقه‌مندی' : '☆ علاقه‌مندی';
        }
    }
}

function updateFavCount() {
    const el = document.getElementById('fav-count');
    if (el) el.textContent = favorites.length.toLocaleString('fa-IR');
}

/* ============================================
   ۱۴. فیلترها و جستجو
   ============================================ */
function setupFilterButtons() {
    const buttons = {
        'show-all': 'all',
        'show-favorites': 'favorites',
        'show-gainers': 'gainers',
        'show-losers': 'losers'
    };
    
    Object.keys(buttons).forEach(id => {
        document.getElementById(id)?.addEventListener('click', () => {
            currentView = buttons[id];
            currentPage = 1;
            Object.keys(buttons).forEach(bid => document.getElementById(bid)?.classList.remove('active'));
            document.getElementById(id)?.classList.add('active');
            applyFilters();
        });
    });
}

function setupSearch() {
    const input = document.getElementById('search-input');
    const clearBtn = document.getElementById('clear-search');
    if (!input) return;
    
    let timeout = null;
    input.addEventListener('input', () => {
        clearTimeout(timeout);
        clearBtn.style.display = input.value ? 'block' : 'none';
        timeout = setTimeout(() => {
            currentPage = 1;
            applyFilters();
        }, 200);
    });
    
    clearBtn?.addEventListener('click', () => {
        input.value = '';
        clearBtn.style.display = 'none';
        currentPage = 1;
        applyFilters();
        input.focus();
    });
    
    // Escape برای پاک کردن
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            input.value = '';
            clearBtn.style.display = 'none';
            applyFilters();
        }
    });
}

function setupSort() {
    document.getElementById('sort-select')?.addEventListener('change', (e) => {
        currentSort = e.target.value;
        currentPage = 1;
        applyFilters();
    });
}

function setupViewToggle() {
    document.getElementById('view-grid')?.addEventListener('click', () => {
        viewMode = 'grid';
        document.getElementById('crypto-grid')?.classList.remove('list-view');
        document.getElementById('view-grid')?.classList.add('active');
        document.getElementById('view-list')?.classList.remove('active');
        localStorage.setItem('viewMode', 'grid');
    });
    
    document.getElementById('view-list')?.addEventListener('click', () => {
        viewMode = 'list';
        document.getElementById('crypto-grid')?.classList.add('list-view');
        document.getElementById('view-list')?.classList.add('active');
        document.getElementById('view-grid')?.classList.remove('active');
        localStorage.setItem('viewMode', 'list');
    });
}

/* ============================================
   ۱۵. صعودی/نزولی
   ============================================ */
function setupMoversTabs() {
    document.querySelectorAll('.movers-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.movers-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentMoverTab = tab.dataset.tab;
            renderMovers();
        });
    });
}

function renderMovers() {
    const gEl = document.getElementById('top-gainers');
    const lEl = document.getElementById('top-losers');
    if (!gEl || !lEl || allCoins.length === 0) return;
    
    const key = currentMoverTab === '24h' ? 'price_change_percentage_24h'
              : currentMoverTab === '7d' ? 'price_change_percentage_7d_in_currency'
              : 'price_change_percentage_30d_in_currency';
    
    const valid = allCoins.filter(c => c[key] != null);
    const sorted = [...valid].sort((a, b) => b[key] - a[key]);
    
    gEl.innerHTML = '';
    lEl.innerHTML = '';
    
    sorted.slice(0, 5).forEach(c => gEl.appendChild(createMoverItem(c, true, key)));
    sorted.slice(-5).reverse().forEach(c => lEl.appendChild(createMoverItem(c, false, key)));
}

function createMoverItem(coin, isGainer, key) {
    const change = coin[key] || 0;
    const item = document.createElement('div');
    item.className = 'mover-item';
    item.innerHTML = `
        <img src="${coin.image}" alt="${coin.name}" 
             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🪙</text></svg>'">
        <div style="flex:1; min-width:0;">
            <div class="mover-name">${coin.name}</div>
            <div class="mover-symbol">${coin.symbol.toUpperCase()}</div>
        </div>
        <span class="mover-change ${isGainer ? 'positive' : 'negative'}">
            ${isGainer ? '+' : ''}${change.toFixed(2)}%
        </span>
    `;
    item.addEventListener('click', () => openChart(coin));
    return item;
}

/* ============================================
   ۱۶. هشدار قیمت
   ============================================ */
function renderAlerts() {
    // فقط تو صفحه alerts.html استفاده میشه
}

function checkAlerts() {
    if (alerts.length === 0) return;
    
    alerts.forEach((alert, idx) => {
        if (alert.notified) return;
        const coin = allCoins.find(c => c.id === alert.coinId);
        if (!coin) return;
        
        const price = coin.current_price;
        const triggered = (alert.type === 'above' && price >= alert.target) ||
                          (alert.type === 'below' && price <= alert.target);
        
        if (triggered) {
            alert.notified = true;
            
            // نمایش نوتیف
            if (Notification.permission === 'granted') {
                new Notification(`🔔 ${coin.name}`, {
                    body: `قیمت به $${price.toLocaleString('en-US')} رسید (هدف: $${alert.target.toLocaleString('en-US')})`,
                    icon: coin.image
                });
            }
            
            // ذخیره
            localStorage.setItem('alerts', JSON.stringify(alerts));
            
            console.log(`🔔 هشدار ${coin.name} فعال شد!`);
        }
    });
}

function setupAlertModal() {
    const modal = document.getElementById('alert-modal');
    const closeBtn = document.getElementById('alert-modal-close');
    const saveBtn = document.getElementById('save-alert-btn');
    
    closeBtn?.addEventListener('click', () => modal?.classList.remove('open'));
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('open');
    });
    
    saveBtn?.addEventListener('click', () => {
        const target = parseFloat(document.getElementById('alert-target-price').value);
        const type = document.querySelector('input[name="alert-type"]:checked')?.value || 'above';
        
        if (!target || !currentChartCoin) {
            alert('لطفاً قیمت هدف را وارد کنید');
            return;
        }
        
        alerts.push({
            coinId: currentChartCoin.id,
            target,
            type,
            notified: false,
            createdAt: Date.now()
        });
        
        localStorage.setItem('alerts', JSON.stringify(alerts));
        modal.classList.remove('open');
        
        // درخواست اجازه نوتیفیکیشن
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }
        
        alert('✅ هشدار ذخیره شد!');
    });
}

/* ============================================
   ۱۷. کیف پول
   ============================================ */
let connectedWallet = null;

function getWalletProvider() {
    // اول Trust Wallet، بعد MetaMask، بعد هر provider
    if (window.ethereum?.providers) {
        for (const p of window.ethereum.providers) {
            if (p.isTrust) return p;
        }
        for (const p of window.ethereum.providers) {
            if (p.isMetaMask) return p;
        }
    }
    return window.ethereum || null;
}

function showWalletStatus(msg, type = 'info') {
    const el = document.getElementById('wallet-status');
    if (!el) return;
    el.textContent = msg;
    el.className = `wallet-status show ${type}`;
    if (type !== 'info') setTimeout(() => el.classList.remove('show'), 5000);
}

function shortenAddress(addr) {
    if (!addr) return '-';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

async function connectWallet() {
    const btn = document.getElementById('connect-wallet-btn');
    const provider = getWalletProvider();
    
    if (!provider) {
        showWalletStatus('❌ کیف پول نصب نیست', 'error');
        return;
    }
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<span>⏳</span> در حال اتصال...';
        
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
        if (!accounts?.length) throw new Error('حساب انتخاب نشد');
        
        connectedWallet = accounts[0];
        
        document.getElementById('wallet-address').textContent = shortenAddress(connectedWallet);
        document.getElementById('wallet-address').title = connectedWallet;
        
        const balance = await provider.request({
            method: 'eth_getBalance',
            params: [connectedWallet, 'latest']
        });
        const ethBal = parseInt(balance, 16) / 1e18;
        document.getElementById('wallet-balance').textContent = ethBal.toFixed(4) + ' ETH';
        
        const chainId = await provider.request({ method: 'eth_chainId' });
        document.getElementById('wallet-network').textContent = NETWORKS[chainId] || chainId;
        
        document.getElementById('wallet-info').style.display = 'block';
        btn.style.display = 'none';
        
        showWalletStatus('✅ با موفقیت متصل شدی!', 'success');
        
        provider.on?.('accountsChanged', (accs) => {
            if (!accs.length) disconnectWallet();
            else window.location.reload();
        });
        provider.on?.('chainChanged', () => window.location.reload());
        
    } catch (error) {
        console.error('خطا:', error);
        showWalletStatus('❌ ' + (error.message || 'خطای ناشناخته'), 'error');
        btn.disabled = false;
        btn.innerHTML = '<span>🦊</span> اتصال به MetaMask';
    }
}

function disconnectWallet() {
    connectedWallet = null;
    document.getElementById('wallet-info').style.display = 'none';
    const btn = document.getElementById('connect-wallet-btn');
    if (btn) {
        btn.style.display = 'inline-flex';
        btn.disabled = false;
        btn.innerHTML = '<span>🦊</span> اتصال به MetaMask';
    }
    showWalletStatus('👋 اتصال قطع شد', 'info');
}

function setupWallet() {
    const btn = document.getElementById('connect-wallet-btn');
    if (!btn) return;
    
    if (!getWalletProvider()) {
        document.getElementById('wallet-not-installed').style.display = 'block';
        btn.style.display = 'none';
        return;
    }
    
    btn.addEventListener('click', connectWallet);
    document.getElementById('disconnect-wallet-btn')?.addEventListener('click', disconnectWallet);
}

/* ============================================
   ۱۸. نمودار
   ============================================ */
let chartInstance = null;

async function openChart(coin) {
    const modal = document.getElementById('chart-modal');
    if (!modal) return;
    
    currentChartCoin = coin;
    currentChartDays = 7;
    
    // پر کردن اطلاعات
    document.getElementById('modal-name').textContent = coin.name;
    document.getElementById('modal-price').textContent = '$' + coin.current_price.toLocaleString('en-US', {
        maximumFractionDigits: coin.current_price < 1 ? 6 : 2
    });
    document.getElementById('modal-logo').src = coin.image;
    document.getElementById('modal-rank').textContent = `#${coin.market_cap_rank || '—'}`;
    
    const change24 = coin.price_change_percentage_24h || 0;
    const el24 = document.getElementById('modal-change-24');
    el24.textContent = (change24 >= 0 ? '▲ +' : '▼ ') + Math.abs(change24).toFixed(2) + '%';
    el24.style.color = change24 >= 0 ? '#0ecb81' : '#f6465d';
    
    const change7 = coin.price_change_percentage_7d_in_currency || 0;
    const el7 = document.getElementById('modal-change-7');
    el7.textContent = (change7 >= 0 ? '▲ +' : '▼ ') + Math.abs(change7).toFixed(2) + '%';
    el7.style.color = change7 >= 0 ? '#0ecb81' : '#f6465d';
    
    document.getElementById('modal-mcap').textContent = formatLargeNumber(coin.market_cap);
    
    // دکمه علاقه‌مندی
    const favBtn = document.getElementById('modal-fav-btn');
    favBtn.textContent = favorites.includes(coin.id) ? '⭐ علاقه‌مندی' : '☆ علاقه‌مندی';
    
    // لینک جزئیات
    document.getElementById('modal-detail-btn').href = `coin.html?id=${coin.id}`;
    
    // نمایش
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    
    // ریست دکمه‌های بازه
    document.querySelectorAll('.chart-period-btn').forEach(b => b.classList.toggle('active', b.dataset.days === '7'));
    
    await loadChart(coin.id, 7);
}

async function loadChart(coinId, days) {
    const container = document.querySelector('.chart-container');
    if (!container) return;
    
    container.innerHTML = '<p style="text-align:center; padding:50px; opacity:0.6;">⏳ در حال دریافت...</p>';
    
    try {
        const res = await fetch(`${API_BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`);
        const data = await res.json();
        const prices = data.prices;
        
        container.innerHTML = '<canvas id="price-chart"></canvas>';
        const ctx = document.getElementById('price-chart').getContext('2d');
        
        const labels = prices.map(p => {
            const d = new Date(p[0]);
            if (days === 1) return d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
            if (days === 365) return d.toLocaleDateString('fa-IR', { month: 'short', year: '2-digit' });
            return d.toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' });
        });
        const values = prices.map(p => p[1]);
        
        const isUp = values[values.length - 1] >= values[0];
        const lineColor = isUp ? '#0ecb81' : '#f6465d';
        const fillColor = isUp ? 'rgba(14, 203, 129, 0.15)' : 'rgba(246, 70, 93, 0.15)';
        
        if (chartInstance) chartInstance.destroy();
        
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, fillColor);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        
        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'قیمت',
                    data: values,
                    borderColor: lineColor,
                    backgroundColor: gradient,
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 7,
                    pointHoverBackgroundColor: lineColor,
                    pointHoverBorderColor: '#fff',
                    pointHoverBorderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { intersect: false, mode: 'index' },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.95)',
                        padding: 14,
                        cornerRadius: 10,
                        titleFont: { family: 'Vazirmatn', size: 12 },
                        bodyFont: { family: 'Vazirmatn', size: 14, weight: 'bold' },
                        borderColor: lineColor,
                        borderWidth: 2,
                        displayColors: false,
                        callbacks: {
                            label: (ctx) => '$' + ctx.parsed.y.toLocaleString('en-US', {
                                maximumFractionDigits: ctx.parsed.y < 1 ? 6 : 2
                            })
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.5)',
                            font: { family: 'Vazirmatn', size: 10 },
                            maxTicksLimit: 6
                        }
                    },
                    y: {
                        position: 'right',
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.5)',
                            font: { family: 'Vazirmatn', size: 10 },
                            callback: (v) => {
                                if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
                                if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
                                if (v >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'K';
                                return '$' + v.toFixed(2);
                            }
                        }
                    }
                }
            }
        });
        
    } catch (e) {
        console.error(e);
        container.innerHTML = '<p style="text-align:center; padding:50px; color:#f6465d;">❌ خطا</p>';
    }
}

function closeChart() {
    document.getElementById('chart-modal')?.classList.remove('open');
    document.body.style.overflow = '';
    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }
    currentChartCoin = null;
}

function setupChartModal() {
    document.getElementById('modal-close')?.addEventListener('click', closeChart);
    document.getElementById('chart-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'chart-modal') closeChart();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeChart();
    });
    
    // دکمه‌های بازه زمانی
    document.querySelectorAll('.chart-period-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            document.querySelectorAll('.chart-period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentChartDays = parseInt(btn.dataset.days);
            if (currentChartCoin) await loadChart(currentChartCoin.id, currentChartDays);
        });
    });
    
    // دکمه علاقه‌مندی در مودال
    document.getElementById('modal-fav-btn')?.addEventListener('click', () => {
        if (currentChartCoin) toggleFavorite(currentChartCoin.id);
    });
    
    // دکمه هشدار
    document.getElementById('modal-alert-btn')?.addEventListener('click', () => {
        if (!currentChartCoin) return;
        document.getElementById('alert-coin-name').textContent = `${currentChartCoin.name} (${currentChartCoin.symbol.toUpperCase()})`;
        document.getElementById('alert-target-price').value = currentChartCoin.current_price;
        document.getElementById('alert-modal')?.classList.add('open');
    });
}

/* ============================================
   ۱۹. دکمه بازگشت به بالا
   ============================================ */
function setupScrollTop() {
    const btn = document.getElementById('scroll-top');
    if (!btn) return;
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 500) btn.classList.add('show');
        else btn.classList.remove('show');
    });
    
    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

/* ============================================
   ۲۰. کلیدهای میانبر
   ============================================ */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // فقط اگه تو input نیست
        if (e.target.tagName === 'INPUT') return;
        
        // / → فوکوس روی جستجو
        if (e.key === '/') {
            e.preventDefault();
            document.getElementById('search-input')?.focus();
        }
        
        // T → تغییر تم
        if (e.key === 't' || e.key === 'T') {
            document.getElementById('theme-toggle')?.click();
        }
        
        // Arrow left/right → صفحه قبل/بعد
        if (e.key === 'ArrowLeft') {
            document.getElementById('next-page')?.click();
        }
        if (e.key === 'ArrowRight') {
            document.getElementById('prev-page')?.click();
        }
    });
}

/* ============================================
   ۲۱. مدیریت خطا
   ============================================ */
window.addEventListener('error', (e) => {
    console.error('❌ خطای سراسری:', e.message);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('❌ خطای Promise:', e.reason);
});