// ===== Glasseria Catalog App with Dynamic Categories =====
// Updated with Size & Color Selection before adding to favorites

// WhatsApp Number
const WHATSAPP_NUMBER = '972524048371';

// State
let categories = [];
let subcategories = [];
let products = [];
// favorites now stores objects: { id, selectedSize, selectedColor }
let favorites = JSON.parse(localStorage.getItem('glasseria_favorites')) || [];
// Migration: convert old format (array of IDs) to new format (array of objects)
if (favorites.length > 0 && typeof favorites[0] === 'string') {
    favorites = favorites.map(id => ({ id, selectedSize: null, selectedColor: null }));
    localStorage.setItem('glasseria_favorites', JSON.stringify(favorites));
}

let currentView = 'categories'; // 'categories', 'subcategories', 'products'
let currentCategoryId = null;
let currentSubcategoryId = null;

// Lightbox State
let lightboxImages = [];
let lightboxCurrentIndex = 0;

// Selection Modal State
let pendingFavoriteProduct = null;

// DOM Elements
const mainNav = document.getElementById('main-nav');
const mobileNav = document.getElementById('mobile-nav');
const categoriesSection = document.getElementById('categories');
const categoriesGrid = document.getElementById('categories-grid');
const subcategoriesSection = document.getElementById('subcategories');
const subcategoriesGrid = document.getElementById('subcategories-grid');
const subcategoriesTitle = document.getElementById('subcategories-title');
const productsGrid = document.getElementById('products-grid');
const noProducts = document.getElementById('no-products');
const loadingEl = document.getElementById('loading');
const productsCountEl = document.getElementById('products-count');
const currentCategoryTitle = document.getElementById('current-category');
const favoritesBtn = document.getElementById('favorites-btn');
const favoritesPanel = document.getElementById('favorites-panel');
const favoritesList = document.getElementById('favorites-list');
const favoritesEmpty = document.getElementById('favorites-empty');
const favoritesCountEl = document.getElementById('favorites-count');
const closePanel = document.getElementById('close-panel');
const overlay = document.getElementById('overlay');
const btnClear = document.getElementById('btn-clear');
const btnWhatsapp = document.getElementById('btn-whatsapp');
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const backToCategories = document.getElementById('back-to-categories');
const productModal = document.getElementById('product-modal');
const modalContent = document.getElementById('modal-content');
const modalClose = document.getElementById('modal-close');

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
    loadAllData();
    setupEventListeners();
    setupWelcomePopup();
    createLightbox();
    createSelectionModal();
});

// ===== Create Selection Modal =====
function createSelectionModal() {
    if (document.getElementById('selection-modal')) return;
    
    const modal = document.createElement('div');
    modal.className = 'selection-modal-overlay';
    modal.id = 'selection-modal';
    modal.innerHTML = `
        <div class="selection-modal">
            <button class="selection-modal-close" id="selection-modal-close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
            <div class="selection-modal-header">
                <div class="selection-modal-image" id="selection-modal-image"></div>
                <div class="selection-modal-info">
                    <h3 id="selection-modal-name"></h3>
                    <p id="selection-modal-sku"></p>
                </div>
            </div>
            <div class="selection-modal-body">
                <div class="selection-group" id="selection-sizes-group" style="display: none;">
                    <label>בחר מידה:</label>
                    <div class="selection-options" id="selection-sizes"></div>
                </div>
                <div class="selection-group" id="selection-colors-group" style="display: none;">
                    <label>בחר צבע:</label>
                    <div class="selection-options" id="selection-colors"></div>
                </div>
                <div class="selection-note" id="selection-note" style="display: none;">
                    <span>💡</span> ניתן להוסיף גם בלי לבחור מידה/צבע
                </div>
            </div>
            <div class="selection-modal-footer">
                <button class="btn-add-favorite" id="btn-add-favorite">
                    <svg viewBox="0 0 24 24">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                    הוסף למועדפים
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Event listeners
    document.getElementById('selection-modal-close').addEventListener('click', closeSelectionModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeSelectionModal();
    });
    document.getElementById('btn-add-favorite').addEventListener('click', confirmAddToFavorites);
}

// ===== Open Selection Modal =====
function openSelectionModal(product, sourceButton) {
    pendingFavoriteProduct = { product, sourceButton };
    
    const modal = document.getElementById('selection-modal');
    const modalImage = document.getElementById('selection-modal-image');
    const modalName = document.getElementById('selection-modal-name');
    const modalSku = document.getElementById('selection-modal-sku');
    const sizesGroup = document.getElementById('selection-sizes-group');
    const colorsGroup = document.getElementById('selection-colors-group');
    const sizesContainer = document.getElementById('selection-sizes');
    const colorsContainer = document.getElementById('selection-colors');
    const selectionNote = document.getElementById('selection-note');
    
    // Set product info
    const firstImage = product.images && product.images.length > 0 
        ? product.images[0] 
        : (product.image || 'images/placeholder.svg');
    modalImage.innerHTML = `<img src="${firstImage}" alt="${product.name}" onerror="this.src='images/placeholder.svg'">`;
    modalName.textContent = product.name;
    modalSku.textContent = `מק"ט: ${product.sku || '-'}`;
    
    // Set sizes
    if (product.sizes && product.sizes.length > 0) {
        sizesGroup.style.display = 'block';
        sizesContainer.innerHTML = product.sizes.map(size => `
            <button class="selection-option" data-type="size" data-value="${size}">${size}</button>
        `).join('');
        
        // Add click handlers for sizes
        sizesContainer.querySelectorAll('.selection-option').forEach(btn => {
            btn.addEventListener('click', () => {
                sizesContainer.querySelectorAll('.selection-option').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            });
        });
    } else {
        sizesGroup.style.display = 'none';
    }
    
    // Set colors
    if (product.colors && product.colors.length > 0) {
        colorsGroup.style.display = 'block';
        colorsContainer.innerHTML = product.colors.map(color => `
            <button class="selection-option" data-type="color" data-value="${color}">${color}</button>
        `).join('');
        
        // Add click handlers for colors
        colorsContainer.querySelectorAll('.selection-option').forEach(btn => {
            btn.addEventListener('click', () => {
                colorsContainer.querySelectorAll('.selection-option').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            });
        });
    } else {
        colorsGroup.style.display = 'none';
    }
    
    // Show note if there are options to select
    if ((product.sizes && product.sizes.length > 0) || (product.colors && product.colors.length > 0)) {
        selectionNote.style.display = 'flex';
    } else {
        selectionNote.style.display = 'none';
    }
    
    modal.classList.add('active');
}

// ===== Close Selection Modal =====
function closeSelectionModal() {
    const modal = document.getElementById('selection-modal');
    modal.classList.remove('active');
    pendingFavoriteProduct = null;
    
    // Clear selections
    document.querySelectorAll('#selection-modal .selection-option').forEach(btn => {
        btn.classList.remove('selected');
    });
}

// ===== Confirm Add to Favorites =====
function confirmAddToFavorites() {
    if (!pendingFavoriteProduct) return;
    
    const { product, sourceButton } = pendingFavoriteProduct;
    
    // Get selected size and color
    const selectedSizeBtn = document.querySelector('#selection-sizes .selection-option.selected');
    const selectedColorBtn = document.querySelector('#selection-colors .selection-option.selected');
    
    const selectedSize = selectedSizeBtn ? selectedSizeBtn.dataset.value : null;
    const selectedColor = selectedColorBtn ? selectedColorBtn.dataset.value : null;
    
    // Add to favorites with selections
    addToFavorites(product.id, selectedSize, selectedColor, sourceButton);
    
    closeSelectionModal();
}

// ===== Helper: Check if product is in favorites =====
function isProductInFavorites(productId) {
    return favorites.some(fav => fav.id === productId);
}

// ===== Helper: Find favorite by product ID =====
function findFavorite(productId) {
    return favorites.find(fav => fav.id === productId);
}

// ===== Add to Favorites =====
function addToFavorites(productId, selectedSize, selectedColor, button) {
    favorites.push({
        id: productId,
        selectedSize: selectedSize,
        selectedColor: selectedColor
    });
    
    if (button) {
        button.classList.add('active');
    }
    
    localStorage.setItem('glasseria_favorites', JSON.stringify(favorites));
    updateFavoritesCount();
    renderFavoritesList();
    
    // Update card button if exists
    const cardBtn = document.querySelector(`.product-card .favorite-btn[data-id="${productId}"]`);
    if (cardBtn && cardBtn !== button) {
        cardBtn.classList.add('active');
    }
}

// ===== Remove from Favorites =====
function removeFromFavorites(productId, button) {
    const index = favorites.findIndex(fav => fav.id === productId);
    if (index !== -1) {
        favorites.splice(index, 1);
    }
    
    if (button) {
        button.classList.remove('active');
    }
    
    localStorage.setItem('glasseria_favorites', JSON.stringify(favorites));
    updateFavoritesCount();
    renderFavoritesList();
    
    // Update card button if exists
    const cardBtn = document.querySelector(`.product-card .favorite-btn[data-id="${productId}"]`);
    if (cardBtn && cardBtn !== button) {
        cardBtn.classList.remove('active');
    }
    
    // Update modal button if exists
    const modalBtn = document.querySelector(`.modal-favorite-btn[data-id="${productId}"]`);
    if (modalBtn) {
        modalBtn.classList.remove('active');
        modalBtn.innerHTML = `
            <svg viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
            הוסף למועדפים
        `;
    }
}

// ===== Toggle Favorite (for removing only) =====
function toggleFavorite(productId, button, product = null) {
    const isFavorite = isProductInFavorites(productId);
    
    if (isFavorite) {
        // Remove from favorites
        removeFromFavorites(productId, button);
    } else {
        // If product provided, open selection modal
        if (product) {
            // Check if product has sizes or colors
            if ((product.sizes && product.sizes.length > 0) || (product.colors && product.colors.length > 0)) {
                openSelectionModal(product, button);
            } else {
                // No options, add directly
                addToFavorites(productId, null, null, button);
            }
        } else {
            // Find product and check
            const foundProduct = products.find(p => p.id === productId);
            if (foundProduct && ((foundProduct.sizes && foundProduct.sizes.length > 0) || (foundProduct.colors && foundProduct.colors.length > 0))) {
                openSelectionModal(foundProduct, button);
            } else {
                addToFavorites(productId, null, null, button);
            }
        }
    }
}

// ===== Create Lightbox Element =====
function createLightbox() {
    // Check if lightbox already exists
    if (document.getElementById('image-lightbox')) return;
    
    const lightbox = document.createElement('div');
    lightbox.className = 'image-lightbox';
    lightbox.id = 'image-lightbox';
    lightbox.innerHTML = `
        <button class="lightbox-close" id="lightbox-close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
        </button>
        <button class="lightbox-arrow prev" id="lightbox-prev">
            <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <img src="" alt="תמונה מוגדלת" id="lightbox-image">
        <button class="lightbox-arrow next" id="lightbox-next">
            <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <div class="lightbox-counter" id="lightbox-counter">1 / 1</div>
    `;
    document.body.appendChild(lightbox);
    
    // Event listeners for lightbox
    const lightboxEl = document.getElementById('image-lightbox');
    const lightboxClose = document.getElementById('lightbox-close');
    const lightboxPrev = document.getElementById('lightbox-prev');
    const lightboxNext = document.getElementById('lightbox-next');
    const lightboxImage = document.getElementById('lightbox-image');
    
    // Close lightbox
    lightboxClose.addEventListener('click', closeLightbox);
    lightboxEl.addEventListener('click', (e) => {
        if (e.target === lightboxEl || e.target === lightboxImage) {
            closeLightbox();
        }
    });
    
    // Navigation
    lightboxPrev.addEventListener('click', (e) => {
        e.stopPropagation();
        navigateLightbox(-1);
    });
    
    lightboxNext.addEventListener('click', (e) => {
        e.stopPropagation();
        navigateLightbox(1);
    });
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (!lightboxEl.classList.contains('active')) return;
        
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowRight') navigateLightbox(-1); // RTL
        if (e.key === 'ArrowLeft') navigateLightbox(1); // RTL
    });
    
    // Swipe support for mobile
    let touchStartX = 0;
    let touchEndX = 0;
    
    lightboxEl.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    
    lightboxEl.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleLightboxSwipe();
    }, { passive: true });
    
    function handleLightboxSwipe() {
        const swipeThreshold = 50;
        const diff = touchStartX - touchEndX;
        
        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                // Swipe left - next (RTL)
                navigateLightbox(1);
            } else {
                // Swipe right - prev (RTL)
                navigateLightbox(-1);
            }
        }
    }
}

// ===== Open Lightbox =====
function openLightbox(images, startIndex = 0) {
    lightboxImages = images;
    lightboxCurrentIndex = startIndex;
    
    const lightbox = document.getElementById('image-lightbox');
    const lightboxImage = document.getElementById('lightbox-image');
    const lightboxCounter = document.getElementById('lightbox-counter');
    const lightboxPrev = document.getElementById('lightbox-prev');
    const lightboxNext = document.getElementById('lightbox-next');
    
    // Set image
    lightboxImage.src = lightboxImages[lightboxCurrentIndex];
    
    // Update counter
    if (lightboxImages.length > 1) {
        lightboxCounter.style.display = 'block';
        lightboxCounter.textContent = `${lightboxCurrentIndex + 1} / ${lightboxImages.length}`;
        lightboxPrev.style.display = 'flex';
        lightboxNext.style.display = 'flex';
    } else {
        lightboxCounter.style.display = 'none';
        lightboxPrev.style.display = 'none';
        lightboxNext.style.display = 'none';
    }
    
    // Show lightbox
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// ===== Close Lightbox =====
function closeLightbox() {
    const lightbox = document.getElementById('image-lightbox');
    lightbox.classList.remove('active');
    
    // Only restore scroll if modal is not open
    if (!productModal.classList.contains('active')) {
        document.body.style.overflow = '';
    }
}

// ===== Navigate Lightbox =====
function navigateLightbox(direction) {
    if (lightboxImages.length <= 1) return;
    
    lightboxCurrentIndex += direction;
    
    // Loop around
    if (lightboxCurrentIndex < 0) {
        lightboxCurrentIndex = lightboxImages.length - 1;
    } else if (lightboxCurrentIndex >= lightboxImages.length) {
        lightboxCurrentIndex = 0;
    }
    
    const lightboxImage = document.getElementById('lightbox-image');
    const lightboxCounter = document.getElementById('lightbox-counter');
    
    // Add fade effect
    lightboxImage.style.opacity = '0';
    
    setTimeout(() => {
        lightboxImage.src = lightboxImages[lightboxCurrentIndex];
        lightboxCounter.textContent = `${lightboxCurrentIndex + 1} / ${lightboxImages.length}`;
        lightboxImage.style.opacity = '1';
    }, 150);
}

// ===== Load All Data =====
async function loadAllData() {
    showLoading(true);
    
    try {
        // Load categories
        categoriesCollection.orderBy('order').onSnapshot((snapshot) => {
            categories = [];
            snapshot.forEach((doc) => {
                categories.push({ id: doc.id, ...doc.data() });
            });
            renderCategories();
            renderNavigation();
        });
        
        // Load subcategories
        subcategoriesCollection.orderBy('order').onSnapshot((snapshot) => {
            subcategories = [];
            snapshot.forEach((doc) => {
                subcategories.push({ id: doc.id, ...doc.data() });
            });
        });
        
        // Load products
        productsCollection.orderBy('createdAt', 'desc').onSnapshot((snapshot) => {
            products = [];
            snapshot.forEach((doc) => {
                products.push({ id: doc.id, ...doc.data() });
            });
            
            showLoading(false);
            updateFavoritesCount();
            
            renderCategories();
            renderProducts();
            
        });
    } catch (error) {
        console.error('Error loading data:', error);
        showLoading(false);
    }
}

// ===== Show/Hide Loading =====
function showLoading(show) {
    if (loadingEl) {
        loadingEl.style.display = show ? 'flex' : 'none';
    }
}

// ===== Render Navigation =====
function renderNavigation() {
    const navLinks = categories.map(cat => 
        `<a href="#" class="nav-link" data-category="${cat.id}">${cat.name}</a>`
    ).join('');
    
    mainNav.innerHTML = `
        <a href="#" class="nav-link active" data-category="all">הכל</a>
        ${navLinks}
        <a href="about.html" class="nav-link nav-about">אודות</a>
    `;
    
    mobileNav.innerHTML = `
        <a href="#" class="nav-link active" data-category="all">הכל</a>
        ${navLinks}
        <a href="about.html" class="nav-link nav-about">אודות</a>
    `;
    
    document.querySelectorAll('.nav-link:not(.nav-about)').forEach(link => {
        link.addEventListener('click', handleNavClick);
    });
}

// ===== Render Categories =====
function renderCategories() {
    if (categories.length === 0) {
        categoriesGrid.innerHTML = `
            <div class="empty-state">
                <p>אין קטגוריות עדיין</p>
            </div>
        `;
        return;
    }
    
    categoriesGrid.innerHTML = categories.map(cat => {
        const productCount = products.filter(p => p.categoryId === cat.id).length;
        return `
            <div class="category-card" data-category="${cat.id}">
                <div class="category-image">
                    <img src="${cat.image || 'images/placeholder.svg'}" alt="${cat.name}" onerror="this.src='images/placeholder.svg'">
                </div>
                <div class="category-info">
                    <h3>${cat.name}</h3>
                    <span class="category-count">${productCount} מוצרים</span>
                </div>
            </div>
        `;
    }).join('');
    
    document.querySelectorAll('.category-card').forEach(card => {
        card.addEventListener('click', () => handleCategoryClick(card.dataset.category));
    });
}

// ===== Handle Category Click =====
function handleCategoryClick(categoryId) {
    currentCategoryId = categoryId;
    const category = categories.find(c => c.id === categoryId);
    
    const subs = subcategories.filter(s => s.categoryId === categoryId);
    
    if (subs.length > 0) {
        showSubcategories(categoryId, subs);
    } else {
        showProducts(categoryId, null);
    }
}

// ===== Show Subcategories =====
function showSubcategories(categoryId, subs) {
    const category = categories.find(c => c.id === categoryId);
    
    currentView = 'subcategories';
    categoriesSection.style.display = 'none';
    subcategoriesSection.style.display = 'block';
    subcategoriesTitle.textContent = category ? category.name : '';
    
    subcategoriesGrid.innerHTML = subs.map(sub => {
        const productCount = products.filter(p => p.subcategoryId === sub.id).length;
        return `
            <div class="subcategory-card" data-subcategory="${sub.id}">
                <div class="subcategory-image">
                    <img src="${sub.image || 'images/placeholder.svg'}" alt="${sub.name}" onerror="this.src='images/placeholder.svg'">
                </div>
                <div class="subcategory-info">
                    <h3>${sub.name}</h3>
                    <span class="subcategory-count">${productCount} מוצרים</span>
                </div>
            </div>
        `;
    }).join('');
    
    subcategoriesGrid.innerHTML = `
        <div class="subcategory-card all-in-category" data-subcategory="all">
            <div class="subcategory-image">
                <div class="all-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M4 6h16M4 12h16M4 18h16"/>
                    </svg>
                </div>
            </div>
            <div class="subcategory-info">
                <h3>כל המוצרים</h3>
                <span class="subcategory-count">${products.filter(p => p.categoryId === categoryId).length} מוצרים</span>
            </div>
        </div>
    ` + subcategoriesGrid.innerHTML;
    
    document.querySelectorAll('.subcategory-card').forEach(card => {
        card.addEventListener('click', () => {
            const subId = card.dataset.subcategory;
            if (subId === 'all') {
                showProducts(categoryId, null);
            } else {
                showProducts(categoryId, subId);
            }
        });
    });
    
    setActiveNav(categoryId);
    document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
}

// ===== Show Products =====
function showProducts(categoryId, subcategoryId) {
    currentView = 'products';
    currentCategoryId = categoryId;
    currentSubcategoryId = subcategoryId;
    
    categoriesSection.style.display = 'none';
    subcategoriesSection.style.display = 'none';
    
    let filtered = products;
    let title = 'כל המוצרים';
    
    if (categoryId) {
        filtered = products.filter(p => p.categoryId === categoryId);
        const cat = categories.find(c => c.id === categoryId);
        title = cat ? cat.name : '';
        
        if (subcategoryId) {
            filtered = filtered.filter(p => p.subcategoryId === subcategoryId);
            const sub = subcategories.find(s => s.id === subcategoryId);
            title = sub ? `${cat ? cat.name + ' - ' : ''}${sub.name}` : title;
        }
    }
    
    currentCategoryTitle.textContent = title;
    renderProducts(filtered);
    setActiveNav(categoryId);
}

// ===== Render Products =====
function renderProducts(filteredProducts = null) {
    const productsToShow = filteredProducts !== null ? filteredProducts : products;
    
    productsGrid.innerHTML = '';
    productsGrid.style.display = 'grid';
    
    if (productsToShow.length === 0) {
        noProducts.style.display = 'block';
        productsGrid.style.display = 'none';
    } else {
        noProducts.style.display = 'none';
        
        productsToShow.forEach(product => {
            const isFavorite = isProductInFavorites(product.id);
            const card = createProductCard(product, isFavorite);
            productsGrid.appendChild(card);
        });
    }
    
    productsCountEl.textContent = productsToShow.length;
}

// ===== Create Product Card (עם תמיכה בקרוסלה) =====
function createProductCard(product, isFavorite) {
    // תמיכה גם בתמונה בודדת וגם במערך תמונות
    const images = product.images && product.images.length > 0 
        ? product.images 
        : (product.image ? [product.image] : ['images/placeholder.svg']);
    
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
        <div class="product-image">
            <!-- הקרוסלה תיווצר כאן -->
        </div>
        <button class="favorite-btn ${isFavorite ? 'active' : ''}" data-id="${product.id}">
            <svg viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
        </button>
        <div class="product-info">
            <h3 class="product-name">${product.name}</h3>
            <p class="product-sku">מק"ט: ${product.sku || '-'}</p>
            ${product.type ? `<p class="product-type">${product.type}</p>` : ''}
            <p class="product-price">₪${product.price || '0'}</p>
        </div>
    `;
    
    // אתחול הקרוסלה
    setTimeout(() => {
        if (typeof productCarousel !== 'undefined') {
            productCarousel.initCardCarousel(card, images);
        }
    }, 10);
    
    // לחיצה על הכרטיס פותחת את המודל
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.favorite-btn') && !e.target.closest('.carousel-arrow')) {
            openProductModal(product);
        }
    });
    
    // כפתור מועדפים
    const favoriteBtn = card.querySelector('.favorite-btn');
    favoriteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(product.id, favoriteBtn, product);
    });
    
    return card;
}

// ===== Product Modal (עם תמיכה בקרוסלה ו-Lightbox) =====
function openProductModal(product) {
    const cat = categories.find(c => c.id === product.categoryId);
    const sub = subcategories.find(s => s.id === product.subcategoryId);
    const isFavorite = isProductInFavorites(product.id);
    
    // תמיכה גם בתמונה בודדת וגם במערך תמונות
    const images = product.images && product.images.length > 0 
        ? product.images 
        : (product.image ? [product.image] : ['images/placeholder.svg']);
    
    modalContent.innerHTML = `
        <div class="modal-product">
            <div class="modal-product-image" data-images='${JSON.stringify(images)}'>
                <!-- הקרוסלה תיווצר כאן -->
            </div>
            <div class="modal-product-info">
                <div class="modal-product-category">${cat ? cat.name : ''} ${sub ? '/ ' + sub.name : ''}</div>
                <h2 class="modal-product-name">${product.name}</h2>
                <p class="modal-product-sku">מק"ט: ${product.sku || '-'}</p>
                ${product.type ? `<p class="modal-product-type">${product.type}</p>` : ''}
                ${product.description ? `<p class="modal-product-description">${product.description}</p>` : ''}
                <div class="modal-product-price">₪${product.price || '0'}</div>
                
                ${product.sizes && product.sizes.length > 0 ? `
                    <div class="modal-product-sizes">
                        <strong>מידות זמינות:</strong>
                        <div class="size-options">
                            ${product.sizes.map(s => `<span class="size-option">${s}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${product.colors && product.colors.length > 0 ? `
                    <div class="modal-product-colors">
                        <strong>צבעים זמינים:</strong>
                        <div class="color-options">
                            ${product.colors.map(c => `<span class="color-option">${c}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <button class="modal-favorite-btn ${isFavorite ? 'active' : ''}" data-id="${product.id}">
                    <svg viewBox="0 0 24 24">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                    ${isFavorite ? 'הסר מהמועדפים' : 'הוסף למועדפים'}
                </button>
            </div>
        </div>
    `;
    
    // אתחול קרוסלה במודל
    setTimeout(() => {
        if (typeof productCarousel !== 'undefined') {
            const modalElement = modalContent.querySelector('.modal-product');
            productCarousel.initModalCarousel(modalElement, images);
        }
        
        // הוספת אירוע לחיצה על התמונה לפתיחת Lightbox
        const modalImageContainer = modalContent.querySelector('.modal-product-image');
        if (modalImageContainer) {
            modalImageContainer.style.cursor = 'zoom-in';
            modalImageContainer.addEventListener('click', (e) => {
                // לא לפתוח lightbox אם לחצו על חצים
                if (e.target.closest('.modal-carousel-arrow') || e.target.closest('.modal-carousel-dot')) {
                    return;
                }
                
                // מציאת האינדקס הנוכחי של התמונה
                let currentIndex = 0;
                const activeDot = modalImageContainer.querySelector('.modal-carousel-dot.active');
                if (activeDot) {
                    currentIndex = parseInt(activeDot.dataset.index) || 0;
                }
                
                openLightbox(images, currentIndex);
            });
        }
    }, 10);
    
    // כפתור מועדפים במודל
    const modalFavBtn = modalContent.querySelector('.modal-favorite-btn');
    modalFavBtn.addEventListener('click', () => {
        toggleFavorite(product.id, modalFavBtn, product);
        const isNowFavorite = isProductInFavorites(product.id);
        modalFavBtn.innerHTML = `
            <svg viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
            ${isNowFavorite ? 'הסר מהמועדפים' : 'הוסף למועדפים'}
        `;
        modalFavBtn.classList.toggle('active', isNowFavorite);
    });
    
    productModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeProductModal() {
    productModal.classList.remove('active');
    document.body.style.overflow = '';
}

// ===== Event Listeners =====
function setupEventListeners() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', handleNavClick);
    });
    
    backToCategories.addEventListener('click', () => {
        currentView = 'categories';
        categoriesSection.style.display = 'block';
        subcategoriesSection.style.display = 'none';
        currentCategoryTitle.textContent = 'כל המוצרים';
        renderProducts();
        setActiveNav('all');
    });
    
    favoritesBtn.addEventListener('click', openFavoritesPanel);
    closePanel.addEventListener('click', closeFavoritesPanel);
    overlay.addEventListener('click', closeFavoritesPanel);
    btnClear.addEventListener('click', clearFavorites);
    btnWhatsapp.addEventListener('click', sendToWhatsApp);
    
    mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    
    modalClose.addEventListener('click', closeProductModal);
    productModal.addEventListener('click', (e) => {
        if (e.target === productModal) closeProductModal();
    });
}

// ===== Handle Navigation Click =====
function handleNavClick(e) {
    e.preventDefault();
    const categoryId = e.target.dataset.category;
    
    closeMobileMenu();
    
    if (categoryId === 'all') {
        currentView = 'categories';
        currentCategoryId = null;
        currentSubcategoryId = null;
        categoriesSection.style.display = 'block';
        subcategoriesSection.style.display = 'none';
        currentCategoryTitle.textContent = 'כל המוצרים';
        renderProducts();
        setActiveNav('all');
    } else {
        handleCategoryClick(categoryId);
    }
}

// ===== Set Active Navigation =====
function setActiveNav(categoryId) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.category === categoryId);
    });
}

// ===== Favorites Functions =====
function updateFavoritesCount() {
    favoritesCountEl.textContent = favorites.length;
    
    if (favorites.length === 0) {
        favoritesEmpty.style.display = 'flex';
        favoritesList.style.display = 'none';
    } else {
        favoritesEmpty.style.display = 'none';
        favoritesList.style.display = 'block';
    }
}

function openFavoritesPanel() {
    renderFavoritesList();
    favoritesPanel.classList.add('active');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeFavoritesPanel() {
    favoritesPanel.classList.remove('active');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

function renderFavoritesList() {
    favoritesList.innerHTML = '';
    
    favorites.forEach(fav => {
        const product = products.find(p => p.id === fav.id);
        if (!product) return;
        
        // תמיכה בתמונה הראשונה מהמערך
        const firstImage = product.images && product.images.length > 0 
            ? product.images[0] 
            : (product.image || 'images/placeholder.svg');
        
        // Build selection info
        let selectionInfo = '';
        if (fav.selectedSize || fav.selectedColor) {
            const parts = [];
            if (fav.selectedSize) parts.push(`מידה: ${fav.selectedSize}`);
            if (fav.selectedColor) parts.push(`צבע: ${fav.selectedColor}`);
            selectionInfo = `<div class="favorite-item-selection">${parts.join(' | ')}</div>`;
        }
        
        const item = document.createElement('div');
        item.className = 'favorite-item';
        item.innerHTML = `
            <div class="favorite-item-image">
                <img src="${firstImage}" alt="${product.name}" onerror="this.src='images/placeholder.svg'">
            </div>
            <div class="favorite-item-info">
                <div class="favorite-item-name">${product.name}</div>
                <div class="favorite-item-sku">מק"ט: ${product.sku || '-'}</div>
                ${selectionInfo}
                <div class="favorite-item-price">₪${product.price || 0}</div>
            </div>
            <button class="favorite-item-remove" data-id="${product.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;
        
        const removeBtn = item.querySelector('.favorite-item-remove');
        removeBtn.addEventListener('click', () => {
            removeFromFavorites(product.id, null);
        });
        
        favoritesList.appendChild(item);
    });
    
    updateFavoritesCount();
}

function clearFavorites() {
    favorites = [];
    localStorage.setItem('glasseria_favorites', JSON.stringify(favorites));
    
    document.querySelectorAll('.favorite-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    renderFavoritesList();
}

function sendToWhatsApp() {
    if (favorites.length === 0) {
        alert('נא לבחור מוצרים לפני שליחה');
        return;
    }
    
    let message = 'שלום, אני מעוניין במוצרים הבאים:\n\n';
    
    favorites.forEach((fav, index) => {
        const product = products.find(p => p.id === fav.id);
        if (!product) return;
        
        const cat = categories.find(c => c.id === product.categoryId);
        message += `${index + 1}. ${product.name}\n`;
        message += `   מק"ט: ${product.sku || '-'}\n`;
        if (cat) message += `   קטגוריה: ${cat.name}\n`;
        
        // Add selected size and color
        if (fav.selectedSize) {
            message += `   מידה: ${fav.selectedSize}\n`;
        }
        if (fav.selectedColor) {
            message += `   צבע: ${fav.selectedColor}\n`;
        }
        
        message += `   מחיר: ₪${product.price || '0'}\n\n`;
    });
    
    message += 'אשמח לקבל פרטים נוספים. תודה!';
    
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
}

// ===== Mobile Menu =====
function toggleMobileMenu() {
    mobileMenuBtn.classList.toggle('active');
    mobileNav.classList.toggle('active');
}

function closeMobileMenu() {
    mobileMenuBtn.classList.remove('active');
    mobileNav.classList.remove('active');
}

// ===== Scroll Header Effect =====
window.addEventListener('scroll', () => {
    const header = document.querySelector('.header');
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
        header.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
    } else {
        header.style.boxShadow = 'none';
    }
});

// ===== Welcome Popup (פעם אחת בסשן בלבד) =====
function setupWelcomePopup() {
    const welcomePopup = document.getElementById('welcome-popup');
    const welcomeCloseBtn = document.getElementById('welcome-close');
    const dontShowAgain = document.getElementById('dont-show-again');
    
    // משתמש ב-sessionStorage - הפופאפ יופיע פעם אחת בכל סשן
    if (!sessionStorage.getItem('glasseria_welcome_shown')) {
        setTimeout(() => {
            welcomePopup.classList.add('active');
            sessionStorage.setItem('glasseria_welcome_shown', 'true');
        }, 500);
    }
    
    welcomeCloseBtn.addEventListener('click', () => {
        // אם המשתמש סימן "אל תציג שוב" - שומר ב-localStorage לצמיתות
        if (dontShowAgain.checked) {
            localStorage.setItem('glasseria_welcome_dismissed', 'true');
        }
        welcomePopup.classList.remove('active');
    });
    
    welcomePopup.addEventListener('click', (e) => {
        if (e.target === welcomePopup) {
            if (dontShowAgain.checked) {
                localStorage.setItem('glasseria_welcome_dismissed', 'true');
            }
            welcomePopup.classList.remove('active');
        }
    });
}
