# import_csv.py
import pandas as pd
import mysql.connector
import argparse

def get_db():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="",         # change if needed or use env vars
        database="smartphone_reviews"
    )

def import_csv(csv_path):
    df = pd.read_csv(csv_path, dtype=str).fillna('')
    conn = get_db()
    cursor = conn.cursor()

    # cache maps to avoid repeated selects
    cursor.execute("SELECT brand_id, brand_name FROM brands")
    brands_map = {row[1]: row[0] for row in cursor.fetchall()}

    cursor.execute("SELECT phone_id, phone_name, brand_id FROM phones")
    phones_map = {(row[2], row[1]): row[0] for row in cursor.fetchall()}

    for idx, row in df.iterrows():
        brand = row['brand_name'].strip()
        phone = row['phone_name'].strip()
        review = row['review_text'].strip()

        if not brand or not phone or not review:
            continue

        # insert brand if missing
        if brand not in brands_map:
            cursor.execute("INSERT IGNORE INTO brands (brand_name) VALUES (%s)", (brand,))
            conn.commit()
            cursor.execute("SELECT brand_id FROM brands WHERE brand_name = %s", (brand,))
            brands_map[brand] = cursor.fetchone()[0]

        brand_id = brands_map[brand]

        # insert phone if missing
        key = (brand_id, phone)
        if key not in phones_map:
            cursor.execute("INSERT IGNORE INTO phones (brand_id, phone_name) VALUES (%s, %s)",
                           (brand_id, phone))
            conn.commit()
            cursor.execute("SELECT phone_id FROM phones WHERE brand_id = %s AND phone_name = %s",
                           (brand_id, phone))
            phones_map[key] = cursor.fetchone()[0]

        phone_id = phones_map[key]

        # insert review
        cursor.execute("INSERT INTO reviews (phone_id, review_text) VALUES (%s, %s)",
                       (phone_id, review))

    conn.commit()
    cursor.close()
    conn.close()
    print("Import finished.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("csv", help="Path to CSV file")
    args = parser.parse_args()
    import_csv(args.csv)
