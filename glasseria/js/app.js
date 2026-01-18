// ===== Glasseria Catalog App with Dynamic Categories =====

// WhatsApp Number
const WHATSAPP_NUMBER = '972524048371';

// State
let categories = [];
let subcategories = [];
let products = [];
let favorites = JSON.parse(localStorage.getItem('glasseria_favorites')) || [];
let currentView = 'categories'; // 'categories', 'subcategories', 'products'
let currentCategoryId = null;
let currentSubcategoryId = null;

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
});

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
            
            renderCategories(); // Update category counts
    renderProducts(); // Always render products
            
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
    
    // Update main nav
    mainNav.innerHTML = `
        <a href="#" class="nav-link active" data-category="all">הכל</a>
        ${navLinks}
    `;
    
    // Update mobile nav
    mobileNav.innerHTML = `
        <a href="#" class="nav-link active" data-category="all">הכל</a>
        ${navLinks}
    `;
    
    // Re-attach event listeners
    document.querySelectorAll('.nav-link').forEach(link => {
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
    
    // Attach click events
    document.querySelectorAll('.category-card').forEach(card => {
        card.addEventListener('click', () => handleCategoryClick(card.dataset.category));
    });
}

// ===== Handle Category Click =====
function handleCategoryClick(categoryId) {
    currentCategoryId = categoryId;
    const category = categories.find(c => c.id === categoryId);
    
    // Check if category has subcategories
    const subs = subcategories.filter(s => s.categoryId === categoryId);
    
    if (subs.length > 0) {
        // Show subcategories
        showSubcategories(categoryId, subs);
    } else {
        // Show products directly
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
    
    // Add "All in category" option
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
    
    // Attach click events
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
    
    // Update navigation
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
            const isFavorite = favorites.includes(product.id);
            const card = createProductCard(product, isFavorite);
            productsGrid.appendChild(card);
        });
    }
    
    productsCountEl.textContent = productsToShow.length;
}

// ===== Create Product Card =====
function createProductCard(product, isFavorite) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
        <div class="product-image">
            <img src="${product.image || 'images/placeholder.svg'}" alt="${product.name}" onerror="this.src='images/placeholder.svg'">
            <button class="favorite-btn ${isFavorite ? 'active' : ''}" data-id="${product.id}">
                <svg viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
            </button>
        </div>
        <div class="product-info">
            <h3 class="product-name">${product.name}</h3>
            <p class="product-sku">מק"ט: ${product.sku || '-'}</p>
            ${product.type ? `<p class="product-type">${product.type}</p>` : ''}
            <p class="product-price">₪${product.price || '0'}</p>
        </div>
    `;
    
    // Click on card to open modal
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.favorite-btn')) {
            openProductModal(product);
        }
    });
    
    // Favorite button
    const favoriteBtn = card.querySelector('.favorite-btn');
    favoriteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(product.id, favoriteBtn);
    });
    
    return card;
}

// ===== Product Modal =====
function openProductModal(product) {
    const cat = categories.find(c => c.id === product.categoryId);
    const sub = subcategories.find(s => s.id === product.subcategoryId);
    const isFavorite = favorites.includes(product.id);
    
    modalContent.innerHTML = `
        <div class="modal-product">
            <div class="modal-product-image">
                <img src="${product.image || 'images/placeholder.svg'}" alt="${product.name}" onerror="this.src='images/placeholder.svg'">
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
    
    // Favorite button in modal
    const modalFavBtn = modalContent.querySelector('.modal-favorite-btn');
    modalFavBtn.addEventListener('click', () => {
        toggleFavorite(product.id, modalFavBtn);
        // Update text
        const isNowFavorite = favorites.includes(product.id);
        modalFavBtn.innerHTML = `
            <svg viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
            ${isNowFavorite ? 'הסר מהמועדפים' : 'הוסף למועדפים'}
        `;
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
    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', handleNavClick);
    });
    
    // Back to categories
    backToCategories.addEventListener('click', () => {
        currentView = 'categories';
        categoriesSection.style.display = 'block';
        subcategoriesSection.style.display = 'none';
        currentCategoryTitle.textContent = 'כל המוצרים';
        renderProducts();
        setActiveNav('all');
    });
    
    // Favorites
    favoritesBtn.addEventListener('click', openFavoritesPanel);
    closePanel.addEventListener('click', closeFavoritesPanel);
    overlay.addEventListener('click', closeFavoritesPanel);
    btnClear.addEventListener('click', clearFavorites);
    btnWhatsapp.addEventListener('click', sendToWhatsApp);
    
    // Mobile menu
    mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    
    // Product modal
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
        // Show all
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
function toggleFavorite(productId, button) {
    const index = favorites.indexOf(productId);
    
    if (index === -1) {
        favorites.push(productId);
        button.classList.add('active');
    } else {
        favorites.splice(index, 1);
        button.classList.remove('active');
    }
    
    localStorage.setItem('glasseria_favorites', JSON.stringify(favorites));
    updateFavoritesCount();
    renderFavoritesList();
    
    // Update product card if visible
    const cardBtn = document.querySelector(`.product-card .favorite-btn[data-id="${productId}"]`);
    if (cardBtn && cardBtn !== button) {
        cardBtn.classList.toggle('active', favorites.includes(productId));
    }
}

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
    
    const favoriteProducts = products.filter(p => favorites.includes(p.id));
    
    favoriteProducts.forEach(product => {
        const item = document.createElement('div');
        item.className = 'favorite-item';
        item.innerHTML = `
            <div class="favorite-item-image">
                <img src="${product.image || 'images/placeholder.svg'}" alt="${product.name}" onerror="this.src='images/placeholder.svg'">
            </div>
            <div class="favorite-item-info">
                <div class="favorite-item-name">${product.name}</div>
                <div class="favorite-item-sku">מק"ט: ${product.sku || '-'}</div>
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
            toggleFavorite(product.id, removeBtn);
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
    
    const favoriteProducts = products.filter(p => favorites.includes(p.id));
    
    let message = 'שלום, אני מעוניין במוצרים הבאים:\n\n';
    
    favoriteProducts.forEach((product, index) => {
        const cat = categories.find(c => c.id === product.categoryId);
        message += `${index + 1}. ${product.name}\n`;
        message += `   מק"ט: ${product.sku || '-'}\n`;
        if (cat) message += `   קטגוריה: ${cat.name}\n`;
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

// ===== Welcome Popup =====
function setupWelcomePopup() {
    const welcomePopup = document.getElementById('welcome-popup');
    const welcomeCloseBtn = document.getElementById('welcome-close');
    const dontShowAgain = document.getElementById('dont-show-again');
    
    if (!localStorage.getItem('glasseria_welcome_dismissed')) {
        setTimeout(() => {
            welcomePopup.classList.add('active');
        }, 500);
    }
    
    welcomeCloseBtn.addEventListener('click', () => {
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
