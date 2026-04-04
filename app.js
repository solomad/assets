document.addEventListener('DOMContentLoaded', () => {
    const assetList = document.getElementById('assetList');
    const searchInput = document.getElementById('searchInput');
    const radioBtns = document.querySelectorAll('input[name="priceFilter"]');
    const sortSelect = document.getElementById('sortSelect');
    const resultsCount = document.getElementById('resultsCount');
    const fileInput = document.getElementById('fileInput');
    const dbInfo = document.getElementById('dbInfo');

    let allAssets =[];
    let currentFilter = 'All'; // 'All', 'Free', 'Paid'
    let currentSort = 'default';
    let currentSearch = '';

    // Изначальная загрузка из репозитория
    fetch('data.json')
        .then(response => response.json())
        .then(data => processData(data, false))
        .catch(err => {
            dbInfo.innerHTML = '<span style="color: #ff5252;">data.json не найден</span>';
            console.log('Ожидание ручной загрузки файла.');
        });

    // Обработка ручной загрузки файла
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                processData(data, true);
            } catch (err) {
                alert("Ошибка: неверный формат JSON файла.");
            }
        };
        reader.readAsText(file);
    });

    function processData(data, isManual) {
        allAssets = data.map(asset => {
            let parsedPrice = 0;
            let isUnknown = false;
            
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

        dbInfo.innerHTML = `База загружена:<br><strong style="color:var(--text-main); font-size:16px;">${allAssets.length}</strong> шт.`;
        if (isManual) {
            // Сбрасываем фильтры при новой загрузке
            searchInput.value = '';
            currentSearch = '';
            document.querySelector('input[value="All"]').checked = true;
            currentFilter = 'All';
        }
        renderAssets();
    }

    // Слушатели фильтров
    searchInput.addEventListener('input', (e) => {
        currentSearch = e.target.value.toLowerCase();
        renderAssets();
    });

    radioBtns.forEach(radio => {
        radio.addEventListener('change', (e) => {
            currentFilter = e.target.value;
            renderAssets();
        });
    });

    sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        renderAssets();
    });

    function renderAssets() {
        // Фильтрация
        const filtered = allAssets.filter(asset => {
            if (currentSearch && !asset.lowerName.includes(currentSearch) && !asset.lowerPublisher.includes(currentSearch)) {
                return false;
            }
            if (currentFilter === 'Free' && !asset.IsFree && asset.parsedPrice !== 0) return false;
            if (currentFilter === 'Paid' && (asset.IsFree || asset.parsedPrice === 0 || asset.isUnknown)) return false;
            return true;
        });

        // Сортировка
        if (currentSort !== 'default') {
            filtered.sort((a, b) => {
                if (currentSort === 'name-asc') {
                    return a.lowerName.localeCompare(b.lowerName);
                } else if (currentSort === 'name-desc') {
                    return b.lowerName.localeCompare(a.lowerName);
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

        resultsCount.textContent = `${filtered.length} items`;
        assetList.innerHTML = '';

        if (filtered.length === 0) {
            assetList.innerHTML = `<div class="empty-state"><h2>No assets found</h2><p>Try adjusting your search or filters.</p></div>`;
            return;
        }

        // Рендер списка
        let html = '';
        filtered.forEach((asset) => {
            const isFree = asset.IsFree || asset.parsedPrice === 0;
            const badgeClass = isFree ? 'badge free' : 'badge';
            const displayPrice = isFree ? 'Free' : (asset.Price || 'Unknown');
            const imageSrc = asset.ImageURL || 'https://via.placeholder.com/140x90/e0e0e0/555555?text=No+Image';
            const storeUrl = asset.AssetURL || `https://assetstore.unity.com/?q=${encodeURIComponent(asset.Asset)}&orderBy=1`;

            html += `
                <div class="asset-item">
                    <div class="asset-image">
                        <img src="${imageSrc}" alt="${asset.Asset}" loading="lazy" onerror="this.src='https://via.placeholder.com/140x90/222429/959595?text=No+Image'" />
                    </div>
                    <div class="asset-info">
                        <div class="asset-pub">${asset.Publisher}</div>
                        <h3 class="asset-title">${asset.Asset}</h3>
                        <div class="asset-badges">
                            <span class="${badgeClass}">${displayPrice}</span>
                        </div>
                    </div>
                    <div class="asset-action">
                        <a href="${storeUrl}" target="_blank" class="btn-open">Open in Store</a>
                    </div>
                </div>
            `;
        });
        
        assetList.innerHTML = html;
    }
});