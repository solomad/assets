document.addEventListener('DOMContentLoaded', () => {
    const assetGrid = document.getElementById('assetGrid');
    const searchInput = document.getElementById('searchInput');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const sortSelect = document.getElementById('sortSelect');
    const resultsInfo = document.getElementById('resultsInfo');
    const fileInput = document.getElementById('fileInput');

    let allAssets = [];

    // Анимация появления
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { rootMargin: '50px 0px', threshold: 0.1 });

    let currentFilter = 'All'; 
    let currentSort = 'default';
    let currentSearch = '';

    // Загрузка по умолчанию
    fetch('data.json')
        .then(response => response.json())
        .then(data => processData(data))
        .catch(err => {
            resultsInfo.innerHTML = 'Загрузите свой JSON файл с помощью кнопки выше.';
            console.log('Нет дефолтного data.json. Ожидание файла пользователя.');
        });

    // Обработка загрузки пользовательского файла
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                processData(data);
                resultsInfo.style.color = "var(--success)";
                resultsInfo.textContent = "Файл успешно загружен!";
                setTimeout(() => renderAssets(), 1500);
            } catch (err) {
                resultsInfo.style.color = "var(--accent-secondary)";
                resultsInfo.textContent = "Ошибка: неверный формат JSON файла.";
            }
        };
        reader.readAsText(file);
    });

    // Парсинг данных
    function processData(data) {
        allAssets = data.map(asset => {
            let parsedPrice = 0;
            let isUnknown = false;
            
            // Обработка цены
            let priceStr = String(asset.Price).toLowerCase();
            if (asset.IsFree || priceStr === 'free' || priceStr === 'бесплатно') {
                parsedPrice = 0;
            } else if (!asset.Price || priceStr === 'unknown') {
                parsedPrice = -1;
                isUnknown = true;
            } else {
                const match = String(asset.Price).match(/[\d.]+/);
                parsedPrice = match ? parseFloat(match[0]) : 0;
            }

            return {
                ...asset,
                parsedPrice,
                isUnknown,
                lowerName: (asset.Asset || '').toLowerCase(),
                lowerPublisher: (asset.Publisher || '').toLowerCase()
            };
        });
        renderAssets();
    }

    // Слушатели событий интерфейса
    searchInput.addEventListener('input', (e) => {
        currentSearch = e.target.value.toLowerCase();
        renderAssets();
    });

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderAssets();
        });
    });

    sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        renderAssets();
    });

    // Отрисовка
    function renderAssets() {
        resultsInfo.style.color = "var(--text-secondary)";
        const filtered = allAssets.filter(asset => {
            if (currentSearch && !asset.lowerName.includes(currentSearch) && !asset.lowerPublisher.includes(currentSearch)) {
                return false;
            }
            if (currentFilter === 'Free' && !asset.IsFree) return false;
            if (currentFilter === 'Paid' && (asset.IsFree || asset.isUnknown)) return false;
            return true;
        });

        if (currentSort !== 'default') {
            filtered.sort((a, b) => {
                if (currentSort === 'name-asc') {
                    return a.lowerName.localeCompare(b.lowerName);
                } else if (currentSort === 'price-asc' || currentSort === 'price-desc') {
                    const priceA = a.parsedPrice;
                    const priceB = b.parsedPrice;
                    if (priceA === -1 && priceB !== -1) return 1;
                    if (priceB === -1 && priceA !== -1) return -1;
                    if (priceA === -1 && priceB === -1) return 0;
                    return currentSort === 'price-asc' ? priceA - priceB : priceB - priceA;
                }
                return 0;
            });
        }

        resultsInfo.textContent = `Найдено ассетов: ${filtered.length}`;
        assetGrid.innerHTML = '';

        if (filtered.length === 0) {
            assetGrid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem; color:var(--text-secondary);"><h3>Ничего не найдено.</h3></div>`;
            return;
        }

        let html = '';
        filtered.forEach((asset) => {
            const isFree = asset.IsFree || String(asset.Price).toLowerCase() === 'free';
            const priceClass = isFree ? 'asset-price free' : 'asset-price';
            const displayPrice = isFree ? 'Бесплатно' : (asset.Price || 'Неизвестно');
            const imageSrc = asset.ImageURL || 'https://via.placeholder.com/400x200/2a2a35/9ea3b5?text=No+Image';
            const storeUrl = asset.AssetURL || '#';

            html += `
                <div class="asset-card">
                    <div class="asset-image">
                        <img src="${imageSrc}" alt="${asset.Asset}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x200/2a2a35/9ea3b5?text=No+Image'" />
                    </div>
                    <div class="asset-content">
                        <h3 class="asset-title">${asset.Asset}</h3>
                        <div class="asset-publisher">
                            <svg class="publisher-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                            ${asset.Publisher}
                        </div>
                        <div class="asset-footer">
                            <span class="${priceClass}">${displayPrice}</span>
                            <a href="${storeUrl}" target="_blank" class="store-btn">Открыть в<br>Asset Store</a>
                        </div>
                    </div>
                </div>
            `;
        });
        assetGrid.innerHTML = html;
        document.querySelectorAll('.asset-card').forEach(card => observer.observe(card));
    }

    const backToTopBtn = document.getElementById('backToTopBtn');
    window.addEventListener('scroll', () => {
        backToTopBtn.classList.toggle('show', window.scrollY > 300);
    });
    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
});