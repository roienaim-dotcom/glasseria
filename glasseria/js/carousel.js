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
            
            // Check if we're on a touch device with CSS scroll-snap enabled
            const isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
            
            if (isTouchDevice) {
                // On touch devices, use native scroll (CSS has scroll-snap enabled)
                const slide = carousel.children[index];
                if (slide) {
                    carousel.scrollTo({
                        left: index * carousel.offsetWidth,
                        behavior: 'smooth'
                    });
                }
            } else {
                // On desktop, use transform
                carousel.style.transform = `translateX(${-index * 100}%)`;
            }
            
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
        
        // Scroll listener for mobile (CSS enables scroll-snap on touch devices)
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
        }, { passive: true });
    }
}

// Global carousel instance
const productCarousel = new ProductCarousel();
