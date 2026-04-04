document.addEventListener('DOMContentLoaded', () => {
    const assetGrid = document.getElementById('assetGrid');
    const searchInput = document.getElementById('searchInput');
    const sortSelect = document.getElementById('sortSelect');
    const filterRadios = document.querySelectorAll('input[name="priceFilter"]');
    const resultsInfo = document.getElementById('resultsInfo');
    const fileInput = document.getElementById('fileInput');

    let allAssets =[];
    let currentFilter = 'All'; 
    let currentSort = 'default';
    let currentSearch = '';

    // Изначальная загрузка из репозитория
    fetch('data.json')
        .then(response => response.json())
        .then(data => processData(data))
        .catch(err => {
            resultsInfo.textContent = 'Нет данных. Загрузите файл JSON.';
        });

    // Ручная загрузка файла
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                processData(JSON.parse(event.target.result));
            } catch (err) {
                alert("Ошибка чтения JSON файла.");
            }
        };
        reader.readAsText(file);
    });

    function processData(data) {
        allAssets = data.map(asset => {
            let parsedPrice = 0;
            let isUnknown = false;
            let priceStr = String(asset.Price).toLowerCase();
            
            if (asset.IsFree || priceStr === 'free' || priceStr === 'бесплатно' || priceStr === 'owned') {
                parsedPrice = 0;
            } else if (!asset.Price || priceStr === 'unknown') {
                parsedPrice = -1;
                isUnknown = true;
            } else {
                const match = priceStr.match(/[\d.]+/);
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

    searchInput.addEventListener('input', (e) => {
        currentSearch = e.target.value.toLowerCase();
        renderAssets();
    });

    filterRadios.forEach(radio => {
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
        const filtered = allAssets.filter(asset => {
            if (currentSearch && !asset.lowerName.includes(currentSearch) && !asset.lowerPublisher.includes(currentSearch)) {
                return false;
            }
            if (currentFilter === 'Free' && !asset.IsFree && asset.Price !== 'Owned') return false;
            if (currentFilter === 'Paid' && (asset.IsFree || asset.Price === 'Owned' || asset.isUnknown)) return false;
            return true;
        });

        if (currentSort !== 'default') {
            filtered.sort((a, b) => {
                if (currentSort === 'name-asc') return a.lowerName.localeCompare(b.lowerName);
                const priceA = a.parsedPrice;
                const priceB = b.parsedPrice;
                if (priceA === -1 && priceB !== -1) return 1;
                if (priceB === -1 && priceA !== -1) return -1;
                if (priceA === -1 && priceB === -1) return 0;
                return currentSort === 'price-asc' ? priceA - priceB : priceB - priceA;
            });
        }

        resultsInfo.textContent = `Найдено ассетов: ${filtered.length}`;
        assetGrid.innerHTML = '';

        let html = '';
        filtered.forEach((asset) => {
            const isFreeOrOwned = asset.IsFree || asset.Price === 'Owned' || String(asset.Price).toLowerCase() === 'free';
            const priceClass = isFreeOrOwned ? 'asset-price free' : 'asset-price';
            const displayPrice = asset.Price || 'Free';
            const imageSrc = asset.ImageURL || 'https://via.placeholder.com/400x200/eaeaea/888888?text=No+Image';

            html += `
                <div class="asset-card">
                    <div class="asset-image">
                        <img src="${imageSrc}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x200/eaeaea/888888?text=No+Image'" />
                    </div>
                    <div class="asset-content">
                        <h3 class="asset-title" title="${asset.Asset}">${asset.Asset}</h3>
                        <div class="asset-publisher">${asset.Publisher}</div>
                        <div class="asset-footer">
                            <span class="${priceClass}">${displayPrice}</span>
                            <a href="${asset.AssetURL}" target="_blank" class="store-btn">В магазин</a>
                        </div>
                    </div>
                </div>
            `;
        });
        assetGrid.innerHTML = html;
    }
});