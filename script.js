/* ============================================
   سایت قیمت ارز دیجیتال - اسکریپت اصلی
   نسخه: ۲.۰ | تاریخ: ۲۰۲۶
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
const COINS_PER_REQUEST = 200;

/* ============================================
   ۲. دریافت نرخ دلار به تومان
   ============================================ */

async function fetchTomanRate() {
    try {
        const res = await fetch(
            'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/irr.json'
        );
        
        if (!res.ok) throw new Error('خطا در دریافت نرخ');
        
        const data = await res.json();
        
        // irr.usd = هر یک ریال چند دلار است
        // نرخ دلار به ریال = 1 / irr.usd
        // نرخ دلار به تومان = (1 / irr.usd) / 10
        if (data.irr && data.irr.usd && data.irr.usd > 0) {
            usdToTomanRate = (1 / data.irr.usd) / 10;
            console.log('✅ نرخ تومان:', usdToTomanRate.toLocaleString('fa-IR'));
        }
    } catch (e) {
        console.error('❌ خطا در دریافت نرخ تومان:', e);
    }
}

/* ============================================
   ۳. مدیریت تم شب/روز
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
   ۴. دریافت قیمت‌ها از CoinGecko
   ============================================ */

async function fetchPrices() {
    const grid = document.getElementById('crypto-grid');
    const updateEl = document.getElementById('last-update');
    
    try {
        // اگه نرخ تومان گرفته نشده، اول اون رو بگیر
        if (usdToTomanRate === 0) {
            await fetchTomanRate();
        }
        
        // درخواست به API
        const url = `${API_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${COINS_PER_REQUEST}&page=1&price_change_percentage=24h`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`خطای شبکه: ${response.status}`);
        }
        
        const data = await response.json();
        
        // ذخیره داده‌ها
        allCoins = data;
        
        // اگه کاربر تو صفحه دیگه‌ایه، برگردون به صفحه ۱
        // (فقط اگه قبلاً داده‌ای نبوده)
        if (grid.innerHTML.includes('در حال دریافت')) {
            currentPage = 1;
        }
        
        // رندر
        applyFilters();
        
        // نمایش زمان آخرین به‌روزرسانی
        const now = new Date();
        if (updateEl) {
            updateEl.textContent = `آخرین به‌روزرسانی: ${now.toLocaleTimeString('en-US')}`;
        }
        
        console.log(`✅ ${data.length} ارز دریافت شد`);
        
    } catch (error) {
        console.error('❌ خطا:', error);
        if (grid) {
            grid.innerHTML = `
                <p style="text-align:center; grid-column:1/-1; padding:40px; color:#f6465d;">
                    ❌ خطا در دریافت اطلاعات<br>
                    <span style="font-size:0.85rem; opacity:0.7;">${error.message}</span>
                </p>
            `;
        }
        if (updateEl) {
            updateEl.textContent = 'خطا در دریافت داده';
        }
    }
}

/* ============================================
   ۵. اعمال فیلترها (جستجو + علاقه‌مندی)
   ============================================ */

function applyFilters() {
    const searchInput = document.getElementById('search-input');
    const term = (searchInput ? searchInput.value : '').toLowerCase().trim();
    
    let result = allCoins;
    
    // فیلتر علاقه‌مندی
    if (currentView === 'favorites') {
        result = result.filter(coin => favorites.includes(coin.id));
    }
    
    // فیلتر جستجو
    if (term !== '') {
        result = result.filter(coin => {
            const nameMatch = coin.name.toLowerCase().includes(term);
            const symbolMatch = coin.symbol.toLowerCase().includes(term);
            const idMatch = coin.id.toLowerCase().includes(term);
            return nameMatch || symbolMatch || idMatch;
        });
    }
    
    // رندر با صفحه‌بندی
    renderCoinsWithPagination(result);
    
    // به‌روزرسانی دکمه‌های صفحه‌بندی
    updatePaginationButtons(result.length);
}

/* ============================================
   ۶. رندر کارت‌ها با صفحه‌بندی
   ============================================ */

function renderCoinsWithPagination(coinsList) {
    const grid = document.getElementById('crypto-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    // حالت علاقه‌مندی خالی
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
    
    // حالت هیچ نتیجه‌ای پیدا نشد
    if (coinsList.length === 0) {
        grid.innerHTML = `
            <p class="no-results">
                🔍 هیچ ارزی با این اسم پیدا نشد<br>
                <span style="font-size:0.85rem; opacity:0.7;">یه کلمه دیگه امتحان کن</span>
            </p>
        `;
        return;
    }
    
    // محاسبه بازه صفحه فعلی
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const pageCoins = coinsList.slice(startIndex, endIndex);
    
    // ساخت کارت برای هر ارز
    pageCoins.forEach((coin, index) => {
        const card = createCoinCard(coin);
        // تاخیر انیمیشن برای ورود تدریجی کارت‌ها
        card.style.animationDelay = `${index * 0.02}s`;
        grid.appendChild(card);
    });
    
    // اگه صفحه خالیه (بعد از حذف علاقه‌مندی)
    if (pageCoins.length === 0 && currentPage > 1) {
        currentPage = 1;
        applyFilters();
    }
}

/* ============================================
   ۷. ساخت کارت ارز
   ============================================ */

function createCoinCard(coin) {
    // رتبه واقعی از کل لیست
    const realRank = allCoins.indexOf(coin) + 1;
    const name = coin.name;
    const symbol = coin.symbol.toUpperCase();
    const imageUrl = coin.image;
    const price = coin.current_price;
    const change = coin.price_change_percentage_24h || 0;
    
    // قیمت با کاما
    const priceFormatted = price.toLocaleString('en-US', {
        maximumFractionDigits: price < 1 ? 6 : 2
    });
    
    // کلاس تغییرات
    const changeClass = change >= 0 ? 'positive' : 'negative';
    const changeSign = change >= 0 ? '▲ +' : '▼ ';
    
    // قیمت تومان
    let priceToman = '';
    if (usdToTomanRate > 0) {
        const toman = price * usdToTomanRate;
        if (toman >= 1) {
            priceToman = toman.toLocaleString('fa-IR', { 
                maximumFractionDigits: 0 
            }) + ' تومان';
        }
    }
    
    // علاقه‌مندی
    const isFav = favorites.includes(coin.id);
    const starIcon = isFav ? '⭐' : '☆';
    
    // ساخت کارت
    const card = document.createElement('div');
    card.className = 'crypto-card';
    card.setAttribute('data-coin-id', coin.id);
    card.innerHTML = `
        <button class="favorite-btn ${isFav ? 'active' : ''}" 
                aria-label="${isFav ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}"
                data-id="${coin.id}">
            ${starIcon}
        </button>
        <span class="rank">#${realRank}</span>
        <img src="${imageUrl}" 
             alt="${name}" 
             class="coin-logo" 
             loading="lazy"
             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🪙</text></svg>'">
        <h3 title="${name}">${name}</h3>
        <p class="symbol">${symbol}</p>
        <p class="price">$${priceFormatted}</p>
        ${priceToman ? `<p class="price-toman">${priceToman}</p>` : ''}
        <p class="change ${changeClass}">${changeSign}${Math.abs(change).toFixed(2)}%</p>
    `;
    
    // کلیک روی ستاره علاقه‌مندی
    const favBtn = card.querySelector('.favorite-btn');
    favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(coin.id);
    });
    
    // کلیک روی کارت → باز کردن نمودار
    card.addEventListener('click', (e) => {
        if (e.target.closest('.favorite-btn')) return;
        openChart(coin);
    });
    
    return card;
}

/* ============================================
   ۸. به‌روزرسانی دکمه‌های صفحه‌بندی
   ============================================ */

function updatePaginationButtons(totalItems) {
    const pagination = document.getElementById('pagination');
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');
    
    if (!pagination) return;
    
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    
    // اگه فقط ۱ صفحه هست، مخفی کن
    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }
    
    pagination.style.display = 'flex';
    
    // به‌روزرسانی متن
    pageInfo.textContent = `صفحه ${currentPage.toLocaleString('fa-IR')} از ${totalPages.toLocaleString('fa-IR')}`;
    
    // فعال/غیرفعال کردن دکمه‌ها
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
}

/* ============================================
   ۹. تنظیم دکمه‌های صفحه‌بندی
   ============================================ */

function setupPagination() {
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                applyFilters();
                scrollToTop();
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const searchInput = document.getElementById('search-input');
            const term = (searchInput ? searchInput.value : '').toLowerCase().trim();
            
            let total = allCoins;
            if (currentView === 'favorites') {
                total = total.filter(c => favorites.includes(c.id));
            }
            if (term !== '') {
                total = total.filter(c => 
                    c.name.toLowerCase().includes(term) || 
                    c.symbol.toLowerCase().includes(term)
                );
            }
            
            const totalPages = Math.ceil(total.length / ITEMS_PER_PAGE);
            
            if (currentPage < totalPages) {
                currentPage++;
                applyFilters();
                scrollToTop();
            }
        });
    }
}

/* ============================================
   ۱۰. اسکرول نرم به بالا
   ============================================ */

function scrollToTop() {
    window.scrollTo({ 
        top: 0, 
        behavior: 'smooth' 
    });
}

/* ============================================
   ۱۱. مدیریت علاقه‌مندی‌ها
   ============================================ */

function toggleFavorite(coinId) {
    const index = favorites.indexOf(coinId);
    
    if (index === -1) {
        favorites.push(coinId);
    } else {
        favorites.splice(index, 1);
    }
    
    // ذخیره در حافظه مرورگر
    localStorage.setItem('favorites', JSON.stringify(favorites));
    
    // به‌روزرسانی تعداد
    updateFavCount();
    
    // رندر مجدد
    applyFilters();
}

function updateFavCount() {
    const favCount = document.getElementById('fav-count');
    if (favCount) {
        favCount.textContent = favorites.length.toLocaleString('fa-IR');
    }
}

/* ============================================
   ۱۲. تنظیم دکمه‌های فیلتر
   ============================================ */

function setupFilterButtons() {
    const showAll = document.getElementById('show-all');
    const showFav = document.getElementById('show-favorites');
    
    if (showAll) {
        showAll.addEventListener('click', () => {
            currentView = 'all';
            currentPage = 1;
            showAll.classList.add('active');
            showAll.setAttribute('aria-selected', 'true');
            showFav.classList.remove('active');
            showFav.setAttribute('aria-selected', 'false');
            applyFilters();
        });
    }
    
    if (showFav) {
        showFav.addEventListener('click', () => {
            currentView = 'favorites';
            currentPage = 1;
            showFav.classList.add('active');
            showFav.setAttribute('aria-selected', 'true');
            showAll.classList.remove('active');
            showAll.setAttribute('aria-selected', 'false');
            applyFilters();
        });
    }
}

/* ============================================
   ۱۳. تنظیم کادر جستجو
   ============================================ */

function setupSearch() {
    const searchInput = document.getElementById('search-input');
    
    if (!searchInput) return;
    
    // جستجوی زنده با تاخیر (debounce)
    let timeout = null;
    
    searchInput.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            currentPage = 1;
            applyFilters();
        }, 150);
    });
    
    // پاک کردن با Escape
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchInput.value = '';
            currentPage = 1;
            applyFilters();
        }
    });
}

/* ============================================
   ۱۴. نمودار قیمت
   ============================================ */

let chartInstance = null;

async function openChart(coin) {
    const modal = document.getElementById('chart-modal');
    const modalName = document.getElementById('modal-name');
    const modalPrice = document.getElementById('modal-price');
    const modalChange = document.getElementById('modal-change');
    const modalLogo = document.getElementById('modal-logo');
    const chartContainer = document.querySelector('.chart-container');
    
    if (!modal || !chartContainer) return;
    
    // پر کردن اطلاعات پایه
    modalName.textContent = coin.name;
    modalPrice.textContent = '$' + coin.current_price.toLocaleString('en-US', {
        maximumFractionDigits: coin.current_price < 1 ? 6 : 2
    });
    modalLogo.src = coin.image;
    modalLogo.alt = coin.name;
    
    // درصد تغییرات
    const change = coin.price_change_percentage_24h || 0;
    modalChange.textContent = 
        (change >= 0 ? '▲ +' : '▼ ') + Math.abs(change).toFixed(2) + '% (۲۴ ساعت)';
    modalChange.className = change >= 0 ? 'positive' : 'negative';
    
    // نمایش modal
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    
    // نمایش لودینگ
    chartContainer.innerHTML = `
        <p style="text-align:center; padding:50px; opacity:0.6;">
            ⏳ در حال دریافت نمودار...
        </p>
    `;
    
    try {
        // دریافت داده‌های نمودار ۷ روزه
        const response = await fetch(
            `${API_BASE}/coins/${coin.id}/market_chart?vs_currency=usd&days=7`
        );
        
        if (!response.ok) throw new Error('خطای شبکه');
        
        const data = await response.json();
        const prices = data.prices;
        
        // ساخت canvas جدید
        chartContainer.innerHTML = '<canvas id="price-chart"></canvas>';
        const ctx = document.getElementById('price-chart').getContext('2d');
        
        // آماده‌سازی داده‌ها
        const labels = prices.map(p => {
            const d = new Date(p[0]);
            return d.toLocaleDateString('fa-IR', { 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit'
            });
        });
        const values = prices.map(p => p[1]);
        
        // تشخیص رنگ (سبز اگه صعودی، قرمز اگه نزولی)
        const firstPrice = values[0];
        const lastPrice = values[values.length - 1];
        const isUp = lastPrice >= firstPrice;
        const lineColor = isUp ? '#0ecb81' : '#f6465d';
        const fillColor = isUp ? 'rgba(14, 203, 129, 0.15)' : 'rgba(246, 70, 93, 0.15)';
        
        // حذف نمودار قبلی
        if (chartInstance) {
            chartInstance.destroy();
        }
        
        // ساخت نمودار جدید
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
                    pointHoverBackgroundColor: lineColor,
                    pointHoverBorderColor: '#fff',
                    pointHoverBorderWidth: 2,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: { 
                        display: false 
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        padding: 12,
                        titleFont: { 
                            family: 'Tahoma', 
                            size: 12 
                        },
                        bodyFont: { 
                            family: 'Tahoma', 
                            size: 13,
                            weight: 'bold'
                        },
                        borderColor: lineColor,
                        borderWidth: 1,
                        displayColors: false,
                        callbacks: {
                            label: (context) => {
                                const value = context.parsed.y;
                                return '$' + value.toLocaleString('en-US', {
                                    maximumFractionDigits: value < 1 ? 6 : 2
                                });
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { 
                            color: 'rgba(255, 255, 255, 0.05)',
                            display: false
                        },
                        ticks: { 
                            color: 'rgba(255, 255, 255, 0.5)',
                            font: { 
                                family: 'Tahoma', 
                                size: 10 
                            },
                            maxTicksLimit: 6
                        }
                    },
                    y: {
                        position: 'right',
                        grid: { 
                            color: 'rgba(255, 255, 255, 0.05)' 
                        },
                        ticks: { 
                            color: 'rgba(255, 255, 255, 0.5)',
                            font: { 
                                family: 'Tahoma', 
                                size: 10 
                            },
                            callback: (value) => {
                                if (value >= 1000) {
                                    return '$' + (value / 1000).toFixed(1) + 'K';
                                }
                                return '$' + value.toLocaleString('en-US', {
                                    maximumFractionDigits: value < 1 ? 4 : 0
                                });
                            }
                        }
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('❌ خطای نمودار:', error);
        chartContainer.innerHTML = `
            <p style="text-align:center; padding:50px; opacity:0.6; color:#f6465d;">
                ❌ خطا در دریافت نمودار<br>
                <span style="font-size:0.85rem;">دوباره تلاش کن</span>
            </p>
        `;
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
    const modal = document.getElementById('chart-modal');
    const closeBtn = document.getElementById('modal-close');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeChart);
    }
    
    // بستن با کلیک بیرون
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeChart();
        });
    }
    
    // بستن با کلید Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeChart();
    });
}

/* ============================================
   ۱۵. راه‌اندازی اولیه
   ============================================ */

window.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 سایت قیمت ارز دیجیتال شروع شد');
    
    // تنظیمات اولیه
    setupTheme();
    setupSearch();
    setupFilterButtons();
    setupPagination();
    setupChartModal();
    updateFavCount();
    
    // دریافت داده‌ها
    fetchPrices();
    
    // به‌روزرسانی خودکار هر ۶۰ ثانیه
    setInterval(fetchPrices, 60000);
    
    console.log(`📊 تعداد علاقه‌مندی‌ها: ${favorites.length}`);
});

/* ============================================
   ۱۶. مدیریت خطاهای سراسری
   ============================================ */

window.addEventListener('error', (e) => {
    console.error('❌ خطای سراسری:', e.message);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('❌ خطای Promise:', e.reason);
});

/* ============================================
   ۱۷. ذخیره‌سازی در بستن صفحه
   ============================================ */

window.addEventListener('beforeunload', () => {
    localStorage.setItem('favorites', JSON.stringify(favorites));
});