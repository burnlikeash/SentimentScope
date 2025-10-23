// Header Component Logic

class HeaderComponent {
    constructor() {
        this.tabs = document.querySelectorAll('.tab');
        this.activeTab = 'Reviews';
        this.init();
    }

    init() {
        this.setupTabSwitching();
    }

    setupTabSwitching() {
        this.tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target);
            });
        });
    }

    switchTab(clickedTab) {
        // Remove active class from all tabs
        this.tabs.forEach(tab => tab.classList.remove('active'));
        
        // Add active class to clicked tab
        clickedTab.classList.add('active');
        
        // Update active tab
        this.activeTab = clickedTab.textContent;
        
        // Emit custom event for other components to listen to
        document.dispatchEvent(new CustomEvent('tabChanged', {
            detail: { activeTab: this.activeTab }
        }));
        
        // Handle tab-specific logic
        this.handleTabSwitch(this.activeTab);
    }

    handleTabSwitch(tabName) {
        // Only Reviews view is supported now
        this.showReviewsContent();
    }

    showReviewsContent() {
        // Show reviews-related content
        const mainContent = document.querySelector('.main-content');
        mainContent.style.display = 'block';
        
        console.log('Showing reviews content');
    }

    // Removed analytics view

    getActiveTab() {
        return this.activeTab;
    }
}