// ===== متغیرهای سراسری =====
let allCoins = [];
let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
let currentView = 'all';
let usdToTomanRate = 0;
let currentPage = 1;
const ITEMS_PER_PAGE = 20;

// ===== دریافت نرخ تومان =====
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
        currentPage = 1;
        applyFilters();

        const now = new Date();
        updateEl.textContent = `آخرین به‌روزرسانی: ${now.toLocaleTimeString('en-US')}`;

    } catch (error) {
        grid.innerHTML = '<p style="text-align:center;">❌ خطا در دریافت</p>';
    }
}

// ===== اعمال فیلترها =====
function applyFilters() {
    const searchInput = document.getElementById('search-input');
    const term = (searchInput ? searchInput.value : '').toLowerCase().trim();

    let result = allCoins;

    if (currentView === 'favorites') {
        result = result.filter(coin => favorites.includes(coin.id));
    }

    if (term !== '') {
        result = result.filter(coin => {
            const nameMatch = coin.name.toLowerCase().includes(term);
            const symbolMatch = coin.symbol.toLowerCase().includes(term);
            return nameMatch || symbolMatch;
        });
    }

    // رندر با صفحه‌بندی
    renderCoinsWithPagination(result);
    updatePaginationButtons(result.length);
}

// ===== رندر با صفحه‌بندی =====
function renderCoinsWithPagination(coinsList) {
    const grid = document.getElementById('crypto-grid');
    grid.innerHTML = '';

    if (currentView === 'favorites' && coinsList.length === 0) {
        grid.innerHTML = `
            <div class="empty-favorites">
                <span class="big-star">⭐</span>
                هنوز هیچ ارزی رو به علاقه‌مندی‌ها اضافه نکردی.<br>
                روی ستاره هر کارت بزن تا اینجا ذخیره بشه.
            </div>
        `;
        return;
    }

    if (coinsList.length === 0) {
        grid.innerHTML = '<p style="text-align:center; grid-column:1/-1; padding:40px;">🔍 هیچ ارزی با این اسم پیدا نشد</p>';
        return;
    }

    // محاسبه بازه صفحه فعلی
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const pageCoins = coinsList.slice(startIndex, endIndex);

    pageCoins.forEach(coin => {
        const realRank = allCoins.indexOf(coin) + 1;
        const name = coin.name;
        const symbol = coin.symbol.toUpperCase();
        const imageUrl = coin.image;
        const price = coin.current_price.toLocaleString('en-US');
        const change = coin.price_change_percentage_24h || 0;
        const cls = change >= 0 ? 'positive' : 'negative';
        const sign = change >= 0 ? '▲ +' : '▼ ';

        let priceToman = '';
        if (usdToTomanRate > 0) {
            const toman = coin.current_price * usdToTomanRate;
            priceToman = toman.toLocaleString('fa-IR', { maximumFractionDigits: 0 }) + ' تومان';
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
            <img src="${imageUrl}" alt="${name}" class="coin-logo">
            <h3>${name}</h3>
            <p class="symbol">${symbol}</p>
            <p class="price">$${price}</p>
            ${priceToman ? `<p class="price-toman">${priceToman}</p>` : ''}
            <p class="change ${cls}">${sign}${change.toFixed(2)}%</p>
        `;

        const favBtn = card.querySelector('.favorite-btn');
        favBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(coin.id);
        });

        card.addEventListener('click', (e) => {
            if (e.target.closest('.favorite-btn')) return;
            openChart(coin);
        });

        grid.appendChild(card);
    });
}

// ===== به‌روزرسانی دکمه‌های صفحه‌بندی =====
function updatePaginationButtons(totalItems) {
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');

    if (totalPages <= 1) {
        document.getElementById('pagination').style.display = 'none';
        return;
    }

    document.getElementById('pagination').style.display = 'flex';

    pageInfo.textContent = `صفحه ${currentPage} از ${totalPages}`;
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
}

// ===== دکمه‌های صفحه‌بندی =====
function setupPagination() {
    document.getElementById('prev-page').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            applyFilters();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    document.getElementById('next-page').addEventListener('click', () => {
        currentPage++;
        applyFilters();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// ===== علاقه‌مندی =====
function toggleFavorite(coinId) {
    const index = favorites.indexOf(coinId);
    if (index === -1) {
        favorites.push(coinId);
    } else {
        favorites.splice(index, 1);
    }
    localStorage.setItem('favorites', JSON.stringify(favorites));
    updateFavCount();
    applyFilters();
}

function updateFavCount() {
    const favCount = document.getElementById('fav-count');
    if (favCount) favCount.textContent = favorites.length;
}

// ===== دکمه‌های فیلتر =====
function setupFilterButtons() {
    const showAll = document.getElementById('show-all');
    const showFav = document.getElementById('show-favorites');

    showAll.addEventListener('click', () => {
        currentView = 'all';
        currentPage = 1;
        showAll.classList.add('active');
        showFav.classList.remove('active');
        applyFilters();
    });

    showFav.addEventListener('click', () => {
        currentView = 'favorites';
        currentPage = 1;
        showFav.classList.add('active');
        showAll.classList.remove('active');
        applyFilters();
    });
}

// ===== جستجو =====
function setupSearch() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            currentPage = 1;
            applyFilters();
        });
    }
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
        chartContainer.innerHTML = '<p style="text-align:center;padding:50px;opacity:0.6;">❌ خطا</p>';
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

// ===== شروع =====
window.addEventListener('DOMContentLoaded', () => {
    setupTheme();
    setupSearch();
    setupFilterButtons();
    setupPagination();
    setupChartModal();
    updateFavCount();
    fetchPrices();
    setInterval(fetchPrices, 60000);
});