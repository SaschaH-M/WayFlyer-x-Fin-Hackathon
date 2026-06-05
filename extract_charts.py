#!/usr/bin/env python3
"""
extract_charts.py — Generates JSON data for the deep-dive dashboard.
Outputs a single JS file with all chart data embedded.
"""
import pandas as pd
import numpy as np
import json
from pathlib import Path
from collections import defaultdict

DATA = Path("data")

def load(name, **kwargs):
    return pd.read_csv(DATA / name, **kwargs)

def df_to_xy(df, x_col, y_cols, null_value=0):
    """Convert dataframe to {labels: [...], datasets: [{label, data}]}"""
    result = {"labels": df[x_col].astype(str).tolist()}
    result["datasets"] = []
    for col in y_cols if isinstance(y_cols, list) else [y_cols]:
        vals = df[col].fillna(null_value).tolist()
        result["datasets"].append({"label": col, "data": vals})
    return result

def period_to_str(p):
    return str(p)


# =====================================================================
# PREP DATA
# =====================================================================
orders = load("orders.csv", parse_dates=["created_at"])
line_items = load("line_items.csv")
refunds = load("refunds.csv", parse_dates=["created_at"])
variants = load("variants.csv")
products = load("products.csv")
bank = load("bank_transactions.csv", parse_dates=["date"])
google = load("google_ads_daily.csv", parse_dates=["date"])
meta = load("meta_ads_daily.csv", parse_dates=["date"])
customers = load("customers.csv", parse_dates=["created_at", "acquisition_date"])
tickets = load("support_tickets.csv", parse_dates=["created_at", "resolved_at", "first_response_at"])
po_lines = load("po_line_items.csv")

orders["month"] = orders["created_at"].dt.to_period("M")
refunds["month"] = refunds["created_at"].dt.to_period("M")
bank["month"] = bank["date"].dt.to_period("M")
google["month"] = google["date"].dt.to_period("M")
meta["month"] = meta["date"].dt.to_period("M")
tickets["month"] = tickets["created_at"].dt.to_period("M")

# Join line_items → variants → products (for product type revenue)
li_cols = [c for c in line_items.columns if c not in ("price", "total_discount", "product_id", "title")]
sold = (line_items[li_cols]
    .merge(orders[["order_id", "created_at", "customer_id"]], on="order_id")
    .merge(variants[["variant_id", "product_id", "price"]], on="variant_id")
    .merge(products[["product_id", "title", "product_type", "gender_segment"]], on="product_id"))
sold["revenue"] = sold["price"] * sold["quantity"]
sold["month"] = sold["created_at"].dt.to_period("M")
sold["year"] = sold["created_at"].dt.year
sold["month_num"] = sold["created_at"].dt.month

# =====================================================================
# CHART 1: Monthly Revenue by Product Type (Stacked)
# =====================================================================
rev_by_type = sold.groupby(["month", "product_type"])["revenue"].sum().unstack(fill_value=0)
rev_by_type.index = rev_by_type.index.astype(str)
chart1 = {
    "labels": rev_by_type.index.tolist(),
    "datasets": [
        {"label": col, "data": rev_by_type[col].tolist()}
        for col in rev_by_type.columns
    ]
}

# =====================================================================
# CHART 2: Month-over-Month Revenue (YoY comparison)
# =====================================================================
monthly_rev = orders.groupby("month")["total_price"].sum().reset_index()
monthly_rev.columns = ["month", "revenue"]
monthly_rev["month_str"] = monthly_rev["month"].astype(str)
monthly_rev["year"] = monthly_rev["month_str"].str[:4]
monthly_rev["mm"] = monthly_rev["month_str"].str[5:7]
monthly_rev["month_label"] = monthly_rev.apply(lambda r: f"{r['year']}-{r['mm']}", axis=1)

y1 = monthly_rev[monthly_rev["year"] == "2024"]
y2 = monthly_rev[monthly_rev["year"] == "2025"]
y3 = monthly_rev[monthly_rev["year"] == "2026"]

months_ordered = ["06","07","08","09","10","11","12","01","02","03","04","05"]
month_names = {"06":"Jun","07":"Jul","08":"Aug","09":"Sep","10":"Oct","11":"Nov","12":"Dec","01":"Jan","02":"Feb","03":"Mar","04":"Apr","05":"May"}

chart2 = {
    "labels": [month_names[m] for m in months_ordered],
    "datasets": [
        {
            "label": "2024",
            "data": [float(y1[y1["mm"] == m]["revenue"].iloc[0]) if len(y1[y1["mm"] == m]) > 0 else None for m in months_ordered]
        },
        {
            "label": "2025",
            "data": [float(y2[y2["mm"] == m]["revenue"].iloc[0]) if len(y2[y2["mm"] == m]) > 0 else None for m in months_ordered]
        },
        {
            "label": "2026",
            "data": [float(y3[y3["mm"] == m]["revenue"].iloc[0]) if len(y3[y3["mm"] == m]) > 0 else None for m in months_ordered]
        }
    ]
}

# =====================================================================
# CHART 3: Monthly Cash Flow (In/Out/Net)
# =====================================================================
cashflow = bank.groupby("month").agg(
    total_in=("amount_gbp", lambda x: x[x > 0].sum()),
    total_out=("amount_gbp", lambda x: abs(x[x < 0].sum())),
).reset_index()
cashflow["net"] = cashflow["total_in"] - cashflow["total_out"]
cashflow["month_str"] = cashflow["month"].astype(str)

chart3 = {
    "labels": cashflow["month_str"].tolist(),
    "datasets": [
        {"label": "Cash In", "data": cashflow["total_in"].round(0).tolist()},
        {"label": "Cash Out", "data": cashflow["total_out"].round(0).tolist()},
        {"label": "Net Flow", "data": cashflow["net"].round(0).tolist()},
    ]
}

# =====================================================================
# CHART 4: Revenue vs Cash In (reconciliation check)
# =====================================================================
rev_vs_cash = monthly_rev.merge(
    cashflow[["month_str", "total_in", "total_out"]],
    left_on="month_str", right_on="month_str", how="left"
)
chart4 = {
    "labels": rev_vs_cash["month_str"].tolist(),
    "datasets": [
        {"label": "Gross Revenue (Orders)", "data": rev_vs_cash["revenue"].round(0).tolist()},
        {"label": "Cash Inflow (Bank)", "data": rev_vs_cash["total_in"].round(0).tolist()},
    ]
}

# =====================================================================
# CHART 5: Marketing Spend & ROAS Over Time
# =====================================================================
g_agg = google.groupby("month").agg(g_spend=("spend_gbp", "sum"), g_roas=("conversion_value_gbp", lambda x: x.sum()/google[google["month"].isin(x.index)]["spend_gbp"].sum())).reset_index()
# Fix ROAS calc
g_spend = google.groupby("month")["spend_gbp"].sum()
g_conv = google.groupby("month")["conversion_value_gbp"].sum()
g_roas = (g_conv / g_spend).reset_index()
g_roas.columns = ["month", "g_roas"]

m_spend = meta.groupby("month")["spend_gbp"].sum()
m_conv = meta.groupby("month")["conversion_value_gbp"].sum()
m_roas = (m_conv / m_spend).reset_index()
m_roas.columns = ["month", "m_roas"]

roas_data = g_roas.merge(m_roas, on="month", how="outer").sort_values("month")
roas_data["month_str"] = roas_data["month"].astype(str)

# Monthly spend data
g_spend_df = g_spend.reset_index()
g_spend_df.columns = ["month", "g_spend"]
m_spend_df = m_spend.reset_index()
m_spend_df.columns = ["month", "m_spend"]
spend_data = g_spend_df.merge(m_spend_df, on="month", how="outer").sort_values("month")
spend_data["month_str"] = spend_data["month"].astype(str)

chart5 = {
    "labels": roas_data["month_str"].tolist(),
    "datasets": [
        {"label": "Google ROAS", "data": roas_data["g_roas"].round(2).tolist()},
        {"label": "Meta ROAS", "data": roas_data["m_roas"].round(2).tolist()},
    ]
}

chart5b = {
    "labels": spend_data["month_str"].tolist(),
    "datasets": [
        {"label": "Google Spend", "data": spend_data["g_spend"].round(0).tolist()},
        {"label": "Meta Spend", "data": spend_data["m_spend"].round(0).tolist()},
    ]
}

# =====================================================================
# CHART 6: Returns - Monthly Refund Amount & Rate
# =====================================================================
refund_monthly = refunds.groupby("month").agg(
    refund_amount=("amount", "sum"),
    refund_count=("refund_id", "nunique")
).reset_index()
refund_monthly.columns = ["month", "refund_amount", "refund_count"]
refund_monthly["month_str"] = refund_monthly["month"].astype(str)

rev_monthly = orders.groupby("month")["total_price"].sum().reset_index()
rev_monthly.columns = ["month", "revenue"]
rev_monthly["month_str"] = rev_monthly["month"].astype(str)

refund_rate = refund_monthly.merge(rev_monthly, on="month_str")
refund_rate["rate"] = refund_rate["refund_amount"] / refund_rate["revenue"] * 100

chart6 = {
    "labels": refund_rate["month_str"].tolist(),
    "datasets": [
        {"label": "Refund Amount", "data": refund_rate["refund_amount"].round(0).tolist()},
        {"label": "Refund Rate (%)", "data": refund_rate["rate"].round(1).tolist()},
    ]
}

# Refund reasons pie
reasons = refunds["reason"].value_counts()
chart6b = {
    "labels": reasons.index.tolist(),
    "data": reasons.values.tolist(),
}

# =====================================================================
# CHART 7: Product Type Seasonality (Heatmap-style)
# =====================================================================
# Monthly revenue by product type, pivoted
chart7 = chart1  # same data, different visual

# =====================================================================
# CHART 8: Inventory - Stockouts per month
# =====================================================================
inv = load("inventory_movements.csv", parse_dates=["date"])
inv["month"] = inv["date"].dt.to_period("M")

# Count stockout events: variant goes to 0 on a sale day
sales = inv[inv["type"] == "sale"].copy()
sales = sales.sort_values(["variant_id", "date"])

# Monthly unique variants sold
monthly_active = sales.groupby("month")["variant_id"].nunique().reset_index()
monthly_active.columns = ["month", "active_variants"]
monthly_active["month_str"] = monthly_active["month"].astype(str)

# Monthly total SKUs (variants with inventory > 0 at end of month)
# Simpler: total unit sales per month
monthly_units = sales.groupby("month").agg(
    units_sold=("quantity_delta", lambda x: sum(abs(v) for v in x)),
    transactions=("movement_id", "nunique")
).reset_index()
monthly_units["month_str"] = monthly_units["month"].astype(str)

chart8 = {
    "labels": monthly_active["month_str"].tolist(),
    "datasets": [
        {"label": "Active Variants Sold", "data": monthly_active["active_variants"].tolist()},
        {"label": "Units Sold", "data": monthly_units["units_sold"].tolist()},
    ]
}

# =====================================================================
# CHART 9: Mens vs Womens Revenue Over Time
# =====================================================================
gs_rev = sold.groupby(["month", "gender_segment"])["revenue"].sum().unstack(fill_value=0)
gs_rev.index = gs_rev.index.astype(str)

chart9 = {
    "labels": gs_rev.index.tolist(),
    "datasets": [
        {"label": col, "data": gs_rev[col].round(0).tolist()}
        for col in gs_rev.columns
    ]
}

# =====================================================================
# CHART 10: Customer Acquisition by Month & Source
# =====================================================================
cust_monthly = customers.copy()
cust_monthly["acq_month"] = cust_monthly["created_at"].dt.to_period("M")
acq_source = cust_monthly.groupby(["acq_month", "acquisition_source"]).size().unstack(fill_value=0)
acq_source.index = acq_source.index.astype(str)

# Top 4 sources + "other"
top_sources = acq_source.sum().sort_values(ascending=False).head(5).index.tolist()
acq_agg = acq_source[top_sources].copy()
acq_agg["other"] = acq_source[[c for c in acq_source.columns if c not in top_sources]].sum(axis=1)

chart10 = {
    "labels": acq_agg.index.tolist(),
    "datasets": [
        {"label": col[:50], "data": acq_agg[col].tolist()}
        for col in acq_agg.columns
    ]
}

# =====================================================================
# CHART 11: Support Ticket Volume & Resolution Time
# =====================================================================
tickets_monthly = tickets.groupby("month").agg(
    tickets=("ticket_id", "nunique"),
    avg_resolution=("resolution_time_minutes", "mean"),
    bot_pct=("resolved_by", lambda x: (x == "bot").sum() / len(x) * 100 if len(x) > 0 else 0)
).reset_index()
tickets_monthly["month_str"] = tickets_monthly["month"].astype(str)

chart11 = {
    "labels": tickets_monthly["month_str"].tolist(),
    "datasets": [
        {"label": "Tickets", "data": tickets_monthly["tickets"].tolist()},
        {"label": "Avg Resolution (min)", "data": tickets_monthly["avg_resolution"].round(0).tolist()},
    ]
}

chart11b = {
    "labels": tickets_monthly["month_str"].tolist(),
    "datasets": [
        {"label": "Bot Resolution %", "data": tickets_monthly["bot_pct"].round(1).tolist()},
    ]
}

# =====================================================================
# CHART 12: Bank Balance Over Time
# =====================================================================
bank_sorted = bank.sort_values("date")
chart12 = {
    "labels": bank_sorted["date"].dt.strftime("%Y-%m-%d").tolist(),
    "datasets": [
        {"label": "Bank Balance (£)", "data": bank_sorted["balance_gbp"].round(0).tolist()},
    ]
}

# =====================================================================
# CHART 13: Average Order Value by Product Type Over Time
# =====================================================================
aov_by_type = sold.groupby(["month", "product_type"]).agg(
    aov=("price", "mean"),
    orders=("order_id", "nunique")
).reset_index()

aov_pivot = aov_by_type.pivot(index="month", columns="product_type", values="aov").fillna(0)
aov_pivot.index = aov_pivot.index.astype(str)

chart13 = {
    "labels": aov_pivot.index.tolist(),
    "datasets": [
        {"label": col, "data": aov_pivot[col].round(0).tolist()}
        for col in aov_pivot.columns
    ]
}

# =====================================================================
# CHART 14: Discount Code Usage Over Time
# =====================================================================
orders["has_discount"] = (orders["total_discounts"] > 0).astype(int)
disc_monthly = orders.groupby("month").agg(
    total_orders=("order_id", "nunique"),
    discounted=("has_discount", "sum"),
    avg_discount=("total_discounts", "mean"),
    aov_discounted=("total_price", lambda x: x[orders["has_discount"] == 1].mean()),
    aov_full=("total_price", lambda x: x[orders["has_discount"] == 0].mean()),
).reset_index()
disc_monthly["disc_pct"] = disc_monthly["discounted"] / disc_monthly["total_orders"] * 100
disc_monthly["month_str"] = disc_monthly["month"].astype(str)

chart14 = {
    "labels": disc_monthly["month_str"].tolist(),
    "datasets": [
        {"label": "Discounted Orders %", "data": disc_monthly["disc_pct"].round(1).tolist()},
        {"label": "Avg Discount (£)", "data": disc_monthly["avg_discount"].round(1).tolist()},
    ]
}

# =====================================================================
# CHART 15: Profit Margin by Product Type (Bar)
# =====================================================================
landed = po_lines.groupby("variant_id")["landed_cost_per_unit_gbp"].last().to_dict()
sold["cost"] = sold["variant_id"].map(landed)
sold["cost"].fillna(sold["cost"].mean(), inplace=True)
sold["gross_margin"] = (sold["price"] - sold["cost"]) / sold["price"] * 100

margin_summary = sold.groupby("product_type").agg(
    revenue=("revenue", "sum"),
    margin=("gross_margin", "mean"),
).sort_values("margin")

chart15 = {
    "labels": margin_summary.index.tolist(),
    "datasets": [
        {"label": "Avg Gross Margin %", "data": margin_summary["margin"].round(1).tolist()},
    ]
}

# =====================================================================
# CHART 16: Seasonality Heat Map - Revenue by Month & Product
# =====================================================================
# Monthly rev by product_type already in chart1/chart7
# Normalize each product type as % of its own maximum
rev_by_type_pct = rev_by_type.copy()
for col in rev_by_type_pct.columns:
    mx = rev_by_type_pct[col].max()
    if mx > 0:
        rev_by_type_pct[col] = rev_by_type_pct[col] / mx * 100

chart16 = {
    "labels": rev_by_type_pct.index.tolist(),
    "datasets": [
        {"label": col, "data": rev_by_type_pct[col].round(0).tolist()}
        for col in rev_by_type_pct.columns
    ]
}

# =====================================================================
# CHART 17: Cash Position vs Inventory Value vs Revenue
# =====================================================================
# Monthly ending bank balance
bank_monthly_end = bank.groupby("month")["balance_gbp"].last().reset_index()
bank_monthly_end.columns = ["month", "ending_balance"]
bank_monthly_end["month_str"] = bank_monthly_end["month"].astype(str)

# Monthly revenue
monthly_rev2 = orders.groupby("month")["total_price"].sum().reset_index()
monthly_rev2.columns = ["month", "revenue"]
monthly_rev2["month_str"] = monthly_rev2["month"].astype(str)

# Inventory value estimate (rough - sum of inventory_quantity * price)
inv_value = variants.copy()
inv_value["value"] = inv_value["inventory_quantity"] * inv_value["price"]
total_inv = inv_value["value"].sum()

chart17 = monthly_rev2.merge(bank_monthly_end, on="month_str", how="left")
chart17_data = {
    "labels": chart17["month_str"].tolist(),
    "datasets": [
        {"label": "Monthly Revenue (£)", "data": chart17["revenue"].round(0).tolist()},
        {"label": "Ending Bank Balance (£)", "data": chart17["ending_balance"].round(0).tolist()},
    ]
}

# =====================================================================
# OUTPUT
# =====================================================================
output = {
    "chart1_revenue_by_type": chart1,
    "chart2_revenue_yoy": chart2,
    "chart3_cashflow": chart3,
    "chart4_revenue_vs_cash": chart4,
    "chart5_roas": chart5,
    "chart5b_ad_spend": chart5b,
    "chart6_refunds": chart6,
    "chart6b_refund_reasons": chart6b,
    "chart7_product_seasonality": chart7,
    "chart8_inventory": chart8,
    "chart9_gender_segment": chart9,
    "chart10_acquisition": chart10,
    "chart11_support": chart11,
    "chart11b_bot_rate": chart11b,
    "chart12_bank_balance": chart12,
    "chart13_aov_by_type": chart13,
    "chart14_discounts": chart14,
    "chart15_margins": chart15,
    "chart16_seasonality_norm": chart16,
    "chart17_revenue_vs_balance": chart17_data,
}

# Write as JS
with open("chart_data.js", "w") as f:
    f.write("const CHART_DATA = ")
    json.dump(output, f, indent=2)
    f.write(";")

print(f"Generated chart_data.js with {len(output)} chart datasets")
print("Charts generated:")
for k in output:
    ds = output[k].get("datasets", output[k].get("data", "pie"))
    n = len(ds) if isinstance(ds, list) else 1
    print(f"  {k}: {len(output[k]['labels'])} data points, {n} series")
