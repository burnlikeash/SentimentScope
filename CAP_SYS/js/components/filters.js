// Filter Component Logic - Single Active Filter

class FilterComponent {
    constructor() {
        this.sentimentButtons = document.querySelectorAll('.sentiment-btn');
        this.topicButtons = document.querySelectorAll('.topic-btn');
        this.filterButtons = document.querySelectorAll('.filter-btn');
        this.topicsGrid = document.querySelector('.topics-grid');
        this.filterButtonsContainer = document.querySelector('.filter-buttons');
        
        this.activeFilters = {
            sentiment: null,
            topic: null,
            brand: null,
            search: null,
            activeFilter: null // Only one additional filter can be active
        };
        
        this.init();
    }

    formatTopicLabel(label) {
        if (!label) return '';
        return label
            .replace(/_/g, ' ')
            .replace(/, and /gi, ', ')  // Remove "and" when it appears as ", and "
            .replace(/ and /gi, ', ')   // Remove "and" when it appears as " and "
            .replace(/^and /gi, '')     // Remove "and" when it appears at the beginning
            .replace(/, $/g, '')        // Remove trailing comma and space
            .replace(/^, /g, '')        // Remove leading comma and space
            .replace(/\b\w/g, c => c.toUpperCase());
    }

    // Check if two topics are similar based on common words and meaning
    areTopicsSimilar(topic1, topic2) {
        if (!topic1 || !topic2) return false;
        
        // Normalize topics for comparison
        const normalize = (topic) => {
            return topic.toLowerCase()
                .replace(/[^\w\s]/g, ' ')  // Replace punctuation with spaces
                .replace(/\s+/g, ' ')      // Normalize whitespace
                .trim();
        };
        
        const norm1 = normalize(topic1);
        const norm2 = normalize(topic2);
        
        // If they're exactly the same after normalization, they're similar
        if (norm1 === norm2) return true;
        
        // Split into words
        const words1 = norm1.split(' ').filter(w => w.length > 2);
        const words2 = norm2.split(' ').filter(w => w.length > 2);
        
        if (words1.length === 0 || words2.length === 0) return false;
        
        // Calculate word overlap
        const commonWords = words1.filter(word => words2.includes(word));
        const overlapRatio = commonWords.length / Math.min(words1.length, words2.length);
        
        // Consider topics similar if they share more than 50% of their words
        return overlapRatio > 0.5;
    }

    // Select diverse topics from a pool, avoiding similar topics
    selectDiverseTopics(topicPool, count) {
        if (topicPool.length <= count) {
            return topicPool;
        }
        
        const selected = [];
        const remaining = [...topicPool];
        
        // Shuffle the pool to add randomness while maintaining diversity
        const shuffled = [...remaining].sort(() => 0.5 - Math.random());
        
        for (let i = 0; i < shuffled.length && selected.length < count; i++) {
            const candidate = shuffled[i];
            let isSimilar = false;
            
            // Check if this topic is similar to any already selected
            for (const selectedTopic of selected) {
                if (this.areTopicsSimilar(candidate, selectedTopic)) {
                    isSimilar = true;
                    console.log(`Skipping "${candidate}" - similar to "${selectedTopic}"`);
                    break;
                }
            }
            
            // If not similar, add it to selected topics
            if (!isSimilar) {
                selected.push(candidate);
                console.log(`Added "${candidate}" to selected topics`);
            }
        }
        
        // If we couldn't find enough diverse topics, fill with remaining topics
        if (selected.length < count) {
            const remainingTopics = shuffled.filter(topic => !selected.includes(topic));
            selected.push(...remainingTopics.slice(0, count - selected.length));
            console.log(`Added ${count - selected.length} remaining topics to reach target count`);
        }
        
        return selected;
    }

    init() {
        this.populateTopics();
        this.populateFilters();
        this.setupEventListeners();
    }

    populateTopics() {
        // Clear existing topics
        this.topicsGrid.innerHTML = '';
        
        // Get topics (restrict to top 20 by relevance to ensure variety after deduplication)
        let topics = [];
        if (window.dataManager && typeof window.dataManager.getTopTopics === 'function') {
            topics = window.dataManager.getTopTopics(20);
        } else if (window.dataManager) {
            topics = window.dataManager.getTopics();
        }
        
        // Additional filtering for better topic quality
        topics = topics.filter(topic => {
            if (!topic || topic.length < 3) return false;
            // Filter out topics that are too technical or unclear
            if (topic.includes('Mm') && topic.length < 10) return false;
            if (topic.includes('And') && topic.split(' ').length < 3) return false;
            if (topic === 'Yes' || topic === 'No') return false;
            return true;
        });
        
        // Strong deduplication: normalize case and trim whitespace, then use Set
        const normalizedTopics = topics.map(t => t.trim().toLowerCase());
        const uniqueTopics = [];
        const seen = new Set();
        
        for (let i = 0; i < topics.length; i++) {
            const normalized = normalizedTopics[i];
            if (!seen.has(normalized)) {
                seen.add(normalized);
                uniqueTopics.push(topics[i]); // Keep original case
            }
        }
        
        // Select 6 diverse topics from the pool, avoiding similar topics
        const selectedTopics = this.selectDiverseTopics(uniqueTopics, 6);
        
        // Debug logging for topic selection
        console.log(`Selected ${selectedTopics.length} diverse topics from pool of ${uniqueTopics.length}:`, selectedTopics);
        
        // Add topic buttons
        selectedTopics.forEach(topic => {
            const classes = ['topic-btn'];
            // Color-code by topic sentiment via background color classes
            try {
                if (window.dataManager && typeof window.dataManager.getTopicSentiment === 'function') {
                    const s = window.dataManager.getTopicSentiment(topic);
                    console.log(`Topic button "${topic}" -> sentiment: ${s}`);
                    if (s === 'positive') classes.push('topic-positive');
                    else if (s === 'negative') classes.push('topic-negative');
                    else classes.push('topic-neutral');
                } else {
                    console.log(`Topic button "${topic}" -> no dataManager, using neutral`);
                    classes.push('topic-neutral');
                }
            } catch (e) { 
                console.warn(`Topic button "${topic}" -> error getting sentiment:`, e);
                classes.push('topic-neutral'); 
            }
            const button = createElement('button', classes, this.formatTopicLabel(topic));
            button.addEventListener('click', () => this.selectTopic(topic));
            this.topicsGrid.appendChild(button);
        });
        
        // Update topic buttons reference
        this.topicButtons = document.querySelectorAll('.topic-btn');
    }
    

    populateFilters() {
        // Clear existing filters
        this.filterButtonsContainer.innerHTML = '';
        
        // Add label
        const label = createElement('span', [], 'Filter by Sentiment Bias:');
        label.style.marginRight = '8px';
        this.filterButtonsContainer.appendChild(label);
    
        // Create descriptive sentiment bias buttons mapped from star ratings 1-5
        const labels = {
            1: 'Mostly Negative',
            2: 'Somewhat Negative',
            3: 'Neutral',
            4: 'Somewhat Positive',
            5: 'Mostly Positive'
        };
        [1, 2, 3, 4, 5].forEach(val => {
            const filter = { name: labels[val], type: 'star_rating', value: val };
            const button = createElement('button', ['filter-btn'], labels[val], {
                'data-type': filter.type,
                'data-value': String(filter.value)
            });
            button.addEventListener('click', () => this.selectFilter(filter, button));
            this.filterButtonsContainer.appendChild(button);
        });
        
        // Update filter buttons reference
        this.filterButtons = document.querySelectorAll('.filter-btn');
    }
    

    setupEventListeners() {
        // Sentiment buttons
        this.sentimentButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                let sentiment = null;
                if (btn.classList.contains('positive')) sentiment = 'positive';
                else if (btn.classList.contains('neutral')) sentiment = 'neutral';
                else if (btn.classList.contains('negative')) sentiment = 'negative';
                this.selectSentiment(sentiment, btn);
            });
        });

        // Listen for external filter changes
        document.addEventListener('brandChanged', (e) => {
            this.activeFilters.brand = e.detail.selectedBrand;
            this.applyFilters();
        });

        document.addEventListener('searchPerformed', (e) => {
            this.activeFilters.search = e.detail.query;
            this.applyFilters();
        });

        document.addEventListener('searchCleared', () => {
            this.activeFilters.search = null;
            this.applyFilters();
        });
    }

    selectSentiment(sentiment, button) {
        // Remove active class from all sentiment buttons
        this.sentimentButtons.forEach(btn => btn.classList.remove('active'));
        
        // Toggle sentiment selection
        if (this.activeFilters.sentiment === sentiment) {
            this.activeFilters.sentiment = null;
        } else {
            this.activeFilters.sentiment = sentiment;
            button.classList.add('active');
        }
        
        this.applyFilters();
    }

    selectTopic(topic) {
        // Remove active class from all topic buttons
        this.topicButtons.forEach(btn => btn.classList.remove('active'));
        
        // Toggle topic selection
        if (this.activeFilters.topic === topic) {
            this.activeFilters.topic = null;
        } else {
            this.activeFilters.topic = topic;
            // Add active class to the button whose text matches the formatted topic label
            const formatted = this.formatTopicLabel(topic);
            Array.from(this.topicButtons).forEach(btn => {
                if (btn.textContent === formatted) {
                    btn.classList.add('active');
                }
            });

            // Clear other filters when a topic is selected
            // Clear sentiment selection
            this.activeFilters.sentiment = null;
            this.sentimentButtons.forEach(btn => btn.classList.remove('active'));

            // Clear star/other filter buttons
            this.activeFilters.activeFilter = null;
            this.filterButtons.forEach(btn => btn.classList.remove('active'));

            // Clear brand selection and reset dropdown UI if available
            this.activeFilters.brand = null;
            try {
                if (window.SentimentScope && window.SentimentScope.components && window.SentimentScope.components.dropdown) {
                    const dropdown = window.SentimentScope.components.dropdown;
                    dropdown.selectedBrand = 'BRANDS';
                    const btnText = dropdown.btn && dropdown.btn.childNodes[0];
                    if (btnText) btnText.textContent = 'BRANDS ';
                }
                // Emit brandChanged with null so product list updates
                document.dispatchEvent(new CustomEvent('brandChanged', {
                    detail: { selectedBrand: null }
                }));
            } catch (e) {
                // best-effort UI reset
            }

            // Clear search
            this.activeFilters.search = null;
            document.dispatchEvent(new CustomEvent('searchCleared'));
        }
        
        this.applyFilters();
    }

    selectFilter(filter, button) {
        // Remove active class from all filter buttons
        this.filterButtons.forEach(btn => btn.classList.remove('active'));
        
        // Toggle filter selection - only one can be active at a time
        if (this.activeFilters.activeFilter && 
            this.activeFilters.activeFilter.type === filter.type && 
            this.activeFilters.activeFilter.value === filter.value) {
            // Clicking the same filter deactivates it
            this.activeFilters.activeFilter = null;
        } else {
            // Activate the clicked filter
            this.activeFilters.activeFilter = filter;
            button.classList.add('active');
        }
        
        this.applyFilters();
    }

    applyFilters() {
        // Emit filter change event
        document.dispatchEvent(new CustomEvent('filtersChanged', {
            detail: { filters: this.activeFilters }
        }));
        
        console.log('Active filters:', this.activeFilters);
    }

    clearAllFilters() {
        // Reset all filters
        this.activeFilters = {
            sentiment: null,
            topic: null,
            brand: null,
            search: null,
            activeFilter: null
        };
        
        // Remove active classes
        this.sentimentButtons.forEach(btn => btn.classList.remove('active'));
        this.topicButtons.forEach(btn => btn.classList.remove('active'));
        this.filterButtons.forEach(btn => btn.classList.remove('active'));
        
        this.applyFilters();
    }

    getActiveFilters() {
        return this.activeFilters;
    }

    // Method to refresh topics with new diverse selection
    refreshTopics() {
        console.log('Refreshing topics with new diverse selection...');
        this.populateTopics();
    }

    // Helper method to get currently active filter for display
    getActiveFilterName() {
        if (this.activeFilters.activeFilter) {
            return this.activeFilters.activeFilter.name;
        }
        return null;
    }

    // Method to programmatically set a filter
    setActiveFilter(filterName) {
        const targetFilter = FILTERS.find(f => f.name === filterName);
        if (targetFilter) {
            // Clear all filter buttons
            this.filterButtons.forEach(btn => btn.classList.remove('active'));
            
            // Activate the target filter
            const targetButton = Array.from(this.filterButtons).find(btn => 
                btn.getAttribute('data-type') === targetFilter.type && 
                btn.getAttribute('data-value') === targetFilter.value
            );
            
            if (targetButton) {
                targetButton.classList.add('active');
                this.activeFilters.activeFilter = targetFilter;
                this.applyFilters();
            }
        }
    }
}