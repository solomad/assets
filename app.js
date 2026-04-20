document.addEventListener('DOMContentLoaded', () => {
    const toggleRatings = document.getElementById('toggleRatings');
    const toggleTags = document.getElementById('toggleTags');

    toggleRatings?.addEventListener('change', (e) => document.body.classList.toggle('hide-ratings', !e.target.checked));
    toggleTags?.addEventListener('change', (e) => document.body.classList.toggle('hide-tags', !e.target.checked));
    
    const assetGrid = document.getElementById('assetGrid');
    const searchInput = document.getElementById('searchInput');
    const sortSelect = document.getElementById('sortSelect');
    const resultsInfo = document.getElementById('resultsInfo');
    const fileInput = document.getElementById('fileInput');
    
    const gridToggleBtn = document.getElementById('gridToggleBtn');
    const gridColsSelect = document.getElementById('gridColsSelect');
    
    const statusList = document.getElementById('statusList');
    const labelsList = document.getElementById('labelsList');
    const categoriesList = document.getElementById('categoriesList');
    const publishersList = document.getElementById('publishersList');
    const publisherSearch = document.getElementById('publisherSearch');

    let allAssets =[];
    let publisherCounts = {};
    
    let currentSearch = '';
    let currentSort = 'default';
    let selectedStatuses = new Set();
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

    gridToggleBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        gridColsSelect.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
        if (gridColsSelect && !gridColsSelect.contains(e.target) && e.target !== gridToggleBtn) {
            gridColsSelect.classList.remove('show');
        }
    });

    gridColsSelect?.addEventListener('click', (e) => {
        if (e.target.tagName === 'SPAN') {
            const cols = e.target.dataset.cols;
            gridColsSelect.querySelectorAll('span').forEach(s => s.classList.remove('active'));
            e.target.classList.add('active');
            
            if (assetGrid) {
                assetGrid.setAttribute('data-cols', cols);
            }
            gridColsSelect.classList.remove('show');
        }
    });

    function initGridCols() {
        const activeSpan = gridColsSelect?.querySelector('span.active');
        if (activeSpan && assetGrid) {
            assetGrid.setAttribute('data-cols', activeSpan.dataset.cols);
        }
    }
    initGridCols();

    fetch('data.json')
        .then(response => response.json())
        .then(data => processData(data))
        .catch(() => {
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
            processData(allFileData.flat());
        } catch (err) {
            alert("Error: One or more files have invalid JSON format.");
            console.error(err);
        }
    });

    function processData(data) {
        if (!Array.isArray(data)) return;

        allAssets = data.map(asset => {
            let parsedPrice = 0;
            let priceStr = String(asset.Price || '').toLowerCase().trim();
            
            if (['free', 'бесплатно', '', 'owned', 'deprecated', 'null'].includes(priceStr)) {
                parsedPrice = 0;
            } else {
                const match = priceStr.match(/[\d.]+/);
                parsedPrice = match ? parseFloat(match[0]) : 0;
            }

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
                Category: categoryPath,
                Status: asset.Status || 'Active' // Прямое чтение из базы
            };
        });

        const cumulativeCounts = {};
        allAssets.forEach(asset => {
            const parts = asset.Category.split(' > ');
            let currentPath = '';
            parts.forEach(part => {
                currentPath = currentPath ? currentPath + ' > ' + part : part;
                cumulativeCounts[currentPath] = (cumulativeCounts[currentPath] || 0) + 1;
            });
			publisherCounts[asset.Publisher] = (publisherCounts[asset.Publisher] || 0) + 1;
        });

        const statuses =[...new Set(allAssets.map(a => a.Status))].filter(Boolean).sort();
        const labels =[...new Set(allAssets.map(a => a.Label))].filter(Boolean).sort();
        const categories = Object.keys(cumulativeCounts).sort();
        const publishers =[...new Set(allAssets.map(a => a.Publisher))].filter(Boolean).sort((a,b) => a.toLowerCase().localeCompare(b.toLowerCase()));

        buildFilterUI(statuses, labels, categories, publishers, cumulativeCounts);
        renderAssets();
    }

    function buildFilterUI(statuses, labels, categories, publishers, cumulativeCounts) {
        if(statusList) statusList.innerHTML = '';
        labelsList.innerHTML = '';
        categoriesList.innerHTML = '';
        publishersList.innerHTML = '';
        
        selectedStatuses.clear();
        selectedLabels.clear();
        selectedCategories.clear();
        selectedPublishers.clear();

        if(statusList) {
            statuses.forEach(val => statusList.appendChild(createCheckbox(val, selectedStatuses)));
        }
        labels.forEach(val => labelsList.appendChild(createCheckbox(val, selectedLabels)));
        
        categories.forEach((val, index) => {
            let parts = val.split(' > ');
            let depth = parts.length - 1;
            let displayName = `${parts[depth]} (${cumulativeCounts[val]})`;
            
            const categoryWrapper = document.createElement('div');
            categoryWrapper.className = 'category-wrapper';
            categoryWrapper.dataset.path = val;
            categoryWrapper.style.display = depth > 0 ? 'none' : 'flex';
            categoryWrapper.style.justifyContent = 'space-between';
            categoryWrapper.style.alignItems = 'center';
            categoryWrapper.style.marginBottom = '4px';
            
            categoryWrapper.appendChild(createCheckbox(val, selectedCategories, displayName));
            
            const hasChildren = index + 1 < categories.length && categories[index + 1].startsWith(val + ' > ');
            
            if (hasChildren) {
                const toggle = document.createElement('span');
                toggle.className = 'category-toggle';
                toggle.style.transform = 'rotate(-90deg)';
                toggle.style.cursor = 'pointer';
                toggle.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
                
                toggle.addEventListener('click', () => {
                    const isExpanded = toggle.classList.toggle('expanded');
                    toggle.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)';
                    
                    const parentPartsCount = val.split(' > ').length;
                    const allWrappers = categoriesList.querySelectorAll('.category-wrapper');
                    
                    allWrappers.forEach(wrap => {
                        const childPath = wrap.dataset.path;
                        if (childPath.startsWith(val + ' > ')) {
                            if (!isExpanded) {
                                wrap.style.display = 'none';
                                const childToggle = wrap.querySelector('.category-toggle');
                                if (childToggle) {
                                    childToggle.classList.remove('expanded');
                                    childToggle.style.transform = 'rotate(-90deg)';
                                }
                            } else if (childPath.split(' > ').length === parentPartsCount + 1) {
                                wrap.style.display = 'flex';
                            }
                        }
                    });
                });
                categoryWrapper.appendChild(toggle);
            }
            
            if (depth > 0) {
                categoryWrapper.style.marginLeft = `${depth * 14}px`;
                categoryWrapper.style.borderLeft = '1px solid var(--border-color)';
                categoryWrapper.style.paddingLeft = '8px';
            }
            categoriesList.appendChild(categoryWrapper);
        });

        publishers.forEach(val => {
            const cb = createCheckbox(val, selectedPublishers);
            cb.classList.add('pub-item');
            cb.dataset.name = val.toLowerCase();
            publishersList.appendChild(cb);
        });
    }

    function createCheckbox(value, targetSet, displayName = value) {
        const label = document.createElement('label');
        label.className = 'filter-checkbox';
        
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = value;
        input.addEventListener('change', (e) => {
            e.target.checked ? targetSet.add(value) : targetSet.delete(value);
            renderAssets();
        });

        const span = document.createElement('span');
        span.textContent = displayName;

        label.appendChild(input);
        label.appendChild(span);
        return label;
    }

    searchInput.addEventListener('input', (e) => {
        currentSearch = e.target.value.toLowerCase();
        renderAssets();
    });

    publisherSearch.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        publishersList.querySelectorAll('.pub-item').forEach(item => {
            item.style.display = item.dataset.name.includes(term) ? 'flex' : 'none';
        });
    });

    sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        renderAssets();
    });

    const getRefLink = (url) => url ? (url.includes('?') ? `${url}&aid=1100lebp8` : `${url}?aid=1100lebp8`) : '#';

    function getStarsHtml(rating, count) {
        if (!count || !rating) {
            return `<div class="rating-stars unrated" title="No ratings yet">${`<svg class="star empty" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`.repeat(5)} <span class="rating-count">(0)</span></div>`;
        }
        
        let stars = '';
        for (let i = 1; i <= 5; i++) {
            const starClass = rating >= i ? 'filled' : (rating >= i - 0.5 ? 'half' : 'empty');
            stars += `<svg class="star ${starClass}" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`;
        }
        return `<div class="rating-stars" title="Rating: ${rating} (${count} reviews)">${stars} <span class="rating-count">(${count})</span></div>`;
    }

    const iconPlus = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
    const iconMinus = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;

    function renderAssets() {
        const filtered = allAssets.filter(asset => {
            if (currentSearch && !asset.lowerName.includes(currentSearch)) return false;
            if (selectedStatuses.size > 0 && !selectedStatuses.has(asset.Status)) return false;
            if (selectedLabels.size > 0 && !selectedLabels.has(asset.Label)) return false;
            if (selectedPublishers.size > 0 && !selectedPublishers.has(asset.Publisher)) return false;
            
            if (selectedCategories.size > 0) {
                const isMatch = Array.from(selectedCategories).some(cat => asset.Category === cat || asset.Category.startsWith(`${cat} > `));
                if (!isMatch) return false;
            }
            return true;
        });

        filtered.sort((a, b) => {
            if (currentSort === 'name-asc') return a.lowerName.localeCompare(b.lowerName);
            if (currentSort === 'price-asc') return a.parsedPrice - b.parsedPrice;
            if (currentSort === 'price-desc') return b.parsedPrice - a.parsedPrice;
            
            if (currentSort === 'rating-desc') return b.parsedRating !== a.parsedRating ? b.parsedRating - a.parsedRating : b.parsedCount - a.parsedCount;
            if (currentSort === 'rating-asc') {
                if (a.parsedRating === 0 && b.parsedRating !== 0) return 1; 
                if (b.parsedRating === 0 && a.parsedRating !== 0) return -1;
                return a.parsedRating !== b.parsedRating ? a.parsedRating - b.parsedRating : a.parsedCount - b.parsedCount; 
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
            const card = document.createElement('div');
            card.className = 'asset-card';
            
            let priceClass = 'asset-price';
            if (asset.Status === 'Deprecated') {
                priceClass = 'asset-price deprecated';
            } else if (asset.parsedPrice === 0) {
                priceClass = 'asset-price free';
            }
            
            const displayPrice = asset.Status === 'Deprecated' ? 'Deprecated' : asset.Price;
            
            const isActive = selectedPublishers.has(asset.Publisher) && selectedPublishers.size === 1;
            const pubTag = asset.PublisherURL 
                ? `<a href="${getRefLink(asset.PublisherURL)}" target="_blank" class="pub-name-link" title="Open publisher page on Unity">${asset.Publisher}</a>`
                : `<span class="pub-tag">${asset.Publisher}</span>`;
            
            const hasMultipleAssets = publisherCounts[asset.Publisher] > 1;
            
            const pubButtonHtml = hasMultipleAssets ? `
                <button class="filter-pub-btn ${isActive ? 'active' : ''}" data-publisher="${asset.Publisher}" title="${isActive ? 'Сбросить фильтр' : 'Только этот автор'}">
                    ${isActive ? iconMinus : iconPlus}
                </button>
            ` : '';

            card.innerHTML = `
                <div class="asset-image">
                    <img src="${asset.ImageURL || 'https://via.placeholder.com/600x400?text=No+Image'}" loading="lazy" onerror="this.src='https://via.placeholder.com/600x400?text=No+Image'">
                </div>
                <div class="asset-content">
                    <h3 class="asset-title" title="${asset.Asset}">
                        <a href="${getRefLink(asset.AssetURL)}" target="_blank">${asset.Asset}</a>
                    </h3>
                    <div class="asset-publisher">
                        ${pubTag}
                        ${pubButtonHtml} </div>
                    ${getStarsHtml(asset.parsedRating, asset.parsedCount)}
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
    window.addEventListener('scroll', () => backToTopBtn.classList.toggle('show', window.scrollY > 300));
    backToTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    
    assetGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-pub-btn');
        if (btn) {
            const pub = btn.dataset.publisher;
            const isCurrentFilter = selectedPublishers.has(pub) && selectedPublishers.size === 1;

            if (isCurrentFilter) {
                selectedPublishers.clear();
            } else {
                selectedPublishers.clear();
                selectedPublishers.add(pub);
            }
            
            document.querySelectorAll('#publishersList input[type="checkbox"]').forEach(cb => {
                cb.checked = selectedPublishers.has(cb.value);
            });
            
            window.scrollTo({ top: 0, behavior: 'smooth' });
            renderAssets();
        }
    });
});