// Utility Helper Functions

/**
 * Capitalizes the first letter of a string
 */
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Debounce function to limit function calls
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Filter products based on criteria
 */
function filterProducts(products, filters) {
    return products.filter(product => {
        // Filter by sentiment
        if (filters.sentiment && product.sentiment !== filters.sentiment) {
            return false;
        }
        
        // Filter by brand
        if (filters.brand && filters.brand !== 'All Brands' && product.brand !== filters.brand) {
            return false;
        }
        
        // Filter by category/topic
        if (filters.category && product.category !== filters.category) {
            return false;
        }
        
        // Filter by search term
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            const productText = `${product.name} ${product.description} ${product.brand}`.toLowerCase();
            if (!productText.includes(searchTerm)) {
                return false;
            }
        }
        
        return true;
    });
}

/**
 * Create HTML element with classes and content
 */
function createElement(tag, classes = [], content = '', attributes = {}) {
    const element = document.createElement(tag);
    
    if (classes.length > 0) {
        element.classList.add(...classes);
    }
    
    if (content) {
        element.textContent = content;
    }
    
    Object.keys(attributes).forEach(key => {
        element.setAttribute(key, attributes[key]);
    });
    
    return element;
}

/**
 * Add event listener with automatic cleanup
 */
function addEventListenerWithCleanup(element, event, handler) {
    element.addEventListener(event, handler);
    
    // Return cleanup function
    return () => {
        element.removeEventListener(event, handler);
    };
}

/**
 * Animate element with simple transitions
 */
function animateElement(element, property, from, to, duration = 300) {
    const startTime = performance.now();
    const change = to - from;
    
    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const currentValue = from + (change * progress);
        element.style[property] = currentValue + (property.includes('opacity') ? '' : 'px');
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }
    
    requestAnimationFrame(animate);
}