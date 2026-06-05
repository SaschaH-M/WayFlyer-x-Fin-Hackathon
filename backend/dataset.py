"""
dataset.py — load DB tables into cached pandas DataFrames with parsed dates.
One source of truth for every compute module. Cached for the process lifetime;
call invalidate() after reloading data.
"""
from functools import lru_cache

import pandas as pd

from db import get_engine

# date columns to parse per table
DATE_COLS = {
    "orders": ["created_at"],
    "line_items": [],
    "variants": [],
    "products": ["created_at"],
    "purchase_orders": ["created_at", "expected_delivery", "actual_delivery",
                        "deposit_paid_at", "balance_paid_at"],
    "po_line_items": [],
    "suppliers": [],
    "bank_transactions": ["date"],
    "inventory_movements": ["date"],
    "refunds": ["created_at"],
    "google_ads_daily": ["date"],
    "meta_ads_daily": ["date"],
    "email_campaigns": ["sent_at"],
    "email_events": ["timestamp"],
    "support_tickets": ["created_at", "first_response_at", "resolved_at"],
    "customers": ["created_at", "acquisition_date"],
}


@lru_cache(maxsize=None)
def table(name: str) -> pd.DataFrame:
    eng = get_engine()
    df = pd.read_sql_table(name, eng)
    for col in DATE_COLS.get(name, []):
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")
    return df


def invalidate():
    table.cache_clear()


# convenience accessors
def orders():       return table("orders")
def line_items():   return table("line_items")
def variants():     return table("variants")
def products():     return table("products")
def po_lines():     return table("po_line_items")
def purchase_orders(): return table("purchase_orders")
def suppliers():    return table("suppliers")
def bank():         return table("bank_transactions")
def inventory():    return table("inventory_movements")
def refunds():      return table("refunds")
