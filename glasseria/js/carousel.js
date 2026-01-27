// ===== Product Image Carousel System =====
// Fixed for RTL Hebrew site - arrows and dots work correctly

class ProductCarousel {
    constructor() {
        this.isMobile = this.checkMobile();
        
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
        
        const carouselHTML = this.createCarouselHTML(images, 'card');
        container.innerHTML = carouselHTML;
        
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
        
        const carouselHTML = this.createCarouselHTML(images, 'modal');
        container.innerHTML = carouselHTML;
        
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
                <img src="${img}" alt="תמונת מוצר ${index + 1}" loading="lazy">
            </div>
        `).join('');
        
        // Create dots
        const dots = images.length > 1 ? images.map((_, index) => `
            <button class="${dotClass}${index === 0 ? ' active' : ''}" data-index="${index}"></button>
        `).join('') : '';
        
        // Arrows:
        // - "prev" class = RIGHT side arrow (points right >) = goes to PREVIOUS image
        // - "next" class = LEFT side arrow (points left <) = goes to NEXT image
        const arrows = images.length > 1 ? `
            <button class="${arrowClass} prev" aria-label="תמונה קודמת">
                <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
            <button class="${arrowClass} next" aria-label="תמונה הבאה">
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
        
        // Update carousel - move to specific index
        const updateCarousel = (index) => {
            currentIndex = index;
            
            // Use negative translateX because carousel has direction:ltr in CSS
            carousel.style.transform = `translateX(${-index * 100}%)`;
            
            // Update dots
            dots.forEach((dot, i) => {
                dot.classList.toggle('active', i === index);
            });
            
            carousel.dataset.current = index;
        };
        
        // Go to previous image (index - 1)
        const goPrev = () => {
            const newIndex = (currentIndex - 1 + totalSlides) % totalSlides;
            updateCarousel(newIndex);
        };
        
        // Go to next image (index + 1)
        const goNext = () => {
            const newIndex = (currentIndex + 1) % totalSlides;
            updateCarousel(newIndex);
        };
        
        // Arrow click handlers
        // prev button (RIGHT side, arrow points right) = go to previous image
        if (prevBtn) {
            prevBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                goPrev();
            });
        }
        
        // next button (LEFT side, arrow points left) = go to next image
        if (nextBtn) {
            nextBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                goNext();
            });
        }
        
        // Dot click handlers
        dots.forEach((dot, index) => {
            dot.addEventListener('click', (e) => {
                e.stopPropagation();
                updateCarousel(index);
            });
        });
        
        // Touch swipe support
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
                    // Swiped left = go to next image
                    goNext();
                } else {
                    // Swiped right = go to previous image
                    goPrev();
                }
            }
        };
    }
}

// Global carousel instance
const productCarousel = new ProductCarousel();
