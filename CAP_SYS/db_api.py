# db_api.py - Updated for Your Specific Schema
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import mysql.connector
from typing import List, Dict, Optional
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="SentimentScope Database API", version="1.0.0")

# Add CORS middleware to allow frontend connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper to convert positive percentage to a 1.0–5.0 star rating
def compute_star_rating_from_positive_percentage(positive_percentage: float) -> float:
    if positive_percentage >= 80:
        return 5.0
    elif positive_percentage >= 60:
        return 4.0
    elif positive_percentage >= 40:
        return 3.0
    elif positive_percentage >= 20:
        return 2.0
    else:
        return 1.0

# Database connection with error handling
def get_db():
    try:
        return mysql.connector.connect(
            host="localhost",
            user="root",
            password="",
            database="smartphone_reviews",
            charset='utf8mb4',
            use_unicode=True
        )
    except mysql.connector.Error as err:
        logger.error(f"Database connection error: {err}")
        raise HTTPException(status_code=500, detail="Database connection failed")

# Health check endpoint
@app.get("/")
def health_check():
    return {"status": "healthy", "message": "SentimentScope API is running"}

# Database stats endpoint
@app.get("/stats")
def get_database_stats():
    """Get overall database statistics"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        stats = {}
        
        # Count brands
        cursor.execute("SELECT COUNT(*) as count FROM brands")
        stats['brands'] = cursor.fetchone()['count']
        
        # Count phones
        cursor.execute("SELECT COUNT(*) as count FROM phones")
        stats['phones'] = cursor.fetchone()['count']
        
        # Count reviews
        cursor.execute("SELECT COUNT(*) as count FROM reviews")
        stats['reviews'] = cursor.fetchone()['count']
        
        # Count processed sentiments
        cursor.execute("SELECT COUNT(*) as count FROM sentiments")
        stats['processed_sentiments'] = cursor.fetchone()['count']
        
        # Count topics
        cursor.execute("SELECT COUNT(*) as count FROM topics")
        stats['topics'] = cursor.fetchone()['count']
        
        cursor.close()
        conn.close()
        
        return stats
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 1. Get all brands
@app.get("/brands")
def get_brands() -> List[Dict]:
    """Get all smartphone brands"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM brands ORDER BY brand_name")
        results = cursor.fetchall()
        cursor.close()
        conn.close()
        logger.info(f"Retrieved {len(results)} brands")
        return results
    except Exception as e:
        logger.error(f"Error getting brands: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 2. Get phones with enhanced information
@app.get("/phones")
def get_phones(
    brand_id: Optional[int] = Query(None, description="Filter by brand ID"),
    search: Optional[str] = Query(None, description="Search phone names"),
    limit: Optional[int] = Query(None, description="Limit results")
) -> List[Dict]:
    """Get phones with review and sentiment statistics"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # Optimized query with computed positive percentage for cleaner star rating calculation
        query = """
            SELECT 
                p.phone_id,
                p.phone_name,
                p.brand_id,
                b.brand_name,
                COUNT(DISTINCT r.review_id) as review_count,
                COUNT(DISTINCT s.sentiment_id) as processed_sentiments,
                COALESCE(AVG(CASE 
                    WHEN s.sentiment_label = 'positive' THEN 5
                    WHEN s.sentiment_label = 'neutral' THEN 3
                    WHEN s.sentiment_label = 'negative' THEN 1
                    ELSE NULL
                END), 3.0) as avg_sentiment_rating,
                CASE 
                    WHEN COUNT(DISTINCT s.sentiment_id) = 0 THEN 3.0
                    WHEN (COUNT(DISTINCT CASE WHEN s.sentiment_label = 'positive' THEN s.sentiment_id END) * 100.0 / COUNT(DISTINCT s.sentiment_id)) >= 80 THEN 5.0
                    WHEN (COUNT(DISTINCT CASE WHEN s.sentiment_label = 'positive' THEN s.sentiment_id END) * 100.0 / COUNT(DISTINCT s.sentiment_id)) >= 60 THEN 4.0
                    WHEN (COUNT(DISTINCT CASE WHEN s.sentiment_label = 'positive' THEN s.sentiment_id END) * 100.0 / COUNT(DISTINCT s.sentiment_id)) >= 40 THEN 3.0
                    WHEN (COUNT(DISTINCT CASE WHEN s.sentiment_label = 'positive' THEN s.sentiment_id END) * 100.0 / COUNT(DISTINCT s.sentiment_id)) >= 20 THEN 2.0
                    ELSE 1.0
                END as star_rating,
                GROUP_CONCAT(DISTINCT t.topic_label SEPARATOR ', ') as topics
            FROM phones p
            LEFT JOIN brands b ON p.brand_id = b.brand_id
            LEFT JOIN reviews r ON p.phone_id = r.phone_id
            LEFT JOIN sentiments s ON r.review_id = s.review_id
            LEFT JOIN topics t ON p.phone_id = t.phone_id
        """
        params = []
        conditions = []
        
        if brand_id is not None:
            conditions.append("p.brand_id = %s")
            params.append(brand_id)
            
        if search:
            conditions.append("p.phone_name LIKE %s")
            params.append(f"%{search}%")
        
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
            
        query += " GROUP BY p.phone_id, p.phone_name, p.brand_id, b.brand_name"
        query += " ORDER BY review_count DESC, p.phone_name"
        
        if limit:
            query += f" LIMIT {limit}"
        
        cursor.execute(query, params)
        results = cursor.fetchall()
        
        # Convert ratings to float and handle None values
        for result in results:
            if result['avg_sentiment_rating'] is not None:
                result['avg_sentiment_rating'] = float(result['avg_sentiment_rating'])
            else:
                result['avg_sentiment_rating'] = 3.0  # Default neutral
            if 'star_rating' in result and result['star_rating'] is not None:
                result['star_rating'] = float(result['star_rating'])
            else:
                result['star_rating'] = 3.0
                
        cursor.close()
        conn.close()
        
        logger.info(f"Retrieved {len(results)} phones")
        return results
    except Exception as e:
        logger.error(f"Error getting phones: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 3. Get reviews by phone
@app.get("/reviews")
def get_reviews(
    phone_id: int,
    limit: Optional[int] = Query(100, description="Limit number of reviews"),
    with_sentiment: Optional[bool] = Query(True, description="Include sentiment data")
) -> List[Dict]:
    """Get reviews for a specific phone with optional sentiment data"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        if with_sentiment:
            query = """
                SELECT 
                    r.*,
                    s.sentiment_label,
                    s.sentiment_score,
                    p.phone_name,
                    b.brand_name
                FROM reviews r
                LEFT JOIN sentiments s ON r.review_id = s.review_id
                LEFT JOIN phones p ON r.phone_id = p.phone_id
                LEFT JOIN brands b ON p.brand_id = b.brand_id
                WHERE r.phone_id = %s
                ORDER BY COALESCE(s.sentiment_score, 0) DESC, r.review_id DESC
                LIMIT %s
            """
        else:
            query = """
                SELECT 
                    r.*,
                    p.phone_name,
                    b.brand_name
                FROM reviews r
                LEFT JOIN phones p ON r.phone_id = p.phone_id
                LEFT JOIN brands b ON p.brand_id = b.brand_id
                WHERE r.phone_id = %s
                ORDER BY r.review_id DESC
                LIMIT %s
            """
            
        cursor.execute(query, (phone_id, limit))
        results = cursor.fetchall()
        cursor.close()
        conn.close()
        
        logger.info(f"Retrieved {len(results)} reviews for phone {phone_id}")
        return results
    except Exception as e:
        logger.error(f"Error getting reviews: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 4. Get sentiment summary by phone - Updated for your schema
@app.get("/sentiments")
def get_sentiments(phone_id: int) -> Dict:
    """Get sentiment analysis summary for a phone"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT 
                s.sentiment_label, 
                COUNT(*) as count, 
                AVG(s.sentiment_score) as avg_confidence,
                MIN(s.sentiment_score) as min_score,
                MAX(s.sentiment_score) as max_score
            FROM sentiments s
            INNER JOIN reviews r ON s.review_id = r.review_id
            WHERE r.phone_id = %s
            GROUP BY s.sentiment_label
            ORDER BY count DESC
        """, (phone_id,))
        results = cursor.fetchall()
        cursor.close()
        conn.close()
        
        # Transform to frontend-friendly format
        sentiment_data = {}
        total_reviews = 0
        
        for row in results:
            sentiment_data[row["sentiment_label"]] = {
                "count": row["count"],
                "confidence": float(row["avg_confidence"] or 0),
                "min_score": float(row["min_score"] or 0),
                "max_score": float(row["max_score"] or 0)
            }
            total_reviews += row["count"]
        
        # Add percentages
        for sentiment in sentiment_data:
            sentiment_data[sentiment]["percentage"] = round(
                (sentiment_data[sentiment]["count"] / total_reviews) * 100, 1
            ) if total_reviews > 0 else 0
        
        result = {
            "phone_id": phone_id,
            "total_reviews": total_reviews,
            "sentiments": sentiment_data
        }
        
        logger.info(f"Retrieved sentiment data for phone {phone_id}: {total_reviews} processed reviews")
        return result
    except Exception as e:
        logger.error(f"Error getting sentiments: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 5. Get topics by phone - Updated for your schema
@app.get("/topics")
def get_topics(phone_id: int) -> List[Dict]:
    """Get discussion topics for a phone with relevance scores"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT 
                t.*,
                COUNT(DISTINCT rt.review_id) as review_mentions,
                AVG(rt.relevance_score) as avg_relevance
            FROM topics t
            LEFT JOIN review_topics rt ON t.topic_id = rt.topic_id
            WHERE t.phone_id = %s
            GROUP BY t.topic_id
            ORDER BY avg_relevance DESC, review_mentions DESC
        """, (phone_id,))
        results = cursor.fetchall()
        cursor.close()
        conn.close()
        
        # Convert float fields
        for result in results:
            if result['avg_relevance'] is not None:
                result['avg_relevance'] = float(result['avg_relevance'])
        
        logger.info(f"Retrieved {len(results)} topics for phone {phone_id}")
        return results
    except Exception as e:
        logger.error(f"Error getting topics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 6. Get complete phone details with all related data
@app.get("/phones/{phone_id}/complete")
def get_complete_phone_data(phone_id: int) -> Dict:
    """Get complete phone data including reviews, sentiments, and topics"""
    try:
        # Get phone details directly from DB instead of calling get_phones()
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT 
                p.phone_id,
                p.phone_name,
                p.brand_id,
                b.brand_name
            FROM phones p
            LEFT JOIN brands b ON p.brand_id = b.brand_id
            WHERE p.phone_id = %s
        """, (phone_id,))
        phone = cursor.fetchone()
        cursor.close()
        conn.close()

        if not phone:
            raise HTTPException(status_code=404, detail="Phone not found")

        # Wrap subqueries safely
        try:
            reviews = get_reviews(phone_id, limit=50, with_sentiment=True)
        except Exception as e:
            logger.warning(f"Could not fetch reviews for phone {phone_id}: {e}")
            reviews = []

        try:
            sentiments = get_sentiments(phone_id)
        except Exception as e:
            logger.warning(f"Could not fetch sentiments for phone {phone_id}: {e}")
            sentiments = {"phone_id": phone_id, "total_reviews": 0, "sentiments": {}}

        # Compute star rating from sentiments distribution (positive percentage)
        positive_percentage = 0.0
        try:
            positive_percentage = float(sentiments.get("sentiments", {}).get("positive", {}).get("percentage", 0.0) or 0.0)
        except Exception:
            positive_percentage = 0.0
        star_rating = compute_star_rating_from_positive_percentage(positive_percentage)

        try:
            topics = get_topics(phone_id)
        except Exception as e:
            logger.warning(f"Could not fetch topics for phone {phone_id}: {e}")
            topics = []

        # Attach star_rating to phone object for convenience and include separately
        phone_with_rating = dict(phone)
        phone_with_rating["star_rating"] = float(star_rating)
        return {
            "phone": phone_with_rating,
            "star_rating": float(star_rating),
            "sentiments": sentiments,
            "reviews": reviews,
            "topics": topics
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting complete phone data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# 7. Search functionality updated for your schema
@app.get("/search")
def search_phones(
    query: str = Query(..., description="Search query"),
    sentiment_filter: Optional[str] = Query(None, description="Filter by sentiment"),
    brand_filter: Optional[int] = Query(None, description="Filter by brand ID"),
    min_reviews: Optional[int] = Query(None, description="Minimum number of reviews"),
    limit: Optional[int] = Query(20, description="Limit results")
) -> Dict:
    """Advanced search with multiple filters"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        search_query = """
            SELECT DISTINCT 
                p.*,
                b.brand_name,
                COUNT(DISTINCT r.review_id) as review_count,
                COUNT(DISTINCT s.sentiment_id) as processed_sentiments,
                COALESCE(AVG(CASE 
                    WHEN s.sentiment_label = 'positive' THEN 5
                    WHEN s.sentiment_label = 'neutral' THEN 3
                    WHEN s.sentiment_label = 'negative' THEN 1
                    ELSE NULL
                END), 3.0) as avg_sentiment_rating,
                CASE 
                    WHEN COUNT(DISTINCT s.sentiment_id) = 0 THEN 3.0
                    WHEN (COUNT(DISTINCT CASE WHEN s.sentiment_label = 'positive' THEN s.sentiment_id END) * 100.0 / COUNT(DISTINCT s.sentiment_id)) >= 80 THEN 5.0
                    WHEN (COUNT(DISTINCT CASE WHEN s.sentiment_label = 'positive' THEN s.sentiment_id END) * 100.0 / COUNT(DISTINCT s.sentiment_id)) >= 60 THEN 4.0
                    WHEN (COUNT(DISTINCT CASE WHEN s.sentiment_label = 'positive' THEN s.sentiment_id END) * 100.0 / COUNT(DISTINCT s.sentiment_id)) >= 40 THEN 3.0
                    WHEN (COUNT(DISTINCT CASE WHEN s.sentiment_label = 'positive' THEN s.sentiment_id END) * 100.0 / COUNT(DISTINCT s.sentiment_id)) >= 20 THEN 2.0
                    ELSE 1.0
                END as star_rating
            FROM phones p
            LEFT JOIN brands b ON p.brand_id = b.brand_id
            LEFT JOIN reviews r ON p.phone_id = r.phone_id
            LEFT JOIN sentiments s ON r.review_id = s.review_id
            WHERE (p.phone_name LIKE %s OR r.review_text LIKE %s)
        """
        params = [f"%{query}%", f"%{query}%"]
        
        if sentiment_filter:
            search_query += " AND s.sentiment_label = %s"
            params.append(sentiment_filter)
            
        if brand_filter:
            search_query += " AND p.brand_id = %s"
            params.append(brand_filter)
        
        search_query += " GROUP BY p.phone_id, p.phone_name, p.brand_id, b.brand_name"
        
        if min_reviews:
            search_query += f" HAVING COUNT(DISTINCT r.review_id) >= {min_reviews}"
        
        search_query += " ORDER BY review_count DESC, processed_sentiments DESC, p.phone_name"
        
        if limit:
            search_query += f" LIMIT {limit}"
        
        cursor.execute(search_query, params)
        results = cursor.fetchall()
        
        # Convert float fields
        for result in results:
            if result['avg_sentiment_rating'] is not None:
                result['avg_sentiment_rating'] = float(result['avg_sentiment_rating'])
            if 'star_rating' in result and result['star_rating'] is not None:
                result['star_rating'] = float(result['star_rating'])
        
        cursor.close()
        conn.close()
        
        logger.info(f"Search for '{query}' returned {len(results)} results")
        return {
            "query": query,
            "total_results": len(results),
            "phones": results
        }
    except Exception as e:
        logger.error(f"Error in search: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 8. Get unprocessed reviews (for ML pipeline)
@app.get("/reviews/unprocessed")
def get_unprocessed_reviews(limit: Optional[int] = Query(100)) -> List[Dict]:
    """Get reviews that haven't been processed for sentiment analysis yet"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT r.*, p.phone_name, b.brand_name
            FROM reviews r
            LEFT JOIN phones p ON r.phone_id = p.phone_id
            LEFT JOIN brands b ON p.brand_id = b.brand_id
            LEFT JOIN sentiments s ON r.review_id = s.review_id
            WHERE s.sentiment_id IS NULL
            ORDER BY r.review_id ASC
            LIMIT %s
        """, (limit,))
        results = cursor.fetchall()
        cursor.close()
        conn.close()
        
        logger.info(f"Retrieved {len(results)} unprocessed reviews")
        return results
    except Exception as e:
        logger.error(f"Error getting unprocessed reviews: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 9. Health check for ML processing status
@app.get("/ml-status")
def get_ml_processing_status() -> Dict:
    """Get status of ML processing (sentiment analysis and topic modeling)"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # Get processing statistics
        cursor.execute("""
            SELECT 
                COUNT(r.review_id) as total_reviews,
                COUNT(s.sentiment_id) as processed_sentiments,
                COUNT(t.topic_id) as total_topics,
                COUNT(rt.review_id) as topic_assignments
            FROM reviews r
            LEFT JOIN sentiments s ON r.review_id = s.review_id
            LEFT JOIN topics t ON r.phone_id = t.phone_id
            LEFT JOIN review_topics rt ON r.review_id = rt.review_id
        """)
        stats = cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        total_reviews = stats['total_reviews']
        processed_sentiments = stats['processed_sentiments']
        
        result = {
            "total_reviews": total_reviews,
            "processed_sentiments": processed_sentiments,
            "unprocessed_reviews": total_reviews - processed_sentiments,
            "processing_percentage": round((processed_sentiments / total_reviews * 100), 1) if total_reviews > 0 else 0,
            "total_topics": stats['total_topics'],
            "topic_assignments": stats['topic_assignments']
        }
        
        return result
    except Exception as e:
        logger.error(f"Error getting ML status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Run with: uvicorn db_api:app --reload --port 8000