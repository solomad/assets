document.addEventListener('DOMContentLoaded', () => {
    const assetGrid = document.getElementById('assetGrid');
    const searchInput = document.getElementById('searchInput');
    const sortSelect = document.getElementById('sortSelect');
    const resultsInfo = document.getElementById('resultsInfo');
    const fileInput = document.getElementById('fileInput');
    const gridColsSelect = document.getElementById('gridColsSelect');
    
    const labelsList = document.getElementById('labelsList');
    const categoriesList = document.getElementById('categoriesList');
    const publishersList = document.getElementById('publishersList');
    const publisherSearch = document.getElementById('publisherSearch');

    let allAssets = [];
    
    // Filter States
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

    function updateGridCols() {
        if(assetGrid && gridColsSelect) {
            assetGrid.setAttribute('data-cols', gridColsSelect.value);
        }
    }
    gridColsSelect.addEventListener('change', updateGridCols);
    updateGridCols(); 

    // 1. DATA LOADING
    fetch('data.json')
        .then(response => response.json())
        .then(data => processData(data))
        .catch(err => {
            resultsInfo.textContent = 'Database not found. Please upload a JSON file.';
        });

    fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        try {
            const allFileData = await Promise.all(files.map(file => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (ev) => resolve(JSON.parse(ev.target.result));
                    reader.onerror = reject;
                    reader.readAsText(file);
                });
            }));

            const combinedData = allFileData.flat();
            processData(combinedData);
        } catch (err) {
            alert("Error: One or more files have invalid JSON format.");
            console.error(err);
        }
    });

    // 2. DATA PROCESSING
    function processData(data) {
        if (!Array.isArray(data)) return;

        allAssets = data.map(asset => {
            let parsedPrice = 0;
            let priceStr = String(asset.Price || '').toLowerCase().trim();
            
            // Обработка Deprecated или пустой цены приравнивается к 0 для сортировки
            if (priceStr === 'free' || priceStr === 'бесплатно' || priceStr === '' || priceStr === 'owned' || priceStr === 'deprecated' || priceStr === 'null') {
                parsedPrice = 0;
            } else {
                const match = priceStr.match(/[\d.]+/);
                parsedPrice = match ? parseFloat(match[0]) : 0;
            }

            // Нормализация путей категорий (меняем слэши на >, убираем лишние пробелы)
            let rawCategory = asset.Category || 'Other';
            let categoryPath = rawCategory.split(/(?:\s*>\s*|\s*\/\s*)/).join(' > ');

            return {
                ...asset,
                parsedPrice,
                parsedRating: parseFloat(asset.Rating) || 0,
                parsedCount: parseInt(asset.RatingCount) || 0,
                lowerName: (asset.Asset || '').toLowerCase(),
                lowerPublisher: (asset.Publisher || '').toLowerCase(),
                Label: asset.Label || 'No Label',
                Category: categoryPath
            };
        });

        const labels = [...new Set(allAssets.map(a => a.Label))].filter(Boolean).sort();
        
        // Генерация дерева категорий (включаем все родительские узлы)
        let categorySet = new Set();
        allAssets.forEach(a => {
            let parts = a.Category.split(' > ');
            let currentPath = '';
            parts.forEach(part => {
                currentPath = currentPath ? currentPath + ' > ' + part : part;
                categorySet.add(currentPath);
            });
        });
        const categories = Array.from(categorySet).sort();
        
        const publishers = [...new Set(allAssets.map(a => a.Publisher))].filter(Boolean).sort((a,b) => a.toLowerCase().localeCompare(b.toLowerCase()));

        buildFilterUI(labels, categories, publishers);
        renderAssets();
    }

    // 3. UI BUILDER FOR FILTERS
    function buildFilterUI(labels, categories, publishers) {
        labelsList.innerHTML = '';
        categoriesList.innerHTML = '';
        publishersList.innerHTML = '';
        
        selectedLabels.clear();
        selectedCategories.clear();
        selectedPublishers.clear();

        labels.forEach(val => labelsList.appendChild(createCheckbox(val, selectedLabels)));
        
        // Построение иерархического списка категорий
        categories.forEach(val => {
            let parts = val.split(' > ');
            let depth = parts.length - 1;
            let displayName = parts[depth]; // Показываем только финальную часть имени
            
            const cb = createCheckbox(val, selectedCategories, displayName);
            
            // Визуальный отступ для подкатегорий
            if (depth > 0) {
                cb.style.marginLeft = `${depth * 14}px`;
                cb.style.borderLeft = '2px solid var(--border-color)';
                cb.style.paddingLeft = '8px';
            }
            categoriesList.appendChild(cb);
        });

        publishers.forEach(val => {
            const cb = createCheckbox(val, selectedPublishers);
            cb.classList.add('pub-item');
            cb.dataset.name = val.toLowerCase();
            publishersList.appendChild(cb);
        });
    }

    // Добавлен аргумент displayName для разделения значения (Value) и отображаемого имени
    function createCheckbox(value, targetSet, displayName = value) {
        const label = document.createElement('label');
        label.className = 'filter-checkbox';
        
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = value;
        input.addEventListener('change', (e) => {
            if (e.target.checked) targetSet.add(value);
            else targetSet.delete(value);
            renderAssets();
        });

        const span = document.createElement('span');
        span.textContent = displayName;

        label.appendChild(input);
        label.appendChild(span);
        return label;
    }

    // 4. SEARCH & SORTING
    searchInput.addEventListener('input', (e) => {
        currentSearch = e.target.value.toLowerCase();
        renderAssets();
    });

    publisherSearch.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const items = publishersList.querySelectorAll('.pub-item');
        items.forEach(item => {
            const isMatch = item.dataset.name.includes(term);
            item.style.display = isMatch ? 'flex' : 'none';
        });
    });

    sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        renderAssets();
    });

    const getRefLink = (url) => {
        if (!url) return '#';
        return url.includes('?') ? url + '&aid=1100lebp8' : url + '?aid=1100lebp8';
    };

    function getStarsHtml(rating, count) {
        // ФИКС ВЫСОТЫ: Если нет рейтинга, возвращаем пустой блок-заглушку того же размера
        if (count === 0 || !rating) {
            return `<div class="rating-stars empty-rating" title="No rating">No reviews yet</div>`;
        }
        
        let stars = '';
        for (let i = 1; i <= 5; i++) {
            if (rating >= i) {
                stars += `<svg class="star filled" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`;
            } else if (rating >= i - 0.5) {
                stars += `<svg class="star half" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`;
            } else {
                stars += `<svg class="star empty" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`;
            }
        }
        return `<div class="rating-stars" title="Rating: ${rating} (${count} reviews)">${stars} <span class="rating-count">(${count})</span></div>`;
    }

    // 5. MAIN RENDER FUNCTION
    function renderAssets() {
        const filtered = allAssets.filter(asset => {
            if (currentSearch && !asset.lowerName.includes(currentSearch)) return false;
            if (selectedLabels.size > 0 && !selectedLabels.has(asset.Label)) return false;
            if (selectedPublishers.size > 0 && !selectedPublishers.has(asset.Publisher)) return false;
            
            // Логика фильтрации по подкатегориям
            if (selectedCategories.size > 0) {
                let match = false;
                for (let selectedCat of selectedCategories) {
                    // Проверяем, совпадает ли категория или является ли она подкатегорией выбранной
                    if (asset.Category === selectedCat || asset.Category.startsWith(selectedCat + ' > ')) {
                        match = true;
                        break;
                    }
                }
                if (!match) return false;
            }
            
            return true;
        });

        filtered.sort((a, b) => {
            if (currentSort === 'name-asc') return a.lowerName.localeCompare(b.lowerName);
            if (currentSort === 'price-asc') return a.parsedPrice - b.parsedPrice;
            if (currentSort === 'price-desc') return b.parsedPrice - a.parsedPrice;
            
            if (currentSort === 'rating-desc') {
                if (b.parsedRating !== a.parsedRating) return b.parsedRating - a.parsedRating;
                return b.parsedCount - a.parsedCount; 
            }
            if (currentSort === 'rating-asc') {
                if (a.parsedRating === 0 && b.parsedRating !== 0) return 1; 
                if (b.parsedRating === 0 && a.parsedRating !== 0) return -1;
                if (a.parsedRating !== b.parsedRating) return a.parsedRating - b.parsedRating;
                return a.parsedCount - b.parsedCount; 
            }
            return 0; 
        });

        resultsInfo.textContent = `Assets found: ${filtered.length}`;
        assetGrid.innerHTML = '';

        if (filtered.length === 0) {
            assetGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:#666">No assets found</div>';
            return;
        }

        filtered.forEach(asset => {
            // Определение статуса (Deprecated / Free / Paid)
            const rawPrice = String(asset.Price || '').trim();
            const isDeprecated = rawPrice === '' || rawPrice.toLowerCase() === 'deprecated' || rawPrice.toLowerCase() === 'null';
            const isFree = rawPrice.toLowerCase() === 'free' || rawPrice.toLowerCase() === 'owned' || rawPrice.toLowerCase() === 'бесплатно';
            
            let priceClass = 'asset-price';
            let displayPrice = asset.Price || '';

            if (isDeprecated) {
                priceClass = 'asset-price deprecated';
                displayPrice = 'Deprecated';
            } else if (isFree) {
                priceClass = 'asset-price free';
            }

            const imageSrc = asset.ImageURL || 'https://via.placeholder.com/600x400?text=No+Image';
            const pubContent = asset.PublisherURL 
                ? `<a href="${getRefLink(asset.PublisherURL)}" target="_blank">${asset.Publisher}</a>`
                : asset.Publisher;

            const ratingHtml = getStarsHtml(asset.parsedRating, asset.parsedCount);

            const card = document.createElement('div');
            card.className = 'asset-card';
            card.innerHTML = `
                <div class="asset-image">
                    <img src="${imageSrc}" loading="lazy" onerror="this.src='https://via.placeholder.com/600x400?text=No+Image'">
                </div>
                <div class="asset-content">
                    <h3 class="asset-title" title="${asset.Asset}">
                        <a href="${getRefLink(asset.AssetURL)}" target="_blank">${asset.Asset}</a>
                    </h3>
                    <div class="asset-publisher">${pubContent}</div>
                    
                    ${ratingHtml}

                    <div class="asset-tags">
                        <span class="asset-tag">${asset.Label}</span>
                        <span class="asset-tag" title="${asset.Category}">${asset.Category.split(' > ').pop()}</span>
                    </div>
                    <div class="asset-footer">
                        <span class="${priceClass}">${displayPrice}</span>
                    </div>
                </div>
            `;
            assetGrid.appendChild(card);
            observer.observe(card);
        });
    }

    const backToTopBtn = document.getElementById('backToTopBtn');
    window.addEventListener('scroll', () => {
        backToTopBtn.classList.toggle('show', window.scrollY > 300);
    });
    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
});