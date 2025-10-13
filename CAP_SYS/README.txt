PREREQS:
pip install -r requirements.txt


#1  FIRST STEP IS TO UPLOAD THIS QUERY INTO DATABASE

//STARTS HERE//

CREATE DATABASE IF NOT EXISTS smartphone_reviews;
USE smartphone_reviews;

CREATE TABLE brands (
  brand_id INT AUTO_INCREMENT PRIMARY KEY,
  brand_name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE phones (
  phone_id INT AUTO_INCREMENT PRIMARY KEY,
  brand_id INT NOT NULL,
  phone_name VARCHAR(200) NOT NULL,
  UNIQUE KEY brand_phone_unique (brand_id, phone_name),
  FOREIGN KEY (brand_id) REFERENCES brands(brand_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE reviews (
  review_id INT AUTO_INCREMENT PRIMARY KEY,
  phone_id INT NOT NULL,
  review_text TEXT NOT NULL,
  FOREIGN KEY (phone_id) REFERENCES phones(phone_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ML tables
CREATE TABLE sentiments (
  sentiment_id INT AUTO_INCREMENT PRIMARY KEY,
  review_id INT NOT NULL UNIQUE,
  sentiment_label ENUM('positive','negative','neutral') NOT NULL,
  sentiment_score FLOAT,
  FOREIGN KEY (review_id) REFERENCES reviews(review_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE topics (
  topic_id INT AUTO_INCREMENT PRIMARY KEY,
  phone_id INT NOT NULL,
  topic_label VARCHAR(255) NOT NULL,
  representative_terms TEXT,
  UNIQUE KEY idx_phone_topic (phone_id, topic_label),  -- ✅ prevent duplicate topics
  FOREIGN KEY (phone_id) REFERENCES phones(phone_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE review_topics (
  review_id INT NOT NULL,
  topic_id INT NOT NULL,
  relevance_score FLOAT,
  PRIMARY KEY (review_id, topic_id),  -- ✅ already unique
  FOREIGN KEY (review_id) REFERENCES reviews(review_id) ON DELETE CASCADE,
  FOREIGN KEY (topic_id) REFERENCES topics(topic_id) ON DELETE CASCADE
) ENGINE=InnoDB;

//ENDS HERE//


#2  SECOND STEP IS TO UPLOAD CSV INTO DATABASE
- run this command in terminal

[ python import_csv.py example.csv ]



#3 RUN ML API
- run this command in new terminal

[uvicorn ml_api:app --reload --port 8001]

- in another terminal, run: (endpoints, processes reviews)

curl.exe -X POST http://127.0.0.1:8001/run-sentiment
curl.exe -X POST http://127.0.0.1:8001/run-topics
curl.exe -X POST http://127.0.0.1:8001/process-all


#4 RUN DB API
- run this command in new terminal

[uvicorn db_api:app --reload --port 8000]


-----------------------------------------------
TO USE THE APIS:

- Start DATABASE API in terminal
[ uvicorn db_api:app --reload --port 8000 ] 

- Start ML API in terminal
[ uvicorn ml_api:app --reload --port 8001 ]

- RUN THE APIS
# sentiment for all reviews
curl -X POST http://127.0.0.1:8001/run-sentiment

# topics for a specific phone (phone_id = 3)
curl -X POST http://127.0.0.1:8001/run-all-topics






