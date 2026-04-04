document.addEventListener('DOMContentLoaded', () => {
    const assetGrid = document.getElementById('assetGrid');
    const searchInput = document.getElementById('searchInput');
    const sortSelect = document.getElementById('sortSelect');
    const resultsInfo = document.getElementById('resultsInfo');
    const fileInput = document.getElementById('fileInput');
    
    const labelsList = document.getElementById('labelsList');
    const categoriesList = document.getElementById('categoriesList');
    const publishersList = document.getElementById('publishersList');
    const publisherSearch = document.getElementById('publisherSearch');

    let allAssets =[];
    
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

    // 1. DATA LOADING
    fetch('data.json')
        .then(response => response.json())
        .then(data => processData(data))
        .catch(err => {
            resultsInfo.textContent = 'Database not found. Please upload a JSON file.';
        });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                processData(JSON.parse(event.target.result));
            } catch (err) {
                alert("Error: Invalid JSON format.");
            }
        };
        reader.readAsText(file);
    });

    // 2. DATA PROCESSING
    function processData(data) {
        if (!Array.isArray(data)) return;

        allAssets = data.map(asset => {
            let parsedPrice = 0;
            let priceStr = String(asset.Price || '').toLowerCase();
            if (priceStr === 'free' || priceStr === 'бесплатно' || priceStr === '' || priceStr === 'owned') {
                parsedPrice = 0;
            } else {
                const match = priceStr.match(/[\d.]+/);
                parsedPrice = match ? parseFloat(match[0]) : 0;
            }

            return {
                ...asset,
                parsedPrice,
                parsedRating: parseFloat(asset.Rating) || 0,
                parsedCount: parseInt(asset.RatingCount) || 0,
                lowerName: (asset.Asset || '').toLowerCase(),
                lowerPublisher: (asset.Publisher || '').toLowerCase(),
                Label: asset.Label || 'No Label',
                Category: asset.Category || 'Other'
            };
        });

        // Unique filter values
        const labels = [...new Set(allAssets.map(a => a.Label))].filter(Boolean).sort();
        const categories = [...new Set(allAssets.map(a => a.Category))].filter(Boolean).sort();
        const publishers =[...new Set(allAssets.map(a => a.Publisher))].filter(Boolean).sort((a,b) => a.toLowerCase().localeCompare(b.toLowerCase()));

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
        categories.forEach(val => categoriesList.appendChild(createCheckbox(val, selectedCategories)));
        publishers.forEach(val => {
            const cb = createCheckbox(val, selectedPublishers);
            cb.classList.add('pub-item');
            cb.dataset.name = val.toLowerCase();
            publishersList.appendChild(cb);
        });
    }

    function createCheckbox(text, targetSet) {
        const label = document.createElement('label');
        label.className = 'filter-checkbox';
        
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = text;
        input.addEventListener('change', (e) => {
            if (e.target.checked) targetSet.add(text);
            else targetSet.delete(text);
            renderAssets();
        });

        const span = document.createElement('span');
        span.textContent = text;

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

    // Helper for affiliate links
    const getRefLink = (url) => {
        if (!url) return '#';
        return url.includes('?') ? url + '&aid=1100lebp8' : url + '?aid=1100lebp8';
    };

    // 5. MAIN RENDER FUNCTION
    function renderAssets() {
        const filtered = allAssets.filter(asset => {
            if (currentSearch && !asset.lowerName.includes(currentSearch)) return false;
            if (selectedLabels.size > 0 && !selectedLabels.has(asset.Label)) return false;
            if (selectedCategories.size > 0 && !selectedCategories.has(asset.Category)) return false;
            if (selectedPublishers.size > 0 && !selectedPublishers.has(asset.Publisher)) return false;
            return true;
        });

        filtered.sort((a, b) => {
            if (currentSort === 'name-asc') return a.lowerName.localeCompare(b.lowerName);
            if (currentSort === 'price-asc') return a.parsedPrice - b.parsedPrice;
            if (currentSort === 'price-desc') return b.parsedPrice - a.parsedPrice;
            if (currentSort === 'rating-desc') return b.parsedRating - a.parsedRating;
            if (currentSort === 'rating-asc') return a.parsedRating - b.parsedRating;
            return 0; // default
        });

        resultsInfo.textContent = `Assets found: ${filtered.length}`;
        assetGrid.innerHTML = '';

        if (filtered.length === 0) {
            assetGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:#666">No assets found</div>';
            return;
        }

        filtered.forEach(asset => {
            const isFree = asset.Price === 'Free' || asset.Price === 'Owned' || !asset.Price;
            const priceClass = isFree ? 'asset-price free' : 'asset-price';
            const displayPrice = asset.Price || '';
            const imageSrc = asset.ImageURL || 'https://via.placeholder.com/600x400?text=No+Image';

            const pubContent = asset.PublisherURL 
                ? `<a href="${getRefLink(asset.PublisherURL)}" target="_blank">${asset.Publisher}</a>`
                : asset.Publisher;

            let ratingHtml = '';
            if (asset.parsedCount > 0) {
                ratingHtml = `
                <div class="asset-rating" title="Rating: ${asset.parsedRating} (${asset.parsedCount} reviews)">
                    <svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                    ${asset.parsedRating} (${asset.parsedCount})
                </div>`;
            }

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
                    <div class="asset-meta">
                        <div class="asset-publisher">${pubContent}</div>
                        ${ratingHtml}
                    </div>
                    <div class="asset-tags">
                        <span class="asset-tag">${asset.Label}</span>
                        <span class="asset-tag">${asset.Category}</span>
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