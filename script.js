/* ============================================
   سایت قیمت ارز دیجیتال - اسکریپت اصلی
   نسخه: ۴.۰
   ============================================ */

let allCoins = [];
let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
let alerts = JSON.parse(localStorage.getItem('alerts') || '[]');
let currentView = 'all';
let usdToTomanRate = 0;
let currentPage = 1;
let currentChartCoin = null;
let currentChartDays = 7;
const ITEMS_PER_PAGE = 20;
const API_BASE = 'https://api.coingecko.com/api/v3';

/* ============================================
   ۱. نرخ تومان
   ============================================ */
async function fetchTomanRate() {
    try {
        const res = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/irr.json');
        const data = await res.json();
        if (data.irr && data.irr.usd && data.irr.usd > 0) {
            usdToTomanRate = (1 / data.irr.usd) / 10;
        }
    } catch (e) { console.error(e); }
}

/* ============================================
   ۲. تم
   ============================================ */
function setupTheme() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const saved = localStorage.getItem('theme');
    if (saved === 'light') { document.body.classList.add('light-mode'); btn.textContent = '☀️'; }
    else btn.textContent = '🌙';
    btn.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        const isLight = document.body.classList.contains('light-mode');
        btn.textContent = isLight ? '☀️' : '🌙';
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
    });
}

/* ============================================
   ۳. شاخص ترس و طمع
   ============================================ */
async function fetchFearGreed() {
    const box = document.getElementById('fear-greed-box');
    if (!box) return;
    try {
        const response = await fetch('https://api.alternative.me/fng/?limit=1');
        const data = await response.json();
        const fg = data.data[0];
        const value = parseInt(fg.value);
        const translations = { 'Extreme Fear': 'ترس شدید', 'Fear': 'ترس', 'Neutral': 'خنثی', 'Greed': 'طمع', 'Extreme Greed': 'طمع شدید' };
        const labelFa = translations[fg.value_classification] || fg.value_classification;
        let color = '#f0b90b';
        if (value <= 25) color = '#f6465d';
        else if (value <= 45) color = '#ff8c42';
        else if (value <= 75) color = '#8dd35f';
        else color = '#0ecb81';
        const time = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
        box.innerHTML = `
            <div class="fg-value" style="color: ${color};">${value}</div>
            <div class="fg-label" style="color: ${color};">${labelFa}</div>
            <div class="fg-bar-container"><div class="fg-pointer" style="right: ${value}%;"></div></div>
            <div class="fg-labels-row"><span>ترس شدید</span><span>خنثی</span><span>طمع شدید</span></div>
            <p class="fg-update">آخرین به‌روزرسانی: ${time}</p>`;
    } catch (e) { box.innerHTML = '<p class="loading-text">❌ خطا</p>'; }
}

/* ============================================
   ۴. ارزهای ترند
   ============================================ */
async function fetchTrending() {
    const grid = document.getElementById('trending-grid');
    if (!grid) return;
    try {
        const response = await fetch(`${API_BASE}/search/trending`);
        const data = await response.json();
        grid.innerHTML = '';
        data.coins.slice(0, 5).forEach((item, i) => {
            const coin = item.item;
            const card = document.createElement('div');
            card.className = 'trending-card';
            card.innerHTML = `
                <span class="fire">🔥</span>
                <img src="${coin.small}" alt="${coin.name}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🪙</text></svg>'">
                <h4>${coin.symbol}</h4>
                <p class="trend-rank">#${i + 1}</p>`;
            card.addEventListener('click', () => {
                const input = document.getElementById('search-input');
                if (input) { input.value = coin.name; currentPage = 1; currentView = 'all'; applyFilters(); window.scrollTo({ top: 800, behavior: 'smooth' }); }
            });
            grid.appendChild(card);
        });
    } catch (e) { grid.innerHTML = '<p class="loading-text">❌ خطا</p>'; }
}

/* ============================================
   ۵. صعودی/نزولی
   ============================================ */
function renderMovers() {
    const gEl = document.getElementById('top-gainers');
    const lEl = document.getElementById('top-losers');
    if (!gEl || !lEl || allCoins.length === 0) return;
    const valid = allCoins.filter(c => c.price_change_percentage_24h != null);
    const sorted = [...valid].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
    gEl.innerHTML = ''; lEl.innerHTML = '';
    sorted.slice(0, 5).forEach(c => gEl.appendChild(createMoverItem(c, true)));
    sorted.slice(-5).reverse().forEach(c => lEl.appendChild(createMoverItem(c, false)));
}

function createMoverItem(coin, isGainer) {
    const change = coin.price_change_percentage_24h;
    const item = document.createElement('div');
    item.className = 'mover-item';
    item.innerHTML = `
        <img src="${coin.image}" alt="${coin.name}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🪙</text></svg>'">
        <span class="mover-name">${coin.symbol.toUpperCase()}</span>
        <span class="mover-change ${isGainer ? 'positive' : 'negative'}">${isGainer ? '+' : ''}${change.toFixed(2)}%</span>`;
    item.addEventListener('click', () => openChart(coin));
    return item;
}

/* ============================================
   ۶. هشدارهای قیمت
   ============================================ */
function renderAlerts() {
    const list = document.getElementById('alerts-list');
    if (!list) return;
    if (alerts.length === 0) {
        list.innerHTML = '<p class="loading-text">هنوز هشداری تنظیم نکردی</p>';
        return;
    }
    list.innerHTML = '';
    alerts.forEach((alert, idx) => {
        const coin = allCoins.find(c => c.id === alert.coinId);
        if (!coin) return;
        const isTriggered = (alert.type === 'above' && coin.current_price >= alert.target) || (alert.type === 'below' && coin.current_price <= alert.target);
        const item = document.createElement('div');
        item.className = 'alert-item' + (isTriggered ? ' triggered' : '');
        item.innerHTML = `
            <span class="alert-coin">${coin.symbol.toUpperCase()}</span>
            <span class="alert-type">${alert.type === 'above' ? '📈 بالاتر از' : '📉 پایین‌تر از'}</span>
            <span class="alert-target">$${alert.target.toLocaleString('en-US')}</span>
            <button class="alert-delete" data-idx="${idx}">🗑 حذف</button>`;
        item.querySelector('.alert-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            alerts.splice(idx, 1);
            localStorage.setItem('alerts', JSON.stringify(alerts));
            renderAlerts();
        });
        list.appendChild(item);
    });
}

function checkAlerts() {
    alerts.forEach((alert, idx) => {
        const coin = allCoins.find(c => c.id === alert.coinId);
        if (!coin) return;
        const triggered = (alert.type === 'above' && coin.current_price >= alert.target) || (alert.type === 'below' && coin.current_price <= alert.target);
        if (triggered && !alert.notified) {
            alert.notified = true;
            if (Notification.permission === 'granted') {
                new Notification(`🔔 ${coin.name}`, { body: `قیمت به $${coin.current_price.toLocaleString('en-US')} رسید` });
            }
            localStorage.setItem('alerts', JSON.stringify(alerts));
        }
    });
    renderAlerts();
}

function setupAlertModal() {
    const modal = document.getElementById('alert-modal');
    const closeBtn = document.getElementById('alert-modal-close');
    const saveBtn = document.getElementById('save-alert-btn');
    if (!modal) return;
    closeBtn?.addEventListener('click', () => modal.classList.remove('open'));
    saveBtn?.addEventListener('click', () => {
        const target = parseFloat(document.getElementById('alert-target-price').value);
        const type = document.getElementById('alert-type').value;
        if (!target || !currentChartCoin) return;
        alerts.push({ coinId: currentChartCoin.id, target, type, notified: false });
        localStorage.setItem('alerts', JSON.stringify(alerts));
        modal.classList.remove('open');
        renderAlerts();
        if (Notification.permission === 'default') Notification.requestPermission();
    });
}

/* ============================================
   ۷. کیف پول Trust Wallet
   ============================================ */
let connectedWallet = null;
const NETWORKS = { '0x1': 'Ethereum', '0x38': 'BNB Chain', '0x89': 'Polygon', '0xa4b1': 'Arbitrum', '0xa': 'Optimism', '0x2105': 'Base' };

function getTrustProvider() {
    if (window.ethereum?.providers) {
        for (const p of window.ethereum.providers) if (p.isTrust) return p;
    }
    if (window.ethereum?.isTrust) return window.ethereum;
    // fallback: هر provider
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
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

async function connectWallet() {
    const btn = document.getElementById('connect-wallet-btn');
    const provider = getTrustProvider();
    if (!provider) {
        showWalletStatus('❌ کیف پول نصب نیست', 'error');
        setTimeout(() => window.open('https://trustwallet.com/download', '_blank'), 1500);
        return;
    }
    try {
        btn.disabled = true;
        btn.textContent = '⏳ در حال اتصال...';
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
        if (!accounts?.length) throw new Error('حساب انتخاب نشد');
        connectedWallet = accounts[0];
        document.getElementById('wallet-address').textContent = shortenAddress(connectedWallet);
        document.getElementById('wallet-address').title = connectedWallet;
        const balance = await provider.request({ method: 'eth_getBalance', params: [connectedWallet, 'latest'] });
        const ethBal = parseInt(balance, 16) / 1e18;
        document.getElementById('wallet-balance').textContent = ethBal.toFixed(4) + ' ETH';
        const chainId = await provider.request({ method: 'eth_chainId' });
        document.getElementById('wallet-network').textContent = NETWORKS[chainId] || chainId;
        document.getElementById('wallet-info').style.display = 'block';
        btn.style.display = 'none';
        showWalletStatus('✅ متصل شدی!', 'success');
        provider.on?.('accountsChanged', (accs) => { if (!accs.length) disconnectWallet(); else location.reload(); });
        provider.on?.('chainChanged', () => location.reload());
    } catch (error) {
        showWalletStatus('❌ ' + error.message, 'error');
        btn.disabled = false;
        btn.textContent = '🦊 اتصال به Trust Wallet';
    }
}

function disconnectWallet() {
    connectedWallet = null;
    document.getElementById('wallet-info').style.display = 'none';
    const btn = document.getElementById('connect-wallet-btn');
    btn.style.display = 'block';
    btn.disabled = false;
    btn.textContent = '🦊 اتصال به Trust Wallet';
    showWalletStatus('👋 قطع شد', 'info');
}

function setupWallet() {
    const btn = document.getElementById('connect-wallet-btn');
    if (!btn) return;
    if (!getTrustProvider()) {
        document.getElementById('wallet-not-installed').style.display = 'block';
        btn.style.display = 'none';
        return;
    }
    btn.addEventListener('click', connectWallet);
    document.getElementById('disconnect-wallet-btn')?.addEventListener('click', disconnectWallet);
}

/* ============================================
   ۸. دریافت قیمت‌ها
   ============================================ */
async function fetchPrices() {
    const grid = document.getElementById('crypto-grid');
    try {
        if (usdToTomanRate === 0) await fetchTomanRate();
        const res = await fetch(`${API_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=200&page=1&price_change_percentage=24h`);
        if (!res.ok) throw new Error('خطای شبکه');
        allCoins = await res.json();
        applyFilters();
        renderMovers();
        renderAlerts();
        checkAlerts();
        const now = new Date();
        document.getElementById('last-update').textContent = `آخرین به‌روزرسانی: ${now.toLocaleTimeString('en-US')}`;
    } catch (e) {
        console.error(e);
        if (grid) grid.innerHTML = '<p style="text-align:center; padding:40px;">❌ خطا در دریافت</p>';
    }
}

/* ============================================
   ۹. فیلترها
   ============================================ */
function applyFilters() {
    const input = document.getElementById('search-input');
    const term = (input ? input.value : '').toLowerCase().trim();
    let result = allCoins;
    if (currentView === 'favorites') result = result.filter(c => favorites.includes(c.id));
    if (term) result = result.filter(c => c.name.toLowerCase().includes(term) || c.symbol.toLowerCase().includes(term));
    renderCoinsWithPagination(result);
    updatePaginationButtons(result.length);
}

/* ============================================
   ۱۰. رندر کارت‌ها
   ============================================ */
function renderCoinsWithPagination(coinsList) {
    const grid = document.getElementById('crypto-grid');
    if (!grid) return;
    grid.innerHTML = '';
    if (currentView === 'favorites' && coinsList.length === 0) {
        grid.innerHTML = '<div class="empty-favorites"><span class="big-star">⭐</span>هنوز علاقه‌مندی نداری</div>';
        return;
    }
    if (coinsList.length === 0) {
        grid.innerHTML = '<p class="no-results">🔍 چیزی پیدا نشد</p>';
        return;
    }
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    coinsList.slice(start, start + ITEMS_PER_PAGE).forEach((coin, i) => {
        const card = createCoinCard(coin);
        card.style.animationDelay = `${i * 0.02}s`;
        grid.appendChild(card);
    });
}

function createCoinCard(coin) {
    const rank = allCoins.indexOf(coin) + 1;
    const price = coin.current_price.toLocaleString('en-US', { maximumFractionDigits: coin.current_price < 1 ? 6 : 2 });
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
    card.innerHTML = `
        <button class="favorite-btn ${isFav ? 'active' : ''}">${isFav ? '⭐' : '☆'}</button>
        <span class="rank">#${rank}</span>
        <img src="${coin.image}" alt="${coin.name}" class="coin-logo" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🪙</text></svg>'">
        <h3>${coin.name}</h3>
        <p class="symbol">${coin.symbol.toUpperCase()}</p>
        <p class="price">$${price}</p>
        ${toman ? `<p class="price-toman">${toman}</p>` : ''}
        <p class="change ${cls}">${sign}${Math.abs(change).toFixed(2)}%</p>`;
    card.querySelector('.favorite-btn').addEventListener('click', (e) => { e.stopPropagation(); toggleFavorite(coin.id); });
    card.addEventListener('click', (e) => { if (!e.target.closest('.favorite-btn')) openChart(coin); });
    return card;
}

/* ============================================
   ۱۱. صفحه‌بندی
   ============================================ */
function updatePaginationButtons(total) {
    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
    const pag = document.getElementById('pagination');
    if (!pag) return;
    if (totalPages <= 1) { pag.style.display = 'none'; return; }
    pag.style.display = 'flex';
    document.getElementById('page-info').textContent = `صفحه ${currentPage.toLocaleString('fa-IR')} از ${totalPages.toLocaleString('fa-IR')}`;
    document.getElementById('prev-page').disabled = currentPage === 1;
    document.getElementById('next-page').disabled = currentPage === totalPages;
}

function setupPagination() {
    document.getElementById('prev-page')?.addEventListener('click', () => { if (currentPage > 1) { currentPage--; applyFilters(); scrollTo({ top: 0, behavior: 'smooth' }); } });
    document.getElementById('next-page')?.addEventListener('click', () => { currentPage++; applyFilters(); scrollTo({ top: 0, behavior: 'smooth' }); });
}

/* ============================================
   ۱۲. علاقه‌مندی
   ============================================ */
function toggleFavorite(coinId) {
    const idx = favorites.indexOf(coinId);
    if (idx === -1) favorites.push(coinId); else favorites.splice(idx, 1);
    localStorage.setItem('favorites', JSON.stringify(favorites));
    document.getElementById('fav-count').textContent = favorites.length.toLocaleString('fa-IR');
    applyFilters();
}

/* ============================================
   ۱۳. فیلتر و جستجو
   ============================================ */
function setupFilterButtons() {
    const all = document.getElementById('show-all'), fav = document.getElementById('show-favorites');
    all?.addEventListener('click', () => { currentView = 'all'; currentPage = 1; all.classList.add('active'); fav.classList.remove('active'); applyFilters(); });
    fav?.addEventListener('click', () => { currentView = 'favorites'; currentPage = 1; fav.classList.add('active'); all.classList.remove('active'); applyFilters(); });
}

function setupSearch() {
    const input = document.getElementById('search-input');
    if (!input) return;
    let t = null;
    input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { currentPage = 1; applyFilters(); }, 150); });
}

/* ============================================
   ۱۴. نمودار
   ============================================ */
let chartInstance = null;

async function openChart(coin) {
    const modal = document.getElementById('chart-modal');
    if (!modal) return;
    currentChartCoin = coin;
    currentChartDays = 7;
    document.getElementById('modal-name').textContent = coin.name;
    document.getElementById('modal-price').textContent = '$' + coin.current_price.toLocaleString('en-US', { maximumFractionDigits: coin.current_price < 1 ? 6 : 2 });
    document.getElementById('modal-logo').src = coin.image;
    const change = coin.price_change_percentage_24h || 0;
    const mc = document.getElementById('modal-change');
    mc.textContent = (change >= 0 ? '▲ +' : '▼ ') + Math.abs(change).toFixed(2) + '% (۲۴ ساعت)';
    mc.className = change >= 0 ? 'positive' : 'negative';
    document.getElementById('view-details-btn').href = `coin.html?id=${coin.id}`;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    document.querySelectorAll('.chart-period-btn').forEach(b => b.classList.toggle('active', b.dataset.days === '7'));
    await loadChart(coin.id, 7);
}

async function loadChart(coinId, days) {
    const container = document.querySelector('.chart-container');
    container.innerHTML = '<p style="text-align:center;padding:50px;opacity:0.6;">⏳ ...</p>';
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
        chartInstance = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets: [{ label: 'قیمت', data: values, borderColor: lineColor, backgroundColor: fillColor, borderWidth: 2, fill: true, tension: 0.3, pointRadius: 0, pointHoverRadius: 5 }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(0,0,0,0.9)', padding: 12, callbacks: { label: (c) => '$' + c.parsed.y.toLocaleString('en-US', { maximumFractionDigits: 2 }) } } },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 10 }, maxTicksLimit: 6 } },
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 10 } } }
                }
            }
        });
    } catch (e) { container.innerHTML = '<p style="text-align:center;padding:50px;">❌ خطا</p>'; }
}

function closeChart() {
    document.getElementById('chart-modal')?.classList.remove('open');
    document.body.style.overflow = '';
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
}

function setupChartModal() {
    document.getElementById('modal-close')?.addEventListener('click', closeChart);
    document.getElementById('chart-modal')?.addEventListener('click', (e) => { if (e.target.id === 'chart-modal') closeChart(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeChart(); });
    document.querySelectorAll('.chart-period-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            document.querySelectorAll('.chart-period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentChartDays = parseInt(btn.dataset.days);
            if (currentChartCoin) await loadChart(currentChartCoin.id, currentChartDays);
        });
    });
    document.getElementById('add-alert-btn')?.addEventListener('click', () => {
        if (!currentChartCoin) return;
        document.getElementById('alert-coin-name').textContent = currentChartCoin.name;
        document.getElementById('alert-target-price').value = currentChartCoin.current_price;
        document.getElementById('alert-modal').classList.add('open');
    });
}

/* ============================================
   ۱۵. PWA
   ============================================ */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(e => console.log('SW:', e));
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
    setupAlertModal();
    setupWallet();
    document.getElementById('fav-count').textContent = favorites.length.toLocaleString('fa-IR');
    fetchPrices();
    fetchFearGreed();
    fetchTrending();
    setInterval(fetchPrices, 60000);
    setInterval(fetchFearGreed, 600000);
});