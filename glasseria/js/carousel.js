// ===== Product Image Carousel System =====
// Supports multiple images per product with swipe on mobile and arrows on desktop

class ProductCarousel {
    constructor() {
        this.carousels = new Map(); // Store carousel states
        this.isMobile = this.checkMobile();
        
        // Listen for window resize
        window.addEventListener('resize', () => {
            this.isMobile = this.checkMobile();
        });
    }
    
    checkMobile() {
        return window.matchMedia('(hover: none) and (pointer: coarse)').matches || window.innerWidth <= 768;
    }
    
    // Initialize a product card carousel
    initCardCarousel(productCard, images) {
        if (!images || images.length === 0) return;
        
        const container = productCard.querySelector('.product-image');
        if (!container) return;
        
        // Create carousel HTML
        const carouselHTML = this.createCarouselHTML(images, 'card');
        container.innerHTML = carouselHTML;
        
        // Add has-multiple class if more than 1 image
        if (images.length > 1) {
            container.classList.add('has-multiple');
            this.setupCarouselEvents(container, images.length, 'card');
        }
    }
    
    // Initialize modal carousel
    initModalCarousel(modalElement, images) {
        if (!images || images.length === 0) return;
        
        const container = modalElement.querySelector('.modal-product-image');
        if (!container) return;
        
        // Create carousel HTML
        const carouselHTML = this.createCarouselHTML(images, 'modal');
        container.innerHTML = carouselHTML;
        
        // Add has-multiple class if more than 1 image
        if (images.length > 1) {
            container.classList.add('has-multiple');
            this.setupCarouselEvents(container, images.length, 'modal');
        } else {
            container.classList.remove('has-multiple');
        }
    }
    
    createCarouselHTML(images, type) {
        const isModal = type === 'modal';
        const slideClass = isModal ? 'modal-image-slide' : 'product-image-slide';
        const carouselClass = isModal ? 'modal-image-carousel' : 'product-image-carousel';
        const arrowClass = isModal ? 'modal-carousel-arrow' : 'carousel-arrow';
        const dotsClass = isModal ? 'modal-carousel-dots' : 'carousel-dots';
        const dotClass = isModal ? 'modal-carousel-dot' : 'carousel-dot';
        
        // Create slides
        const slides = images.map((img, index) => `
            <div class="${slideClass}" data-index="${index}">
                <img src="${img}" alt="×ª×ž×•× ×ª ×ž×•×¦×¨ ${index + 1}" loading="lazy">
            </div>
        `).join('');
        
        // Create dots
        const dots = images.length > 1 ? images.map((_, index) => `
            <button class="${dotClass}${index === 0 ? ' active' : ''}" data-index="${index}"></button>
        `).join('') : '';
        
        // Create arrows (only for multiple images)
        const arrows = images.length > 1 ? `
            <button class="${arrowClass} prev" aria-label="×ª×ž×•× ×” ×§×•×“×ž×ª">
                <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
            <button class="${arrowClass} next" aria-label="×ª×ž×•× ×” ×”×‘××”">
                <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
        ` : '';
        
        return `
            <div class="${carouselClass}" data-current="0">
                ${slides}
            </div>
            ${arrows}
            <div class="${dotsClass}">
                ${dots}
            </div>
        `;
    }
    
    setupCarouselEvents(container, totalSlides, type) {
        const isModal = type === 'modal';
        const carouselClass = isModal ? '.modal-image-carousel' : '.product-image-carousel';
        const arrowClass = isModal ? '.modal-carousel-arrow' : '.carousel-arrow';
        const dotClass = isModal ? '.modal-carousel-dot' : '.carousel-dot';
        
        const carousel = container.querySelector(carouselClass);
        const prevBtn = container.querySelector(`${arrowClass}.prev`);
        const nextBtn = container.querySelector(`${arrowClass}.next`);
        const dots = container.querySelectorAll(dotClass);
        
        let currentIndex = 0;
        
        // Update carousel position
        const updateCarousel = (index) => {
            currentIndex = index;
            
            if (this.isMobile) {
                // On mobile, use scroll
                const slide = carousel.children[index];
                if (slide) {
                    slide.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
                }
            } else {
                // On desktop, use transform (positive for RTL direction)
                carousel.style.transform = `translateX(${index * 100}%)`;
            }
            
            // Update dots
            dots.forEach((dot, i) => {
                dot.classList.toggle('active', i === index);
            });
            
            carousel.dataset.current = index;
        };
        
        // Arrow click handlers - RTL: right arrow (prev) goes forward, left arrow (next) goes backward
        if (prevBtn) {
            prevBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const newIndex = (currentIndex + 1) % totalSlides;
                updateCarousel(newIndex);
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const newIndex = (currentIndex - 1 + totalSlides) % totalSlides;
                updateCarousel(newIndex);
            });
        }
        
        // Dot click handlers
        dots.forEach((dot, index) => {
            dot.addEventListener('click', (e) => {
                e.stopPropagation();
                updateCarousel(index);
            });
        });
        
        // Mobile swipe support using scroll
        if (this.isMobile) {
            let scrollTimeout;
            carousel.addEventListener('scroll', () => {
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(() => {
                    const scrollLeft = carousel.scrollLeft;
                    const slideWidth = carousel.offsetWidth;
                    const newIndex = Math.round(scrollLeft / slideWidth);
                    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < totalSlides) {
                        currentIndex = newIndex;
                        dots.forEach((dot, i) => {
                            dot.classList.toggle('active', i === currentIndex);
                        });
                        carousel.dataset.current = currentIndex;
                    }
                }, 50);
            });
        }
        
        // Touch swipe support for non-scrollable carousels
        let touchStartX = 0;
        let touchEndX = 0;
        
        carousel.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });
        
        carousel.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, { passive: true });
        
        const handleSwipe = () => {
            const swipeThreshold = 50;
            const diff = touchStartX - touchEndX;
            
            if (Math.abs(diff) > swipeThreshold) {
                if (diff > 0) {
                    // Swipe left in RTL - go to next image
                    const newIndex = (currentIndex + 1) % totalSlides;
                    updateCarousel(newIndex);
                } else {
                    // Swipe right in RTL - go to previous image
                    const newIndex = (currentIndex - 1 + totalSlides) % totalSlides;
                    updateCarousel(newIndex);
                }
            }
        };
    }
}

// Global carousel instance
const productCarousel = new ProductCarousel();

// ===== Integration with existing app.js =====

// Helper function to render product card with carousel
function renderProductCardWithCarousel(product) {
    // Get images array - support both single image and multiple images
    const images = product.images && product.images.length > 0 
        ? product.images 
        : (product.image ? [product.image] : ['images/placeholder.svg']);
    
    const card = document.createElement('div');
    card.className = 'product-card';
    card.dataset.id = product.id;
    
    card.innerHTML = `
        <div class="product-image">
            <!-- Carousel will be initialized here -->
        </div>
        <button class="favorite-btn" data-id="${product.id}">
            <svg viewBox="0 0 24 24">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
        </button>
        <div class="product-info">
            <h3 class="product-name">${product.name || '×œ×œ× ×©×'}</h3>
            <p class="product-sku">×ž×§"×˜: ${product.sku || '-'}</p>
            ${product.type ? `<p class="product-type">${product.type}</p>` : ''}
            <p class="product-price">${product.price ? product.price.toLocaleString() + ' â‚ª' : '×¦×•×¨ ×§×©×¨'}</p>
        </div>
    `;
    
    // Initialize carousel after adding to DOM
    setTimeout(() => {
        productCarousel.initCardCarousel(card, images);
    }, 0);
    
    return card;
}

// Helper function to open modal with carousel
function openProductModalWithCarousel(product) {
    // Get images array
    const images = product.images && product.images.length > 0 
        ? product.images 
        : (product.image ? [product.image] : ['images/placeholder.svg']);
    
    const modal = document.querySelector('.product-modal');
    if (!modal) return;
    
    // Update modal content
    modal.querySelector('.modal-product-category').textContent = product.category || '';
    modal.querySelector('.modal-product-name').textContent = product.name || '×œ×œ× ×©×';
    modal.querySelector('.modal-product-sku').textContent = `×ž×§"×˜: ${product.sku || '-'}`;
    modal.querySelector('.modal-product-type').textContent = product.type || '';
    modal.querySelector('.modal-product-description').textContent = product.description || '';
    modal.querySelector('.modal-product-price').textContent = product.price ? product.price.toLocaleString() + ' â‚ª' : '×¦×•×¨ ×§×©×¨';
    
    // Update sizes
    const sizesContainer = modal.querySelector('.size-options');
    if (sizesContainer) {
        sizesContainer.innerHTML = (product.sizes || []).map(size => 
            `<span class="size-option">${size}</span>`
        ).join('');
    }
    
    // Update colors
    const colorsContainer = modal.querySelector('.color-options');
    if (colorsContainer) {
        colorsContainer.innerHTML = (product.colors || []).map(color => 
            `<span class="color-option">${color}</span>`
        ).join('');
    }
    
    // Initialize modal carousel
    productCarousel.initModalCarousel(modal, images);
    
    // Update favorite button state
    const favoriteBtn = modal.querySelector('.modal-favorite-btn');
    if (favoriteBtn) {
        favoriteBtn.dataset.id = product.id;
        // Check if product is in favorites and update button state
    }
    
    // Show modal
    document.querySelector('.product-modal-overlay').classList.add('active');
}

// ===== Firestore Schema Update for Multiple Images =====
/*
Product document structure with multiple images:

{
    id: "product_123",
    name: "××¨×•×Ÿ ××ž×‘×˜×™×” ×¨×•×ž× ×˜×™×§",
    sku: "ROM-120",
    price: 6670,
    categoryId: "cat_1",
    subcategoryId: "subcat_1",
    category: "××¨×•× ×•×ª ××ž×‘×˜×™×”",
    type: "×¤×•×¨×ž×™×™×§×”",
    description: "××¨×•×Ÿ ×ª×œ×•×™ ×‘×’×™×ž×•×¨ ×¦×‘×¢ ××¤×•×§×¡×™...",
    sizes: ["120", "130-150"],
    colors: ["×œ×‘×Ÿ", "×©×—×•×¨", "××¤×•×¨"],
    
    // Single image (backward compatible)
    image: "https://firebase-storage-url/main-image.jpg",
    
    // Multiple images (new field)
    images: [
        "https://firebase-storage-url/image1.jpg",
        "https://firebase-storage-url/image2.jpg",
        "https://firebase-storage-url/image3.jpg"
    ],
    
    createdAt: Timestamp
}
*/

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ProductCarousel, productCarousel, renderProductCardWithCarousel, openProductModalWithCarousel };
}
