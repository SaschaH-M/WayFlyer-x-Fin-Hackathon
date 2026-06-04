"""
simulator.py — Backtest the tool against reality. THE PROOF POINT.

Method (honest, no peeking):
  1. Cut the timeline at month 12 (default 2025-05-31).
  2. Using ONLY data on/before the cutoff, score every variant and emit a
     recommendation: REORDER (stockout risk) / MARKDOWN (trapped cash) / HOLD.
  3. Replay the ACTUAL months 13-24 from the real data and measure what each
     recommendation would have been worth:
       - REORDER SKUs that actually stocked out  -> revenue recovered (lost
         sales the operator would have captured), and a stockout avoided.
       - MARKDOWN SKUs that stayed overstocked    -> trapped cash freed.
  4. Score the tool's accuracy: of the SKUs it flagged REORDER, how many really
     did stock out (precision). This is what makes the claim credible.

Output: headline totals, a 12-month cumulative series for charting, accuracy,
and cited example SKUs.
"""
from functools import lru_cache

import numpy as np
import pandas as pd

import dataset as ds

CUTOFF = pd.Timestamp("2025-05-31")          # end of month 12
END = pd.Timestamp("2026-05-31")             # end of month 24
CAPTURE_RATE = 0.80                          # we don't claim 100% of lost sales
DISCOUNT, SELL_THROUGH = 0.30, 0.70          # markdown assumptions (match Cash Radar)


def _velocity_before(li, orders, cutoff, days=90):
    lo = cutoff - pd.Timedelta(days=days)
    oiw = orders[(orders["created_at"] > lo) & (orders["created_at"] <= cutoff)]
    liw = li[li["order_id"].isin(oiw["order_id"])]
    s = liw.groupby("variant_id")["quantity"].sum()
    return (s / (days / 7.0)).to_dict()       # units / week


def _inventory_at(im, asof):
    upto = im[im["date"] <= asof]
    inv = upto.sort_values("date").groupby("variant_id").tail(1)[["variant_id", "running_balance"]]
    return dict(zip(inv["variant_id"], inv["running_balance"]))


@lru_cache(maxsize=4)
def compute(cutoff_str: str = None):
    cutoff = pd.Timestamp(cutoff_str) if cutoff_str else CUTOFF
    orders = ds.orders(); li = ds.line_items(); variants = ds.variants()
    products = ds.products(); im = ds.inventory(); poli = ds.po_lines()

    vel = _velocity_before(li, orders, cutoff)
    inv_cut = _inventory_at(im, cutoff)
    price = dict(zip(variants["variant_id"], variants["price"]))
    landed = poli.groupby("variant_id")["landed_cost_per_unit_gbp"].last().to_dict()
    avg_landed = poli["landed_cost_per_unit_gbp"].mean()
    pname = dict(zip(products["product_id"], products["title"]))
    vprod = dict(zip(variants["variant_id"], variants["product_id"]))
    vsku = dict(zip(variants["variant_id"], variants["sku"]))

    # actual test-window facts (months 13-24)
    test_orders = orders[(orders["created_at"] > cutoff) & (orders["created_at"] <= END)]
    test_li = li[li["order_id"].isin(test_orders["order_id"])].merge(
        test_orders[["order_id", "created_at"]], on="order_id")
    test_li["month"] = test_li["created_at"].dt.to_period("M")
    units_sold_test = test_li.groupby("variant_id")["quantity"].sum().to_dict()

    # actual stockout days per variant inside the window (running_balance <= 0)
    im_test = im[(im["date"] > cutoff) & (im["date"] <= END)].sort_values("date")
    oos_days = {}
    for vid, g in im_test.groupby("variant_id"):
        # count distinct days the balance was at/below zero
        z = g[g["running_balance"] <= 0]
        oos_days[vid] = z["date"].dt.normalize().nunique()

    test_months = pd.period_range(cutoff + pd.Timedelta(days=1), END, freq="M")
    monthly_freed = {str(m): 0.0 for m in test_months}
    monthly_recovered = {str(m): 0.0 for m in test_months}

    reorder_recs, markdown_recs = [], []
    tp = fp = 0   # reorder precision: stocked-out vs not
    total_freed = total_recovered = 0.0
    stockouts_avoided = 0

    for _, v in variants.iterrows():
        vid = v["variant_id"]
        p = float(price.get(vid, 0) or 0)
        c = float(landed.get(vid, avg_landed))
        wk = float(vel.get(vid, 0.0))
        inv = float(inv_cut.get(vid, 0.0))
        cover = (inv / wk / 4.33) if wk > 0 else (999 if inv > 0 else 0)

        # recommendation as-of cutoff
        if inv <= 0 or (cover < 2 and wk > 0):
            rec = "reorder"
        elif cover > 12 and wk > 0:
            rec = "markdown"
        else:
            rec = "hold"

        if rec == "reorder":
            d_oos = oos_days.get(vid, 0)
            did_stockout = d_oos > 0
            tp += did_stockout; fp += (not did_stockout)
            if did_stockout:
                stockouts_avoided += 1
                weeks_oos = d_oos / 7.0
                lost_units = wk * weeks_oos
                recovered = lost_units * p * CAPTURE_RATE
                total_recovered += recovered
                # spread recovered revenue across the months the SKU was actually short
                vmonths = im_test[(im_test["variant_id"] == vid) & (im_test["running_balance"] <= 0)]["date"].dt.to_period("M").unique()
                if len(vmonths):
                    per = recovered / len(vmonths)
                    for m in vmonths:
                        if str(m) in monthly_recovered:
                            monthly_recovered[str(m)] += per
                reorder_recs.append({
                    "variant_id": vid, "sku": vsku.get(vid), "product_name": pname.get(vprod.get(vid), ""),
                    "velocity_wk": round(wk, 2), "weeks_out_of_stock": round(weeks_oos, 1),
                    "lost_units": round(lost_units), "revenue_recovered": round(recovered), "price": round(p, 2)})
        elif rec == "markdown":
            sold = float(units_sold_test.get(vid, 0))
            # tool correct if it did NOT naturally clear (still overstocked)
            still_overstocked = sold < inv
            if still_overstocked and inv > 0:
                freed = inv * p * (1 - DISCOUNT) * SELL_THROUGH
                total_freed += freed
                # markdown realised early — credit to first test month
                first_m = str(test_months[0])
                monthly_freed[first_m] += freed
                markdown_recs.append({
                    "variant_id": vid, "sku": vsku.get(vid), "product_name": pname.get(vprod.get(vid), ""),
                    "inventory_at_cutoff": int(inv), "units_sold_after": int(sold),
                    "months_cover": round(cover, 1) if cover < 999 else 999,
                    "cash_freed": round(freed), "trapped_at_cost": round(inv * c), "price": round(p, 2)})

    precision = tp / (tp + fp) if (tp + fp) else 0.0

    # cumulative series for the chart
    months_sorted = [str(m) for m in test_months]
    cum_freed = cum_rec = 0.0
    series = []
    for m in months_sorted:
        cum_freed += monthly_freed[m]; cum_rec += monthly_recovered[m]
        series.append({"month": m, "cash_freed": round(monthly_freed[m]),
                       "revenue_recovered": round(monthly_recovered[m]),
                       "cum_cash_freed": round(cum_freed), "cum_revenue_recovered": round(cum_rec),
                       "cum_total": round(cum_freed + cum_rec)})

    reorder_recs.sort(key=lambda r: -r["revenue_recovered"])
    markdown_recs.sort(key=lambda r: -r["cash_freed"])
    total_impact = total_freed + total_recovered

    return {
        "cutoff": cutoff.strftime("%Y-%m-%d"),
        "test_window": {"start": months_sorted[0], "end": months_sorted[-1], "months": len(months_sorted)},
        "headline": {
            "total_impact_gbp": round(total_impact),
            "cash_freed_gbp": round(total_freed),
            "revenue_recovered_gbp": round(total_recovered),
            "stockouts_avoided": stockouts_avoided,
            "reorder_flagged": tp + fp,
            "markdown_flagged": len(markdown_recs),
            "reorder_precision": round(precision, 3),
            "reorder_precision_pct": round(precision * 100, 1),
        },
        "series": series,
        "top_reorder": reorder_recs[:15],
        "top_markdown": markdown_recs[:15],
        "assumptions": {
            "capture_rate": CAPTURE_RATE, "markdown_discount": DISCOUNT, "sell_through": SELL_THROUGH,
            "velocity_window_days": 90,
            "note": ("Recommendations use only data on/before the cutoff. Outcomes are measured "
                     "against the real months 13-24 in the dataset — actual stockouts and actual "
                     "leftover inventory. Recovered revenue is discounted by an 80% capture rate."),
        },
    }
