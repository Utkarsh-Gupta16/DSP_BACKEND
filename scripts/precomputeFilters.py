import pymongo
import sys
import psutil
from pymongo import MongoClient
from collections import defaultdict

# Batch size for processing documents
BATCH_SIZE = 10000

# Function to monitor memory usage
def log_memory_usage():
    process = psutil.Process()
    memory_info = process.memory_info()
    memory_mb = memory_info.rss / 1024 / 1024  # Convert bytes to MB
    print(f"Memory Usage: {memory_mb:.2f} MB")
    if memory_mb > 256:
        print("Warning: Memory usage exceeds 256MB, consider reducing batch size.")

def precompute_filters():
    try:
        print("Starting precomputation of filters...")

        # Connect to MongoDB
        client = MongoClient("mongodb://127.0.0.1:27017/DataSellingProject")
        db = client["DataSellingProject"]
        company_collection = db["companies"]
        filter_metadata_collection = db["filterMetadata"]

        # Clear existing metadata
        filter_metadata_collection.delete_many({})
        print("Cleared existing FilterMetadata collection.")

        # Precompute all counts in a single pass
        print("Precomputing all counts in a single pass...")
        category_counts = defaultdict(int)
        subcategory_counts = defaultdict(int)
        sub_subcategory_counts = defaultdict(int)

        # Single aggregation pipeline to compute all counts
        pipeline = [
            # Match documents that have at least one non-null, non-"N/A" field
            {
                "$match": {
                    "$or": [
                        {"category": {"$ne": None, "$ne": "N/A"}},
                        {"subcategory": {"$ne": None, "$ne": "N/A"}},
                        {"Categories": {"$ne": None, "$ne": "N/A"}}
                    ]
                }
            },
            # Group by all fields to compute counts
            {
                "$group": {
                    "_id": {
                        "category": "$category",
                        "subcategory": "$subcategory",
                        "subSubcategory": "$Categories"
                    },
                    "count": {"$sum": 1}
                }
            }
        ]

        # Stream the aggregation results
        cursor = company_collection.aggregate(pipeline, allowDiskUse=True)
        batch_count = 0
        for doc in cursor:
            category = doc["_id"]["category"]
            subcategory = doc["_id"]["subcategory"]
            sub_subcategory = doc["_id"]["subSubcategory"]
            count = doc["count"]

            # Update category counts
            if category and category != "N/A":
                category_counts[category] += count

            # Update subcategory counts
            if category and subcategory and subcategory != "N/A":
                key = f"{category}:{subcategory}"
                subcategory_counts[key] += count

            # Update sub-subcategory counts
            if category and subcategory and sub_subcategory and sub_subcategory != "N/A":
                key = f"{category}:{subcategory}:{sub_subcategory}"
                sub_subcategory_counts[key] += count

            batch_count += 1
            if batch_count % BATCH_SIZE == 0:
                log_memory_usage()

        log_memory_usage()

        # Prepare documents for insertion
        print("Preparing documents for insertion...")

        # Category documents
        category_docs = [
            {"type": "category", "value": value, "count": count}
            for value, count in category_counts.items()
        ]

        # Subcategory documents
        subcategory_docs = [
            {"type": "subcategory", "category": key.split(":")[0], "value": key.split(":")[1], "count": count}
            for key, count in subcategory_counts.items()
        ]

        # Sub-subcategory documents
        sub_subcategory_docs = [
            {
                "type": "subSubcategory",
                "category": key.split(":")[0],
                "subcategory": key.split(":")[1],
                "value": key.split(":")[2],
                "count": count
            }
            for key, count in sub_subcategory_counts.items()
        ]

        # Combine all documents
        all_docs = category_docs + subcategory_docs + sub_subcategory_docs
        print(f"Total documents to insert: {len(all_docs)}")

        # Insert all documents using insert_many
        print("Inserting documents using insert_many...")
        inserted_count = 0

        for i in range(0, len(all_docs), BATCH_SIZE):
            batch = all_docs[i:i + BATCH_SIZE]
            filter_metadata_collection.insert_many(batch, ordered=False)
            inserted_count += len(batch)
            print(f"Inserted {inserted_count} documents...")
            log_memory_usage()

        print("Precomputation completed successfully.")

    except Exception as e:
        print(f"Error during precomputation: {e}")
        sys.exit(1)

    finally:
        client.close()

if __name__ == "__main__":
    precompute_filters()