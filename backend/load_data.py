"""
load_data.py — load the 21-file Pretty Fly data pack into the database.
Idempotent: drops + recreates each table. Run once at setup, or whenever the
CSVs change.

    python load_data.py
"""
import sys
import time
from pathlib import Path

import pandas as pd

from db import get_engine, backend_name

DATA = Path(__file__).resolve().parent.parent / "data"

# table name -> csv file. (support_messages.json handled separately.)
CSV_TABLES = [
    "products", "variants", "collections", "product_collections",
    "customers", "addresses", "orders", "line_items", "discount_codes",
    "refunds", "suppliers", "purchase_orders", "po_line_items",
    "inventory_movements", "google_ads_daily", "meta_ads_daily",
    "email_campaigns", "email_events", "support_tickets",
    "bank_transactions",
]


def load():
    eng = get_engine()
    print(f"Loading into {backend_name()} ({eng.url})")
    t0 = time.time()
    for name in CSV_TABLES:
        fp = DATA / f"{name}.csv"
        if not fp.exists():
            print(f"  ! missing {fp.name}, skipping")
            continue
        df = pd.read_csv(fp, low_memory=False)
        df.to_sql(name, eng, if_exists="replace", index=False, chunksize=5000)
        print(f"  {name:24s} {len(df):>7,} rows")
    print(f"Done in {time.time()-t0:.1f}s")


if __name__ == "__main__":
    load()
