// Dropdown Component Logic

class DropdownComponent {
    constructor() {
        this.dropdown = document.querySelector('.brands-dropdown');
        this.btn = document.querySelector('.brands-btn');
        this.content = document.querySelector('.dropdown-content');
        this.selectedBrand = 'BRANDS';
        this.isOpen = false;
        this.init();
    }

    init() {
        this.populateDropdown();
        this.setupEventListeners();
    }

    populateDropdown() {
        // Clear existing content
        this.content.innerHTML = '';
        
        // Add brand options
        const brands = window.dataManager ? window.dataManager.getBrands() : [];
        brands.forEach(brand => {
            const item = createElement('div', ['dropdown-item'], brand);
            item.addEventListener('click', () => this.selectBrand(brand));
            this.content.appendChild(item);
        });
    }

    setupEventListeners() {
        // Toggle dropdown on button click
        this.btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.dropdown.contains(e.target)) {
                this.closeDropdown();
            }
        });

        // Handle keyboard navigation
        this.dropdown.addEventListener('keydown', (e) => {
            this.handleKeydown(e);
        });
    }

    toggleDropdown() {
        this.isOpen = !this.isOpen;
        this.dropdown.classList.toggle('open', this.isOpen);
    }

    openDropdown() {
        this.isOpen = true;
        this.dropdown.classList.add('open');
    }

    closeDropdown() {
        this.isOpen = false;
        this.dropdown.classList.remove('open');
    }

    selectBrand(brand) {
        this.selectedBrand = brand;
        
        // Update button text
        const btnText = this.btn.childNodes[0];
        btnText.textContent = brand + ' ';
        
        // Close dropdown
        this.closeDropdown();
        
        // Scroll to top after selection
        try {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (e) {
            window.scrollTo(0, 0);
        }

        // Emit custom event for filtering
        document.dispatchEvent(new CustomEvent('brandChanged', {
            detail: { selectedBrand: brand }
        }));
        
        console.log('Selected brand:', brand);
    }

    handleKeydown(event) {
        const items = this.content.querySelectorAll('.dropdown-item');
        const currentFocus = document.activeElement;
        const currentIndex = Array.from(items).indexOf(currentFocus);

        switch(event.key) {
            case 'Escape':
                this.closeDropdown();
                this.btn.focus();
                break;
            case 'ArrowDown':
                event.preventDefault();
                if (currentIndex < items.length - 1) {
                    items[currentIndex + 1].focus();
                } else {
                    items[0].focus();
                }
                break;
            case 'ArrowUp':
                event.preventDefault();
                if (currentIndex > 0) {
                    items[currentIndex - 1].focus();
                } else {
                    items[items.length - 1].focus();
                }
                break;
            case 'Enter':
                if (currentFocus && currentFocus.classList.contains('dropdown-item')) {
                    currentFocus.click();
                }
                break;
        }
    }

    getSelectedBrand() {
        return this.selectedBrand;
    }

    updateBrands(brands) {
        this.populateDropdown();
    }
}