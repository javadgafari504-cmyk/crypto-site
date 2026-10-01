// ===== متغیرهای سراسری =====
let allCoins = [];
let usdToTomanRate = 0;

// ===== دریافت نرخ دلار به تومان =====
async function fetchTomanRate() {
    try {
        const res = await fetch(
            'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/irr.json'
        );
        const data = await res.json();
        if (data.irr && data.irr.usd) {
            usdToTomanRate = (1 / data.irr.usd) / 10;
        }
    } catch (e) {
        console.error('خطا در دریافت نرخ تومان:', e);
    }
}

// ===== تم شب/روز =====
function setupTheme() {
    const themeToggle = document.getElementById('theme-toggle');
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

// ===== دریافت قیمت‌ها =====
async function fetchPrices() {
    const grid = document.getElementById('crypto-grid');
    const updateEl = document.getElementById('last-update');

    try {
        if (usdToTomanRate === 0) {
            await fetchTomanRate();
        }

        const response = await fetch(
            'https://api.coingecko.com/api/v3/coins/markets' +
            '?vs_currency=usd' +
            '&order=market_cap_desc' +
            '&per_page=200' +
            '&page=1' +
            '&price_change_percentage=24h'
        );

        const data = await response.json();
        allCoins = data;
        applyFilters();

        const now = new Date();
        updateEl.textContent = `آخرین به‌روزرسانی: ${now.toLocaleTimeString('en-US')}`;

    } catch (error) {
        grid.innerHTML = '<p style="text-align:center;">❌ خطا در دریافت</p>';
    }
}

// ===== اعمال فیلتر جستجو =====
function applyFilters() {
    const searchInput = document.getElementById('search-input');
    const term = (searchInput ? searchInput.value : '').toLowerCase().trim();

    let result = allCoins;

    if (term !== '') {
        result = allCoins.filter(coin => {
            const nameMatch = coin.name.toLowerCase().includes(term);
            const symbolMatch = coin.symbol.toLowerCase().includes(term);
            return nameMatch || symbolMatch;
        });
    }

    renderCoins(result);
}

// ===== رندر کارت‌ها =====
function renderCoins(coinsList) {
    const grid = document.getElementById('crypto-grid');
    grid.innerHTML = '';

    if (coinsList.length === 0) {
        grid.innerHTML = '<p class="no-results">🔍 هیچ ارزی با این اسم پیدا نشد</p>';
        return;
    }

    coinsList.forEach(coin => {
        const realRank = allCoins.indexOf(coin) + 1;
        const name = coin.name;
        const symbol = coin.symbol.toUpperCase();
        const imageUrl = coin.image;
        const price = coin.current_price.toLocaleString('en-US');
        const change = coin.price_change_percentage_24h || 0;
        const cls = change >= 0 ? 'positive' : 'negative';
        const sign = change >= 0 ? '▲ +' : '▼ ';

        // قیمت تومان
        let priceToman = '';
        if (usdToTomanRate > 0) {
            const toman = coin.current_price * usdToTomanRate;
            priceToman = toman.toLocaleString('fa-IR', { maximumFractionDigits: 0 }) + ' تومان';
        }

        const card = document.createElement('div');
        card.className = 'crypto-card';
        card.innerHTML = `
            <span class="rank">#${realRank}</span>
            <img src="${imageUrl}" alt="${name}" class="coin-logo">
            <h3>${name}</h3>
            <p class="symbol">${symbol}</p>
            <p class="price">$${price}</p>
            ${priceToman ? `<p class="price-toman">${priceToman}</p>` : ''}
            <p class="change ${cls}">${sign}${change.toFixed(2)}%</p>
        `;

        card.addEventListener('click', () => openChart(coin));
        grid.appendChild(card);
    });
}

// ===== نمودار =====
let chartInstance = null;

async function openChart(coin) {
    const modal = document.getElementById('chart-modal');
    const modalName = document.getElementById('modal-name');
    const modalPrice = document.getElementById('modal-price');
    const modalChange = document.getElementById('modal-change');
    const modalLogo = document.getElementById('modal-logo');

    modalName.textContent = coin.name;
    modalPrice.textContent = '$' + coin.current_price.toLocaleString('en-US');
    modalLogo.src = coin.image;
    modalLogo.alt = coin.name;

    const change = coin.price_change_percentage_24h || 0;
    modalChange.textContent = 
        (change >= 0 ? '▲ +' : '▼ ') + change.toFixed(2) + '% (۲۴ ساعت)';
    modalChange.className = change >= 0 ? 'positive' : 'negative';

    modal.classList.add('open');

    const chartContainer = document.querySelector('.chart-container');
    chartContainer.innerHTML = '<p style="text-align:center;padding:50px;opacity:0.6;">⏳ در حال دریافت نمودار...</p>';

    try {
        const response = await fetch(
            `https://api.coingecko.com/api/v3/coins/${coin.id}/market_chart?vs_currency=usd&days=7`
        );

        const data = await response.json();
        const prices = data.prices;

        chartContainer.innerHTML = '<canvas id="price-chart"></canvas>';
        const ctx = document.getElementById('price-chart').getContext('2d');

        const labels = prices.map(p => {
            const d = new Date(p[0]);
            return d.toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' });
        });
        const values = prices.map(p => p[1]);

        const firstPrice = values[0];
        const lastPrice = values[values.length - 1];
        const isUp = lastPrice >= firstPrice;
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
                    pointHoverRadius: 5,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.85)',
                        padding: 12,
                        callbacks: {
                            label: (context) => '$' + context.parsed.y.toLocaleString('en-US', {
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
                        ticks: { 
                            color: 'rgba(255,255,255,0.5)', 
                            font: { size: 10 },
                            callback: (value) => '$' + value.toLocaleString('en-US', { maximumFractionDigits: 0 })
                        }
                    }
                }
            }
        });

    } catch (error) {
        chartContainer.innerHTML = '<p style="text-align:center;padding:50px;opacity:0.6;">❌ خطا در دریافت نمودار</p>';
    }
}

function closeChart() {
    const modal = document.getElementById('chart-modal');
    modal.classList.remove('open');
    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }
}

function setupChartModal() {
    const modal = document.getElementById('chart-modal');
    const closeBtn = document.getElementById('modal-close');

    if (closeBtn) closeBtn.addEventListener('click', closeChart);
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeChart();
        });
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeChart();
    });
}

// ===== گوش دادن به تایپ کاربر =====
function setupSearch() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            applyFilters();
        });
    }
}

// ===== شروع =====
window.addEventListener('DOMContentLoaded', () => {
    setupTheme();
    setupSearch();
    setupChartModal();
    fetchPrices();
    setInterval(fetchPrices, 60000);
});