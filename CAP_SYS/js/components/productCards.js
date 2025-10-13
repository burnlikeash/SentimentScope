// Product Cards Component Logic

class ProductCardsComponent {
    constructor() {
        this.resultsGrid = document.querySelector('.results-grid');
        this.paginationContainer = document.querySelector('.pagination');
        this.prevBtn = this.paginationContainer ? this.paginationContainer.querySelector('.page-prev') : null;
        this.nextBtn = this.paginationContainer ? this.paginationContainer.querySelector('.page-next') : null;
        this.pageInfo = this.paginationContainer ? this.paginationContainer.querySelector('.page-info') : null;
        this.products = SAMPLE_PRODUCTS;
        this.filteredProducts = [...this.products];
        this.currentFilters = {};
        this.currentPage = 1;
        this.pageSize = 12;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.renderProducts();
        this.setupPaginationControls();
    }

    setupEventListeners() {
        // Listen for filter changes
        document.addEventListener('filtersChanged', (e) => {
            this.currentFilters = e.detail.filters;
            this.filterAndRenderProducts();
        });

        // Listen for initial load
        document.addEventListener('DOMContentLoaded', () => {
            this.renderProducts();
        });
    }

    filterAndRenderProducts() {
        // Apply filters to products
        this.filteredProducts = this.applyFilters(this.products, this.currentFilters);
        this.currentPage = 1;
        
        // Re-render with animation
        this.renderProductsWithAnimation();
    }

    applyFilters(products, filters) {
        return products.filter(product => {
            // Filter by sentiment
            if (filters.sentiment && product.sentiment !== filters.sentiment) {
                return false;
            }
            
            // Filter by brand
            if (filters.brand && filters.brand !== 'All Brands' && filters.brand !== 'BRANDS') {
                if (product.brand !== filters.brand) {
                    return false;
                }
            }
            
            // Filter by topic from DB topics
            if (filters.topic) {
                const productTopics = Array.isArray(product.topics) ? product.topics : [];
                if (!productTopics.includes(filters.topic)) {
                    return false;
                }
            }
            
            // Filter by search term
            if (filters.search) {
                const searchTerm = filters.search.toLowerCase();
                const productText = `${product.name} ${product.description} ${product.brand}`.toLowerCase();
                if (!productText.includes(searchTerm)) {
                    return false;
                }
            }
            
            // (removed) Apply additional filters - path unused

            // Star rating filter using backend star_rating field and specified ranges
            if (filters.activeFilter && filters.activeFilter.type === 'star_rating') {
                const target = Number(filters.activeFilter.value);
                const star = Number(product.star_rating ?? product.rating ?? 0);
                switch (target) {
                    case 1:
                        if (!(star >= 1.0 && star < 2.0)) return false;
                        break;
                    case 2:
                        if (!(star >= 2.0 && star < 3.0)) return false;
                        break;
                    case 3:
                        if (!(star >= 3.0 && star < 4.0)) return false;
                        break;
                    case 4:
                        if (!(star >= 4.0 && star < 5.0)) return false;
                        break;
                    case 5:
                        // Treat near-5 as 5★ when rounded
                        if (!(Math.round(star) === 5)) return false;
                        break;
                    default:
                        break;
                }
            }
            
            return true;
        });
    }

    renderProducts() {
        // Clear existing products
        this.resultsGrid.innerHTML = '';
        
        // Show message if no products found
        if (this.filteredProducts.length === 0) {
            this.showNoResultsMessage();
            this.updatePagination(0, 0);
            return;
        }

        const startIdx = (this.currentPage - 1) * this.pageSize;
        const endIdx = startIdx + this.pageSize;
        const pageItems = this.filteredProducts.slice(startIdx, endIdx);
        
        // Use document fragment for better performance
        const fragment = document.createDocumentFragment();
        
        // Render each product on current page
        pageItems.forEach((product, index) => {
            const productCard = this.createProductCard(product);
            
            // Add staggered animation delay
            productCard.style.opacity = '0';
            productCard.style.transform = 'translateY(20px)';
            
            fragment.appendChild(productCard);
        });
        
        // Append fragment in one operation
        this.resultsGrid.appendChild(fragment);
        
        // Animate in all cards at once for better performance
        const cards = this.resultsGrid.querySelectorAll('.product-card');
        cards.forEach((card, index) => {
            setTimeout(() => {
                card.style.transition = 'all 0.3s ease';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 30); // Reduced delay for faster animation
        });

        const totalPages = Math.max(1, Math.ceil(this.filteredProducts.length / this.pageSize));
        this.updatePagination(this.currentPage, totalPages);
    }

    renderProductsWithAnimation() {
        // Fade out existing products
        const existingCards = this.resultsGrid.querySelectorAll('.product-card');
        
        if (existingCards.length === 0) {
            this.renderProducts();
            return;
        }

        // Animate out existing cards
        existingCards.forEach((card, index) => {
            setTimeout(() => {
                card.style.transition = 'all 0.2s ease';
                card.style.opacity = '0';
                card.style.transform = 'translateY(-10px)';
            }, index * 20);
        });

        // Render new products after animation
        setTimeout(() => {
            this.renderProducts();
        }, 300);
    }

    createProductCard(product) {
        // Create card container
        const card = createElement('div', ['product-card']);
        
        // Create product header
        const header = createElement('div', ['product-header']);
        
        // Product image/icon
        const image = createElement('div', ['product-image']);
        const brandKey = (product.brand || '').toLowerCase();
        const img = document.createElement('img');
        img.alt = product.brand || 'brand';
        img.src = `images/brands/${brandKey}.png`;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        img.style.objectFit = 'contain';
        img.onerror = () => { image.textContent = product.icon || '📦'; img.remove(); };
        image.appendChild(img);
        
        // Product info
        const info = createElement('div', ['product-info']);
        const title = createElement('h3', [], product.name);
        info.appendChild(title);
        
        header.appendChild(image);
        header.appendChild(info);
        
        // Product description
        const description = createElement('p', ['product-description'], product.description);
        
        // Product footer
        const footer = createElement('div', ['product-footer']);
        
        // Rating
        const rating = createElement('span', ['rating', product.sentiment], 
            `Rating: ${capitalize(product.sentiment)}`);
        
        // View review link
        const viewReview = createElement('a', ['view-review'], 'View Full Review', {
            href: '#',
            'data-product-id': product.id
        });
        
        // Add click handler for view review
        viewReview.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleViewReview(product);
        });
        
        footer.appendChild(rating);
        footer.appendChild(viewReview);
        
        // Assemble card
        card.appendChild(header);
        card.appendChild(description);
        card.appendChild(footer);
        
        // Add hover effects
        this.addHoverEffects(card);
        
        return card;
    }

    addHoverEffects(card) {
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-4px)';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
        });
    }

    setupPaginationControls() {
        if (!this.paginationContainer) return;
        const updateButtons = () => {
            const totalPages = Math.max(1, Math.ceil(this.filteredProducts.length / this.pageSize));
            if (this.prevBtn) this.prevBtn.disabled = this.currentPage <= 1;
            if (this.nextBtn) this.nextBtn.disabled = this.currentPage >= totalPages;
            if (this.pageInfo) this.pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
        };

        if (this.prevBtn) {
            this.prevBtn.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage -= 1;
                    this.renderProductsWithAnimation();
                    updateButtons();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        }

        if (this.nextBtn) {
            this.nextBtn.addEventListener('click', () => {
                const totalPages = Math.max(1, Math.ceil(this.filteredProducts.length / this.pageSize));
                if (this.currentPage < totalPages) {
                    this.currentPage += 1;
                    this.renderProductsWithAnimation();
                    updateButtons();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        }

        updateButtons();
    }

    updatePagination(currentPage, totalPages) {
        if (!this.paginationContainer) return;
        if (this.pageInfo) this.pageInfo.textContent = `Page ${currentPage} of ${Math.max(1, totalPages)}`;
        if (this.prevBtn) this.prevBtn.disabled = currentPage <= 1;
        if (this.nextBtn) this.nextBtn.disabled = currentPage >= Math.max(1, totalPages);
    }

    handleViewReview(product) {
        // Handle viewing full review
        console.log('Viewing full review for:', product.name);
        
        // Emit event for existing modal to render full product details
        document.dispatchEvent(new CustomEvent('viewReviewRequested', {
            detail: { product }
        }));
    }

    showNoResultsMessage() {
        const message = createElement('div', ['no-results']);
        message.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: #6b7280;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🔍</div>
                <h3 style="font-size: 1.25rem; margin-bottom: 0.5rem; color: #374151;">No products found</h3>
                <p>Try adjusting your filters or search terms</p>
            </div>
        `;
        
        this.resultsGrid.appendChild(message);
    }

    // Public methods for external control
    setProducts(products) {
        this.products = products;
        this.filteredProducts = [...products];
        this.renderProducts();
    }

    addProduct(product) {
        this.products.push(product);
        this.filterAndRenderProducts();
    }

    removeProduct(productId) {
        this.products = this.products.filter(p => p.id !== productId);
        this.filterAndRenderProducts();
    }

    getFilteredProducts() {
        return this.filteredProducts;
    }
}