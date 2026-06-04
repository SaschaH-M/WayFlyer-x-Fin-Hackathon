"""
stocksense.py — StockSense Score (0-100) + status + recommendation per variant.
Ported from the proven stocksense_data.py pipeline, now computed live from the DB.

Score = stock_urgency(0-50) + demand_intensity(0-30) + trend_bonus(0-20).
"today" in the dataset = 1 Jun 2026.
"""
from functools import lru_cache

import numpy as np

import dataset as ds

LAST3_START = "2026-03-01"
LAST12_START = "2025-06-01"
LAST12_END = "2026-05-31"
CURRENT_MONTH = 6  # June


@lru_cache(maxsize=1)
def compute():
    orders = ds.orders()
    products = ds.products()
    variants = ds.variants()
    po_lines = ds.po_lines()

    li = ds.line_items()[["order_id", "variant_id", "product_id", "quantity", "price"]].copy()
    li = li.merge(orders[["order_id", "created_at"]], on="order_id")
    li["revenue"] = li["price"] * li["quantity"]
    li["month_num"] = li["created_at"].dt.month

    landed = po_lines.groupby("variant_id")["landed_cost_per_unit_gbp"].last().to_dict()
    avg_landed = po_lines["landed_cost_per_unit_gbp"].mean()

    last3 = li[li["created_at"] >= LAST3_START]
    sales_3mo = last3.groupby("variant_id").agg(
        units_3mo=("quantity", "sum"), revenue_3mo=("revenue", "sum")).reset_index()
    s3u = dict(zip(sales_3mo["variant_id"], sales_3mo["units_3mo"]))
    s3r = dict(zip(sales_3mo["variant_id"], sales_3mo["revenue_3mo"]))

    last12 = li[(li["created_at"] >= LAST12_START) & (li["created_at"] <= LAST12_END)]
    sales_12mo = last12.groupby("variant_id").agg(units_12mo=("quantity", "sum")).reset_index()
    s12u = dict(zip(sales_12mo["variant_id"], sales_12mo["units_12mo"]))
    max_demand = max(1, sales_12mo["units_12mo"].max())

    # monthly sparkline per variant
    li["month"] = li["created_at"].dt.to_period("M")
    msp = li.groupby(["variant_id", "month"])["quantity"].sum().unstack(fill_value=0)
    all_months = sorted(li["month"].unique())
    msp = msp.reindex(columns=all_months, fill_value=0)

    # seasonality per product_type per calendar month
    li_t = li.merge(products[["product_id", "product_type"]], on="product_id")
    mbt = li_t.groupby(["product_type", "month_num"])["quantity"].sum().reset_index()
    abt = li_t.groupby("product_type")["quantity"].sum().rename("annual").reset_index()
    seas = mbt.merge(abt, on="product_type")
    seas["factor"] = seas["quantity"] / seas["annual"]

    prod_by_id = products.set_index("product_id")
    out = []
    for _, var in variants.iterrows():
        vid = var["variant_id"]
        pid = var["product_id"]
        prod = prod_by_id.loc[pid]
        inv_qty = var["inventory_quantity"]
        price = var["price"]
        cost = landed.get(vid, avg_landed)

        u3 = float(s3u.get(vid, 0)); r3 = float(s3r.get(vid, 0)); u12 = float(s12u.get(vid, 0))
        vel_3mo = u3 / 13; vel_12mo = u12 / 52
        if u12 > 0:
            blended = vel_3mo * 0.6 + vel_12mo * 0.4
        else:
            blended = vel_3mo if u3 > 0 else 0

        if blended > 0:
            months_cover = (inv_qty / blended) / 4.33
        else:
            months_cover = 999 if inv_qty > 0 else 0

        s = seas[(seas["product_type"] == prod["product_type"]) & (seas["month_num"] == CURRENT_MONTH)]["factor"].values
        season_factor = float(s[0]) if len(s) else 1 / 12

        trend = (vel_3mo - vel_12mo) / vel_12mo if (u12 > 0 and vel_12mo > 0) else 0

        if months_cover == 0 or inv_qty <= 0:
            stock_urgency = 50
        elif months_cover > 12:
            stock_urgency = 0
        else:
            stock_urgency = 50 * (1 - months_cover / 12)
        demand_intensity = min(30, 30 * (u12 / max_demand))
        trend_bonus = min(20, max(0, trend * 50)) if trend > 0 else 0
        score = int(min(100, max(0, round(stock_urgency + demand_intensity + trend_bonus))))

        if inv_qty <= 0:
            status = "reorder"
        elif months_cover > 12 and blended > 0:
            status = "markdown"
        elif months_cover < 2 and blended > 0:
            status = "reorder"
        elif score >= 50:
            status = "watch"
        elif blended == 0 and inv_qty > 0:
            status = "markdown"
        else:
            status = "healthy"

        if status == "reorder":
            reorder_qty = max(1, round(blended * 12)) if blended > 0 else max(1, round(u3 * 0.8))
            rec = f"Reorder {reorder_qty} units"
            rec_cost = round(reorder_qty * cost)
            rec_detail = (f"Est. cost £{rec_cost:,}. ~{round(reorder_qty/blended) if blended>0 else 0} weeks cover at current velocity."
                          if blended > 0 else f"Based on {u3:.0f} units sold last 3 months.")
        elif status == "markdown":
            rec = f"Mark down {int(inv_qty)} units"
            rec_cost = round(inv_qty * cost)
            mc = 999 if months_cover >= 999 else round(months_cover)
            rec_detail = f"£{rec_cost:,} tied up at cost. {mc} months of cover. Consider 30-50% discount."
        else:
            rec = "Healthy — no action needed"
            rec_cost = 0
            mc = 999 if months_cover >= 999 else round(months_cover)
            rec_detail = f"{mc} months of cover."

        spark = [round(float(x), 1) for x in msp.loc[vid].values.tolist()] if vid in msp.index else []

        # plain-English reasoning — why this score, why this status (no black box)
        cover_txt = "out of stock" if inv_qty <= 0 else ("∞ months of cover" if months_cover >= 999 else f"{round(months_cover)} months of cover")
        why = (f"Sells {round(blended,1)}/week, {int(inv_qty)} in stock → {cover_txt}. "
               f"Score = {round(stock_urgency)} urgency + {round(demand_intensity)} demand"
               + (f" + {round(trend_bonus)} trend" if trend_bonus > 0 else "") + f" = {score}/100.")

        out.append({
            "variant_id": vid, "product_id": pid,
            "product_name": prod["title"], "product_type": prod["product_type"],
            "gender_segment": prod["gender_segment"], "sku": var["sku"],
            "price": round(float(price), 2), "landed_cost": round(float(cost), 2),
            "inventory": int(inv_qty), "units_3mo": round(u3), "revenue_3mo": round(r3),
            "units_12mo": round(u12), "velocity_weekly": round(float(blended), 2),
            "months_cover": round(float(months_cover), 1) if months_cover < 999 else 999,
            "trend": round(float(trend), 3), "season_factor": round(season_factor, 4),
            "stocksense_score": score, "status": status,
            "score_stock_urgency": round(float(stock_urgency), 1),
            "score_demand_intensity": round(float(demand_intensity), 1),
            "score_trend_bonus": round(float(trend_bonus), 1),
            "why": why,
            "recommendation": rec, "recommendation_cost": rec_cost,
            "recommendation_detail": rec_detail, "sparkline": spark,
            "margin_pct": round((price - cost) / price * 100, 1) if price > 0 else 0,
        })

    reorder = [v for v in out if v["status"] == "reorder"]
    markdown = [v for v in out if v["status"] == "markdown"]
    healthy = [v for v in out if v["status"] == "healthy"]
    watch = [v for v in out if v["status"] == "watch"]
    total_trapped = sum(v["landed_cost"] * v["inventory"] for v in markdown)
    total_reorder_cost = sum(v["recommendation_cost"] for v in reorder)
    lost_monthly = sum(v["revenue_3mo"] for v in reorder if v["inventory"] <= 0) / 3

    summary = {
        "total_variants": len(out),
        "reorder_count": len(reorder), "markdown_count": len(markdown),
        "healthy_count": len(healthy), "watch_count": len(watch),
        "total_trapped_cash": round(total_trapped),
        "total_reorder_cost": round(total_reorder_cost),
        "lost_monthly_revenue": round(lost_monthly),
        "avg_stocksense_score": round(sum(v["stocksense_score"] for v in out) / len(out), 1),
        "product_types": sorted(set(v["product_type"] for v in out)),
    }
    return {"summary": summary, "variants": out}
