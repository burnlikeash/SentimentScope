# ml_api.py 
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import mysql.connector
from transformers import pipeline
from bertopic import BERTopic
from sentence_transformers import SentenceTransformer
import re
import spacy
from sklearn.feature_extraction.text import CountVectorizer
import logging
from typing import Dict, List
import traceback

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Simple ML Pipeline API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load models once at startup
print("Loading ML models...")
try:
    sentiment_model = pipeline(
        "sentiment-analysis",
        model="distilbert/distilbert-base-uncased-finetuned-sst-2-english",
        tokenizer="distilbert/distilbert-base-uncased-finetuned-sst-2-english",
        truncation=True,
        max_length=512
    )
    embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
    nlp = spacy.load("en_core_web_sm", disable=["ner", "parser"])
    print("✅ All models loaded successfully!")
except Exception as e:
    print(f"❌ Failed to load models: {e}")
    sentiment_model = None
    embedding_model = None
    nlp = None

# Simple database connection
def get_db():
    try:
        return mysql.connector.connect(
            host="localhost",
            user="root",
            password="",
            database="smartphone_reviews",
            charset='utf8mb4',
            use_unicode=True,
            autocommit=False
        )
    except mysql.connector.Error as err:
        logger.error(f"Database connection error: {err}")
        raise HTTPException(status_code=500, detail="Database connection failed")

# Simple text cleaning
def clean_text(text: str) -> str:
    """Very simple text cleaning"""
    if not text or len(text.strip()) < 10:
        return ""
    
    # Basic cleaning
    text = text.lower()
    text = re.sub(r'[^a-zA-Z\s]', '', text)  # Keep only letters and spaces
    text = re.sub(r'\s+', ' ', text).strip()  # Normalize spaces
    
    return text

# Helper to create readable topic labels
def make_topic_label(words: List[str]) -> str:
    """Convert top topic words into a readable label.
    - Capitalize each word and replace underscores with spaces
    - Use natural phrasing for 2 or 3 words
    """
    def normalize(word: str) -> str:
        return word.replace("_", " ").strip().title()

    cleaned = [normalize(w) for w in words if isinstance(w, str) and w.strip()]

    if len(cleaned) == 2:
        return f"{cleaned[0]} and {cleaned[1]}"
    elif len(cleaned) == 3:
        return f"{cleaned[0]}, {cleaned[1]}, and {cleaned[2]}"
    elif len(cleaned) == 1:
        return cleaned[0]
    else:
        return " ".join(cleaned)

# Health check
@app.get("/")
def health_check():
    return {
        "status": "healthy",
        "models_loaded": {
            "sentiment": sentiment_model is not None,
            "embedding": embedding_model is not None,
            "nlp": nlp is not None
        }
    }

# -------- Single-text analysis (sentiment + topic) --------
class AnalyzeTextRequest(BaseModel):
    text: str

@app.post("/analyze-text")
def analyze_text(req: AnalyzeTextRequest):
    if not sentiment_model:
        raise HTTPException(status_code=500, detail="Sentiment model not loaded")

    raw_text = (req.text or "").strip()
    if len(raw_text) == 0:
        raise HTTPException(status_code=400, detail="Text is required")

    # Sentiment using existing model and logic similar to /run-sentiment
    result = sentiment_model(raw_text)[0]
    label = result['label'].lower()
    score = float(result['score'])

    if label == 'positive' and score < 0.7:
        label = 'neutral'
    elif label == 'negative' and score < 0.7:
        label = 'neutral'

    # Topic extraction (simple heuristic using spaCy noun chunks and keywords)
    topics: List[str] = []
    if nlp is not None:
        try:
            cleaned = clean_text(raw_text)
            if cleaned:
                doc = nlp(cleaned)
                # Collect frequent noun chunks and nouns as candidate topics
                candidate_words = []
                for chunk in doc.noun_chunks:
                    token_text = chunk.text.strip()
                    if len(token_text.split()) <= 3 and len(token_text) >= 3:
                        candidate_words.append(token_text.replace(" ", "_"))
                for token in doc:
                    if token.pos_ in {"NOUN", "PROPN"} and token.is_alpha and len(token.text) >= 3:
                        candidate_words.append(token.lemma_.strip())

                # Basic scoring by frequency
                freq: Dict[str, int] = {}
                for w in candidate_words:
                    if not w:
                        continue
                    freq[w] = freq.get(w, 0) + 1

                # Take top 3 unique by frequency
                top_words = sorted(freq.items(), key=lambda kv: kv[1], reverse=True)[:3]
                raw_topics = [w for (w, _) in top_words]
                # Convert to readable labels
                if raw_topics:
                    label_text = make_topic_label(raw_topics)
                    if label_text:
                        topics = [label_text]
        except Exception:
            # If topic extraction fails, just return empty topics
            topics = []

    return {
        "sentiment": label,
        "confidence": score,
        "topics": topics
    }

# Get processing status
@app.get("/status")
def get_processing_status():
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("SELECT COUNT(*) as total FROM reviews")
        total_reviews = cursor.fetchone()['total']
        
        cursor.execute("SELECT COUNT(*) as processed FROM sentiments")
        processed_sentiments = cursor.fetchone()['processed']
        
        cursor.execute("SELECT COUNT(*) as topics FROM topics")
        total_topics = cursor.fetchone()['topics']
        
        cursor.close()
        conn.close()
        
        return {
            "total_reviews": total_reviews,
            "processed_sentiments": processed_sentiments,
            "unprocessed_reviews": total_reviews - processed_sentiments,
            "total_topics": total_topics,
            "sentiment_percentage": round((processed_sentiments / total_reviews * 100), 1) if total_reviews > 0 else 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Simple sentiment analysis
@app.post("/run-sentiment")
def run_sentiment_analysis():
    if not sentiment_model:
        raise HTTPException(status_code=500, detail="Sentiment model not loaded")
    
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # Get unprocessed reviews
        cursor.execute("""
            SELECT r.review_id, r.review_text
            FROM reviews r
            LEFT JOIN sentiments s ON r.review_id = s.review_id
            WHERE s.review_id IS NULL
            LIMIT 10000
        """)
        
        reviews = cursor.fetchall()
        processed = 0
        errors = 0
        
        logger.info(f"Processing {len(reviews)} unprocessed reviews...")
        
        for review in reviews:
            try:
                text = review['review_text']
                if len(text.strip()) < 10:  # Skip very short reviews
                    continue
                
                # Get sentiment
                result = sentiment_model(text)[0]
                label = result['label'].lower()  # 'positive' or 'negative'
                score = float(result['score'])
                
                # Convert to our format (positive/negative/neutral)
                if label == 'positive' and score < 0.7:
                    label = 'neutral'
                elif label == 'negative' and score < 0.7:
                    label = 'neutral'
                
                # Insert into database
                cursor.execute("""
                    INSERT INTO sentiments (review_id, sentiment_label, sentiment_score)
                    VALUES (%s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                        sentiment_label = VALUES(sentiment_label),
                        sentiment_score = VALUES(sentiment_score)
                """, (review['review_id'], label, score))
                
                processed += 1
                
                if processed % 100 == 0:
                    logger.info(f"Processed {processed} reviews...")
                    
            except Exception as e:
                errors += 1
                logger.error(f"Error processing review {review['review_id']}: {e}")
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {
            "status": "completed",
            "processed": processed,
            "errors": errors,
            "total_reviews": len(reviews)
        }
        
    except Exception as e:
        logger.error(f"Sentiment analysis failed: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

# Simple topic modeling
@app.post("/run-topics")
def run_topic_modeling():
    if not embedding_model or not nlp:
        raise HTTPException(status_code=500, detail="Topic modeling models not loaded")
    
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # Get phones with reviews
        cursor.execute("""
            SELECT p.phone_id, p.phone_name, COUNT(r.review_id) as review_count
            FROM phones p
            INNER JOIN reviews r ON p.phone_id = r.phone_id
            GROUP BY p.phone_id, p.phone_name
            HAVING COUNT(r.review_id) >= 10
            ORDER BY review_count DESC
        """)
        
        phones = cursor.fetchall()
        results = []
        
        logger.info(f"Processing topics for {len(phones)} phones...")
        
        for phone in phones:
            phone_id = phone['phone_id']
            phone_name = phone['phone_name']
            
            try:
                # Get reviews for this phone
                cursor.execute("""
                    SELECT review_id, review_text
                    FROM reviews
                    WHERE phone_id = %s
                """, (phone_id,))
                
                reviews = cursor.fetchall()
                
                # Clean reviews
                docs = []
                review_ids = []
                
                for review in reviews:
                    cleaned = clean_text(review['review_text'])
                    if cleaned and len(cleaned.split()) >= 5:  # At least 5 words
                        docs.append(cleaned)
                        review_ids.append(review['review_id'])
                
                if len(docs) < 10:
                    results.append(f"Skipped {phone_name}: only {len(docs)} clean reviews")
                    continue

                n_docs = len(docs)
                if n_docs < 5:
                    results.append(f"Skipped {phone_name}: only {n_docs} clean reviews (too few for topic modeling)")
                    continue

                # Adaptive thresholds
                min_df = 1 if n_docs < 10 else 2 if n_docs < 20 else 3
                max_df = 1.0 if n_docs < 10 else 0.9 if n_docs < 20 else 0.8

                logger.info(f"{phone_name}: Using min_df={min_df}, max_df={max_df}, docs={n_docs}")

                def create_topic_model(ngram_range=(1, 2), min_df=min_df, max_df=max_df):
                    vectorizer = CountVectorizer(
                        stop_words='english',
                        min_df=min_df,
                        max_df=max_df,
                        max_features=500,
                        ngram_range=ngram_range
                    )
                    return BERTopic(
                        embedding_model=embedding_model,
                        vectorizer_model=vectorizer,
                        nr_topics=min(8, max(3, n_docs // 10)),
                        min_topic_size=max(5, n_docs // 20),
                        calculate_probabilities=True,
                        verbose=False
                    )

                # Try primary configuration
                try:
                    topic_model = create_topic_model()
                    topics, probs = topic_model.fit_transform(docs)
                except Exception as first_error:
                    logger.warning(f"{phone_name}: Initial topic modeling failed ({first_error}); retrying with simpler settings...")
                    # Retry with safer parameters
                    try:
                        topic_model = create_topic_model(ngram_range=(1, 1), min_df=1, max_df=1.0)
                        topics, probs = topic_model.fit_transform(docs)
                    except Exception as retry_error:
                        logger.error(f"❌ {phone_name}: Retry also failed: {retry_error}")
                        results.append(f"❌ {phone_name}: Topic modeling failed completely")
                        continue

                # Process topics
                topics_created = 0
                unique_topics = set(topics)
                
                for topic_id in unique_topics:
                    if topic_id == -1:
                        continue
                    
                    try:
                        topic_words = topic_model.get_topic(topic_id)
                        if not topic_words or len(topic_words) < 3:
                            continue
                        
                        top_words = [word for word, _ in topic_words[:3]]
                        topic_label = make_topic_label(top_words)
                        representative_terms = ", ".join([f"{word}({score:.2f})" for word, score in topic_words[:5]])
                        
                        cursor.execute("""
                            INSERT IGNORE INTO topics (phone_id, topic_label, representative_terms)
                            VALUES (%s, %s, %s)
                        """, (phone_id, topic_label, representative_terms))
                        
                        topic_db_id = cursor.lastrowid
                        if topic_db_id == 0:
                            cursor.execute("""
                                SELECT topic_id FROM topics
                                WHERE phone_id = %s AND topic_label = %s
                            """, (phone_id, topic_label))
                            result = cursor.fetchone()
                            if result:
                                topic_db_id = result['topic_id']
                        
                        if topic_db_id:
                            for i, doc_topic in enumerate(topics):
                                if doc_topic == topic_id:
                                    if probs is not None and len(getattr(probs, "shape", [])) > 1:
                                        score = float(probs[i, topic_id]) if topic_id < probs.shape[1] else float(probs[i].max())
                                    else:
                                        score = 0.5

                                    cursor.execute("""
                                        INSERT IGNORE INTO review_topics (review_id, topic_id, relevance_score)
                                        VALUES (%s, %s, %s)
                                    """, (review_ids[i], topic_db_id, score))
                        
                        topics_created += 1
                        
                    except Exception as topic_error:
                        logger.error(f"Error processing topic {topic_id} for {phone_name}: {topic_error}")
                
                results.append(f"✅ {phone_name}: {topics_created} topics created")
                logger.info(f"Processed {phone_name}: {topics_created} topics")
                
            except Exception as phone_error:
                error_msg = f"❌ {phone_name}: {str(phone_error)}"
                results.append(error_msg)
                logger.error(error_msg)
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {
            "status": "completed",
            "phones_processed": len(phones),
            "results": results
        }
        
    except Exception as e:
        logger.error(f"Topic modeling failed: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

# Process everything
@app.post("/process-all")
def process_everything():
    try:
        # Run sentiment analysis first
        sentiment_result = run_sentiment_analysis()
        
        # Then run topic modeling
        topic_result = run_topic_modeling()
        
        return {
            "status": "completed",
            "sentiment_result": sentiment_result,
            "topic_result": topic_result
        }
        
    except Exception as e:
        logger.error(f"Full processing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Clear all processed data
@app.delete("/clear-all")
def clear_processed_data():
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute("DELETE FROM review_topics")
        cursor.execute("DELETE FROM topics")
        cursor.execute("DELETE FROM sentiments")
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {"status": "All processed data cleared"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Run with: uvicorn ml_api:app --reload --port 8001