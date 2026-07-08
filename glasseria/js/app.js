// ===== Glasseria Catalog App with Dynamic Categories =====
// Updated with Size & Color Selection before adding to favorites

// Safe localStorage/sessionStorage helpers (some in-app browsers block storage)
let _storageBlockedWarned = false;
function _warnStorageBlocked(e) {
    if (_storageBlockedWarned) return;
    _storageBlockedWarned = true;
    if (typeof GlasseriaLogger !== 'undefined') {
        GlasseriaLogger.warn('storage', 'שמירה מקומית נחסמה: ' + (e && e.message ? e.message : e));
    }
}
function safeSetStorage(key, value, session = false) {
    try { (session ? sessionStorage : localStorage).setItem(key, value); } catch(e) { _warnStorageBlocked(e); }
}
function safeGetStorage(key, session = false) {
    try { return (session ? sessionStorage : localStorage).getItem(key); } catch(e) { return null; }
}

// הוספת סגנונות לאנימציית המועדפים
const favoritesAnimationStyles = document.createElement('style');
favoritesAnimationStyles.textContent = `
    .favorites-success-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.3s ease;
    }
    .favorites-success-overlay.active {
        opacity: 1;
    }
    .favorites-success-content {
        background: white;
        padding: 40px 50px;
        border-radius: 20px;
        text-align: center;
        transform: scale(0.5);
        transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .favorites-success-overlay.active .favorites-success-content {
        transform: scale(1);
    }
    .favorites-success-icon {
        width: 80px;
        height: 80px;
        margin: 0 auto 20px;
        animation: heartPulse 0.6s ease-in-out;
    }
    .favorites-success-icon svg {
        width: 100%;
        height: 100%;
        color: #e74c3c;
    }
    .favorites-success-text {
        font-size: 22px;
        font-weight: 600;
        color: #333;
    }
    @keyframes heartPulse {
        0% { transform: scale(0); }
        50% { transform: scale(1.3); }
        100% { transform: scale(1); }
    }
`;
document.head.appendChild(favoritesAnimationStyles);

// WhatsApp Number
const WHATSAPP_NUMBER = '972524048371';

// State
let categories = [];
let subcategories = [];
let products = [];
// favorites now stores objects: { id, selectedSize, selectedColor }
let favorites = [];
try {
    favorites = JSON.parse(localStorage.getItem('glasseria_favorites')) || [];
    // Migration: convert old format (array of IDs) to new format (array of objects)
    if (favorites.length > 0 && typeof favorites[0] === 'string') {
        favorites = favorites.map(id => ({ id, selectedSize: null, selectedColor: null }));
        localStorage.setItem('glasseria_favorites', JSON.stringify(favorites));
    }
} catch (e) {
    // localStorage blocked in some in-app browsers (Instagram, Facebook WebView)
    favorites = [];
}

let currentView = 'categories'; // 'categories', 'subcategories', 'products'
let currentCategoryId = null;
let currentSubcategoryId = null;

// Lightbox State
let lightboxImages = [];
let lightboxCurrentIndex = 0;

// Selection Modal State
let pendingFavoriteProduct = null;

// Lazy Rendering State
let renderedCount = 0;
const PRODUCTS_PER_BATCH = 20;
let currentFilteredProducts = [];
let scrollObserver = null;

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
    loadSiteSettings();
    setupEventListeners();
    setupWelcomePopup();
    createLightbox();
    createSelectionModal();
    setupHistoryNavigation();

    // Splash is hidden when the products actually load (showLoading(false) -> hideSplash),
    // with a short minimum display so it doesn't flash on fast cached loads. On slow
    // connections it stays visible with the loading hints instead of exposing an empty
    // grid. Safety cap only - showLoadingError also hides it on failure.
    window._splashShownAt = Date.now();
    setTimeout(hideSplash, 45000);
});

// ===== Site Settings (hero text + announcement banner, managed from admin) =====
function loadSiteSettings() {
    try {
        if (typeof settingsCollection === 'undefined') return;
        settingsCollection.doc(SETTINGS_DOC_ID).onSnapshot((snap) => {
            const s = snap.exists ? snap.data() : {};
            const titleEl = document.getElementById('hero-title');
            const subEl = document.getElementById('hero-subtitle');
            const bannerEl = document.getElementById('site-banner');
            // Only override defaults when the admin actually set a value (textContent = no HTML injection)
            if (titleEl && s.heroTitle) titleEl.textContent = s.heroTitle;
            if (subEl && s.heroSubtitle) subEl.textContent = s.heroSubtitle;
            if (bannerEl) {
                if (s.bannerVisible && s.bannerText) {
                    bannerEl.textContent = s.bannerText;
                    bannerEl.style.display = 'block';
                } else {
                    bannerEl.style.display = 'none';
                }
            }
        }, () => { /* settings are optional - ignore read errors */ });
    } catch (e) { /* never block the site on settings */ }
}

// ===== History Navigation =====
function setupHistoryNavigation() {
    // שמירת המצב ההתחלתי
    history.replaceState({ view: 'categories', categoryId: null, subcategoryId: null }, '', window.location.pathname);
    
    // האזנה ללחיצה על כפתור "קודם" בדפדפן
    window.addEventListener('popstate', (e) => {
        if (e.state) {
            restoreState(e.state);
        } else {
            // אם אין state, חזרה לקטגוריות
            showCategoriesView();
        }
    });
}

function pushHistoryState(view, categoryId = null, subcategoryId = null) {
    const state = { view, categoryId, subcategoryId };
    history.pushState(state, '', window.location.pathname);
}

function restoreState(state) {
    if (state.view === 'categories') {
        showCategoriesView();
    } else if (state.view === 'subcategories' && state.categoryId) {
        const subs = subcategories.filter(s => s.categoryId === state.categoryId);
        if (subs.length > 0) {
            showSubcategoriesWithoutHistory(state.categoryId, subs);
        } else {
            showCategoriesView();
        }
    } else if (state.view === 'products') {
        showProductsWithoutHistory(state.categoryId, state.subcategoryId);
    }
}

function showCategoriesView() {
    currentView = 'categories';
    currentCategoryId = null;
    currentSubcategoryId = null;
    categoriesSection.style.display = 'block';
    subcategoriesSection.style.display = 'none';
    document.getElementById('products').style.display = 'block';
    currentCategoryTitle.textContent = 'כל המוצרים';
    hideProductsBackButton();
    renderProducts();
    setActiveNav('all');
}

// ===== Create Selection Modal =====
function createSelectionModal() {
    if (document.getElementById('selection-modal')) return;
    
    const modal = document.createElement('div');
    modal.className = 'selection-modal-overlay';
    modal.id = 'selection-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'בחירת מידה וצבע');
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
                    <label id="selection-colors-label">בחר צבע:</label>
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
    modalImage.innerHTML = `<img src="${firstImage}" alt="${product.name}" onerror="this.onerror=null;this.src='images/placeholder.svg'">`;
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
        document.getElementById('selection-colors-label').textContent = getProductColorsLabel(product, 'select');
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
    // Lock body scroll - only if not already locked by another modal (e.g. the product
    // modal). When body is already fixed, window.scrollY is 0 and saving it would
    // overwrite the user's real position - dumping them at the top on close.
    if (document.body.style.position !== 'fixed') {
        document.body.dataset.scrollY = window.scrollY;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${window.scrollY}px`;
        document.body.style.width = '100%';
        document.body.style.overflow = 'hidden';
    }
}

// ===== Close Selection Modal =====
function closeSelectionModal() {
    const modal = document.getElementById('selection-modal');
    modal.classList.remove('active');
    pendingFavoriteProduct = null;
    
    // Restore body scroll - but not while the product modal is still open (it owns the lock)
    if (!productModal.classList.contains('active')) {
        const scrollY = document.body.dataset.scrollY || '0';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo({ top: parseInt(scrollY), behavior: 'instant' });
    }

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
    
    // הצגת אנימציית הצלחה וסגירת מודל המוצר
    if (productModal.classList.contains('active')) {
        showAddedToFavoritesAnimation(() => {
            closeProductModal();
        });
    }
}

// ===== Added to Favorites Animation =====
function showAddedToFavoritesAnimation(callback) {
    // יצירת אלמנט האנימציה
    const overlay = document.createElement('div');
    overlay.className = 'favorites-success-overlay';
    overlay.innerHTML = `
        <div class="favorites-success-content">
            <div class="favorites-success-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
            </div>
            <div class="favorites-success-text">נוסף למועדפים!</div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // הפעלת האנימציה
    requestAnimationFrame(() => {
        overlay.classList.add('active');
    });
    
    // סגירה אחרי 1.2 שניות
    setTimeout(() => {
        overlay.classList.remove('active');
        setTimeout(() => {
            overlay.remove();
            if (callback) callback();
        }, 300);
    }, 1200);
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
        selectedColor: selectedColor,
        quantity: 1
    });

    if (button) {
        button.classList.add('active');
    }

    safeSetStorage('glasseria_favorites', JSON.stringify(favorites));
    updateFavoritesCount();
    renderFavoritesList();

    // Analytics: favorite adds (intent signal). One per product per session.
    const favProduct = products.find(p => p.id === productId);
    logEventOnce('fav:' + productId, 'favorite_add', {
        productId: productId,
        productName: favProduct ? favProduct.name : ''
    });

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
    
    safeSetStorage('glasseria_favorites', JSON.stringify(favorites));
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
    // prev button (RIGHT side, arrow points left) = go to PREVIOUS image
    lightboxPrev.addEventListener('click', (e) => {
        e.stopPropagation();
        navigateLightbox(-1); // Go to previous (index - 1)
    });
    
    // next button (LEFT side, arrow points right) = go to NEXT image
    lightboxNext.addEventListener('click', (e) => {
        e.stopPropagation();
        navigateLightbox(1); // Go to next (index + 1)
    });
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (!lightboxEl.classList.contains('active')) return;
        
        if (e.key === 'Escape') closeLightbox();
        // RTL: Right arrow = next (reading direction), Left arrow = previous
        const isRTL = document.documentElement.dir === 'rtl';
        if (e.key === 'ArrowRight') navigateLightbox(isRTL ? 1 : -1);
        if (e.key === 'ArrowLeft') navigateLightbox(isRTL ? -1 : 1);
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
                // Swiped left = go to next image
                navigateLightbox(1);
            } else {
                // Swiped right = go to previous image
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
    // Note: body scroll is already locked by the modal that opened this lightbox
}

// ===== Close Lightbox =====
function closeLightbox() {
    const lightbox = document.getElementById('image-lightbox');
    lightbox.classList.remove('active');
    // Note: don't restore body scroll here - the modal handles it
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
let dataLoadRetries = 0;
const MAX_RETRIES = 3;
let categoriesLoaded = false;
let subcategoriesLoaded = false;
let productsLoaded = false;
let loadingTimeout = null;
let slowHintTimeout = null; // Promoted to module scope so it can be cleared from anywhere
let initialLoadDone = false; // Track if we got real (non-cache) data at least once
let fallbackInProgress = false; // Guard against concurrent loadDataWithGet calls
let listenersCancelled = false; // Guard against queued onSnapshot callbacks after unsubscribe
// Store unsubscribe functions to prevent duplicate listeners on retry
let unsubCategories = null;
let unsubSubcategories = null;
let unsubProducts = null;

function sortProducts(arr) {
    arr.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
        if (a.order !== undefined) return -1;
        if (b.order !== undefined) return 1;
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
    });
}

function applyProductsData(loadMethod) {
    sortProducts(products);
    productsLoaded = true;
    fallbackInProgress = false; // Reset guard so future fallbacks can run
    if (slowHintTimeout) {
        clearTimeout(slowHintTimeout);
        slowHintTimeout = null;
    }
    if (loadingTimeout) {
        clearTimeout(loadingTimeout);
        loadingTimeout = null;
    }
    dataLoadRetries = 0;
    // Log load timing only on first load (not on live real-time updates)
    if (!window._initialLoadLogged) {
        window._initialLoadLogged = true;
        const duration = Date.now() - (window._glasseriaLoadStart || GlasseriaLogger.getSessionStart());
        GlasseriaLogger.logLoadTime(loadMethod || 'onSnapshot', products.length, duration);
    }
    showLoading(false);
    hideLoadingError();
    hideLoadingHint();
    // Clean favorites that reference deleted products
    const before = favorites.length;
    favorites = favorites.filter(fav => products.some(p => p.id === fav.id));
    if (favorites.length !== before) {
        safeSetStorage('glasseria_favorites', JSON.stringify(favorites));
    }
    updateFavoritesCount();
    renderCategories();
    if (currentView === 'products' && currentCategoryId) {
        showProductsWithoutHistory(currentCategoryId, currentSubcategoryId);
    } else {
        renderProducts();
    }
}

// Fallback: use get() instead of onSnapshot when realtime fails
const GET_MAX_RETRIES = 3;
const GET_RETRY_DELAYS = [2000, 4000, 6000]; // Increasing delay between retries
async function loadDataWithGet(attempt = 1) {
    // Guard against concurrent fallback calls (e.g. timeout + onSnapshot error firing together)
    if (fallbackInProgress && attempt === 1) {
        console.log('loadDataWithGet already in progress, skipping duplicate call');
        return;
    }
    fallbackInProgress = true;
    console.log(`Falling back to get() for data loading (attempt ${attempt}/${GET_MAX_RETRIES})...`);
    // Keep the same user-facing message throughout - no technical details
    showLoadingHint('החיבור איטי, הטעינה עשויה לקחת מספר שניות...');
    try {
        const [catSnap, subSnap, prodSnap] = await Promise.all([
            categoriesCollection.orderBy('order').get({ source: 'server' }),
            subcategoriesCollection.orderBy('order').get({ source: 'server' }),
            productsCollection.get({ source: 'server' })
        ]);

        categories = [];
        catSnap.forEach(doc => categories.push({ id: doc.id, ...doc.data() }));
        categoriesLoaded = true;
        renderCategories();
        renderNavigation();

        subcategories = [];
        subSnap.forEach(doc => subcategories.push({ id: doc.id, ...doc.data() }));
        subcategoriesLoaded = true;

        products = [];
        prodSnap.forEach(doc => products.push({ id: doc.id, ...doc.data() }));
        applyProductsData('get-server');
        initialLoadDone = true;
        console.log(`Fallback loaded: ${products.length} products`);
    } catch (err) {
        console.error(`Fallback get() attempt ${attempt} failed:`, err);
        GlasseriaLogger.logLoadFailure('get-server', err.message || err.code || String(err), attempt);

        // Retry if we have attempts left
        if (attempt < GET_MAX_RETRIES) {
            const delay = GET_RETRY_DELAYS[attempt - 1] || 4000;
            showLoadingHint('החיבור איטי, הטעינה עשויה לקחת מספר שניות...');
            await new Promise(r => setTimeout(r, delay));
            return loadDataWithGet(attempt + 1);
        }

        // All retries exhausted - try from cache as last resort (products + categories + subcategories)
        try {
            const [catSnap, subSnap, prodSnap] = await Promise.all([
                categoriesCollection.orderBy('order').get({ source: 'cache' }).catch(() => null),
                subcategoriesCollection.orderBy('order').get({ source: 'cache' }).catch(() => null),
                productsCollection.get({ source: 'cache' })
            ]);

            if (prodSnap.size > 0) {
                // Load cached categories and subcategories if available (for navigation)
                if (catSnap && catSnap.size > 0) {
                    categories = [];
                    catSnap.forEach(doc => categories.push({ id: doc.id, ...doc.data() }));
                    categoriesLoaded = true;
                    renderCategories();
                    renderNavigation();
                }
                if (subSnap && subSnap.size > 0) {
                    subcategories = [];
                    subSnap.forEach(doc => subcategories.push({ id: doc.id, ...doc.data() }));
                    subcategoriesLoaded = true;
                }

                products = [];
                prodSnap.forEach(doc => products.push({ id: doc.id, ...doc.data() }));
                applyProductsData('get-cache');
                showLoadingHint('נטען מגרסה שמורה. חלק מהמוצרים עשויים להיות לא מעודכנים.');
                console.log(`Cache fallback loaded: ${products.length} products, ${categories.length} categories`);
            } else {
                showLoadingError('לא הצלחנו לטעון את המוצרים. בדקו את החיבור לאינטרנט ונסו לרענן.');
                GlasseriaLogger.logLoadFailure('get-cache', 'Empty cache', attempt);
            }
        } catch (cacheErr) {
            showLoadingError('לא הצלחנו לטעון את המוצרים. בדקו את החיבור לאינטרנט ונסו לרענן.');
            GlasseriaLogger.logLoadFailure('get-cache', cacheErr.message || String(cacheErr), attempt);
        }
    }
}

async function loadAllData() {
    showLoading(true);
    categoriesLoaded = false;
    subcategoriesLoaded = false;
    productsLoaded = false;
    window._glasseriaLoadStart = Date.now();
    window._firestoreErrorLogged = false; // reset per load-phase: only one merged firestore error per load

    // Unsubscribe old listeners before creating new ones (prevents duplicates on retry)
    if (unsubCategories) { unsubCategories(); unsubCategories = null; }
    if (unsubSubcategories) { unsubSubcategories(); unsubSubcategories = null; }
    if (unsubProducts) { unsubProducts(); unsubProducts = null; }
    listenersCancelled = false; // Reset guard for fresh listeners

    // Determine timeout based on connection speed
    const conn = navigator.connection;
    const connType = conn ? conn.effectiveType : '4g';
    const isSlowNetwork = ['slow-2g', '2g', '3g'].includes(connType);
    const LOAD_TIMEOUT = isSlowNetwork ? 25000 : 12000; // 25s for slow, 12s for fast
    const HINT_DELAY = isSlowNetwork ? 2000 : 3000; // Show hint earlier on slow

    // Slow connection hint
    if (loadingTimeout) clearTimeout(loadingTimeout);
    slowHintTimeout = setTimeout(() => {
        if (!productsLoaded) {
            showLoadingHint('החיבור איטי, הטעינה עשויה לקחת מספר שניות...');
        }
    }, HINT_DELAY);

    // Timeout: adaptive based on connection speed, then fallback to get()
    loadingTimeout = setTimeout(() => {
        clearTimeout(slowHintTimeout);
        if (!productsLoaded) {
            console.warn(`Loading timeout - data not received in ${LOAD_TIMEOUT/1000}s, trying fallback...`);
            GlasseriaLogger.warn('load', `Timeout after ${LOAD_TIMEOUT/1000}s, trying fallback`, { retryCount: dataLoadRetries, connectionType: connType });
            // Unsubscribe failed listeners and mark as cancelled
            if (unsubCategories) { unsubCategories(); unsubCategories = null; }
            if (unsubSubcategories) { unsubSubcategories(); unsubSubcategories = null; }
            if (unsubProducts) { unsubProducts(); unsubProducts = null; }
            listenersCancelled = true;

            if (dataLoadRetries < MAX_RETRIES) {
                dataLoadRetries++;
                console.log(`Retry ${dataLoadRetries}/${MAX_RETRIES} using get()...`);
                showLoadingHint('החיבור איטי, הטעינה עשויה לקחת מספר שניות...');
                loadDataWithGet();
            } else {
                showLoadingError('נראה שהחיבור לאינטרנט איטי וטעינת המוצרים מתעכבת. נסו לרענן את הדף.');
                GlasseriaLogger.logLoadFailure('timeout', 'All retries exhausted', dataLoadRetries);
            }
        }
    }, LOAD_TIMEOUT);

    const handleError = (source) => (error) => {
        if (listenersCancelled) return; // Ignore errors from cancelled listeners
        console.error(`Error loading ${source}:`, error);
        // One merged log per load-phase instead of one per collection
        if (!window._firestoreErrorLogged) {
            window._firestoreErrorLogged = true;
            GlasseriaLogger.error('firestore', `onSnapshot error (${source}): ${error.message || error.code || error}`, {
                code: error.code || '',
                firstCollection: source
            });
        }
        // Don't immediately give up - try fallback
        if (!productsLoaded && source === 'products') {
            console.log(`onSnapshot error for ${source}, trying get() fallback...`);
            if (loadingTimeout) { clearTimeout(loadingTimeout); loadingTimeout = null; }
            loadDataWithGet();
        } else if (!productsLoaded) {
            // Category/subcategory error - less critical, try get for those
            console.warn(`onSnapshot error for ${source}, will retry via get if products also fail`);
        }
    };

    try {
        // Load categories
        unsubCategories = categoriesCollection.orderBy('order').onSnapshot((snapshot) => {
            if (listenersCancelled) return; // Queued callback after unsubscribe
            categories = [];
            snapshot.forEach((doc) => {
                categories.push({ id: doc.id, ...doc.data() });
            });
            categoriesLoaded = true;
            renderCategories();
            renderNavigation();
            checkAllDataLoaded();
        }, handleError('categories'));

        // Load subcategories
        unsubSubcategories = subcategoriesCollection.orderBy('order').onSnapshot((snapshot) => {
            if (listenersCancelled) return; // Queued callback after unsubscribe
            subcategories = [];
            snapshot.forEach((doc) => {
                subcategories.push({ id: doc.id, ...doc.data() });
            });
            subcategoriesLoaded = true;
            checkAllDataLoaded();
        }, handleError('subcategories'));

        // Load products - with fromCache awareness
        unsubProducts = productsCollection.onSnapshot((snapshot) => {
            if (listenersCancelled) return; // Queued callback after unsubscribe
            const isFromCache = snapshot.metadata.fromCache;

            // If snapshot is from cache and empty, DON'T clear products yet - wait for server data
            if (isFromCache && snapshot.size === 0 && !initialLoadDone) {
                console.log('Received empty cache snapshot, waiting for server data...');
                return; // Skip this empty cache snapshot
            }

            // If from cache but has data, show it as temporary while waiting for server
            if (isFromCache && snapshot.size > 0 && !initialLoadDone) {
                console.log(`Showing ${snapshot.size} cached products while loading from server...`);
            }

            products = [];
            snapshot.forEach((doc) => {
                products.push({ id: doc.id, ...doc.data() });
            });

            if (!isFromCache) {
                initialLoadDone = true;
            }

            applyProductsData(isFromCache ? 'onSnapshot-cache' : 'onSnapshot');

        }, handleError('products'));
    } catch (error) {
        console.error('Error setting up listeners:', error);
        GlasseriaLogger.error('firestore', `Listener setup failed: ${error.message || error}`, { code: error.code || '' });
        // Clean up any partially-created listeners
        if (unsubCategories) { unsubCategories(); unsubCategories = null; }
        if (unsubSubcategories) { unsubSubcategories(); unsubSubcategories = null; }
        if (unsubProducts) { unsubProducts(); unsubProducts = null; }
        listenersCancelled = true;
        // Try fallback before giving up
        loadDataWithGet();
    }
}

function checkAllDataLoaded() {
    if (categoriesLoaded && subcategoriesLoaded && productsLoaded && loadingTimeout) {
        clearTimeout(loadingTimeout);
        loadingTimeout = null;
    }
}

function showLoadingError(message) {
    hideSplash(); // the error element renders behind the fullscreen splash - reveal it
    let errorEl = document.getElementById('loading-error');
    if (!errorEl) {
        errorEl = document.createElement('div');
        errorEl.id = 'loading-error';
        errorEl.style.cssText = 'text-align:center;padding:20px;color:#c62828;font-weight:500;';
        const loadingParent = loadingEl ? loadingEl.parentNode : document.querySelector('.products-section .container');
        if (loadingParent) {
            loadingParent.insertBefore(errorEl, loadingEl ? loadingEl.nextSibling : null);
        }
    }
    errorEl.innerHTML = `<p>${message}</p><button onclick="location.reload()" style="margin-top:10px;padding:10px 24px;background:#1a1a1a;color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:14px;min-height:44px;">רענן דף</button>`;
    errorEl.style.display = 'block';
    // Stop loading animation on error
    if (loadingEl) {
        const spinner = loadingEl.querySelector('.loading-logo-spin');
        if (spinner) spinner.style.animationPlayState = 'paused';
        const progress = loadingEl.querySelector('.loading-progress');
        if (progress) progress.style.display = 'none';
    }
}

function hideLoadingError() {
    const errorEl = document.getElementById('loading-error');
    if (errorEl) errorEl.style.display = 'none';
}

function showLoadingHint(message) {
    // Write into the splash slogan only while the splash is actually visible and data
    // hasn't loaded - otherwise the message lands in a hidden element and is never seen
    // (this was why "loaded from cache" / retry hints were invisible on slow loads)
    const splashVisible = loadingEl && !window._splashHidden &&
        loadingEl.style.display !== 'none' && !productsLoaded;
    const loadingSlogan = splashVisible ? loadingEl.querySelector('.loading-slogan') : null;
    if (loadingSlogan) {
        loadingSlogan.textContent = message;
        loadingSlogan.style.opacity = '0.7';
        loadingSlogan.style.animation = 'none';
        return;
    }
    // Fallback: create external hint element
    let hintEl = document.getElementById('loading-hint');
    if (!hintEl) {
        hintEl = document.createElement('div');
        hintEl.id = 'loading-hint';
        hintEl.style.cssText = 'text-align:center;padding:10px;color:#666;font-size:13px;';
        if (loadingEl && loadingEl.parentNode) {
            loadingEl.parentNode.insertBefore(hintEl, loadingEl.nextSibling);
        }
    }
    hintEl.textContent = message;
    hintEl.style.display = 'block';
}

function hideLoadingHint() {
    const hintEl = document.getElementById('loading-hint');
    if (hintEl) hintEl.style.display = 'none';
}

// ===== Show/Hide Loading =====
function showLoading(show) {
    if (!loadingEl) return;
    if (show) {
        window._splashHidden = false;
        loadingEl.style.display = 'flex';
    } else {
        // Data arrived - hide the splash, keeping a short minimum display time
        const MIN_SPLASH_MS = 1200;
        const elapsed = Date.now() - (window._splashShownAt || 0);
        setTimeout(hideSplash, Math.max(0, MIN_SPLASH_MS - elapsed));
    }
}

function hideSplash() {
    if (!loadingEl || window._splashHidden) return;
    window._splashHidden = true;
    loadingEl.classList.add('fade-out');
    setTimeout(() => {
        loadingEl.style.display = 'none';
        loadingEl.classList.remove('fade-out');
    }, 400);
}

// ===== Render Navigation =====
function renderNavigation() {
    const navLinks = categories.map(cat =>
        `<a href="#" class="nav-link" data-category="${cat.id}">${cat.name}</a>`
    ).join('');

    // "מבצעים" appears only when there are products with an active sale
    const hasSales = products.some(p => !p.hidden && hasActiveSale(p));
    const saleLink = hasSales
        ? `<a href="#" class="nav-link nav-sale" data-category="__sale__">🔥 מבצעים</a>`
        : '';

    const linksHtml = `
        <a href="#" class="nav-link active" data-category="all">הכל</a>
        ${saleLink}
        ${navLinks}
        <a href="about.html" class="nav-link nav-about">אודות</a>
    `;
    mainNav.innerHTML = linksHtml;
    mobileNav.innerHTML = linksHtml;

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
        const productCount = products.filter(p => p.categoryId === cat.id && !p.hidden).length;
        return `
            <div class="category-card" data-category="${cat.id}">
                <div class="category-image">
                    <img src="${cat.image || 'images/placeholder.svg'}" alt="${cat.name}" loading="lazy" onerror="this.onerror=null;this.src='images/placeholder.svg'">
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

    // Analytics: which categories people open (once per category per session)
    if (categoryId && categoryId !== '__sale__') {
        logEventOnce('cat:' + categoryId, 'category_view', {
            categoryId: categoryId, categoryName: category ? category.name : ''
        });
    }

    const subs = subcategories.filter(s => s.categoryId === categoryId);
    
    if (subs.length > 0) {
        showSubcategories(categoryId, subs);
    } else {
        showProducts(categoryId, null);
    }
}

// ===== Show Subcategories =====
function showSubcategories(categoryId, subs) {
    showSubcategoriesWithoutHistory(categoryId, subs);
    pushHistoryState('subcategories', categoryId, null);
}

function showSubcategoriesWithoutHistory(categoryId, subs) {
    const category = categories.find(c => c.id === categoryId);
    
    currentView = 'subcategories';
    currentCategoryId = categoryId;
    categoriesSection.style.display = 'none';
    subcategoriesSection.style.display = 'block';
    subcategoriesTitle.textContent = category ? category.name : '';
    
    // Hide products section when showing subcategories
    document.getElementById('products').style.display = 'none';
    
    subcategoriesGrid.innerHTML = subs.map(sub => {
        const productCount = products.filter(p => p.subcategoryId === sub.id && !p.hidden).length;
        return `
            <div class="subcategory-card" data-subcategory="${sub.id}">
                <div class="subcategory-image">
                    <img src="${sub.image || 'images/placeholder.svg'}" alt="${sub.name}" loading="lazy" onerror="this.onerror=null;this.src='images/placeholder.svg'">
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
                <span class="subcategory-count">${products.filter(p => p.categoryId === categoryId && !p.hidden).length} מוצרים</span>
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
    subcategoriesSection.scrollIntoView({ behavior: 'smooth' });
}

// ===== Show Products =====
function showProducts(categoryId, subcategoryId) {
    showProductsWithoutHistory(categoryId, subcategoryId);
    pushHistoryState('products', categoryId, subcategoryId);
}

function showProductsWithoutHistory(categoryId, subcategoryId) {
    currentView = 'products';
    currentCategoryId = categoryId;
    currentSubcategoryId = subcategoryId;
    
    categoriesSection.style.display = 'none';
    subcategoriesSection.style.display = 'none';
    
    // Show products section
    document.getElementById('products').style.display = 'block';
    
    // Hidden products never appear on the public site
    const visible = products.filter(p => !p.hidden);
    let filtered = visible;
    let title = 'כל המוצרים';

    if (categoryId === '__sale__') {
        // Virtual "מבצעים" category - all products with an active sale
        filtered = visible.filter(p => hasActiveSale(p));
        title = 'מבצעים';
        showProductsBackButton(categoryId);
    } else if (categoryId) {
        filtered = visible.filter(p => p.categoryId === categoryId);
        const cat = categories.find(c => c.id === categoryId);
        title = cat ? cat.name : '';

        if (subcategoryId) {
            filtered = filtered.filter(p => p.subcategoryId === subcategoryId);
            const sub = subcategories.find(s => s.id === subcategoryId);
            title = sub ? `${cat ? cat.name + ' - ' : ''}${sub.name}` : title;
        }

        // הצגת כפתור חזרה כשאנחנו בתוך קטגוריה
        showProductsBackButton(categoryId);
    } else {
        hideProductsBackButton();
    }
    
    currentCategoryTitle.textContent = title;
    renderProducts(filtered);
    setActiveNav(categoryId);
}

// ===== Products Back Button =====
function showProductsBackButton(categoryId) {
    const backBtn = document.getElementById('products-back-btn');
    if (backBtn) {
        backBtn.style.display = 'flex';
    }
}

function hideProductsBackButton() {
    const backBtn = document.getElementById('products-back-btn');
    if (backBtn) {
        backBtn.style.display = 'none';
    }
}

// ===== Render Products (Lazy Rendering) =====
function renderProducts(filteredProducts = null) {
    // Default (home "all products") must also exclude hidden products
    currentFilteredProducts = filteredProducts !== null ? filteredProducts : products.filter(p => !p.hidden);
    renderedCount = 0;

    productsGrid.innerHTML = '';
    productsGrid.style.display = 'grid';

    // Disconnect previous observer
    if (scrollObserver) {
        scrollObserver.disconnect();
        scrollObserver = null;
    }

    if (currentFilteredProducts.length === 0) {
        noProducts.style.display = 'block';
        productsGrid.style.display = 'none';
        productsCountEl.textContent = '0';
        return;
    }

    noProducts.style.display = 'none';
    renderNextBatch();
    setupScrollObserver();
}

function renderNextBatch() {
    if (renderedCount >= currentFilteredProducts.length) return;

    const end = Math.min(renderedCount + PRODUCTS_PER_BATCH, currentFilteredProducts.length);

    // Use DocumentFragment to batch DOM insertions (reduces reflows)
    const fragment = document.createDocumentFragment();
    const cardsToInit = [];

    for (let i = renderedCount; i < end; i++) {
        const product = currentFilteredProducts[i];
        const isFavorite = isProductInFavorites(product.id);
        const card = createProductCard(product, isFavorite, true); // skipCarouselInit=true
        fragment.appendChild(card);

        // Collect images for carousel init after DOM insertion
        const images = product.images && product.images.length > 0
            ? product.images
            : (product.image ? [product.image] : ['images/placeholder.svg']);
        if (images.length > 0) {
            cardsToInit.push({ card, images });
        }
    }

    productsGrid.appendChild(fragment);
    renderedCount = end;

    // Initialize all carousels in a single requestAnimationFrame (instead of 20 separate setTimeouts)
    if (cardsToInit.length > 0 && typeof productCarousel !== 'undefined') {
        requestAnimationFrame(() => {
            cardsToInit.forEach(({ card, images }) => {
                productCarousel.initCardCarousel(card, images);
            });
        });
    }

    // Update counter
    if (renderedCount < currentFilteredProducts.length) {
        productsCountEl.textContent = renderedCount + ' מתוך ' + currentFilteredProducts.length;
    } else {
        productsCountEl.textContent = currentFilteredProducts.length;
    }

    // Disconnect observer if all rendered
    if (renderedCount >= currentFilteredProducts.length && scrollObserver) {
        scrollObserver.disconnect();
        scrollObserver = null;
    }
}

function setupScrollObserver() {
    const sentinel = document.getElementById('products-sentinel');
    if (!sentinel) return;

    scrollObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && renderedCount < currentFilteredProducts.length) {
            renderNextBatch();
        }
    }, { rootMargin: '0px 0px 300px 0px' });

    scrollObserver.observe(sentinel);
}

// ===== Create Product Card (עם תמיכה בקרוסלה) =====
// ===== Sale / New helpers =====
function hasActiveSale(product) {
    if (product.hidePrice) return false;
    const sale = Number(product.salePrice);
    const base = Number(product.price);
    // Requires a real discount: a positive base price strictly above a positive sale price
    return product.salePrice != null && product.salePrice !== '' && !isNaN(sale) && sale > 0
        && base > 0 && sale < base;
}

function isNewProduct(product) {
    const ms = product.createdAt?.toMillis?.() || (product.createdAt?.seconds ? product.createdAt.seconds * 1000 : 0);
    if (!ms) return false;
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    return (Date.now() - ms) < THIRTY_DAYS;
}

// Price HTML for cards/modal, honoring hidePrice, active sale, and variant "starting from"
function productPriceHtml(product) {
    if (product.hidePrice) return '<span class="quote-text">קבל הצעת מחיר</span>';
    if (hasActiveSale(product)) {
        return '<span class="price-original">₪' + formatPrice(product.price) + '</span> ' +
               '<span class="price-sale">₪' + formatPrice(product.salePrice) + '</span>';
    }
    return (hasVariantPricing(product) ? 'החל מ-' : '') + '₪' + formatPrice(product.price);
}

function productBadgesHtml(product) {
    let b = '';
    if (hasActiveSale(product)) b += '<span class="product-badge badge-sale">מבצע</span>';
    if (isNewProduct(product)) b += '<span class="product-badge badge-new">חדש</span>';
    return b ? `<div class="product-badges">${b}</div>` : '';
}

function createProductCard(product, isFavorite, skipCarouselInit = false) {
    // תמיכה גם בתמונה בודדת וגם במערך תמונות
    const images = product.images && product.images.length > 0
        ? product.images
        : (product.image ? [product.image] : ['images/placeholder.svg']);

    const card = document.createElement('div');
    card.className = 'product-card';
    // Product identity for the image-failure logger (so a broken image says which product)
    card.dataset.productId = product.id;
    card.dataset.productName = product.name || '';
    if (product.sku) card.dataset.productSku = product.sku;
    const favControl = product.outOfStock
        ? '<div class="out-of-stock-badge">אזל מהמלאי</div>'
        : `<button class="favorite-btn ${isFavorite ? 'active' : ''}" data-id="${product.id}">
            <svg viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
        </button>`;
    card.innerHTML = `
        <div class="product-image">
            <!-- הקרוסלה תיווצר כאן -->
        </div>
        ${productBadgesHtml(product)}
        ${favControl}
        <div class="product-info">
            <h3 class="product-name">${product.name}</h3>
            <p class="product-sku">מק"ט: ${product.sku || '-'}</p>
            ${product.type ? `<p class="product-type">${product.type}</p>` : ''}
            <p class="product-price">${productPriceHtml(product)}</p>
        </div>
    `;

    // אתחול הקרוסלה - רק אם לא נדחה ל-batch init
    if (!skipCarouselInit) {
        requestAnimationFrame(() => {
            if (typeof productCarousel !== 'undefined') {
                productCarousel.initCardCarousel(card, images);
            }
        });
    }

    // לחיצה על הכרטיס פותחת את המודל
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.favorite-btn') && !e.target.closest('.carousel-arrow')) {
            openProductModal(product);
        }
    });

    // כפתור מועדפים (לא קיים אם המוצר אזל מהמלאי)
    const favoriteBtn = card.querySelector('.favorite-btn');
    if (favoriteBtn) {
        favoriteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(product.id, favoriteBtn, product);
        });
    }

    return card;
}

// ===== Colors Label Helper =====
function getProductColorsLabel(product, form) {
    // form: 'singular' = צבע/זכוכית, 'plural' = צבעים זמינים/זכוכיות זמינות, 'select' = בחר צבע/בחר זכוכית
    const label = product.colorsLabel || 'צבע';
    if (form === 'plural') return label === 'זכוכית' ? 'זכוכיות זמינות' : 'צבעים זמינים';
    if (form === 'select') return 'בחר ' + label + ':';
    return label;
}

// ===== Variant Pricing Helpers =====
function hasVariantPricing(product) {
    if (product.variantPrices && product.variantPrices.length > 1 && new Set(product.variantPrices.map(v => v.price)).size > 1) return true;
    if (product.sizesPrices && product.sizesPrices.length > 1 && new Set(product.sizesPrices.map(sp => sp.price)).size > 1) return true;
    if (product.colorsPrices && product.colorsPrices.length > 1 && new Set(product.colorsPrices.map(cp => cp.price)).size > 1) return true;
    return false;
}

function updateModalPrice(product) {
    const priceEl = document.getElementById('modal-dynamic-price');
    if (!priceEl) return;
    if (product.hidePrice) return;

    const selectedSizeEl = document.querySelector('#modal-content .size-option.active');
    const selectedColorEl = document.querySelector('#modal-content .color-option.active');
    const selectedSize = selectedSizeEl ? selectedSizeEl.dataset.size : null;
    const selectedColor = selectedColorEl ? selectedColorEl.dataset.color : null;

    const hasVariants = product.variantPrices && product.variantPrices.length > 0;

    // Priority 1: variantPrices (size+color combination) - requires both dimensions
    if (selectedSize && selectedColor && hasVariants) {
        const variant = product.variantPrices.find(v => v.size === selectedSize && v.color === selectedColor);
        if (variant) {
            priceEl.innerHTML = '₪' + formatPrice(variant.price);
            return;
        }
    }

    // When product has variant pricing, show hint for missing dimension
    if (hasVariants) {
        if (selectedSize && !selectedColor) {
            const colorLabel = getProductColorsLabel(product, 'singular');
            priceEl.innerHTML = '<span class="price-hint">בחר גם ' + colorLabel + ' לצפייה במחיר</span>';
            return;
        }
        if (!selectedSize && selectedColor) {
            priceEl.innerHTML = '<span class="price-hint">בחר גם מידה לצפייה במחיר</span>';
            return;
        }
    }

    // When no variant pricing, use individual size/color prices
    if (!hasVariants) {
        // Priority 2: sizesPrices
        if (selectedSize && product.sizesPrices && product.sizesPrices.length > 0) {
            const sp = product.sizesPrices.find(sp => sp.size === selectedSize);
            if (sp) {
                priceEl.innerHTML = '₪' + formatPrice(sp.price);
                return;
            }
        }

        // Priority 3: colorsPrices
        if (selectedColor && product.colorsPrices && product.colorsPrices.length > 0) {
            const cp = product.colorsPrices.find(cp => cp.color === selectedColor);
            if (cp) {
                priceEl.innerHTML = '₪' + formatPrice(cp.price);
                return;
            }
        }
    }

    // Fallback: base price (honor an active sale when there's no variant pricing)
    if (hasVariantPricing(product)) {
        priceEl.innerHTML = '<span class="price-prefix">החל מ-</span>₪' + formatPrice(product.price);
    } else if (hasActiveSale(product)) {
        priceEl.innerHTML = '<span class="price-original">₪' + formatPrice(product.price) + '</span> ' +
                            '<span class="price-sale">₪' + formatPrice(product.salePrice) + '</span>';
    } else {
        priceEl.innerHTML = '₪' + formatPrice(product.price);
    }
}

function getResolvedPrice(product, selectedSize, selectedColor) {
    const hasVariants = product.variantPrices && product.variantPrices.length > 0;
    // Priority 1: variantPrices (size+color combination)
    if (selectedSize && selectedColor && hasVariants) {
        const variant = product.variantPrices.find(v => v.size === selectedSize && v.color === selectedColor);
        if (variant) return variant.price;
    }
    // When product has variant pricing, skip individual size/color price fallbacks
    if (!hasVariants) {
        // Priority 2: sizesPrices
        if (selectedSize && product.sizesPrices && product.sizesPrices.length > 0) {
            const sp = product.sizesPrices.find(sp => sp.size === selectedSize);
            if (sp) return sp.price;
        }
        // Priority 3: colorsPrices
        if (selectedColor && product.colorsPrices && product.colorsPrices.length > 0) {
            const cp = product.colorsPrices.find(cp => cp.color === selectedColor);
            if (cp) return cp.price;
        }
    }
    // Fallback: base price (or the sale price when a sale is active)
    if (hasActiveSale(product)) return Number(product.salePrice);
    return product.price || 0;
}

// Consistent price display everywhere: "1,234" (handles numbers and numeric strings)
function formatPrice(p) {
    return (Number(p) || 0).toLocaleString('he-IL');
}

// ===== Product Modal (עם תמיכה בקרוסלה ו-Lightbox) =====
function openProductModal(product) {
    const cat = categories.find(c => c.id === product.categoryId);
    const sub = subcategories.find(s => s.id === product.subcategoryId);
    const isFavorite = isProductInFavorites(product.id);

    // Analytics: which products get looked at (once per product per session)
    logEventOnce('view:' + product.id, 'product_view', {
        productId: product.id, productName: product.name,
        categoryId: product.categoryId, categoryName: cat ? cat.name : ''
    });
    
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
                <h2 class="modal-product-name">${product.name}${isNewProduct(product) ? ' <span class="product-badge badge-new">חדש</span>' : ''}${hasActiveSale(product) ? ' <span class="product-badge badge-sale">מבצע</span>' : ''}</h2>
                <p class="modal-product-sku">מק"ט: ${product.sku || '-'}</p>
                ${product.type ? `<p class="modal-product-type">${product.type}</p>` : ''}
                ${product.outOfStock ? '<p class="modal-out-of-stock">אזל מהמלאי — ניתן לפנות אלינו לבירור זמינות</p>' : ''}
                ${product.description ? `<p class="modal-product-description">${product.description}</p>` : ''}
                <div class="modal-product-price" id="modal-dynamic-price">
                    ${productPriceHtml(product)}
                </div>

                ${product.sizes && product.sizes.length > 0 ? `
                    <div class="modal-product-sizes">
                        <strong>מידות זמינות:</strong>
                        <div class="size-options">
                            ${product.sizes.map(s => {
                                const sp = product.sizesPrices && product.sizesPrices.find(sp => sp.size === s);
                                const hasVariant = product.variantPrices && product.variantPrices.some(v => v.size === s);
                                return `<span class="size-option ${(sp || hasVariant) ? 'has-price' : ''}" data-size="${s}" ${sp ? `data-price="${sp.price}"` : ''}>${s}</span>`;
                            }).join('')}
                        </div>
                    </div>
                ` : ''}

                ${product.colors && product.colors.length > 0 ? `
                    <div class="modal-product-colors">
                        <strong>${getProductColorsLabel(product, 'plural')}:</strong>
                        <div class="color-options">
                            ${product.colors.map(c => {
                                const cp = product.colorsPrices && product.colorsPrices.find(cp => cp.color === c);
                                const hasVariant = product.variantPrices && product.variantPrices.some(v => v.color === c);
                                return `<span class="color-option ${(cp || hasVariant) ? 'has-price' : ''}" data-color="${c}" ${cp ? `data-price="${cp.price}"` : ''}>${c}</span>`;
                            }).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${product.outOfStock
                    ? '<button class="modal-favorite-btn" disabled style="opacity:0.6;cursor:not-allowed;">אזל מהמלאי</button>'
                    : `<button class="modal-favorite-btn ${isFavorite ? 'active' : ''}" data-id="${product.id}">
                    <svg viewBox="0 0 24 24">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                    ${isFavorite ? 'הסר מהמועדפים' : 'הוסף למועדפים'}
                </button>`}
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
    
    // Size option click handlers - unified price update
    const allSizeOptions = modalContent.querySelectorAll('.size-option');
    allSizeOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            allSizeOptions.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            updateModalPrice(product);
        });
    });

    // Color option click handlers - unified price update
    const allColorOptions = modalContent.querySelectorAll('.color-option');
    allColorOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            allColorOptions.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            updateModalPrice(product);
        });
    });

    // כפתור מועדפים במודל (מושבת אם המוצר אזל מהמלאי)
    const modalFavBtn = modalContent.querySelector('.modal-favorite-btn');
    if (modalFavBtn && !product.outOfStock) modalFavBtn.addEventListener('click', () => {
        const wasInFavorites = isProductInFavorites(product.id);
        toggleFavorite(product.id, modalFavBtn, product);
        const isNowFavorite = isProductInFavorites(product.id);
        
        // אם המוצר נוסף (ולא נפתח selection modal) - הצג אנימציה וסגור
        if (!wasInFavorites && isNowFavorite) {
            showAddedToFavoritesAnimation(() => {
                closeProductModal();
            });
            return;
        }
        
        // אם נפתח selection modal, לא לעשות כלום כאן
        if (!wasInFavorites && !isNowFavorite) {
            return;
        }
        
        // אם המוצר הוסר - עדכן את הכפתור
        modalFavBtn.innerHTML = `
            <svg viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
            ${isNowFavorite ? 'הסר מהמועדפים' : 'הוסף למועדפים'}
        `;
        modalFavBtn.classList.toggle('active', isNowFavorite);
    });
    
    productModal.classList.add('active');
    // Lock body scroll - improved for mobile
    document.body.dataset.scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${window.scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
}

function closeProductModal() {
    productModal.classList.remove('active');
    // Restore body scroll - scrollTo BEFORE removing fixed to prevent jump
    const scrollY = parseInt(document.body.dataset.scrollY || '0');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    window.scrollTo({ top: scrollY, behavior: 'instant' });
}

// ===== Event Listeners =====
function setupEventListeners() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', handleNavClick);
    });
    
    backToCategories.addEventListener('click', () => {
        showCategoriesView();
        pushHistoryState('categories');
    });
    
    // כפתור חזרה בדף המוצרים
    const productsBackBtn = document.getElementById('products-back-btn');
    if (productsBackBtn) {
        productsBackBtn.addEventListener('click', () => {
            // בדיקה אם יש תתי-קטגוריות לקטגוריה הנוכחית
            const subs = subcategories.filter(s => s.categoryId === currentCategoryId);
            if (subs.length > 0) {
                // חזרה לתתי-קטגוריות
                showSubcategories(currentCategoryId, subs);
            } else {
                // חזרה לקטגוריות הראשיות
                showCategoriesView();
                pushHistoryState('categories');
            }
        });
    }
    
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

    // Escape key closes modals (priority: lightbox > selection modal > product modal > favorites)
    // When the lightbox is open its own handler (createLightbox) closes it - one Escape,
    // one layer. Without this check a single Escape closed the product modal underneath too.
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const lightboxEl = document.getElementById('image-lightbox');
        if (lightboxEl && lightboxEl.classList.contains('active')) return;
        const selectionModal = document.getElementById('selection-modal');
        if (selectionModal && selectionModal.classList.contains('active')) {
            closeSelectionModal();
        } else if (productModal.classList.contains('active')) {
            closeProductModal();
        } else if (favoritesPanel.classList.contains('active')) {
            closeFavoritesPanel();
        }
    });
}

// ===== Handle Navigation Click =====
function handleNavClick(e) {
    e.preventDefault();
    const categoryId = e.target.dataset.category;
    
    closeMobileMenu();
    
    if (categoryId === 'all') {
        showCategoriesView();
        pushHistoryState('categories');
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
    // Lock body scroll - improved for mobile
    document.body.dataset.scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${window.scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
}

function closeFavoritesPanel() {
    favoritesPanel.classList.remove('active');
    overlay.classList.remove('active');
    // Restore body scroll
    const scrollY = document.body.dataset.scrollY || '0';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    window.scrollTo({ top: parseInt(scrollY), behavior: 'instant' });
}

function renderFavoritesList() {
    favoritesList.innerHTML = '';

    let total = 0;
    let hasPricedItems = false;

    favorites.forEach(fav => {
        const product = products.find(p => p.id === fav.id);
        // Skip products that were deleted or hidden after being favorited
        if (!product || product.hidden) return;

        const qty = Math.max(1, parseInt(fav.quantity) || 1);

        // תמיכה בתמונה הראשונה מהמערך
        const firstImage = product.images && product.images.length > 0
            ? product.images[0]
            : (product.image || 'images/placeholder.svg');

        // Build selection info
        let selectionInfo = '';
        if (fav.selectedSize || fav.selectedColor) {
            const parts = [];
            if (fav.selectedSize) parts.push(`מידה: ${fav.selectedSize}`);
            if (fav.selectedColor) parts.push(`${getProductColorsLabel(product, 'singular')}: ${fav.selectedColor}`);
            selectionInfo = `<div class="favorite-item-selection">${parts.join(' | ')}</div>`;
        }

        if (!product.hidePrice) {
            total += (Number(getResolvedPrice(product, fav.selectedSize, fav.selectedColor)) || 0) * qty;
            hasPricedItems = true;
        }

        const item = document.createElement('div');
        item.className = 'favorite-item';
        item.innerHTML = `
            <div class="favorite-item-image">
                <img src="${firstImage}" alt="${product.name}" onerror="this.onerror=null;this.src='images/placeholder.svg'">
            </div>
            <div class="favorite-item-info">
                <div class="favorite-item-name">${product.name}</div>
                <div class="favorite-item-sku">מק"ט: ${product.sku || '-'}</div>
                ${selectionInfo}
                <div class="favorite-item-price">${product.hidePrice ? '<span class="quote-text">קבל הצעת מחיר</span>' : '₪' + formatPrice(getResolvedPrice(product, fav.selectedSize, fav.selectedColor))}</div>
                <div class="favorite-item-qty">
                    <button type="button" class="qty-btn qty-minus" aria-label="הפחת כמות">−</button>
                    <span class="qty-value">${qty}</span>
                    <button type="button" class="qty-btn qty-plus" aria-label="הוסף כמות">+</button>
                </div>
            </div>
            <button class="favorite-item-remove" data-id="${product.id}" aria-label="הסר מהמועדפים">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;

        item.querySelector('.favorite-item-remove').addEventListener('click', () => {
            removeFromFavorites(product.id, null);
        });
        item.querySelector('.qty-minus').addEventListener('click', () => changeFavoriteQty(product.id, -1));
        item.querySelector('.qty-plus').addEventListener('click', () => changeFavoriteQty(product.id, 1));

        favoritesList.appendChild(item);
    });

    // Total estimate line (only when there are priced items)
    if (hasPricedItems) {
        const totalEl = document.createElement('div');
        totalEl.className = 'favorites-total';
        totalEl.innerHTML = `<span>הערכת סה"כ:</span> <strong>₪${formatPrice(total)}</strong>`;
        favoritesList.appendChild(totalEl);
    }

    updateFavoritesCount();
}

// Change quantity of a favorite entry (min 1). Removing is via the × button.
function changeFavoriteQty(productId, delta) {
    const fav = favorites.find(f => f.id === productId);
    if (!fav) return;
    fav.quantity = Math.max(1, (parseInt(fav.quantity) || 1) + delta);
    safeSetStorage('glasseria_favorites', JSON.stringify(favorites));
    renderFavoritesList();
}

function clearFavorites() {
    favorites = [];
    safeSetStorage('glasseria_favorites', JSON.stringify(favorites));
    
    document.querySelectorAll('.favorite-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    renderFavoritesList();
}

// Safe accessors for the persisted session/device ids (guard if logger failed to load)
function getSessionId() {
    try { return (typeof GlasseriaLogger !== 'undefined' && GlasseriaLogger.getSessionId()) || ''; }
    catch (e) { return ''; }
}
function getDeviceId() {
    try { return (typeof GlasseriaLogger !== 'undefined' && GlasseriaLogger.getDeviceId()) || ''; }
    catch (e) { return ''; }
}

// Per-session dedup so browsing doesn't flood the events collection
const _loggedEventKeys = new Set();
function logEventOnce(key, type, ctx) {
    if (_loggedEventKeys.has(key)) return;
    _loggedEventKeys.add(key);
    logEvent(type, ctx);
}

// Fire-and-forget analytics event. Never blocks the UI; matches the hardened
// glasseria_events rule shape exactly (createdAt = serverTimestamp).
function logEvent(type, ctx = {}) {
    try {
        if (typeof eventsCollection === 'undefined') return;
        const doc = {
            type: String(type).slice(0, 40),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            sessionId: getSessionId(),
            deviceId: getDeviceId()
        };
        if (ctx.productId) doc.productId = String(ctx.productId);
        if (ctx.productName) doc.productName = String(ctx.productName).slice(0, 300);
        if (ctx.categoryId) doc.categoryId = String(ctx.categoryId);
        if (ctx.categoryName) doc.categoryName = String(ctx.categoryName).slice(0, 300);
        if (typeof ctx.value === 'number') doc.value = ctx.value;
        eventsCollection.add(doc).catch(() => {});
    } catch (e) { /* analytics must never break the site */ }
}

function sendToWhatsApp() {
    if (favorites.length === 0) {
        alert('נא לבחור מוצרים לפני שליחה');
        return;
    }

    let message = 'שלום, אני מעוניין במוצרים הבאים:\n\n';
    const items = [];
    let totalValue = 0;

    let lineNo = 0;
    favorites.forEach((fav) => {
        const product = products.find(p => p.id === fav.id);
        // Skip deleted or hidden products so they don't appear in the quote
        if (!product || product.hidden) return;
        lineNo++;

        const qty = Math.max(1, parseInt(fav.quantity) || 1);
        const cat = categories.find(c => c.id === product.categoryId);
        message += `${lineNo}. ${product.name}${qty > 1 ? ` ×${qty}` : ''}\n`;
        message += `   מק"ט: ${product.sku || '-'}\n`;
        if (cat) message += `   קטגוריה: ${cat.name}\n`;

        // Add selected size and color
        if (fav.selectedSize) {
            message += `   מידה: ${fav.selectedSize}\n`;
        }
        if (fav.selectedColor) {
            message += `   ${getProductColorsLabel(product, 'singular')}: ${fav.selectedColor}\n`;
        }

        let itemPrice = 0;
        if (product.hidePrice) {
            message += `   מחיר: קבל הצעת מחיר\n\n`;
        } else {
            itemPrice = getResolvedPrice(product, fav.selectedSize, fav.selectedColor);
            totalValue += (Number(itemPrice) || 0) * qty;
            const lineTotal = (Number(itemPrice) || 0) * qty;
            message += `   מחיר: ₪${formatPrice(itemPrice)}${qty > 1 ? ` (סה"כ ₪${formatPrice(lineTotal)})` : ''}\n\n`;
        }

        items.push({
            name: product.name || '',
            sku: product.sku || '',
            size: fav.selectedSize || '',
            color: fav.selectedColor || '',
            price: product.hidePrice ? null : (Number(itemPrice) || 0),
            quantity: qty
        });
    });

    if (items.length === 0) {
        alert('נא לבחור מוצרים לפני שליחה');
        return;
    }

    // Estimated total (only if there was at least one priced item)
    if (totalValue > 0) {
        message += `הערכת סה"כ: ₪${formatPrice(totalValue)}\n\n`;
    }

    // Customer-details template - saves the first back-and-forth when quoting
    message += 'כדי לזרז את ההצעה, אשמח למלא:\n';
    message += 'שם: \n';
    message += 'עיר: \n';
    message += 'מתי הפרויקט: \n\n';
    message += 'תודה!';

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;

    // Open WhatsApp first - the send must never be blocked by logging
    window.open(whatsappUrl, '_blank');

    // Record the inquiry for the business (fire-and-forget). Shape matches the
    // hardened glasseria_inquiries rule.
    try {
        if (typeof inquiriesCollection !== 'undefined') {
            // Cap items to satisfy the hardened rule (items.size() <= 200) even for an
            // unrealistically large favorites list
            const cappedItems = items.slice(0, 200);
            inquiriesCollection.add({
                items: cappedItems,
                itemCount: cappedItems.length,
                totalValue,
                status: 'new',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                sessionId: getSessionId(),
                deviceId: getDeviceId(),
                page: 'catalog'
            }).catch(() => {});
        }
    } catch (e) { /* inquiry logging must never break the send */ }

    logEvent('whatsapp_send', { value: items.length });
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
const _headerEl = document.querySelector('.header'); // Cache outside handler
window.addEventListener('scroll', () => {
    if (!_headerEl) return;
    if (window.pageYOffset > 100) {
        _headerEl.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
    } else {
        _headerEl.style.boxShadow = 'none';
    }
}, { passive: true });

// ===== Welcome Popup (פעם אחת בסשן בלבד) =====
function setupWelcomePopup() {
    const welcomePopup = document.getElementById('welcome-popup');
    const welcomeCloseBtn = document.getElementById('welcome-close');
    const dontShowAgain = document.getElementById('dont-show-again');
    
    // הפופאפ יופיע אחרי שהספלאש נעלם (3.2s + 0.5s)
    if (!safeGetStorage('glasseria_welcome_dismissed') && !safeGetStorage('glasseria_welcome_shown', true)) {
        setTimeout(() => {
            welcomePopup.classList.add('active');
            safeSetStorage('glasseria_welcome_shown', 'true', true);
        }, 3700);
    }
    
    welcomeCloseBtn.addEventListener('click', () => {
        // אם המשתמש סימן "אל תציג שוב" - שומר ב-localStorage לצמיתות
        if (dontShowAgain.checked) {
            safeSetStorage('glasseria_welcome_dismissed', 'true');
        }
        welcomePopup.classList.remove('active');
    });

    welcomePopup.addEventListener('click', (e) => {
        if (e.target === welcomePopup) {
            if (dontShowAgain.checked) {
                safeSetStorage('glasseria_welcome_dismissed', 'true');
            }
            welcomePopup.classList.remove('active');
        }
    });
}
