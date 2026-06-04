"""
marketing.py — Marketing Command Center.

Ties ad spend (google_ads_daily, meta_ads_daily) and channel attribution
(orders.utm_source / utm_campaign), email (email_campaigns) to the brand's
real revenue, then connects rising ad demand to the inventory system — the
"launch → smart reorder" loop.

Every number is real and reconciled:
  - True ROAS = spend ÷ Shopify-attributed revenue (not the platform's claim).
  - Break-even ROAS is derived from the brand's own gross margin.
  - Channels with no spend file (TikTok, Instagram-organic, Klaviyo) still show
    real attributed revenue from orders.utm_source.
"""
from functools import lru_cache

import pandas as pd

import dataset as ds
from . import stocksense

# campaign-name keyword -> product_type (used to link ads to inventory)
TYPE_KEYWORDS = [
    ("tee", "Tee"), ("hood", "Hoodie"), ("sweat", "Sweatpants"),
    ("cap", "Cap"), ("trainer", "Trainer"), ("footwear", "Trainer"), ("outerwear", "Outerwear"),
]
TODAY = pd.Timestamp("2026-06-01")


def _campaign_type(name: str):
    n = str(name).lower()
    for kw, t in TYPE_KEYWORDS:
        if kw in n:
            return t
    return None


@lru_cache(maxsize=1)
def compute():
    g = ds.table("google_ads_daily").copy()
    m = ds.table("meta_ads_daily").copy()
    o = ds.orders().copy()
    em = ds.table("email_campaigns").copy()
    poli = ds.po_lines(); v = ds.variants()

    g["date"] = pd.to_datetime(g["date"]); m["date"] = pd.to_datetime(m["date"])

    # ── break-even ROAS from gross margin ──
    landed = poli.groupby("variant_id")["landed_cost_per_unit_gbp"].last()
    price = v.set_index("variant_id")["price"]
    gm = ((price - landed) / price).dropna()
    gm = gm[(gm > 0) & (gm < 1)]
    gross_margin = float(gm.mean())
    break_even = round(1 / gross_margin, 2)

    # ── channel ROI (utm_source) ──
    g_spend = float(g["spend_gbp"].sum())
    m_total = float(m["spend_gbp"].sum())
    if "placement" in m.columns:
        ig_spend = float(m[m["placement"].astype(str).str.contains("Instagram", case=False, na=False)]["spend_gbp"].sum())
        fb_spend = m_total - ig_spend
    else:
        fb_spend, ig_spend = m_total, 0.0
    spend_by_source = {"google": g_spend, "facebook": fb_spend, "instagram": ig_spend}

    ch = o.groupby("utm_source").agg(revenue=("total_price", "sum"), orders=("order_id", "count")).reset_index()
    channels = []
    for _, r in ch.iterrows():
        src = str(r["utm_source"])
        spend = spend_by_source.get(src, 0.0)
        rev = float(r["revenue"])
        channels.append({
            "channel": src, "revenue": round(rev), "orders": int(r["orders"]),
            "aov": round(rev / r["orders"]) if r["orders"] else 0,
            "spend": round(spend), "tracked_spend": spend > 0,
            "roas": round(rev / spend, 2) if spend > 0 else None,
            "profitable": (rev / spend > break_even) if spend > 0 else None,
        })
    channels.sort(key=lambda c: -c["revenue"])

    # ── campaign ROI (true, attributed) ──
    attr = o.groupby("utm_campaign")["total_price"].sum()
    gc = g.groupby("campaign_name")["spend_gbp"].sum()
    mc = m.groupby("campaign_name")["spend_gbp"].sum()
    spend_by_campaign = gc.add(mc, fill_value=0)
    campaigns = []
    for camp, spend in spend_by_campaign.items():
        rev = float(attr.get(camp, 0.0)); spend = float(spend)
        roas = rev / spend if spend else 0
        status = "winner" if roas >= 4 else ("waste" if roas < break_even else "ok")
        campaigns.append({
            "campaign": camp, "spend": round(spend), "attributed_revenue": round(rev),
            "roas": round(roas, 2), "status": status, "product_type": _campaign_type(camp),
        })
    campaigns.sort(key=lambda c: -c["spend"])

    waste = [c for c in campaigns if c["status"] == "waste"]
    winners = sorted([c for c in campaigns if c["status"] == "winner"], key=lambda c: -c["roas"])
    rescuable = sum(c["spend"] for c in waste)
    winner_roas = (sum(c["roas"] for c in winners) / len(winners)) if winners else break_even
    waste_roas = (sum(c["attributed_revenue"] for c in waste) / max(1, rescuable)) if waste else 0
    reallocation = {
        "rescuable_spend": round(rescuable),
        "current_return": round(rescuable * waste_roas),
        "winner_avg_roas": round(winner_roas, 2),
        "projected_return": round(rescuable * winner_roas),
        "projected_gain": round(rescuable * (winner_roas - waste_roas)),
        "from_campaigns": [c["campaign"] for c in waste],
        "to_campaigns": [c["campaign"] for c in winners[:3]],
    }

    # ── free / under-invested channel (TikTok) ──
    free = [c for c in channels if not c["tracked_spend"] and c["channel"] in ("tiktok", "instagram", "organic")]
    tiktok = next((c for c in channels if c["channel"] == "tiktok"), None)

    # ── email ROI ──
    email = []
    for _, r in em.iterrows():
        sends = int(r["recipients"]) or 1
        email.append({
            "name": r["name"], "type": r["type"], "recipients": int(r["recipients"]),
            "open_rate": round(int(r["opens"]) / sends * 100, 1),
            "attributed_orders": int(r["attributed_orders"]),
            "attributed_revenue": round(float(r["attributed_revenue_gbp"])),
            "revenue_per_send": round(float(r["attributed_revenue_gbp"]) / sends, 2),
        })
    email.sort(key=lambda e: -e["attributed_revenue"])

    # ── THE MAGIC: launch demand signal -> inventory response ──
    ads = pd.concat([g[["date", "campaign_name", "impressions", "clicks"]],
                     m[["date", "campaign_name", "impressions", "clicks"]]], ignore_index=True)
    ads["ptype"] = ads["campaign_name"].map(_campaign_type)
    recent = ads[ads["date"] > TODAY - pd.Timedelta(days=60)]
    prior = ads[(ads["date"] <= TODAY - pd.Timedelta(days=60)) & (ads["date"] > TODAY - pd.Timedelta(days=120))]
    rec_imp = recent.groupby("ptype")["impressions"].sum()
    pri_imp = prior.groupby("ptype")["impressions"].sum()
    rec_clk = recent.groupby("ptype")["clicks"].sum()

    ss = stocksense.compute()["variants"]
    by_type = {}
    for v_ in ss:
        t = v_["product_type"]
        d = by_type.setdefault(t, {"reorder": 0, "oos": 0, "reorder_units": 0, "covers": [], "variants": []})
        if v_["status"] == "reorder":
            d["reorder"] += 1
            if v_["inventory"] <= 0:
                d["oos"] += 1
            try:
                d["reorder_units"] += int(v_["recommendation"].split()[1])
            except Exception:
                pass
            d["variants"].append({"sku": v_["sku"], "product_name": v_["product_name"], "inventory": v_["inventory"]})
        if v_["months_cover"] != 999:
            d["covers"].append(v_["months_cover"])

    signals = []
    for t in sorted(set(rec_imp.index.dropna()) | set(by_type.keys())):
        if not t:
            continue
        ri = float(rec_imp.get(t, 0)); pi = float(pri_imp.get(t, 0))
        surge = ((ri - pi) / pi * 100) if pi else 0.0
        d = by_type.get(t, {})
        reorder = d.get("reorder", 0); oos = d.get("oos", 0); units = d.get("reorder_units", 0)
        covers = d.get("covers", [])
        avg_cover = round(sum(covers) / len(covers), 1) if covers else 0
        # actionable when ad demand is rising AND stock is thin
        rising = surge > 5
        thin = reorder > 0
        action = None
        if rising and thin:
            action = f"Demand rising {round(surge)}% but {reorder} SKUs already thin ({oos} out of stock) → reorder {units} units now, before the launch sells out."
            severity = "high" if oos > 0 else "medium"
        elif rising:
            action = f"Ad demand rising {round(surge)}% — stock looks healthy, keep monitoring."
            severity = "low"
        elif thin:
            action = f"{reorder} SKUs thin but ad demand flat — reorder calmly or redirect spend here to drive it."
            severity = "low"
        signals.append({
            "product_type": t, "ad_impressions_recent": round(ri), "surge_pct": round(surge, 1),
            "clicks_recent": int(rec_clk.get(t, 0)),
            "reorder_skus": reorder, "out_of_stock": oos, "recommended_units": units,
            "avg_months_cover": avg_cover, "action": action, "severity": severity if action else "none",
            "example_variants": d.get("variants", [])[:4],
        })
    signals.sort(key=lambda s: ({"high": 0, "medium": 1, "low": 2, "none": 3}[s["severity"]], -s["surge_pct"]))

    # ── product-line recommendations ──
    recs = []
    if tiktok and tiktok["revenue"] > 100000:
        recs.append({
            "title": "Invest in TikTok — it's working for free",
            "detail": f"TikTok drove £{tiktok['revenue']:,} across {tiktok['orders']:,} orders with no tracked ad spend. "
                      f"Even a small paid budget here likely beats your {break_even}× break-even instantly.",
            "tag": "channel",
        })
    if waste:
        recs.append({
            "title": f"Cut {len(waste)} loss-making campaigns",
            "detail": f"£{rescuable:,} is going to campaigns below the {break_even}× break-even. Move it to "
                      f"{', '.join(reallocation['to_campaigns'])} (avg {reallocation['winner_avg_roas']}×) for ~£{reallocation['projected_gain']:,} more revenue.",
            "tag": "reallocate",
        })
    hot = [s for s in signals if s["severity"] in ("high", "medium")]
    if hot:
        t = hot[0]
        recs.append({
            "title": f"Restock {t['product_type']} before the launch sells out",
            "detail": f"{t['action']}",
            "tag": "inventory",
        })

    total_spend = round(g_spend + m_total)
    total_attr = round(float(attr[attr.index.notna()].sum()))
    return {
        "meta": {
            "break_even_roas": break_even, "gross_margin_pct": round(gross_margin * 100, 1),
            "total_ad_spend": total_spend, "total_attributed_revenue": total_attr,
            "blended_roas": round(total_attr / total_spend, 2) if total_spend else 0,
        },
        "channels": channels,
        "campaigns": campaigns,
        "waste": waste, "winners": winners[:6], "reallocation": reallocation,
        "free_channels": free, "email": email,
        "launch_signals": signals,
        "recommendations": recs,
    }
