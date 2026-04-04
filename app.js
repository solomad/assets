document.addEventListener('DOMContentLoaded', () => {
    const assetGrid = document.getElementById('assetGrid');
    const searchInput = document.getElementById('searchInput');
    const sortSelect = document.getElementById('sortSelect');
    const resultsInfo = document.getElementById('resultsInfo');
    const fileInput = document.getElementById('fileInput');
    
    // Контейнеры фильтров
    const labelsList = document.getElementById('labelsList');
    const categoriesList = document.getElementById('categoriesList');
    const publishersList = document.getElementById('publishersList');
    const publisherSearch = document.getElementById('publisherSearch');

    let allAssets =[];
    
    // Состояния фильтров
    let currentSearch = '';
    let currentSort = 'default';
    let selectedLabels = new Set();
    let selectedCategories = new Set();
    let selectedPublishers = new Set();

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { rootMargin: '50px 0px', threshold: 0.1 });

    // Инициализация
    fetch('data.json')
        .then(response => response.json())
        .then(data => processData(data))
        .catch(err => {
            resultsInfo.textContent = 'Нет данных. Загрузите файл JSON с помощью кнопки вверху.';
        });

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
        let uniqueLabels = new Set();
        let uniqueCategories = new Set();
        let uniquePublishers = new Set();

        allAssets = data.map(asset => {
            // Обработка цены для сортировки
            let parsedPrice = 0;
            let priceStr = String(asset.Price || '').toLowerCase();
            
            if (priceStr === 'free' || priceStr === 'бесплатно' || priceStr === '') {
                parsedPrice = 0;
            } else {
                const match = priceStr.match(/[\d.]+/);
                parsedPrice = match ? parseFloat(match[0]) : 0;
            }

            // Сбор уникальных фильтров
            if(asset.Label) uniqueLabels.add(asset.Label);
            if(asset.Category) uniqueCategories.add(asset.Category);
            if(asset.Publisher) uniquePublishers.add(asset.Publisher);

            return {
                ...asset,
                parsedPrice,
                lowerName: (asset.Asset || '').toLowerCase(),
                lowerPublisher: (asset.Publisher || '').toLowerCase()
            };
        });

        buildFilters(uniqueLabels, uniqueCategories, uniquePublishers);
        renderAssets();
    }

    // Создание списков чекбоксов
    function buildFilters(labels, categories, publishers) {
        labelsList.innerHTML = '';
        categoriesList.innerHTML = '';
        publishersList.innerHTML = '';
        selectedLabels.clear();
        selectedCategories.clear();
        selectedPublishers.clear();

        Array.from(labels).sort().forEach(label => {
            labelsList.appendChild(createCheckbox(label, selectedLabels, renderAssets));
        });

        Array.from(categories).sort().forEach(cat => {
            categoriesList.appendChild(createCheckbox(cat, selectedCategories, renderAssets));
        });

        Array.from(publishers).sort((a,b) => a.toLowerCase().localeCompare(b.toLowerCase())).forEach(pub => {
            let el = createCheckbox(pub, selectedPublishers, renderAssets);
            el.classList.add('pub-item');
            el.dataset.name = pub.toLowerCase();
            publishersList.appendChild(el);
        });
    }

    function createCheckbox(value, targetSet, callback) {
        const label = document.createElement('label');
        label.className = 'filter-checkbox';
        
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = value;
        input.addEventListener('change', (e) => {
            if (e.target.checked) targetSet.add(value);
            else targetSet.delete(value);
            callback();
        });

        const span = document.createElement('span');
        span.textContent = value;

        label.appendChild(input);
        label.appendChild(span);
        return label;
    }

    // Локальный поиск по авторам в сайдбаре
    publisherSearch.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll('.pub-item').forEach(item => {
            if (item.dataset.name.includes(term)) item.classList.remove('hidden');
            else item.classList.add('hidden');
        });
    });

    searchInput.addEventListener('input', (e) => {
        currentSearch = e.target.value.toLowerCase();
        renderAssets();
    });

    sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        renderAssets();
    });

    function renderAssets() {
        const filtered = allAssets.filter(asset => {
            // Поиск по имени
            if (currentSearch && !asset.lowerName.includes(currentSearch)) return false;
            
            // Фильтры (если множество пустое - значит ничего не выбрано, показываем всё)
            if (selectedLabels.size > 0 && !selectedLabels.has(asset.Label)) return false;
            if (selectedCategories.size > 0 && !selectedCategories.has(asset.Category)) return false;
            if (selectedPublishers.size > 0 && !selectedPublishers.has(asset.Publisher)) return false;
            
            return true;
        });

        // Сортировка
        if (currentSort !== 'default') {
            filtered.sort((a, b) => {
                if (currentSort === 'name-asc') return a.lowerName.localeCompare(b.lowerName);
                if (currentSort === 'price-asc') return a.parsedPrice - b.parsedPrice;
                if (currentSort === 'price-desc') return b.parsedPrice - a.parsedPrice;
                return 0;
            });
        }

        resultsInfo.textContent = `Найдено ассетов: ${filtered.length}`;
        assetGrid.innerHTML = '';

        let html = '';
        filtered.forEach((asset) => {
            // Цена и бейджики
            const isFree = String(asset.Price).toLowerCase() === 'free' || String(asset.Price).toLowerCase() === 'бесплатно';
            const priceClass = isFree ? 'asset-price free' : 'asset-price';
            const displayPrice = isFree ? 'Free' : asset.Price;
            
            // Если цены нет вообще - блок скрывается
            const priceHtml = displayPrice ? `<span class="${priceClass}">${displayPrice}</span>` : '';

            const imageSrc = asset.ImageURL || 'https://via.placeholder.com/400x200/eaeaea/888888?text=No+Image';

            html += `
                <div class="asset-card">
                    <div class="asset-image">
                        <img src="${imageSrc}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x200/eaeaea/888888?text=No+Image'" />
                    </div>
                    <div class="asset-content">
                        <h3 class="asset-title" title="${asset.Asset}">${asset.Asset}</h3>
                        <div class="asset-publisher">${asset.Publisher}</div>
                        <div class="asset-tags">
                            ${asset.Label ? `<span class="asset-tag">${asset.Label}</span>` : ''}
                            ${asset.Category ? `<span class="asset-tag">${asset.Category}</span>` : ''}
                        </div>
                        <div class="asset-footer">
                            ${priceHtml}
                            <a href="${asset.AssetURL}" target="_blank" class="store-btn">В магазин</a>
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