// Database-Only Product Data Integration

let TOPICS = [];

const FILTERS = [
    { name: "Positive", type: "sentiment", value: "positive" },
    { name: "Negative", type: "sentiment", value: "negative" },
    { name: "Price: High", type: "price", value: "high" },
    { name: "Price: Low", type: "price", value: "low" }
];

// Database-only data manager
class DataManager {
    constructor() {
        this.products = [];
        this.brands = [];
        this.topics = [];
		this.topicStats = {}; // { [topic]: { count, sentimentCounts: {positive, neutral, negative}, dominantSentiment, score } }
        this.isLoading = false;
        this.useDatabase = true;
        this.lastFetch = null;
        this.fetchInterval = 5 * 60 * 1000; // 5 minutes
    }

    async initialize() {
        console.log('Initializing DataManager - Database Only Mode...');
        
        // Check if Database API is available
        const apiAvailable = await this.checkApiAvailability();
        
        if (apiAvailable && this.useDatabase) {
            await this.loadFromDatabase();
        } else {
            console.error('Database API not available. Application requires database connection.');
            throw new Error('Database connection required');
        }
    }

    async checkApiAvailability() {
        try {
            const response = await fetch('http://localhost:8000/', {
                method: 'GET',
                timeout: 3000
            });
            return response.ok;
        } catch (error) {
            console.log('Database API not available:', error.message);
            return false;
        }
    }

    async loadFromDatabase() {
        if (this.isLoading) return;
        
        try {
            this.isLoading = true;
            console.log('Loading data from database via Database API...');

            // Load brands first
            const brandsData = await window.apiService.getBrands();
            this.brands = ['All Brands', ...brandsData.map(b => b.brand_name)];

            // Load all phones with their processed data
            const phonesData = await window.apiService.getAllPhones();

            // Derive unique topics across phones
			const topicSet = new Set();
			phonesData.forEach(p => {
				if (typeof p.topics === 'string' && p.topics.trim().length > 0) {
					p.topics.split(',').forEach(t => topicSet.add(t.trim()))
				}
			});
            
            // Filter out problematic topics
            const filteredTopics = Array.from(topicSet).filter(topic => {
                if (!topic || topic.length < 3) return false; // Too short
                if (topic.length > 50) return false; // Too long
                if (/^(and|or|the|a|an)$/i.test(topic.trim())) return false; // Single articles
                if (/^[^a-zA-Z]*$/i.test(topic)) return false; // No letters
                if (topic.split(' ').length > 6) return false; // Too many words
                return true;
            });
            
			this.topics = filteredTopics;

            // Transform database phones to frontend format
            // Batch sentiment requests to reduce API calls
            const sentimentPromises = phonesData.map(async (phone) => {
                try {
                    const sentiments = await window.apiService.getSentimentsByPhone(phone.phone_id);
                    return { phone, sentiments: sentiments.sentiments || {} };
                } catch (error) {
                    console.warn(`Failed to get sentiments for phone ${phone.phone_id}:`, error);
                    return { phone, sentiments: {} };
                }
            });
            
			const phoneSentimentResults = await Promise.all(sentimentPromises);
			this.products = phoneSentimentResults.map(({ phone, sentiments }) => 
				window.apiService.transformPhoneData(phone, sentiments)
			);

			// Compute topic relevance (frequency across products) and topic sentiment bias
			this.topicStats = {};
			for (const product of this.products) {
				const productSentiment = product.sentiment || 'neutral';
				const productTopics = Array.isArray(product.topics) ? product.topics : [];
				for (const topic of productTopics) {
					if (!this.topicStats[topic]) {
						this.topicStats[topic] = {
							count: 0,
							sentimentCounts: { positive: 0, neutral: 0, negative: 0 },
							dominantSentiment: 'neutral',
							score: 0
						};
					}
					this.topicStats[topic].count += 1;
					if (this.topicStats[topic].sentimentCounts[productSentiment] != null) {
						this.topicStats[topic].sentimentCounts[productSentiment] += 1;
					}
				}
			}
			// finalize dominant sentiment and score
			Object.keys(this.topicStats).forEach(topic => {
				const stats = this.topicStats[topic];
				const entries = Object.entries(stats.sentimentCounts);
				entries.sort((a, b) => b[1] - a[1]);
				stats.dominantSentiment = (entries[0] && entries[0][1] > 0) ? entries[0][0] : 'neutral';
				stats.score = stats.count; // simple relevance = frequency across products
			});

            console.log(`✅ Loaded ${this.products.length} products from database`);
            this.lastFetch = Date.now();

        } catch (error) {
            console.error('❌ Failed to load from database:', error);
            throw error;
        } finally {
            this.isLoading = false;
        }
    }


    async refreshData() {
        if (this.useDatabase && !this.isLoading) {
            const now = Date.now();
            if (!this.lastFetch || (now - this.lastFetch) > this.fetchInterval) {
                console.log('🔄 Refreshing data from database...');
                await this.loadFromDatabase();
                
                // Notify components about data refresh
                document.dispatchEvent(new CustomEvent('dataRefreshed', {
                    detail: { 
                        products: this.products, 
                        brands: this.brands 
                    }
                }));
            } else {
                console.log('⏰ Data is fresh, skipping refresh');
            }
        }
    }

    getProducts() {
        return this.products;
    }

    getBrands() {
        return this.brands;
    }

    getTopics() {
        return this.topics;
    }

	// Return up to `limit` topics ordered by relevance score (descending)
	getTopTopics(limit = 10) {
		const scored = this.topics.map(t => ({ topic: t, score: (this.topicStats[t]?.score) || 0 }));
		scored.sort((a, b) => b.score - a.score);
		return scored.slice(0, Math.max(0, limit)).map(x => x.topic);
	}

	// Get dominant sentiment color label for a topic based on aggregated product sentiments
	getTopicSentiment(topic) {
		return (this.topicStats[topic]?.dominantSentiment) || 'neutral';
	}

    async searchProducts(query, filters = {}) {
        try {
            // Use database search
            const searchParams = new URLSearchParams();
            searchParams.append('query', query);
            
            if (filters.sentiment) {
                searchParams.append('sentiment_filter', filters.sentiment);
            }
            if (filters.brand && filters.brand !== 'All Brands') {
                // Find brand ID
                const brands = await window.apiService.getBrands();
                const brand = brands.find(b => b.brand_name === filters.brand);
                if (brand) {
                    searchParams.append('brand_filter', brand.brand_id);
                }
            }

            const searchResults = await window.apiService.apiCall(`/search?${searchParams.toString()}`);
            
            // Transform search results to frontend format
            return searchResults.phones.map(phone => 
                window.apiService.transformPhoneData(phone, {})
            );
        } catch (error) {
            console.error('Database search failed:', error);
            return [];
        }
    }

    async getPhoneDetails(phoneId) {
        try {
            return await window.apiService.getCompletePhoneData(phoneId);
        } catch (error) {
            console.error('Failed to get phone details from database:', error);
            throw error;
        }
    }

    toggleDatabaseMode(enabled) {
        this.useDatabase = enabled;
        if (enabled) {
            this.initialize();
        }
        
        console.log(`Database mode ${enabled ? 'enabled' : 'disabled'}`);
        
        // Emit status change event
        document.dispatchEvent(new CustomEvent('databaseStatusChanged', {
            detail: { status: this.getDataStatus() }
        }));
    }

    isUsingDatabase() {
        return this.useDatabase && this.products.length > 0 && this.lastFetch !== null;
    }

    getDataStatus() {
        return {
            usingDatabase: this.isUsingDatabase(),
            productsCount: this.products.length,
            brandsCount: this.brands.length,
            lastFetch: this.lastFetch,
            isLoading: this.isLoading
        };
    }

    // Get processing statistics from database
    async getProcessingStats() {
        try {
            const stats = await window.apiService.apiCall('/stats');
            return {
                totalReviews: stats.reviews || 0,
                processedSentiments: stats.processed_sentiments || 0,
                totalTopics: stats.topics || 0,
                totalBrands: stats.brands || 0,
                totalPhones: stats.phones || 0,
                message: 'Data from database'
            };
        } catch (error) {
            console.error('Failed to get processing stats:', error);
            return {
                totalReviews: 'Error',
                processedSentiments: 'Error',
                totalTopics: 'Error',
                message: 'Failed to fetch stats'
            };
        }
    }
}

// Create global data manager instance
window.dataManager = new DataManager();

// Legacy exports for backward compatibility
let SAMPLE_PRODUCTS = [];
let BRANDS = [];

// Initialize data when script loads
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await window.dataManager.initialize();
        
        // Update legacy variables for backward compatibility
        SAMPLE_PRODUCTS = window.dataManager.getProducts();
        BRANDS = window.dataManager.getBrands();
        
        // Notify that initial data is ready
        document.dispatchEvent(new CustomEvent('dataInitialized'));
    } catch (error) {
        console.error('Failed to initialize data manager:', error);
        // Show error to user
        document.body.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; text-align: center; padding: 2rem;">
                <h1 style="color: #ef4444; margin-bottom: 1rem;">Database Connection Required</h1>
                <p style="color: #6b7280; margin-bottom: 2rem;">This application requires a database connection to function.</p>
                <button onclick="window.location.reload()" style="background: #3b82f6; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; cursor: pointer;">
                    Retry Connection
                </button>
            </div>
        `;
    }
});

// Auto-refresh data from database every 5 minutes
setInterval(async () => {
    if (window.dataManager && window.dataManager.isUsingDatabase()) {
        await window.dataManager.refreshData();
    }
}, 5 * 60 * 1000);