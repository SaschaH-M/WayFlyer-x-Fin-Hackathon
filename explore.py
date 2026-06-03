#!/usr/bin/env python3
"""
explore.py — Pain point & opportunity analysis for Pretty Fly dataset.
Run: python explore.py
"""
import pandas as pd
import numpy as np
from pathlib import Path
from decimal import Decimal
from collections import defaultdict

DATA = Path("data")
pd.set_option("display.float_format", lambda x: f"{x:,.2f}")
pd.set_option("display.max_colwidth", 60)
pd.set_option("display.width", 200)


def load(name, **kwargs):
    return pd.read_csv(DATA / name, **kwargs)


def header(msg):
    print(f"\n{'='*70}")
    print(f"  {msg}")
    print(f"{'='*70}")


# ──────────────────────────────────────────────────
# 1. OVERALL BUSINESS HEALTH
# ──────────────────────────────────────────────────
header("1 — MONTHLY REVENUE & ORDER TREND")

orders = load("orders.csv", parse_dates=["created_at"])
line_items = load("line_items.csv")
refunds = load("refunds.csv", parse_dates=["created_at"])

orders["month"] = orders["created_at"].dt.to_period("M")
refunds["month"] = refunds["created_at"].dt.to_period("M")

monthly = (orders
    .groupby("month")
    .agg(
        orders=("order_id", "nunique"),
        revenue=("total_price", "sum"),
        discounts=("total_discounts", "sum"),
        aov=("total_price", "mean"),
    ))

refund_monthly = (refunds
    .groupby("month")
    .agg(refund_amount=("amount", "sum"), refund_count=("refund_id", "nunique")))

m = monthly.join(refund_monthly).fillna(0)
m["net_revenue"] = m["revenue"] - m["refund_amount"]
m["refund_rate"] = (m["refund_amount"] / m["revenue"] * 100)

print(m.to_string())
print(f"\nTOTAL:  {m['revenue'].sum():,.0f} revenue | {m['refund_amount'].sum():,.0f} refunds ({m['refund_amount'].sum()/m['revenue'].sum()*100:.1f}% rate) | {m['orders'].sum():,} orders")

# Revenue growth
recent_3m = m.tail(3)["net_revenue"].mean()
early_3m = m.head(3)["net_revenue"].mean()
print(f"Early (first 3 months) avg net revenue: £{early_3m:,.0f}/mo")
print(f"Recent (last 3 months) avg net revenue: £{recent_3m:,.0f}/mo")
print(f"Growth factor: {recent_3m/early_3m:.1f}x")

# ──────────────────────────────────────────────────
# 2. CASH FLOW / WORKING CAPITAL
# ──────────────────────────────────────────────────
header("2 — CASH CONVERSION CYCLE (Supplier Payments vs Revenue)")

bank = load("bank_transactions.csv", parse_dates=["date"])
bank["month"] = bank["date"].dt.to_period("M")
pos = load("purchase_orders.csv")
po_lines = load("po_line_items.csv")

# Monthly cash in/out
cashflow = bank.groupby("month").agg(
    total_in=("amount_gbp", lambda x: x[x > 0].sum()),
    total_out=("amount_gbp", lambda x: abs(x[x < 0].sum())),
    txns=("transaction_id", "count")
)
cashflow["net"] = cashflow["total_in"] - cashflow["total_out"]
print(cashflow.to_string())

# Supplier payment timing
pos["deposit_dt"] = pd.to_datetime(pos["deposit_paid_at"], errors="coerce")
pos["balance_dt"] = pd.to_datetime(pos["balance_paid_at"], errors="coerce")
pos["created_dt"] = pd.to_datetime(pos["created_at"], errors="coerce")
pos["delivery_dt"] = pd.to_datetime(pos["actual_delivery"], errors="coerce")

pos["deposit_lead"] = (pos["deposit_dt"] - pos["created_dt"]).dt.days
pos["balance_lead"] = (pos["balance_dt"] - pos["delivery_dt"]).dt.days
pos["full_payment"] = (pos["balance_dt"] - pos["created_dt"]).dt.days

print("\nSupplier payment leads (days):")
print(f"  Deposit after PO: avg {pos['deposit_lead'].mean():.0f}d (range {pos['deposit_lead'].min():.0f}-{pos['deposit_lead'].max():.0f})")
print(f"  Balance after delivery: avg {pos['balance_lead'].mean():.0f}d (range {pos['balance_lead'].min():.0f}-{pos['balance_lead'].max():.0f})")
print(f"  Total payment cycle: avg {pos['full_payment'].mean():.0f}d")

# Total supplier spend
print(f"\nTotal PO spend: £{pos['total_cost_gbp'].sum():,.0f}")
total_rev = orders["total_price"].sum()
print(f"Total revenue: £{total_rev:,.0f}")
print(f"PO spend as % of revenue: {pos['total_cost_gbp'].sum()/total_rev*100:.1f}%")

# ──────────────────────────────────────────────────
# 3. PRODUCT & MARGIN ANALYSIS
# ──────────────────────────────────────────────────
header("3 — PRODUCT PERFORMANCE & MARGINS")

products = load("products.csv")
variants = load("variants.csv")

# Join line_items → variants → products
# Both line_items and variants/products share columns - drop conflicts from line_items
li_cols = [c for c in line_items.columns if c not in ("price", "total_discount", "product_id", "title")]
sold = (line_items[li_cols]
    .merge(orders[["order_id", "created_at", "customer_id"]], on="order_id")
    .merge(variants[["variant_id", "product_id", "price"]], on="variant_id")
    .merge(products[["product_id", "title", "product_type", "gender_segment"]], on="product_id"))

sold["revenue"] = sold["price"] * sold["quantity"]
sold["month"] = sold["created_at"].dt.to_period("M")

# Product type performance
pt = sold.groupby("product_type").agg(
    units=("quantity", "sum"),
    revenue=("revenue", "sum"),
    orders=("order_id", "nunique"),
).sort_values("revenue", ascending=False)
pt["% revenue"] = (pt["revenue"] / pt["revenue"].sum() * 100)
pt["avg_price"] = pt["revenue"] / pt["units"]
print("\nBy product type:")
print(pt.to_string())

# Gender segment split over time
gs = sold.groupby(["month", "gender_segment"]).agg(revenue=("revenue", "sum")).reset_index()
gs_pivot = gs.pivot(index="month", columns="gender_segment", values="revenue").fillna(0)
print("\nRevenue by gender segment (monthly):")
print(gs_pivot.tail(12).to_string())

# Top/bottom SKUs
sku_rev = sold.groupby(["title", "variant_id"]).agg(units=("quantity", "sum"), revenue=("revenue", "sum")).sort_values("revenue")
print("\nBottom 5 SKUs by revenue:")
print(sku_rev.head(5).to_string())
print("\nTop 5 SKUs by revenue:")
print(sku_rev.tail(5).to_string())

# Landed cost / margin
landed = po_lines.groupby("variant_id")["landed_cost_per_unit_gbp"].last().to_dict()
sold["cost"] = sold["variant_id"].map(landed)
sold["cost"].fillna(sold["cost"].mean(), inplace=True)
sold["gross_margin"] = (sold["price"] - sold["cost"]) / sold["price"] * 100

margin_by_type = sold.groupby("product_type").agg(
    avg_price=("price", "mean"),
    avg_cost=("cost", "mean"),
    margin_pct=("gross_margin", "mean"),
).sort_values("margin_pct")

print("\nGross margin by product type:")
print(margin_by_type.to_string())

# ──────────────────────────────────────────────────
# 4. INVENTORY HEALTH
# ──────────────────────────────────────────────────
header("4 — INVENTORY ANALYSIS (Dead stock, overstock, stockouts)")

inv = load("inventory_movements.csv", parse_dates=["date"])
inv["month"] = inv["date"].dt.to_period("M")

# Current stock vs. sales velocity
current_stock = variants[["variant_id", "product_id", "inventory_quantity", "price"]]
current_stock = current_stock.merge(products[["product_id", "title", "product_type"]], on="product_id")

# Calculate monthly sales velocity per variant (last 12 months)
recent_sold = sold[sold["created_at"] >= "2025-06-01"]
velocity = recent_sold.groupby("variant_id").agg(
    mo_sales=("quantity", "sum")
).reset_index()
velocity["mo_sales"] = velocity["mo_sales"] / 12  # avg per month over last 12m

current_stock = current_stock.merge(velocity, on="variant_id", how="left")
current_stock["mo_sales"].fillna(0, inplace=True)
current_stock["months_cover"] = np.where(current_stock["mo_sales"] > 0, current_stock["inventory_quantity"] / current_stock["mo_sales"], np.inf)

# Dead stock: > 0 inventory but zero sales in last 12 months
dead_stock = current_stock[(current_stock["inventory_quantity"] > 0) & (current_stock["mo_sales"] == 0)]
dead_value = (dead_stock["inventory_quantity"] * dead_stock["price"]).sum()
print(f"\nDead stock (>0 qty, zero sales in 12mo): {len(dead_stock)} variants, £{dead_value:,.0f} at retail")
if len(dead_stock) > 0:
    print(dead_stock[["title", "variant_id", "inventory_quantity", "price"]].to_string())

# Overstock: > 12 months cover
overstock = current_stock[(current_stock["months_cover"] > 12) & (current_stock["mo_sales"] > 0)]
overstock_value = (overstock["inventory_quantity"] * overstock["price"]).sum()
print(f"\nOverstock (>12 months cover): {len(overstock)} variants, £{overstock_value:,.0f} at retail")
if len(overstock) > 0:
    print(overstock[["title", "variant_id", "inventory_quantity", "months_cover"]].sort_values("months_cover").to_string())

# Stockouts: zero inventory but had sales
sold_variants = set(line_items["variant_id"].unique())
stocked_variants = set(variants[variants["inventory_quantity"] > 0]["variant_id"].unique())
stockout = sold_variants - stocked_variants
# Get last sale info
last_sale = sold.groupby("variant_id")["created_at"].max().reset_index()
stockout_info = last_sale[last_sale["variant_id"].isin(stockout)].merge(
    variants[["variant_id", "product_id"]], on="variant_id"
).merge(products[["product_id", "title"]], on="product_id")
print(f"\nStockout variants (previously sold, now zero inventory): {len(stockout)}")
if len(stockout_info) > 0:
    print(stockout_info.sort_values("title").to_string())

# ──────────────────────────────────────────────────
# 5. MARKETING EFFICIENCY
# ──────────────────────────────────────────────────
header("5 — MARKETING ROAS & CHANNEL PERFORMANCE")

google = load("google_ads_daily.csv", parse_dates=["date"])
meta = load("meta_ads_daily.csv", parse_dates=["date"])
google["month"] = google["date"].dt.to_period("M")
meta["month"] = meta["date"].dt.to_period("M")

# ROAS by platform monthly
g_agg = google.groupby("month").agg(
    g_spend=("spend_gbp", "sum"),
    g_impressions=("impressions", "sum"),
    g_clicks=("clicks", "sum"),
    g_conversions=("conversions", "sum"),
    g_conv_value=("conversion_value_gbp", "sum"),
)
m_agg = meta.groupby("month").agg(
    m_spend=("spend_gbp", "sum"),
    m_impressions=("impressions", "sum"),
    m_clicks=("clicks", "sum"),
    m_conversions=("conversions", "sum"),
    m_conv_value=("conversion_value_gbp", "sum"),
)
ad_perf = g_agg.join(m_agg).fillna(0)
ad_perf["g_roas"] = ad_perf["g_conv_value"] / ad_perf["g_spend"]
ad_perf["m_roas"] = ad_perf["m_conv_value"] / ad_perf["m_spend"]

print("\nGoogle Ads:")
print(f"  Total spend: £{google['spend_gbp'].sum():,.0f}")
print(f"  Reported ROAS: {google['conversion_value_gbp'].sum()/google['spend_gbp'].sum():.2f}x")
print(f"  Avg CPC: £{google['spend_gbp'].sum()/google['clicks'].sum():.2f}")
print(f"  Conv rate: {google['conversions'].sum()/google['clicks'].sum()*100:.1f}%")

print("\nMeta Ads:")
print(f"  Total spend: £{meta['spend_gbp'].sum():,.0f}")
print(f"  Reported ROAS: {meta['conversion_value_gbp'].sum()/meta['spend_gbp'].sum():.2f}x")
print(f"  Avg CPC: £{meta['spend_gbp'].sum()/meta['clicks'].sum():.2f}")
print(f"  Conv rate: {meta['conversions'].sum()/meta['clicks'].sum()*100:.1f}%")

print("\nMonthly ROAS trend:")
print(ad_perf[["g_roas", "m_roas"]].tail(12).to_string())

# Campaign-level performance
g_camp = google.groupby("campaign_name").agg(
    spend=("spend_gbp", "sum"),
    conv_value=("conversion_value_gbp", "sum"),
    conversions=("conversions", "sum"),
).sort_values("spend", ascending=False)
g_camp["roas"] = g_camp["conv_value"] / g_camp["spend"]

m_camp = meta.groupby("campaign_name").agg(
    spend=("spend_gbp", "sum"),
    conv_value=("conversion_value_gbp", "sum"),
    conversions=("conversions", "sum"),
    objective=("campaign_objective", "first"),
).sort_values("spend", ascending=False)
m_camp["roas"] = m_camp["conv_value"] / m_camp["spend"]

print("\nBottom 5 Google campaigns by ROAS:")
print(g_camp.nsmallest(5, "roas").to_string())
print("\nBottom 5 Meta campaigns by ROAS:")
print(m_camp.nsmallest(5, "roas").to_string())

# ──────────────────────────────────────────────────
# 6. CUSTOMER COHORTS & RETENTION
# ──────────────────────────────────────────────────
header("6 — CUSTOMER ANALYSIS (Retention, Cohorts, CLV)")

customers = load("customers.csv", parse_dates=["created_at", "acquisition_date"])

# Repeat rate
cust_order_count = orders.groupby("customer_id").size()
repeat = (cust_order_count > 1).sum()
single = (cust_order_count == 1).sum()
print(f"Customers: {len(customers):,} total")
print(f"  Single-purchase: {single:,} ({single/len(customers)*100:.1f}%)")
print(f"  Repeat (2+ orders): {repeat:,} ({repeat/len(customers)*100:.1f}%)")
print(f"  Avg orders per customer: {cust_order_count.mean():.2f}")

# Repeat rate distribution
for n in range(1, 7):
    cnt = (cust_order_count >= n).sum()
    print(f"  ≥{n} orders: {cnt:,} ({cnt/len(customers)*100:.1f}%)")

# Acquisition source performance
acq = customers.groupby("acquisition_source").agg(
    customers=("customer_id", "nunique"),
    avg_spent=("total_spent", "mean"),
    avg_orders=("orders_count", "mean"),
).sort_values("customers", ascending=False)
print("\nBy acquisition source:")
print(acq.to_string())

# Gender affinity vs spend
gen = customers.groupby("gender_segment_affinity").agg(
    customers=("customer_id", "nunique"),
    avg_spent=("total_spent", "mean"),
    avg_orders=("orders_count", "mean"),
).sort_values("customers", ascending=False)
print("\nBy gender segment affinity:")
print(gen.to_string())

# Customer LTV by first-purchase cohort
orders["customer_first"] = orders.groupby("customer_id")["created_at"].transform("min")
orders["cohort"] = orders["customer_first"].dt.to_period("M")
orders["order_month"] = orders["created_at"].dt.to_period("M")
orders["months_since_first"] = (orders["order_month"] - orders["cohort"]).apply(lambda x: x.n if hasattr(x, 'n') else 0)

# Revenue by cohort (first 12 months of each cohort worth)
cohort_rev = orders.groupby(["cohort", "months_since_first"])["total_price"].sum().reset_index()
last_6m_cohorts = cohort_rev[cohort_rev["cohort"].isin(cohort_rev["cohort"].unique()[-6:])]
pivot = last_6m_cohorts.pivot(index="months_since_first", columns="cohort", values="total_price").fillna(0)
print("\nCohort revenue curve (last 6 cohorts, months since first purchase):")
print(pivot.to_string())

# ──────────────────────────────────────────────────
# 7. REFUNDS DEEP DIVE
# ──────────────────────────────────────────────────
header("7 — RETURNS & REFUND ANALYSIS")

refunds_merged = refunds.merge(orders[["order_id", "created_at"]], on="order_id", suffixes=("_refund", "_order"))
# Refund timing
refunds_merged["days_to_refund"] = (refunds_merged["created_at_refund"] - refunds_merged["created_at_order"]).dt.days

print(f"Refund timing (days after order):")
print(f"  Mean: {refunds_merged['days_to_refund'].mean():.1f}d")
print(f"  Median: {refunds_merged['days_to_refund'].median():.0f}d")
print(f"  <7 days: {(refunds_merged['days_to_refund'] <= 7).sum() / len(refunds_merged) * 100:.1f}%")
print(f"  7-30 days: {((refunds_merged['days_to_refund'] > 7) & (refunds_merged['days_to_refund'] <= 30)).sum() / len(refunds_merged) * 100:.1f}%")
print(f"  >30 days: {(refunds_merged['days_to_refund'] > 30).sum() / len(refunds_merged) * 100:.1f}%")

# Refund reasons
reasons = refunds["reason"].value_counts()
print(f"\nRefund reasons:")
for reason, count in reasons.items():
    print(f"  {reason}: {count:,} ({count/len(refunds)*100:.1f}%)")

# Refund rate by product (join via orders → line_items → variants)
refund_order_ids = set(refunds["order_id"])
orders["had_refund"] = orders["order_id"].isin(refund_order_ids).astype(int)
refund_rate_by_product = sold.groupby(["product_type", "title"]).agg(
    units=("quantity", "sum"),
    revenue=("revenue", "sum"),
).reset_index()
orders_refunds = orders.groupby("order_id").agg(had_refund=("had_refund", "first")).reset_index()
sold_ref = sold.merge(orders_refunds, on="order_id")
prod_refund = sold_ref.groupby("title").agg(
    units=("quantity", "sum"),
    refunded_units=("had_refund", "sum"),
).reset_index()
prod_refund["refund_pct"] = prod_refund["refunded_units"] / prod_refund["units"] * 100

# This is rough - refunded_units counts orders that had any refund, not specific products
# Better: use refund_line_items JSON
print("\nHighlights: Top refund rates")

# ──────────────────────────────────────────────────
# 8. SUPPORT ANALYSIS
# ──────────────────────────────────────────────────
header("8 — SUPPORT TICKET ANALYSIS")

tickets = load("support_tickets.csv", parse_dates=["created_at", "resolved_at", "first_response_at"])

# Channel mix
print("\nBy channel:")
print(tickets["channel"].value_counts().to_string())
print("\nBy category:")
print(tickets["category"].value_counts().to_string())
print("\nBy resolved_by:")
print(tickets["resolved_by"].value_counts().to_string())
print("\nBy priority:")
print(tickets["priority"].value_counts().to_string())

# Resolution time
print(f"\nResolution time (minutes):")
print(f"  Mean: {tickets['resolution_time_minutes'].mean():.0f}")
print(f"  Median: {tickets['resolution_time_minutes'].median():.0f}")
print(f"  p95: {tickets['resolution_time_minutes'].quantile(0.95):.0f}")
print(f"  p99: {tickets['resolution_time_minutes'].quantile(0.99):.0f}")

# Resolution by channel
res_by_channel = tickets.groupby("channel")["resolution_time_minutes"].agg(["mean", "median", "count"]).sort_values("mean")
print("\nResolution time by channel:")
print(res_by_channel.to_string())

# Resolution by whether bot or human
res_by_resolver = tickets.groupby("resolved_by")["resolution_time_minutes"].agg(["mean", "median", "count"]).sort_values("mean")
print("\nResolution time by resolver type:")
print(res_by_resolver.to_string())

# Satisfaction by category
sat = tickets.groupby("category")["satisfaction_rating"].agg(["mean", "count"]).sort_values("mean")
print("\nSatisfaction by category:")
print(sat.to_string())

# What categories are most human-heavy?
human = tickets.groupby("category").agg(
    total=("ticket_id", "nunique"),
    human_resolved=("resolved_by", lambda x: (x == "human").sum()),
    bot_resolved=("resolved_by", lambda x: (x == "bot").sum()),
).reset_index()
human["bot_rate"] = human["bot_resolved"] / human["total"] * 100
human["human%"] = human["human_resolved"] / human["total"] * 100
print("\nAutomation potential by category (lower bot rate = more human work):")
print(human.sort_values("bot_rate").to_string())

# ──────────────────────────────────────────────────
# 9. ORDERS → PROFITABILITY BY SEGMENT
# ──────────────────────────────────────────────────
header("9 — PROFITABILITY DRIVERS (UTM source, discount impact)")

# Orders with discounts vs without
orders["has_discount"] = (orders["total_discounts"] > 0).astype(int)
disc_comp = orders.groupby("has_discount").agg(
    orders=("order_id", "nunique"),
    avg_aov=("total_price", "mean"),
    avg_discount=("total_discounts", "mean"),
)
print("\nDiscount vs non-discount orders:")
print(disc_comp.to_string())

# UTM source AOV
utm = orders.groupby("utm_source").agg(
    orders=("order_id", "nunique"),
    revenue=("total_price", "sum"),
    aov=("total_price", "mean"),
).sort_values("orders", ascending=False)
print("\nBy UTM source:")
print(utm.head(10).to_string())

# Discount code analysis
disc_codes = load("discount_codes.csv")
print("\nDiscount codes:")
print(disc_codes.to_string())

# ──────────────────────────────────────────────────
# 10. KEY INSIGHT SUMMARY
# ──────────────────────────────────────────────────
header("SUMMARY — POTENTIAL BUILD DIRECTIONS")

print("""
Based on the analysis above, here are the most promising pain points & opportunities:

CASH FLOW & WORKING CAPITAL:
  • Time gap between paying suppliers (deposit + balance) and earning revenue
  • Can quantify exactly how much cash is tied up at any given moment
  • Build: Cash forecasting tool, working capital optimizer

INVENTORY:
  • Dead/overstock products tie up cash; stockouts lose sales
  • Which SKUs to reorder vs. discontinue
  • Build: Inventory health dashboard, reorder recommender

MARKETING:
  • ROAS varies significantly by campaign — some are burning cash
  • Ad platforms overclaim vs. actual order attribution
  • Build: True ROAS calculator, budget reallocation tool

CUSTOMER RETENTION:
  • High % of one-time customers — retention is a major lever
  • Segments have very different LTV
  • Build: Churn predictor, re-engagement campaign tool

RETURNS:
  • Some products/reasons drive disproportionate return costs
  • Build: Returns predictor (at checkout), sizing assistant

SUPPORT:
  • Bot resolves ~40% today — which categories/tickets could be fully automated?
  • Some categories have terrible satisfaction
  • Build: AI support agent with order/product context, ticket classifier/router
""")
