#!/usr/bin/env python3
"""
stocksense_data.py — Generates demand scores, forecasts, seasonality, and
recommendations for every variant. Outputs stocksense_data.js for the dashboard.
"""
import pandas as pd
import numpy as np
import json
from pathlib import Path
from collections import defaultdict

DATA = Path("data")

def load(n, **kw):
    return pd.read_csv(DATA / n, **kw)

# ── Load all tables ──
orders = load("orders.csv", parse_dates=["created_at"])
line_items = load("line_items.csv")
variants = load("variants.csv")
products = load("products.csv")
po_lines = load("po_line_items.csv")
pos = load("purchase_orders.csv")
bank = load("bank_transactions.csv", parse_dates=["date"])

# ── Build sales history per variant per month ──
li = line_items[["order_id","variant_id","product_id","quantity","price"]].copy()
li = li.merge(orders[["order_id","created_at"]], on="order_id")
li["revenue"] = li["price"] * li["quantity"]
li["month"] = li["created_at"].dt.to_period("M")
li["year"] = li["created_at"].dt.year
li["month_num"] = li["created_at"].dt.month

# ── Landed cost lookup ──
landed = po_lines.groupby("variant_id")["landed_cost_per_unit_gbp"].last().to_dict()
avg_landed = po_lines["landed_cost_per_unit_gbp"].mean()

# ── Supplier info ──
suppliers = load("suppliers.csv")
po_supplier = pos[["po_id","supplier_id","total_cost_gbp","status"]].merge(
    suppliers[["supplier_id","name","country","lead_time_days","currency"]], on="supplier_id"
)

# ── Base metrics per variant ──
# Sales last 3 months
last3 = li[li["created_at"] >= "2026-03-01"]
sales_3mo = last3.groupby("variant_id").agg(
    units_3mo=("quantity","sum"),
    revenue_3mo=("revenue","sum")
).reset_index()

# Sales last 12 months (for velocity and seasonality)
last12 = li[(li["created_at"] >= "2025-06-01") & (li["created_at"] <= "2026-05-31")]
sales_12mo = last12.groupby("variant_id").agg(
    units_12mo=("quantity","sum"),
    revenue_12mo=("revenue","sum")
).reset_index()

# Monthly sales history per variant (for sparklines)
monthly_sales = li.groupby(["variant_id","month"])["quantity"].sum().reset_index()
monthly_sales_pivot = monthly_sales.pivot(index="variant_id", columns="month", values="quantity").fillna(0)
all_months = sorted(monthly_sales["month"].unique())
monthly_sales_pivot = monthly_sales_pivot.reindex(columns=all_months, fill_value=0)

# ── Seasonality: per product_type, per calendar month ──
# What % of annual units do each month represent?
li_with_type = li.merge(products[["product_id","product_type"]], on="product_type" if False else "product_id")
# Fix: merge on product_id from line_items
li_with_type = li.merge(products[["product_id","product_type","title","gender_segment"]], on="product_id")

monthly_by_type = li_with_type.groupby(["product_type","month_num"])["quantity"].sum().reset_index()
annual_by_type = li_with_type.groupby("product_type")["quantity"].sum().reset_index()
annual_by_type.columns = ["product_type","annual_units"]
seasonality = monthly_by_type.merge(annual_by_type, on="product_type")
seasonality["seasonality_factor"] = seasonality["quantity"] / seasonality["annual_units"]

# ── Build variant records ──
variant_data = []
product_monthly = li_with_type.groupby(["product_type","month"])["quantity"].sum().unstack(fill_value=0)

for _, var in variants.iterrows():
    vid = var["variant_id"]
    pid = var["product_id"]
    prod = products[products["product_id"]==pid].iloc[0]
    
    inv_qty = var["inventory_quantity"]
    price = var["price"]
    cost = landed.get(vid, avg_landed)
    
    # Sales data
    u3 = sales_3mo[sales_3mo["variant_id"]==vid]["units_3mo"].sum()
    r3 = sales_3mo[sales_3mo["variant_id"]==vid]["revenue_3mo"].sum()
    u12 = sales_12mo[sales_12mo["variant_id"]==vid]["units_12mo"].sum()
    
    # Velocity (units/week)
    vel_3mo = u3 / 13  # 13 weeks in 3 months
    vel_12mo = u12 / 52
    
    # Blended velocity (weight recent more)
    if u12 > 0:
        blended_vel = vel_3mo * 0.6 + vel_12mo * 0.4
    else:
        blended_vel = vel_3mo if u3 > 0 else 0
    
    # Current months of cover
    if blended_vel > 0:
        weeks_cover = inv_qty / blended_vel if blended_vel > 0 else 999
        months_cover = weeks_cover / 4.33
    else:
        weeks_cover = 999 if inv_qty > 0 else 0
        months_cover = 999 if inv_qty > 0 else 0
    
    # Seasonality factor for current/next month
    current_month = 6  # June 2026 (current in dataset)
    seasons = seasonality[seasonality["product_type"]==prod["product_type"]]
    season_factor = seasons[seasons["month_num"]==current_month]["seasonality_factor"].values
    season_factor = season_factor[0] if len(season_factor) > 0 else 1/12
    
    # Demand trend: is velocity accelerating or decelerating?
    if u12 > 0 and vel_12mo > 0:
        trend = (vel_3mo - vel_12mo) / vel_12mo  # positive = accelerating
    else:
        trend = 0
    
    # Seasonally adjusted demand forecast (units/week)
    # Normalize season_factor to monthly equivalent
    base_demand = blended_vel
    season_adj_demand = base_demand * (season_factor * 12)  # scale to compare with vel
    
    # ── STOCKSENSE SCORE (0-100) ──
    # Higher = more urgent (high demand, low stock)
    # Components:
    #   1. Stock urgency: how fast are we running out? (0-50)
    #   2. Demand intensity: how much revenue is at stake? (0-30)
    #   3. Trend bonus: accelerating demand gets extra urgency (0-20)
    
    # Stock urgency
    if months_cover == 0 or inv_qty <= 0:
        stock_urgency = 50  # out of stock = maximum urgency
    elif months_cover > 12:
        stock_urgency = 0   # overstocked = zero urgency
    else:
        stock_urgency = 50 * (1 - months_cover / 12)  # linear 0-50
    
    # Demand intensity (relative to max)
    max_demand = max(1, sales_12mo["units_12mo"].max())
    demand_intensity = min(30, 30 * (u12 / max_demand))
    
    # Trend bonus
    trend_bonus = min(20, max(0, trend * 50)) if trend > 0 else 0
    
    score = round(stock_urgency + demand_intensity + trend_bonus)
    score = min(100, max(0, score))
    
    # Status
    if inv_qty <= 0:
        status = "reorder"  # out of stock
    elif months_cover > 12 and blended_vel > 0:
        status = "markdown"
    elif months_cover < 2 and blended_vel > 0:
        status = "reorder"
    elif score >= 50:
        status = "watch"
    elif blended_vel == 0 and inv_qty > 0:
        status = "markdown"
    else:
        status = "healthy"
    
    # Recommendation
    if status == "reorder":
        if blended_vel > 0:
            reorder_qty = max(1, round(blended_vel * 12))  # 12 weeks / ~3 months
        else:
            reorder_qty = max(1, round(u3 * 0.8))  # fallback: 80% of last 3mo
        rec = f"Reorder {reorder_qty} units"
        rec_cost = round(reorder_qty * cost)
        rec_detail = f"Est. cost £{rec_cost:,}. Will provide {round(reorder_qty/blended_vel):.0f} weeks cover at current velocity." if blended_vel > 0 else f"Based on {u3:.0f} units sold last 3 months."
    elif status == "markdown":
        rec = f"Mark down {inv_qty} units"
        rec_cost = round(inv_qty * cost)
        rec_detail = f"£{rec_cost:,} tied up at cost. {months_cover:.0f} months of cover. Consider 30-50% discount."
    else:
        rec = "Healthy — no action needed"
        rec_cost = 0
        rec_detail = f"{months_cover:.0f} months of cover. Revisit in {max(1, round(months_cover/3))} months."
    
    # Monthly sales history for sparkline
    if vid in monthly_sales_pivot.index:
        sparkline = monthly_sales_pivot.loc[vid].values.tolist()
        sparkline_labels = [str(m) for m in all_months]
    else:
        sparkline = []
        sparkline_labels = []
    
    # Seasonality curve for this product type
    if prod["product_type"] in product_monthly.index:
        season_curve = product_monthly.loc[prod["product_type"]].values.tolist()
        season_labels = [str(m) for m in product_monthly.columns]
    else:
        season_curve = []
        season_labels = []
    
    variant_data.append({
        "variant_id": vid,
        "product_id": pid,
        "product_name": prod["title"],
        "product_type": prod["product_type"],
        "gender_segment": prod["gender_segment"],
        "sku": var["sku"],
        "price": round(price, 2),
        "landed_cost": round(cost, 2),
        "inventory": int(inv_qty),
        "units_3mo": round(u3),
        "revenue_3mo": round(r3),
        "units_12mo": round(u12),
        "velocity_weekly": round(blended_vel, 2),
        "months_cover": round(months_cover, 1) if months_cover < 999 else 999,
        "trend": round(trend, 3),
        "season_factor": round(season_factor, 4),
        "stocksense_score": score,
        "status": status,
        "recommendation": rec,
        "recommendation_cost": rec_cost,
        "recommendation_detail": rec_detail,
        "sparkline": [round(x, 1) for x in sparkline],
        "sparkline_labels": sparkline_labels,
        "season_curve": [round(x) for x in season_curve],
        "season_labels": season_labels,
        "margin_pct": round((price - cost) / price * 100, 1) if price > 0 else 0,
    })

# ── Summary statistics ──
reorder_variants = [v for v in variant_data if v["status"] == "reorder"]
markdown_variants = [v for v in variant_data if v["status"] == "markdown"]
healthy_variants = [v for v in variant_data if v["status"] == "healthy"]
watch_variants = [v for v in variant_data if v["status"] == "watch"]

total_trapped = sum(v["landed_cost"] * v["inventory"] for v in markdown_variants)
total_reorder_cost = sum(v["recommendation_cost"] for v in reorder_variants)
total_lost_monthly = sum(v["revenue_3mo"] for v in reorder_variants if v["inventory"] <= 0) / 3

summary = {
    "total_variants": len(variant_data),
    "reorder_count": len(reorder_variants),
    "markdown_count": len(markdown_variants),
    "healthy_count": len(healthy_variants),
    "watch_count": len(watch_variants),
    "total_trapped_cash": round(total_trapped),
    "total_reorder_cost": round(total_reorder_cost),
    "lost_monthly_revenue": round(total_lost_monthly),
    "avg_stocksense_score": round(sum(v["stocksense_score"] for v in variant_data) / len(variant_data), 1),
    "product_types": sorted(set(v["product_type"] for v in variant_data)),
    "generated_at": "2026-06-03",
}

# ── Output ──
output = {
    "summary": summary,
    "variants": variant_data,
}

js = "var STOCKSENSE_DATA = " + json.dumps(output, indent=2) + ";"
with open("stocksense_data.js", "w") as f:
    f.write(js)

print(f"Generated stocksense_data.js: {len(js):,} bytes")
print(f"  Variants: {len(variant_data)}")
print(f"  Reorder: {len(reorder_variants)} | Markdown: {len(markdown_variants)} | Watch: {len(watch_variants)} | Healthy: {len(healthy_variants)}")
print(f"  Total trapped cash: £{total_trapped:,.0f}")
print(f"  Total reorder cost: £{total_reorder_cost:,.0f}")
print(f"  Lost monthly revenue: £{total_lost_monthly:,.0f}")
print(f"  Avg StockSense score: {summary['avg_stocksense_score']}")
print(f"  Scores range: {min(v['stocksense_score'] for v in variant_data)} - {max(v['stocksense_score'] for v in variant_data)}")
print(f"  Scores distribution:")
for status in ["reorder","watch","healthy","markdown"]:
    sv = [v for v in variant_data if v["status"]==status]
    scores = [v["stocksense_score"] for v in sv]
    if scores:
        print(f"    {status}: {len(sv)} variants, score {min(scores)}-{max(scores)} (avg {sum(scores)/len(scores):.0f})")
