// Simple Database API client used by the website only

(function () {
	const DEFAULT_BASE_URL = 'http://localhost:8000';

	class ApiService {
		constructor(baseUrl = DEFAULT_BASE_URL) {
			this.baseUrl = baseUrl.replace(/\/$/, '');
			this.cache = new Map();
			this.defaultHeaders = {
				'Content-Type': 'application/json'
			};
		}

		async apiCall(path, options = {}) {
			const url = `${this.baseUrl}${path}`;
			const useCache = (!options.method || options.method.toUpperCase() === 'GET') && options.cache !== false;
			
			// Check cache with timestamp for cache invalidation
			if (useCache && this.cache.has(url)) {
				const cached = this.cache.get(url);
				const cacheAge = Date.now() - cached.timestamp;
				const maxAge = options.maxAge || 5 * 60 * 1000; // 5 minutes default
				
				if (cacheAge < maxAge) {
					return cached.data;
				} else {
					this.cache.delete(url); // Remove expired cache
				}
			}

			const controller = new AbortController();
			const timeoutMs = options.timeout || 20000;
			const timeout = setTimeout(() => controller.abort(), timeoutMs);

			try {
				const resp = await fetch(url, {
					method: options.method || 'GET',
					headers: { ...this.defaultHeaders, ...(options.headers || {}) },
					body: options.body ? JSON.stringify(options.body) : undefined,
					signal: controller.signal,
					mode: 'cors'
				});
				if (!resp.ok) {
					throw new Error(`API error ${resp.status}: ${resp.statusText}`);
				}
				const data = await resp.json();
				if (useCache) {
					this.cache.set(url, { data, timestamp: Date.now() });
				}
				return data;
			} finally {
				clearTimeout(timeout);
			}
		}

		clearCache() {
			this.cache.clear();
		}

		// Endpoints used by the website
		getBrands() {
			return this.apiCall('/brands');
		}

		getAllPhones() {
			return this.apiCall('/phones');
		}

		getSentimentsByPhone(phoneId) {
			return this.apiCall(`/sentiments?phone_id=${encodeURIComponent(phoneId)}`);
		}

		getCompletePhoneData(phoneId) {
			return this.apiCall(`/phones/${encodeURIComponent(phoneId)}/complete`);
		}

		getStats() {
			return this.apiCall('/stats');
		}

		// ML API (FastAPI ml_api.py assumed at http://localhost:8001)
		async analyzeText(text) {
			const mlBase = 'http://localhost:8001';
			const url = `${mlBase}/analyze-text`;
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 20000);
			try {
				const resp = await fetch(url, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ text }),
					signal: controller.signal,
					mode: 'cors'
				});
				if (!resp.ok) {
					throw new Error(`ML API error ${resp.status}: ${resp.statusText}`);
				}
				return await resp.json();
			} finally {
				clearTimeout(timeout);
			}
		}

		// Shape raw DB rows into the UI product shape expected by components
		transformPhoneData(phoneRow, sentiments = {}) {
			const dominantSentiment = (() => {
				const entries = Object.entries(sentiments);
				if (entries.length === 0) return 'neutral';
				entries.sort((a, b) => (b[1]?.count || 0) - (a[1]?.count || 0));
				return entries[0][0];
			})();

			return {
				id: phoneRow.phone_id,
				name: phoneRow.phone_name,
				brand: phoneRow.brand_name,
				category: 'Smartphones',
				description: `Reviews: ${phoneRow.review_count || 0}.`,
				sentiment: dominantSentiment,
				star_rating: phoneRow.star_rating != null
					? Number(phoneRow.star_rating)
					: (phoneRow.avg_sentiment_rating != null ? Number(phoneRow.avg_sentiment_rating) : 3.0),
				rating: phoneRow.star_rating != null
					? Number(phoneRow.star_rating)
					: (phoneRow.avg_sentiment_rating != null ? Number(phoneRow.avg_sentiment_rating) : 3.0),
				// Parse topics string from DB to array for filtering
				topics: typeof phoneRow.topics === 'string' && phoneRow.topics.trim().length > 0
					? phoneRow.topics.split(',').map(t => t.trim()).filter(Boolean)
					: [],
				icon: '📱'
			};
		}
	}

	// Expose globally
	window.apiService = new ApiService();
})();
