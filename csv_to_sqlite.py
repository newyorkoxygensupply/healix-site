#!/usr/bin/env python3
"""
Convert medical_supplies.csv  →  medical_supplies.db (SQLite + FTS5)

Run from the medsite/ folder:
    python csv_to_sqlite.py

The resulting .db file is what the app reads at runtime.
It uses ~300-450 MB on disk but only ~30-80 MB RAM while serving requests.
"""
import csv
import sqlite3
import sys
import time
from pathlib import Path

CSV_PATH = Path(__file__).parent / "medical_supplies.csv"
DB_PATH  = Path(__file__).parent / "medical_supplies.db"

if not CSV_PATH.exists():
    print(f"ERROR: {CSV_PATH} not found.")
    sys.exit(1)

csv_mb = CSV_PATH.stat().st_size / 1024 / 1024
print(f"Source : {CSV_PATH}  ({csv_mb:.0f} MB)")
print(f"Target : {DB_PATH}")
print()

if DB_PATH.exists():
    DB_PATH.unlink()
    print("Removed existing database.")

conn = sqlite3.connect(str(DB_PATH))
c    = conn.cursor()
c.execute("PRAGMA journal_mode=WAL")
c.execute("PRAGMA synchronous=NORMAL")
c.execute("PRAGMA cache_size=-65536")   # 64 MB build cache

# ── Detect columns from CSV header ──────────────────────────────────────────
with open(CSV_PATH, newline="", encoding="utf-8") as f:
    fieldnames = csv.DictReader(f).fieldnames or []

print(f"Columns ({len(fieldnames)}): {', '.join(fieldnames)}")
print()

# ── Create products table ────────────────────────────────────────────────────
cols_def = []
for col in fieldnames:
    if col == "product_id":
        cols_def.append(f'"{col}" TEXT PRIMARY KEY')
    else:
        cols_def.append(f'"{col}" TEXT')
c.execute(f"CREATE TABLE products ({', '.join(cols_def)})")

# Indexes on filter/sort columns
for col in ["category", "subcategory", "brand", "availability", "latex_free", "sterile"]:
    if col in fieldnames:
        c.execute(f'CREATE INDEX idx_{col} ON products("{col}")')
conn.commit()

# ── Insert rows ──────────────────────────────────────────────────────────────
placeholders = ", ".join("?" for _ in fieldnames)
insert_sql   = f"INSERT OR IGNORE INTO products VALUES ({placeholders})"

t0    = time.time()
total = 0
batch = []
BATCH_SIZE = 5000

print("Inserting rows …")
with open(CSV_PATH, newline="", encoding="utf-8") as f:
    for row in csv.DictReader(f):
        batch.append(tuple(row.get(col, "") for col in fieldnames))
        if len(batch) >= BATCH_SIZE:
            c.executemany(insert_sql, batch)
            conn.commit()
            total += len(batch)
            batch = []
            print(f"  {total:,} rows  ({time.time()-t0:.0f}s)", end="\r", flush=True)

if batch:
    c.executemany(insert_sql, batch)
    conn.commit()
    total += len(batch)

print(f"  {total:,} rows total  ({time.time()-t0:.0f}s)          ")
print()

# ── Create FTS5 full-text search table ───────────────────────────────────────
print("Building FTS5 search index (may take 1-3 minutes) …")
t1 = time.time()

c.execute("""
    CREATE VIRTUAL TABLE products_fts USING fts5(
        product_id  UNINDEXED,
        search_text,
        tokenize = "unicode61"
    )
""")

# Concatenate searchable fields into a single search_text column
search_cols = ["product_name", "brand", "category", "subcategory", "sku"]
# Include first 200 chars of description if column exists
if "description" in fieldnames:
    desc_expr = "SUBSTR(COALESCE(description,''), 1, 200)"
else:
    desc_expr = "''"

col_exprs = " || ' ' || ".join(
    f"COALESCE(\"{col}\", '')" for col in search_cols if col in fieldnames
)
if desc_expr:
    col_exprs += f" || ' ' || {desc_expr}"

c.execute(f"""
    INSERT INTO products_fts(product_id, search_text)
    SELECT product_id, LOWER({col_exprs})
    FROM products
""")
conn.commit()

print(f"  FTS5 index built  ({time.time()-t1:.0f}s)")
print()

db_mb = DB_PATH.stat().st_size / 1024 / 1024
print(f"Done!  {DB_PATH}  ({db_mb:.0f} MB)")
print()
print("Next step — upload to GitHub Release:")
print(f'  curl -H "Authorization: token YOUR_TOKEN" \\')
print(f'       -H "Content-Type: application/octet-stream" \\')
print(f'       --data-binary @{DB_PATH} \\')
print(f'       "https://uploads.github.com/repos/newyorkoxygensupply/healix-site/releases/339637861/assets?name=medical_supplies.db"')
conn.close()
