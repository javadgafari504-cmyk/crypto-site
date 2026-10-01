<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>قیمت ارز دیجیتال</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>

    <header>
        <button id="theme-toggle" title="تغییر تم">🌙</button>
        <h1>💰 قیمت ارز دیجیتال</h1>
        <p id="last-update">در حال دریافت...</p>
    </header>

    <main>
        <div class="search-box">
            <input 
                type="text" 
                id="search-input" 
                placeholder="🔍 جستجو (مثلاً Bitcoin یا BTC)..."
                autocomplete="off"
            >
        </div>

        <div id="crypto-grid">
            <p style="text-align:center; padding:40px;">⏳ در حال دریافت...</p>
        </div>
    </main>

    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>

    <div id="chart-modal" class="modal">
        <div class="modal-content">
            <button class="modal-close" id="modal-close">✖</button>
            <div class="modal-header">
                <img id="modal-logo" src="" alt="" class="modal-logo">
                <div>
                    <h2 id="modal-name">-</h2>
                    <p id="modal-price">-</p>
                </div>
            </div>
            <p id="modal-change">-</p>
            <div class="chart-container">
                <canvas id="price-chart"></canvas>
            </div>
            <p class="chart-label">نمودار قیمت ۷ روز اخیر (دلار)</p>
        </div>
    </div>

    <script src="script.js"></script>
</body>
</html>