// Search Component Logic

class SearchComponent {
    constructor() {
        this.searchBar = document.querySelector('.search-bar');
        this.searchBtn = document.querySelector('.search-btn');
        this.currentQuery = '';
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Search button click
        this.searchBtn.addEventListener('click', () => {
            this.performSearch();
        });

        // Enter key in search bar
        this.searchBar.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });

        // Real-time search with debounce
        const debouncedSearch = debounce(() => {
            const value = this.searchBar.value.trim();
            if (value === '') {
                this.clearSearch();
                return;
            }
            this.performSearch(true);
        }, 300);

        this.searchBar.addEventListener('input', debouncedSearch);

        // Clear search
        this.searchBar.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.clearSearch();
            }
        });
    }

    performSearch(isRealTime = false) {
        const query = this.searchBar.value.trim();
        
        // If emptied, treat as clear
        if (query === '') {
            this.clearSearch();
            return;
        }

        // Don't search for very short queries in real-time
        if (isRealTime && query.length < 2) {
            return;
        }

        this.currentQuery = query;

        // Add visual feedback
        this.addSearchFeedback();

        // Emit search event for other components to listen to
        document.dispatchEvent(new CustomEvent('searchPerformed', {
            detail: { 
                query: query,
                isRealTime: isRealTime 
            }
        }));

        console.log('Searching for:', query);
    }

    addSearchFeedback() {
        // Add temporary visual feedback
        this.searchBtn.style.background = '#3b82f6';
        this.searchBtn.style.color = 'white';

        // Reset after short delay
        setTimeout(() => {
            this.searchBtn.style.background = '';
            this.searchBtn.style.color = '';
        }, 200);
    }

    clearSearch() {
        this.searchBar.value = '';
        this.currentQuery = '';
        
        // Emit clear search event
        document.dispatchEvent(new CustomEvent('searchCleared'));
        
        // Remove focus from search bar
        this.searchBar.blur();
        
        console.log('Search cleared');
    }

    setSearchQuery(query) {
        this.searchBar.value = query;
        this.currentQuery = query;
    }

    getSearchQuery() {
        return this.currentQuery;
    }

    focusSearch() {
        this.searchBar.focus();
    }

    // Add search suggestions (future enhancement)
    showSuggestions(suggestions) {
        // Implementation for search suggestions dropdown
        console.log('Search suggestions:', suggestions);
    }
}