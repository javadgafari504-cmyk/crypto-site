/* ============================================
   سایت قیمت ارز دیجیتال - اسکریپت اصلی
   نسخه: ۳.۰ | تاریخ: ۲۰۲۶
   ============================================ */

/* ============================================
   ۱. متغیرهای سراسری
   ============================================ */

let allCoins = [];
let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
let currentView = 'all';
let usdToTomanRate = 0;
let currentPage = 1;
const ITEMS_PER_PAGE = 20;
const API_BASE = 'https://api.coingecko.com/api/v3';

/* ============================================
   ۲. دریافت نرخ دلار به تومان
   ============================================ */

async function fetchTomanRate() {
    try {
        const res = await fetch(
            'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/irr.json'
        );
        const data = await res.json();
        if (data.irr && data.irr.usd && data.irr.usd > 0) {
            usdToTomanRate = (1 / data.irr.usd) / 10;
        }
    } catch (e) {
        console.error('خطا در نرخ تومان:', e);
    }
}

/* ============================================
   ۳. تم شب/روز
   ============================================ */

function setupTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) return;
    
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        themeToggle.textContent = '☀️';
    } else {
        themeToggle.textContent = '🌙';
    }
    
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        const isLight = document.body.classList.contains('light-mode');
        themeToggle.textContent = isLight ? '☀️' : '🌙';
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
    });
}

/* ============================================
   ۴. شاخص ترس و طمع
   ============================================ */

async function fetchFearGreed() {
    const box = document.getElementById('fear-greed-box');
    if (!box) return;
    
    try {
        const response = await fetch('https://api.alternative.me/fng/?limit=1');
        const data = await response.json();
        
        if (!data.data || !data.data[0]) throw new Error('داده یافت نشد');
        
        const fg = data.data[0];
        const value = parseInt(fg.value);
        const classification = fg.value_classification;
        
        // ترجمه
        const translations = {
            'Extreme Fear': 'ترس شدید',
            'Fear': 'ترس',
            'Neutral': 'خنثی',
            'Greed': 'طمع',
            'Extreme Greed': 'طمع شدید'
        };
        const labelFa = translations[classification] || classification;
        
        // رنگ
        let color = '#f0b90b';
        if (value <= 25) color = '#f6465d';
        else if (value <= 45) color = '#ff8c42';
        else if (value <= 55) color = '#f0b90b';
        else if (value <= 75) color = '#8dd35f';
        else color = '#0ecb81';
        
        const now = new Date();
        const timeStr = now.toLocaleTimeString('fa-IR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        box.innerHTML = `
            <div class="fg-value" style="color: ${color};">${value}</div>
            <div class="fg-label" style="color: ${color};">${labelFa}</div>
            <div class="fg-bar-container">
                <div class="fg-pointer" style="right: ${value}%;"></div>
            </div>
            <div class="fg-labels-row">
                <span>ترس شدید</span>
                <span>خنثی</span>
                <span>طمع شدید</span>
            </div>
            <p class="fg-update">آخرین به‌روزرسانی: ${timeStr}</p>
        `;
        
    } catch (error) {
        console.error('خطا در شاخص ترس و طمع:', error);
        box.innerHTML = '<p class="loading-text">❌ خطا در دریافت شاخص</p>';
    }
}

/* ============================================
   ۵. ارزهای ترند
   ============================================ */

async function fetchTrending() {
    const grid = document.getElementById('trending-grid');
    if (!grid) return;
    
    try {
        const response = await fetch(`${API_BASE}/search/trending`);
        const data = await response.json();
        
        if (!data.coins || data.coins.length === 0) throw new Error('داده یافت نشد');
        
        // فقط ۵ تای اول
        const trending = data.coins.slice(0, 5);
        
        grid.innerHTML = '';
        trending.forEach((item, index) => {
            const coin = item.item;
            const card = document.createElement('div');
            card.className = 'trending-card';
            card.innerHTML = `
                <span class="fire">🔥</span>
                <img src="${coin.small}" alt="${coin.name}" 
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🪙</text></svg>'">
                <h4>${coin.symbol}</h4>
                <p class="trend-rank">#${index + 1}</p>
            `;
            
            // کلیک → جستجو در لیست پایین
            card.addEventListener('click', () => {
                const searchInput = document.getElementById('search-input');
                if (searchInput) {
                    searchInput.value = coin.name;
                    currentPage = 1;
                    currentView = 'all';
                    applyFilters();
                    window.scrollTo({ top: 600, behavior: 'smooth' });
                }
            });
            
            grid.appendChild(card);
        });
        
    } catch (error) {
        console.error('خطا در ارزهای ترند:', error);
        grid.innerHTML = '<p class="loading-text">❌ خطا در دریافت</p>';
    }
}

/* ============================================
   ۶. صعودی‌ها و نزولی‌ها
   ============================================ */

function renderMovers() {
    const gainersEl = document.getElementById('top-gainers');
    const losersEl = document.getElementById('top-losers');
    
    if (!gainersEl || !losersEl || allCoins.length === 0) return;
    
    // فیلتر ارزهایی که تغییرات معتبر دارن
    const validCoins = allCoins.filter(c => 
        c.price_change_percentage_24h !== null && 
        c.price_change_percentage_24h !== undefined
    );
    
    // مرتب‌سازی
    const sorted = [...validCoins].sort((a, b) => 
        b.price_change_percentage_24h - a.price_change_percentage_24h
    );
    
    const topGainers = sorted.slice(0, 5);
    const topLosers = sorted.slice(-5).reverse();
    
    // رندر صعودی‌ها
    gainersEl.innerHTML = '';
    topGainers.forEach(coin => {
        gainersEl.appendChild(createMoverItem(coin, true));
    });
    
    // رندر نزولی‌ها
    losersEl.innerHTML = '';
    topLosers.forEach(coin => {
        losersEl.appendChild(createMoverItem(coin, false));
    });
}

function createMoverItem(coin, isGainer) {
    const change = coin.price_change_percentage_24h;
    const item = document.createElement('div');
    item.className = 'mover-item';
    item.innerHTML = `
        <img src="${coin.image}" alt="${coin.name}" 
             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🪙</text></svg>'">
        <span class="mover-name">${coin.symbol.toUpperCase()}</span>
        <span class="mover-change ${isGainer ? 'positive' : 'negative'}">
            ${isGainer ? '+' : ''}${change.toFixed(2)}%
        </span>
    `;
    
    item.addEventListener('click', () => openChart(coin));
    return item;
}

/* ============================================
   ۷. دریافت قیمت‌ها
   ============================================ */

async function fetchPrices() {
    const grid = document.getElementById('crypto-grid');
    const updateEl = document.getElementById('last-update');
    
    try {
        if (usdToTomanRate === 0) {
            await fetchTomanRate();
        }
        
        const url = `${API_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=200&page=1&price_change_percentage=24h`;
        const response = await fetch(url);
        
        if (!response.ok) throw new Error('خطای شبکه');
        
        const data = await response.json();
        allCoins = data;
        applyFilters();
        renderMovers();
        
        const now = new Date();
        if (updateEl) {
            updateEl.textContent = `آخرین به‌روزرسانی: ${now.toLocaleTimeString('en-US')}`;
        }
        
    } catch (error) {
        console.error('خطا:', error);
        if (grid) {
            grid.innerHTML = '<p style="text-align:center; padding:40px;">❌ خطا در دریافت اطلاعات</p>';
        }
    }
}

/* ============================================
   ۸. اعمال فیلترها
   ============================================ */

function applyFilters() {
    const searchInput = document.getElementById('search-input');
    const term = (searchInput ? searchInput.value : '').toLowerCase().trim();
    
    let result = allCoins;
    
    if (currentView === 'favorites') {
        result = result.filter(coin => favorites.includes(coin.id));
    }
    
    if (term !== '') {
        result = result.filter(coin => 
            coin.name.toLowerCase().includes(term) ||
            coin.symbol.toLowerCase().includes(term)
        );
    }
    
    renderCoinsWithPagination(result);
    updatePaginationButtons(result.length);
}

/* ============================================
   ۹. رندر با صفحه‌بندی
   ============================================ */

function renderCoinsWithPagination(coinsList) {
    const grid = document.getElementById('crypto-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    if (currentView === 'favorites' && coinsList.length === 0) {
        grid.innerHTML = `
            <div class="empty-favorites">
                <span class="big-star">⭐</span>
                هنوز هیچ ارزی رو به علاقه‌مندی‌ها اضافه نکردی.
            </div>
        `;
        return;
    }
    
    if (coinsList.length === 0) {
        grid.innerHTML = '<p style="text-align:center; grid-column:1/-1; padding:40px;">🔍 هیچ ارزی پیدا نشد</p>';
        return;
    }
    
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const pageCoins = coinsList.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    
    pageCoins.forEach((coin, index) => {
        const card = createCoinCard(coin);
        card.style.animationDelay = `${index * 0.02}s`;
        grid.appendChild(card);
    });
}

/* ============================================
   ۱۰. ساخت کارت ارز
   ============================================ */

function createCoinCard(coin) {
    const realRank = allCoins.indexOf(coin) + 1;
    const name = coin.name;
    const symbol = coin.symbol.toUpperCase();
    const price = coin.current_price.toLocaleString('en-US', {
        maximumFractionDigits: coin.current_price < 1 ? 6 : 2
    });
    const change = coin.price_change_percentage_24h || 0;
    const cls = change >= 0 ? 'positive' : 'negative';
    const sign = change >= 0 ? '▲ +' : '▼ ';
    
    let priceToman = '';
    if (usdToTomanRate > 0) {
        const toman = coin.current_price * usdToTomanRate;
        if (toman >= 1) {
            priceToman = toman.toLocaleString('fa-IR', { maximumFractionDigits: 0 }) + ' تومان';
        }
    }
    
    const isFav = favorites.includes(coin.id);
    const starIcon = isFav ? '⭐' : '☆';
    
    const card = document.createElement('div');
    card.className = 'crypto-card';
    card.innerHTML = `
        <button class="favorite-btn ${isFav ? 'active' : ''}" data-id="${coin.id}">
            ${starIcon}
        </button>
        <span class="rank">#${realRank}</span>
        <img src="${coin.image}" alt="${name}" class="coin-logo" loading="lazy"
             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🪙</text></svg>'">
        <h3>${name}</h3>
        <p class="symbol">${symbol}</p>
        <p class="price">$${price}</p>
        ${priceToman ? `<p class="price-toman">${priceToman}</p>` : ''}
        <p class="change ${cls}">${sign}${Math.abs(change).toFixed(2)}%</p>
    `;
    
    card.querySelector('.favorite-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(coin.id);
    });
    
    card.addEventListener('click', (e) => {
        if (e.target.closest('.favorite-btn')) return;
        openChart(coin);
    });
    
    return card;
}

/* ============================================
   ۱۱. صفحه‌بندی
   ============================================ */

function updatePaginationButtons(totalItems) {
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const pagination = document.getElementById('pagination');
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');
    
    if (!pagination) return;
    
    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }
    
    pagination.style.display = 'flex';
    pageInfo.textContent = `صفحه ${currentPage.toLocaleString('fa-IR')} از ${totalPages.toLocaleString('fa-IR')}`;
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
}

function setupPagination() {
    document.getElementById('prev-page')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            applyFilters();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
    
    document.getElementById('next-page')?.addEventListener('click', () => {
        currentPage++;
        applyFilters();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

/* ============================================
   ۱۲. علاقه‌مندی
   ============================================ */

function toggleFavorite(coinId) {
    const index = favorites.indexOf(coinId);
    if (index === -1) favorites.push(coinId);
    else favorites.splice(index, 1);
    
    localStorage.setItem('favorites', JSON.stringify(favorites));
    updateFavCount();
    applyFilters();
}

function updateFavCount() {
    const favCount = document.getElementById('fav-count');
    if (favCount) favCount.textContent = favorites.length.toLocaleString('fa-IR');
}

/* ============================================
   ۱۳. دکمه‌های فیلتر
   ============================================ */

function setupFilterButtons() {
    const showAll = document.getElementById('show-all');
    const showFav = document.getElementById('show-favorites');
    
    showAll?.addEventListener('click', () => {
        currentView = 'all';
        currentPage = 1;
        showAll.classList.add('active');
        showFav.classList.remove('active');
        applyFilters();
    });
    
    showFav?.addEventListener('click', () => {
        currentView = 'favorites';
        currentPage = 1;
        showFav.classList.add('active');
        showAll.classList.remove('active');
        applyFilters();
    });
}

/* ============================================
   ۱۴. جستجو
   ============================================ */

function setupSearch() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;
    
    let timeout = null;
    searchInput.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            currentPage = 1;
            applyFilters();
        }, 150);
    });
}

/* ============================================
   ۱۵. نمودار
   ============================================ */

let chartInstance = null;

async function openChart(coin) {
    const modal = document.getElementById('chart-modal');
    if (!modal) return;
    
    document.getElementById('modal-name').textContent = coin.name;
    document.getElementById('modal-price').textContent = '$' + coin.current_price.toLocaleString('en-US', {
        maximumFractionDigits: coin.current_price < 1 ? 6 : 2
    });
    document.getElementById('modal-logo').src = coin.image;
    
    const change = coin.price_change_percentage_24h || 0;
    const modalChange = document.getElementById('modal-change');
    modalChange.textContent = (change >= 0 ? '▲ +' : '▼ ') + Math.abs(change).toFixed(2) + '% (۲۴ ساعت)';
    modalChange.className = change >= 0 ? 'positive' : 'negative';
    
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    
    const chartContainer = document.querySelector('.chart-container');
    chartContainer.innerHTML = '<p style="text-align:center;padding:50px;opacity:0.6;">⏳ در حال دریافت نمودار...</p>';
    
    try {
        const response = await fetch(`${API_BASE}/coins/${coin.id}/market_chart?vs_currency=usd&days=7`);
        const data = await response.json();
        const prices = data.prices;
        
        chartContainer.innerHTML = '<canvas id="price-chart"></canvas>';
        const ctx = document.getElementById('price-chart').getContext('2d');
        
        const labels = prices.map(p => {
            const d = new Date(p[0]);
            return d.toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' });
        });
        const values = prices.map(p => p[1]);
        
        const isUp = values[values.length - 1] >= values[0];
        const lineColor = isUp ? '#0ecb81' : '#f6465d';
        const fillColor = isUp ? 'rgba(14, 203, 129, 0.15)' : 'rgba(246, 70, 93, 0.15)';
        
        if (chartInstance) chartInstance.destroy();
        
        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'قیمت',
                    data: values,
                    borderColor: lineColor,
                    backgroundColor: fillColor,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.9)',
                        padding: 12,
                        callbacks: {
                            label: (ctx) => '$' + ctx.parsed.y.toLocaleString('en-US', {
                                maximumFractionDigits: 2
                            })
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 10 }, maxTicksLimit: 6 }
                    },
                    y: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 10 } }
                    }
                }
            }
        });
        
    } catch (error) {
        chartContainer.innerHTML = '<p style="text-align:center;padding:50px;opacity:0.6;">❌ خطا</p>';
    }
}

function closeChart() {
    const modal = document.getElementById('chart-modal');
    if (!modal) return;
    modal.classList.remove('open');
    document.body.style.overflow = '';
    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }
}

function setupChartModal() {
    document.getElementById('modal-close')?.addEventListener('click', closeChart);
    document.getElementById('chart-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'chart-modal') closeChart();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeChart();
    });
}

/* ============================================
   ۱۶. شروع
   ============================================ */

window.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 سایت شروع شد');
    
    setupTheme();
    setupSearch();
    setupFilterButtons();
    setupPagination();
    setupChartModal();
    updateFavCount();
    
    // دریافت داده‌ها
    fetchPrices();
    fetchFearGreed();
    fetchTrending();
    
    // به‌روزرسانی هر ۶۰ ثانیه
    setInterval(fetchPrices, 60000);
    // شاخص ترس هر ۱۰ دقیقه (چون API محدودیت داره)
    setInterval(fetchFearGreed, 600000);
});