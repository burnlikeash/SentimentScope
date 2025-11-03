// Main Application Entry Point - Database-Only Integration

// ✅ Utility functions
function debounce(fn, delay) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), delay);
    };
}

function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

class SentimentScopeApp {
    constructor() {
        this.components = {};
        this.isInitialized = false;
        this.dataReady = false;
        this.init();
    }

    init() {
        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.waitForDataAndInitialize();
            });
        } else {
            this.waitForDataAndInitialize();
        }
    }

    async waitForDataAndInitialize() {
        // Show loading indicator
        this.showLoadingState();

        // Wait for data to be initialized
        if (!window.dataManager) {
            // Wait a bit for dataManager to be available
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Listen for data initialization
        document.addEventListener('dataInitialized', () => {
            this.dataReady = true;
            this.initializeComponents();
        });

        // If data is already ready, initialize immediately
        if (window.dataManager &&
            typeof window.dataManager.getProducts === 'function' &&
            window.dataManager.getProducts().length > 0) {
            this.dataReady = true;
            this.initializeComponents();
        }
    }

    showLoadingState() {
        const loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'loading-overlay';
        loadingOverlay.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(255, 255, 255, 0.9);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                backdrop-filter: blur(4px);
            ">
                <div style="
                    font-size: 2rem;
                    margin-bottom: 1rem;
                    animation: pulse 2s infinite;
                ">📱</div>
                <div style="
                    font-size: 1.2rem;
                    color: #3b82f6;
                    font-weight: 600;
                    margin-bottom: 0.5rem;
                ">Loading SentimentScope...</div>
                <div style="
                    color: #6b7280;
                    font-size: 0.9rem;
                ">Connecting to database...</div>
                <div style="
                    margin-top: 1rem;
                    width: 200px;
                    height: 4px;
                    background: #f3f4f6;
                    border-radius: 2px;
                    overflow: hidden;
                ">
                    <div style="
                        width: 100%;
                        height: 100%;
                        background: linear-gradient(90deg, #3b82f6, #10b981);
                        animation: loading 2s infinite;
                        border-radius: 2px;
                    "></div>
                </div>
            </div>
            <style>
                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                }
                @keyframes loading {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
            </style>
        `;

        document.body.appendChild(loadingOverlay);
    }

    hideLoadingState() {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.opacity = '0';
            loadingOverlay.style.transition = 'opacity 0.5s ease';
            setTimeout(() => {
                loadingOverlay.remove();
            }, 500);
        }
    }

    async initializeComponents() {
        try {
            console.log('Initializing SentimentScope with database integration...');

            // Initialize all components
            this.components.header = new HeaderComponent();
            this.components.dropdown = new DropdownComponent();
            this.components.search = new SearchComponent();
            this.components.filters = new FilterComponent();
            this.components.productCards = new ProductCardsComponent();

            // Setup global event listeners
            this.setupGlobalEventListeners();

            // Setup database-specific event listeners
            this.setupDatabaseEventListeners();

            // Wire Clear All Filters button
            const clearBtn = document.getElementById('clear-filters');
            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    // Clear filter component state
                    if (this.components.filters && typeof this.components.filters.clearAllFilters === 'function') {
                        this.components.filters.clearAllFilters();
                    }

                    // Reset brand dropdown UI to default and emit event
                    if (this.components.dropdown) {
                        const dropdown = this.components.dropdown;
                        dropdown.selectedBrand = 'BRANDS';
                        const btnText = dropdown.btn.childNodes[0];
                        if (btnText) btnText.textContent = 'BRANDS ';
                        document.dispatchEvent(new CustomEvent('brandChanged', {
                            detail: { selectedBrand: null }
                        }));
                    }

                    // Clear search query and notify components
                    if (this.components.search && typeof this.components.search.clearSearch === 'function') {
                        this.components.search.clearSearch();
                    } else {
                        document.dispatchEvent(new CustomEvent('searchCleared'));
                    }

                    this.showNotification('All filters cleared', 'success');
                });
            }


            // Wire About button
            const aboutBtn = document.getElementById('about-btn');
            const aboutModal = document.getElementById('about-modal');
            const closeAboutModal = document.getElementById('close-about-modal');
            
            if (aboutBtn && aboutModal) {
                aboutBtn.addEventListener('click', () => {
                    this.showAboutModal();
                });
            }
            
            if (closeAboutModal && aboutModal) {
                closeAboutModal.addEventListener('click', () => {
                    this.hideAboutModal();
                });
            }
            
            // Close modal when clicking outside
            if (aboutModal) {
                aboutModal.addEventListener('click', (e) => {
                    if (e.target === aboutModal) {
                        this.hideAboutModal();
                    }
                });
            }

            // Wire Sentiment modal
            const sentimentBtn = document.getElementById('sentiment-btn');
            const sentimentModal = document.getElementById('sentiment-modal');
            const closeSentimentModal = document.getElementById('close-sentiment-modal');
            const analyzeBtn = document.getElementById('analyze-text-btn');
            const sentimentInput = document.getElementById('sentiment-input');
            const sentimentResult = document.getElementById('sentiment-result');

            const showSentimentModal = () => {
                if (!sentimentModal) return;
                sentimentModal.style.display = 'flex';
                sentimentModal.style.opacity = '0';
                sentimentModal.style.transition = 'opacity 0.3s ease';
                document.body.style.overflow = 'hidden';
                setTimeout(() => { sentimentModal.style.opacity = '1'; }, 10);
                const handleEscape = (e) => {
                    if (e.key === 'Escape') {
                        hideSentimentModal();
                        document.removeEventListener('keydown', handleEscape);
                    }
                };
                document.addEventListener('keydown', handleEscape);
            };

            const hideSentimentModal = () => {
                if (!sentimentModal) return;
                sentimentModal.style.opacity = '0';
                sentimentModal.style.transition = 'opacity 0.3s ease';
                document.body.style.overflow = '';
                setTimeout(() => { sentimentModal.style.display = 'none'; }, 300);
            };

            if (sentimentBtn && sentimentModal) {
                sentimentBtn.addEventListener('click', showSentimentModal);
            }
            if (closeSentimentModal && sentimentModal) {
                closeSentimentModal.addEventListener('click', hideSentimentModal);
            }
            if (sentimentModal) {
                sentimentModal.addEventListener('click', (e) => {
                    if (e.target === sentimentModal) hideSentimentModal();
                });
            }

            if (analyzeBtn && sentimentInput && sentimentResult) {
                analyzeBtn.addEventListener('click', async () => {
                    const text = sentimentInput.value.trim();
                    if (!text) {
                        sentimentResult.textContent = 'Please enter some text.';
                        return;
                    }
                    sentimentResult.innerHTML = '<span style="color:#6b7280;">Analyzing...</span>';
                    try {
                        const res = await window.apiService.analyzeText(text);
                        const sentiment = res.sentiment || 'neutral';
                        const confidence = typeof res.confidence === 'number' ? (res.confidence * 100).toFixed(1) + '%' : '';
                        const topics = Array.isArray(res.topics) && res.topics.length ? res.topics.join(', ') : 'No topics detected';
                        sentimentResult.innerHTML = `
                            <div style="display:flex; flex-direction: column; gap: 0.35rem;">
                                <div><strong>Sentiment:</strong> ${sentiment}</div>
                                <div><strong>Confidence:</strong> ${confidence}</div>
                                <div><strong>Topic(s):</strong> ${topics}</div>
                            </div>`;
                    } catch (err) {
                        console.error(err);
                        sentimentResult.innerHTML = '<span style="color:#b91c1c;">Failed to analyze. Is the ML API running on http://localhost:8001?</span>';
                    }
                });
            }

            // Hide loading state
            this.hideLoadingState();

            // Mark as initialized
            this.isInitialized = true;


            console.log('SentimentScope application initialized successfully');
        } catch (error) {
            console.error('Error initializing SentimentScope:', error);
            this.handleInitializationError(error);
        }
    }

    setupGlobalEventListeners() {
        // Handle view review requests with database data
        document.addEventListener('viewReviewRequested', async (e) => {
            await this.handleViewReview(e.detail.product);
        });

        // Handle keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleGlobalKeydown(e);
        });

        // Handle window resize
        window.addEventListener('resize', debounce(() => {
            this.handleWindowResize();
        }, 250));

        // Handle browser back/forward navigation
        window.addEventListener('popstate', (e) => {
            this.handlePopState(e);
        });
    }

    setupDatabaseEventListeners() {
        // Handle data refresh events
        document.addEventListener('dataRefreshed', (e) => {
            console.log('Data refreshed from database');
            if (this.components.productCards) {
                this.components.productCards.setProducts(e.detail.products);
            }
            if (this.components.dropdown) {
                this.components.dropdown.updateBrands(e.detail.brands);
            }
            this.showNotification('Data updated from database', 'success');
        });

        // Handle database connection status
        document.addEventListener('databaseStatusChanged', (e) => {
            this.showDatabaseStatus(e.detail.status);
        });
    }


    async handleViewReview(product) {
        console.log('Opening detailed view for:', product.name);

        // Get additional data from database
        let completeData = null;
        if (product.id) {
            try {
                completeData = await window.dataManager.getPhoneDetails(product.id);
            } catch (error) {
                console.warn('Could not fetch additional data:', error);
            }
        }

        this.showProductModal(product, completeData);
    }

    // Exposed method used by UI to refresh
    async refreshData() {
        if (window.dataManager && typeof window.dataManager.refreshData === 'function') {
            await window.dataManager.refreshData();
        }
    }

    // ... 🟢 (rest of showProductModal and helper methods remain unchanged, except closeModal fix)

	showProductModal(product, completeData = null) {
		const modal = document.createElement('div');
		modal.className = 'product-modal';

		// Build additional sections from DB data when available
		let additionalSections = '';
		// Optimized reviews processing: prioritize by confidence score
		let shuffledReviews = [];
		if (completeData && Array.isArray(completeData.reviews)) {
			// Only include reviews that have sentiments and sort by confidence score (already done in backend)
			const reviewsWithSentiments = completeData.reviews.filter(r => !!r.sentiment_label);
			if (reviewsWithSentiments.length > 0) {
				// Use the reviews as-is since they're already sorted by confidence score in backend
				shuffledReviews = reviewsWithSentiments;
				const recentReviews = shuffledReviews.slice(0, 3);
			additionalSections += `
				<div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #f3f4f6;">
					<h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 0.75rem; color: #111827;">Recent Reviews</h3>
					<div class="recent-reviews-list">
						${recentReviews.map(review => `
							<div style="background: #f9fafb; padding: 0.75rem; border-radius: 6px; margin-bottom: 0.5rem; border-left: 3px solid ${this.getSentimentColor(review.sentiment_label)};">
								<div style="font-size: 0.8rem; color: #6b7280; margin-bottom: 0.25rem;">
									${capitalize(review.sentiment_label)} sentiment • Review #${review.review_id}
								</div>
								<div style="font-size: 0.85rem; line-height: 1.4; color: #374151;">
									${review.review_text && review.review_text.length > 100 ? review.review_text.substring(0, 100) + '...' : (review.review_text || '')}
								</div>
							</div>
						`).join('')}
					</div>
					${shuffledReviews.length > 3 ? `
						<div style="text-align: right; margin-top: 0.5rem;">
							<button class="show-more-reviews" style="background: #eef2ff; color: #3730a3; border: 1px solid #c7d2fe; padding: 0.35rem 0.6rem; border-radius: 6px; cursor: pointer; font-size: 0.8rem;">See more reviews</button>
						</div>
					` : ''}
				</div>
			`;
			}
		}

		if (completeData && completeData.sentiments && completeData.sentiments.total_reviews > 0) {
			const sentiments = completeData.sentiments.sentiments;
			additionalSections += `
				<div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #f3f4f6;">
					<h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 0.75rem; color: #111827;">Sentiment Analysis (${completeData.sentiments.total_reviews} reviews processed)</h3>
					<div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
						${Object.entries(sentiments).map(([sentiment, data]) => `
							<div style="display: flex; align-items: center; background: ${this.getSentimentBackgroundColor(sentiment)}; color: ${this.getSentimentTextColor(sentiment)}; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.8rem; font-weight: 500;">
								${capitalize(sentiment)}: ${data.percentage}% (${data.count})
							</div>
						`).join('')}
					</div>
				</div>
			`;
		}

		if (completeData && Array.isArray(completeData.topics)) {
            // Ensure topic labels are readable even if stored with underscores
            const formatTopicLabel = (label) => {
                return label
                    ? label.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                    : '';
            };
        
            if (completeData.topics.length > 0) {
                additionalSections += `
                    <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #f3f4f6;">
                        <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 0.75rem; color: #111827;">Frequently Mentioned Topics</h3>
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        ${completeData.topics.slice(0, 5).map(topic => {
                                const lbl = formatTopicLabel(topic.topic_label);
                                let s = 'neutral';
                                try {
                                    if (topic.sentiment_label) {
                                        // ✅ Use the sentiment returned by backend first
                                        s = topic.sentiment_label;
                                    } else if (topic.average_sentiment) {
                                        s = topic.average_sentiment;
                                    } else if (window.dataManager && typeof window.dataManager.getTopicSentiment === 'function') {
                                        // ✅ Only fallback to dataManager if backend didn't send it
                                        s = window.dataManager.getTopicSentiment(topic.topic_label);
                                    }
                                } catch (e) {
                                    console.warn('Error getting topic sentiment:', e);
                                }
        
                                // ✅ Apply sentiment-based color coding
                                const bg = s === 'positive' ? '#dcfce7' :
                                           s === 'negative' ? '#fee2e2' : '#f3f4f6';
                                const bd = s === 'positive' ? '#86efac' :
                                           s === 'negative' ? '#fecaca' : '#e5e7eb';
                                const fg = s === 'positive' ? '#166534' :
                                           s === 'negative' ? '#991b1b' : '#6b7280';
        
                                return `<div style="background: ${bg}; color: ${fg}; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.8rem; border: 1px solid ${bd};">${lbl}</div>`;
                            }).join('')}
                        </div>
                    </div>
                `;
            } else {
                additionalSections += `
                    <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #f3f4f6;">
                        <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 0.75rem; color: #111827;">Frequently Mentioned Topics</h3>
                        <div style="color: #6b7280; font-size: 0.875rem; font-style: italic;">
                            No topics available.
                        </div>
                    </div>
                `;
            }
        }
        

		modal.innerHTML = `
			<div class="modal-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;">
				<div class="modal-content" style="background: white; padding: 2rem; border-radius: 12px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
					<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
						<h2 style="margin: 0; color: #111827;">${product.name}</h2>
						<button class="close-modal" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #6b7280; padding: 0.25rem; border-radius: 4px; transition: background-color 0.2s;" onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='none'">×</button>
					</div>
					<div style="text-align: center; margin-bottom: 1rem;">
						<div style="width: 80px; height: 80px; background: #f3f4f6; border-radius: 8px; margin: 0 auto 0.5rem auto; display: flex; align-items: center; justify-content: center;">
							<img src="images/brands/${(product.brand || '').toLowerCase()}.png" alt="${product.brand || 'brand'}" style="max-width: 100%; max-height: 100%; object-fit: contain; display: block;" onerror="this.onerror=null; this.replaceWith(document.createTextNode('${(product.icon || '📱').replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\n/g, '')}'));">
						</div>
					<div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
						${(() => {
							const ratingVal = Number(product.rating || product.star_rating || 0);
							const label = (typeof getBiasLabelFromRating === 'function') ? getBiasLabelFromRating(ratingVal) : `${capitalize(product.sentiment)} Reviews`;
							const polarity = (typeof getPolarityFromRating === 'function') ? getPolarityFromRating(ratingVal) : (product.sentiment || 'neutral');
							const bg = this.getSentimentBackgroundColor(polarity);
							const fg = this.getSentimentTextColor(polarity);
							return `<span style=\"display: inline-block; padding: 0.25rem 0.75rem; background: ${bg}; color: ${fg}; border-radius: 20px; font-size: 0.875rem; font-weight: 500;\">${label}</span>`;
						})()}
					</div>
					</div>
					<p style="color: #6b7280; line-height: 1.6; margin-bottom: 1rem;">${product.description || ''}</p>
					<div style="display: flex; justify-content: space-between; align-items: center; padding-top: 1rem; border-top: 1px solid #f3f4f6;">
						<span style="color: #9ca3af; font-size: 0.875rem;">Brand: ${product.brand}</span>
						<span style="color: #9ca3af; font-size: 0.875rem;">Category: ${product.category}</span>
					</div>
					${additionalSections}
					<div style="margin-top: 1rem; padding: 0.5rem; background: #f0f9ff; border: 1px solid #e0f2fe; border-radius: 6px; text-align: center; font-size: 0.8rem; color: #0369a1;">📊 Data loaded from database</div>
				</div>
			</div>
		`;

		// Lock background scroll while modal is open
		const previousOverflow = document.body.style.overflow;
		document.body.dataset.prevOverflow = previousOverflow;
		document.body.style.overflow = 'hidden';

		document.body.appendChild(modal);

		// Handle close events
		const closeBtn = modal.querySelector('.close-modal');
		const overlay = modal.querySelector('.modal-overlay');
		const moreBtn = modal.querySelector('.show-more-reviews');

		const handleEscape = (e) => {
			if (e.key === 'Escape') {
				closeModal();
			}
		};

		const closeModal = () => {
			modal.style.opacity = '0';
			modal.style.transition = 'opacity 0.3s ease';
			setTimeout(() => modal.remove(), 300);
			document.removeEventListener('keydown', handleEscape);
			// Restore background scroll
			if (document.body.dataset.prevOverflow !== undefined) {
				document.body.style.overflow = document.body.dataset.prevOverflow;
				delete document.body.dataset.prevOverflow;
			} else {
				document.body.style.overflow = '';
			}
		};

		if (closeBtn) closeBtn.addEventListener('click', closeModal);
		if (overlay) overlay.addEventListener('click', (e) => {
			if (e.target === overlay) closeModal();
		});

		if (moreBtn) {
			let reviewsShown = 3;
			moreBtn.addEventListener('click', () => {
				const list = modal.querySelector('.recent-reviews-list');
				if (!list || !Array.isArray(shuffledReviews)) return;
				const nextBatch = shuffledReviews.slice(reviewsShown, reviewsShown + 5);
				nextBatch.forEach(review => {
					const item = document.createElement('div');
					item.style.background = '#f9fafb';
					item.style.padding = '0.75rem';
					item.style.borderRadius = '6px';
					item.style.marginBottom = '0.5rem';
					item.style.borderLeft = `3px solid ${this.getSentimentColor(review.sentiment_label)}`;
					item.innerHTML = `
						<div style=\"font-size: 0.8rem; color: #6b7280; margin-bottom: 0.25rem;\">${capitalize(review.sentiment_label)} sentiment • Review #${review.review_id}</div>
						<div style=\"font-size: 0.85rem; line-height: 1.4; color: #374151;\">${review.review_text || ''}</div>`;
					list.appendChild(item);
				});
				reviewsShown += nextBatch.length;
				if (reviewsShown >= shuffledReviews.length || nextBatch.length === 0) {
					moreBtn.disabled = true;
					moreBtn.textContent = 'No more reviews';
				}
			});
		}

		document.addEventListener('keydown', handleEscape);

		// Animate in
		modal.style.opacity = '0';
		setTimeout(() => {
			modal.style.transition = 'opacity 0.3s ease';
			modal.style.opacity = '1';
		}, 10);
	}

    // ... 🟢 sentiment color helpers unchanged


    showAboutModal() {
        const aboutModal = document.getElementById('about-modal');
        if (aboutModal) {
            aboutModal.style.display = 'flex';
            aboutModal.style.opacity = '0';
            aboutModal.style.transition = 'opacity 0.3s ease';
            
            // Lock background scroll
            document.body.style.overflow = 'hidden';
            
            // Animate in
            setTimeout(() => {
                aboutModal.style.opacity = '1';
            }, 10);
            
            // Handle escape key
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    this.hideAboutModal();
                    document.removeEventListener('keydown', handleEscape);
                }
            };
            document.addEventListener('keydown', handleEscape);
        }
    }

    hideAboutModal() {
        const aboutModal = document.getElementById('about-modal');
        if (aboutModal) {
            aboutModal.style.opacity = '0';
            aboutModal.style.transition = 'opacity 0.3s ease';
            
            // Restore background scroll
            document.body.style.overflow = '';
            
            setTimeout(() => {
                aboutModal.style.display = 'none';
            }, 300);
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#dcfce7' : type === 'error' ? '#fee2e2' : '#f0f9ff'};
            color: ${type === 'success' ? '#166534' : type === 'error' ? '#991b1b' : '#1e40af'};
            padding: 1rem;
            border-radius: 6px;
            border: 1px solid ${type === 'success'
                ? '#bbf7d0'
                : type === 'error'
                    ? '#fecaca'
                    : '#bfdbfe'};
            z-index: 10001;
            transition: all 0.3s ease;
            max-width: 300px;
        `;

        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    handleGlobalKeydown(event) {
        if (event.ctrlKey || event.metaKey) {
            switch (event.key) {
                case 'k':
                case '/':
                    event.preventDefault();
                    if (this.components.search) {
                        this.components.search.focusSearch();
                    }
                    break;
                case 'r':
                    event.preventDefault();
                    this.refreshData();
                    break;
            }
        }

        if (event.key === 'Escape' && this.components.search) {
            this.components.search.clearSearch();
        }
    }

    getSentimentColor(sentiment) {
        switch (sentiment) {
            case 'positive': return '#10b981';
            case 'negative': return '#ef4444';
            default: return '#d1d5db';
        }
    }
    
    getSentimentBackgroundColor(sentiment) {
        switch (sentiment) {
            case 'positive': return '#dcfce7';
            case 'negative': return '#fee2e2';
            default: return '#f9fafb';
        }
    }
    
    getSentimentTextColor(sentiment) {
        switch (sentiment) {
            case 'positive': return '#166534';
            case 'negative': return '#991b1b';
            default: return '#6b7280';
        }
    }
}

// Expose a global instance used by index.html
window.SentimentScope = new SentimentScopeApp();
