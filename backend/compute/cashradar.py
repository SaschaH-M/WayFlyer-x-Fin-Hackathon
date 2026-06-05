"""
cashradar.py — live Cash Radar. Builds the actual EOD balance series, projects
30 days forward from any anchor date using only data knowable that day (PO
schedules, trailing payout avg, trailing recurring outflows), flags danger
anchors, and computes three remedies (delay PO / discount overstock / bridge).

Ported from the proven cash_radar_data.py. Computed once and cached.
"""
import calendar
from collections import defaultdict
from functools import lru_cache

import numpy as np
import pandas as pd

import dataset as ds

START = pd.Timestamp("2024-06-01")
END = pd.Timestamp("2026-05-31")
HORIZON = 30
DANGER_THRESHOLD = -200000.0
CASH_FLOOR_TARGET = 20000.0
WAYFLYER_APR = 0.24
RECURRING_CATEGORIES = ["PAYROLL", "RENT", "FULFILMENT", "SHIPPING", "SAAS",
                        "MARKETING", "REFUND", "OTHER"]
LABEL_MAP = {
    "PAYROLL": "Payroll", "RENT": "Rent (Studio N1)", "FULFILMENT": "Hub3PL fulfilment",
    "SHIPPING": "Royal Mail shipping", "SAAS": "SaaS subs (Shopify, Figma, etc.)",
    "REFUND": "Shopify refund batch", "OTHER": "Other (VAT, insurance, misc.)",
}


class _Engine:
    """Holds the prepared series/indices so project_from() can be called freely."""

    def __init__(self):
        bt = ds.bank()
        pos = ds.purchase_orders()
        sups = ds.suppliers()
        self.im = ds.inventory()
        self.li = ds.line_items()
        self.orders = ds.orders()
        self.variants = ds.variants()
        self.products = ds.products()
        self.poli = ds.po_lines()

        # actual EOD balance series
        bt_sorted = bt.sort_values(["date", "transaction_id"])
        eod = bt_sorted.groupby(bt_sorted["date"].dt.normalize()).agg(
            eod_balance=("balance_gbp", "last"), daily_net=("amount_gbp", "sum")).reset_index()
        eod.columns = ["date", "eod_balance", "daily_net"]
        all_days = pd.DataFrame({"date": pd.date_range(START, END, freq="D")})
        bs = all_days.merge(eod, on="date", how="left").sort_values("date").reset_index(drop=True)
        bs["eod_balance"] = bs["eod_balance"].ffill().fillna(0)
        self.balance_series = bs
        self.balance_map = dict(zip(bs["date"], bs["eod_balance"]))

        sup_map = sups.set_index("supplier_id")[["name", "payment_terms", "lead_time_days", "currency"]].to_dict("index")

        # PO payment events (50/50 EU, full otherwise)
        po_payments = []
        for _, p in pos.iterrows():
            sup = sup_map[p["supplier_id"]]
            total = float(p["total_cost_gbp"])
            if "deposit" in str(sup["payment_terms"]):
                half = round(total / 2, 2)
                po_payments.append({"po_id": p["po_id"], "supplier": sup["name"],
                                    "date": p["deposit_paid_at"], "amount": -half, "kind": "po_deposit"})
                po_payments.append({"po_id": p["po_id"], "supplier": sup["name"],
                                    "date": p["balance_paid_at"], "amount": -half, "kind": "po_balance"})
            else:
                po_payments.append({"po_id": p["po_id"], "supplier": sup["name"],
                                    "date": p["balance_paid_at"], "amount": -round(total, 2), "kind": "po_full"})
        ppd = pd.DataFrame(po_payments)
        ppd["date"] = pd.to_datetime(ppd["date"])
        self.po_events_by_date = defaultdict(list)
        for _, r in ppd.iterrows():
            if pd.notna(r["date"]) and START <= r["date"] <= END:
                kind_lbl = ("deposit" if r["kind"] == "po_deposit"
                            else "balance" if r["kind"] == "po_balance" else "Net 60 payment")
                self.po_events_by_date[r["date"].normalize()].append({
                    "date": r["date"], "amount": float(r["amount"]),
                    "label": f"PO {r['po_id']} — {r['supplier']} ({kind_lbl})",
                    "kind": "po", "po_id": r["po_id"], "supplier": r["supplier"]})

        # recurring monthly aggregates
        bt_r = bt[bt["raw_category"].isin(RECURRING_CATEGORIES)].copy()
        bt_r["month"] = bt_r["date"].dt.to_period("M")
        bt_r["day"] = bt_r["date"].dt.day
        self.monthly_cat = bt_r.groupby(["month", "raw_category"]).agg(
            total=("amount_gbp", "sum"), n=("amount_gbp", "count")).reset_index()
        self.cat_dom = bt_r.groupby("raw_category")["day"].median().round().astype(int).to_dict()

        # actual payouts
        self.payouts = bt[bt["raw_category"] == "PAYOUT"][["date", "amount_gbp"]].sort_values("date").reset_index(drop=True)

    def trailing_payout_avg(self, T, weeks=8):
        prior = self.payouts[self.payouts["date"] <= T].tail(weeks)
        return float(prior["amount_gbp"].mean()) if len(prior) else 60000.0

    def expected_recurring(self, year, month, T):
        events = []
        trailing = pd.Period(T, freq="M") - 1
        low = trailing - 2
        last_day = calendar.monthrange(year, month)[1]
        for cat in RECURRING_CATEGORIES:
            rows = self.monthly_cat[(self.monthly_cat["raw_category"] == cat)
                                    & (self.monthly_cat["month"] >= low)
                                    & (self.monthly_cat["month"] <= trailing)]
            if len(rows) == 0:
                continue
            avg = float(rows["total"].mean())
            if avg >= 0:
                continue
            dom = self.cat_dom.get(cat, 28)
            if cat == "MARKETING":
                try:
                    d1 = pd.Timestamp(year, month, min(5, last_day))
                    d2 = pd.Timestamp(year, month, last_day)
                except ValueError:
                    continue
                events.append({"date": d1, "amount": round(avg / 2, 2), "label": "Google Ads (est., trailing 3-mo)", "kind": "recurring"})
                events.append({"date": d2, "amount": round(avg / 2, 2), "label": "Meta Ads (est., trailing 3-mo)", "kind": "recurring"})
                continue
            try:
                d = pd.Timestamp(year, month, min(dom, last_day))
            except ValueError:
                continue
            events.append({"date": d, "amount": round(avg, 2), "label": LABEL_MAP[cat] + " (est., trailing 3-mo)", "kind": "recurring"})
        return events

    def project_from(self, T, horizon=HORIZON, override_events=None):
        asof_balance = float(self.balance_map[T])
        avg_payout = self.trailing_payout_avg(T)
        recur = defaultdict(list)
        months = {((T + pd.Timedelta(days=o)).year, (T + pd.Timedelta(days=o)).month) for o in range(1, horizon + 1)}
        for (y, m) in months:
            for ev in self.expected_recurring(y, m, T):
                recur[ev["date"].normalize()].append(ev)
        proj = []
        running = asof_balance
        for offset in range(1, horizon + 1):
            d = T + pd.Timedelta(days=offset)
            dn = d.normalize()
            events = list(self.po_events_by_date.get(dn, []))
            events.extend(recur.get(dn, []))
            if override_events and dn in override_events:
                events = events + override_events[dn]
            if d.dayofweek == 2:
                events.append({"date": d, "amount": avg_payout, "label": "Shopify payout (est., 8-wk avg)", "kind": "payout_est"})
            net = sum(e["amount"] for e in events)
            running += net
            proj.append({
                "date": d.strftime("%Y-%m-%d"), "balance": round(running, 2), "net": round(net, 2),
                "events": [{"amount": round(e["amount"], 2), "label": e["label"], "kind": e["kind"],
                            "po_id": e.get("po_id"), "supplier": e.get("supplier")} for e in events],
            })
        return {"asof_date": T.strftime("%Y-%m-%d"), "asof_balance": round(asof_balance, 2),
                "projection": proj, "avg_weekly_payout": round(avg_payout, 0)}

    def asof_overstock(self, T):
        im_upto = self.im[self.im["date"] <= T]
        inv = im_upto.sort_values("date").groupby("variant_id").tail(1)[["variant_id", "running_balance"]]
        inv.columns = ["variant_id", "inventory"]
        win_start = T - pd.Timedelta(days=90)
        oiw = self.orders[(self.orders["created_at"] > win_start) & (self.orders["created_at"] <= T)]
        liw = self.li[self.li["order_id"].isin(oiw["order_id"])]
        sales = liw.groupby("variant_id")["quantity"].sum().reset_index()
        sales.columns = ["variant_id", "units_90d"]
        landed = self.poli.groupby("variant_id")["landed_cost_per_unit_gbp"].last().reset_index()
        landed.columns = ["variant_id", "landed_cost"]
        df = inv.merge(sales, on="variant_id", how="left")
        df["units_90d"] = df["units_90d"].fillna(0)
        df["velocity_wk"] = df["units_90d"] / 13.0
        df = df.merge(self.variants[["variant_id", "price", "product_id", "sku"]], on="variant_id", how="left")
        df = df.merge(self.products[["product_id", "title", "product_type"]], on="product_id", how="left")
        df = df.merge(landed, on="variant_id", how="left")
        df["landed_cost"] = df["landed_cost"].fillna(df["landed_cost"].median())
        df["months_cover"] = np.where(df["velocity_wk"] > 0, df["inventory"] / df["velocity_wk"] / 4.33, 999.0)
        df["is_overstock"] = (df["months_cover"] > 12) & (df["inventory"] > 0) & (df["velocity_wk"] > 0)
        df["freed"] = df["inventory"] * df["price"] * 0.7 * 0.7
        return df[df["is_overstock"]].sort_values("freed", ascending=False).reset_index(drop=True)

    def compute_remedies(self, T):
        proj = self.project_from(T)
        balances = [d["balance"] for d in proj["projection"]]
        min_bal = min(balances); min_idx = balances.index(min_bal)
        min_date = pd.Timestamp(proj["projection"][min_idx]["date"])
        danger_events = []
        for d in proj["projection"][:min_idx + 1]:
            for e in d["events"]:
                if e["kind"] == "po":
                    danger_events.append({**e, "date": d["date"]})
        danger_events.sort(key=lambda e: e["amount"])

        remedy_a = None
        if danger_events:
            tgt = danger_events[0]; delay = 21
            od = pd.Timestamp(tgt["date"]); nd = od + pd.Timedelta(days=delay)
            ov = {od: [{"date": od, "amount": -tgt["amount"], "label": f"DELAYED: {tgt['label']}", "kind": "remedy_offset"}],
                  nd: [{"date": nd, "amount": tgt["amount"], "label": f"DELAYED to here: {tgt['label']}", "kind": "remedy_offset"}]}
            nb = [d["balance"] for d in self.project_from(T, override_events=ov)["projection"]]
            remedy_a = {
                "kind": "delay_po", "po_id": tgt["po_id"], "supplier": tgt["supplier"],
                "orig_date": tgt["date"], "new_date": nd.strftime("%Y-%m-%d"), "delay_days": delay,
                "amount_gbp": round(-tgt["amount"]), "new_min_balance": round(min(nb)),
                "new_balances": [round(b) for b in nb],
                "headline": f"Delay PO {tgt['po_id']} balance by {delay} days (£{abs(tgt['amount']):,.0f} → {tgt['supplier']})",
                "detail": (f"Push the {od.strftime('%d %b')} payment to {nd.strftime('%d %b')}. Most EU suppliers "
                           f"(50/50 terms) accept a 2-3 week delay against a small fee. Projected nadir improves "
                           f"£{min_bal:,.0f} → £{min(nb):,.0f}."),
            }

        overstock = self.asof_overstock(T)
        gap = CASH_FLOOR_TARGET - min_bal
        chosen, freed = [], 0.0
        for _, v in overstock.iterrows():
            if freed >= gap:
                break
            chosen.append({"variant_id": v["variant_id"], "sku": v["sku"], "product_name": v["title"],
                           "product_type": v["product_type"], "inventory": int(v["inventory"]),
                           "months_cover": round(float(v["months_cover"]), 1) if v["months_cover"] < 999 else 999,
                           "landed_cost": round(float(v["landed_cost"]), 2), "price": round(float(v["price"]), 2),
                           "freed_at_30off_70st": round(float(v["freed"]))})
            freed += float(v["freed"])
        proj_o = self.project_from(T)
        weds = [i for i, d in enumerate(proj_o["projection"]) if pd.Timestamp(d["date"]).dayofweek == 2][:2]
        ovb = {}
        if weds:
            per = freed / len(weds)
            for idx in weds:
                d = pd.Timestamp(proj_o["projection"][idx]["date"])
                ovb.setdefault(d, []).append({"date": d, "amount": per,
                    "label": f"Markdown clearance — {len(chosen)} overstock variants", "kind": "remedy_offset"})
        nbb = [d["balance"] for d in self.project_from(T, override_events=ovb)["projection"]]
        nb_min = min(nbb) if nbb else min_bal
        remedy_b = {
            "kind": "discount_overstock", "variant_count": len(chosen), "freed_gbp": round(freed),
            "variants": chosen[:20], "discount_pct": 30, "sell_through_pct": 70,
            "new_min_balance": round(nb_min), "new_balances": [round(b) for b in nbb],
            "headline": f"Discount {len(chosen)} overstock variants 30% — frees ≈£{freed:,.0f} over 2 payouts",
            "detail": (f"These SKUs have >12 months of cover. 30% off retail with 70% sell-through clears "
                       f"≈£{freed:,.0f} over ~2 weeks. Projected nadir improves £{min_bal:,.0f} → £{nb_min:,.0f}. "
                       f"Dead capital becomes working capital."),
        }

        bridge = max(0, round((CASH_FLOOR_TARGET - min_bal) / 1000) * 1000)
        term = 90; fee = round(bridge * WAYFLYER_APR * term / 365)
        bid = T + pd.Timedelta(days=1)
        ovc = {bid: [{"date": bid, "amount": float(bridge), "label": f"Wayflyer bridge in (+£{bridge:,})", "kind": "remedy_offset"}]}
        ncb = [d["balance"] for d in self.project_from(T, override_events=ovc)["projection"]]
        nc_min = min(ncb) if ncb else min_bal
        remedy_c = {
            "kind": "wayflyer_bridge", "amount_gbp": bridge, "term_days": term,
            "apr_pct": round(WAYFLYER_APR * 100, 1), "fee_gbp": fee,
            "new_min_balance": round(nc_min), "new_balances": [round(b) for b in ncb],
            "headline": f"Wayflyer £{bridge:,} bridge — 90-day term, fee £{fee:,}",
            "detail": (f"£{bridge:,} cash advance against future revenue, repaid over 90 days. All-in fee "
                       f"≈£{fee:,} ({round(WAYFLYER_APR*100)}% APR equiv). Nadir improves £{min_bal:,.0f} → "
                       f"£{nc_min:,.0f}. Real money out — last resort after A and B."),
        }
        return {
            "anchor_date": T.strftime("%Y-%m-%d"), "asof_balance": proj["asof_balance"], "horizon_days": HORIZON,
            "projection": proj["projection"], "balances": balances, "min_balance": round(min_bal),
            "min_date": min_date.strftime("%Y-%m-%d"),
            "danger_drivers": [{"date": e["date"], "amount": e["amount"], "label": e["label"],
                                "po_id": e.get("po_id"), "supplier": e.get("supplier")} for e in danger_events[:8]],
            "days_forewarned": (min_date - T).days,
            "remedies": {"A": remedy_a, "B": remedy_b, "C": remedy_c},
        }


@lru_cache(maxsize=1)
def _engine():
    return _Engine()


@lru_cache(maxsize=1)
def compute():
    """Full Cash Radar bundle — same shape the original UI consumes."""
    e = _engine()
    anchor_summaries, projections_thin = [], {}
    anchor_dates = pd.date_range(START + pd.Timedelta(days=14), END - pd.Timedelta(days=HORIZON), freq="D")
    for T in anchor_dates:
        proj = e.project_from(T)
        balances = [d["balance"] for d in proj["projection"]]
        min_bal = min(balances); min_idx = balances.index(min_bal)
        anchor_summaries.append({"asof_date": proj["asof_date"], "asof_balance": proj["asof_balance"],
                                 "min_projected": min_bal, "min_date": proj["projection"][min_idx]["date"],
                                 "is_danger": min_bal < DANGER_THRESHOLD})
        projections_thin[proj["asof_date"]] = balances

    sum_df = pd.DataFrame(anchor_summaries)
    danger = sum_df[sum_df["is_danger"]].sort_values("min_projected").reset_index(drop=True)
    overall_worst = sum_df["min_projected"].min()
    PREF = pd.Timestamp("2024-08-14")
    if PREF.strftime("%Y-%m-%d") in set(sum_df["asof_date"]):
        primary = PREF
        row = sum_df[sum_df["asof_date"] == PREF.strftime("%Y-%m-%d")].iloc[0]
        worst_min_date = row["min_date"]; primary_min = row["min_projected"]
    else:
        row = sum_df[sum_df["min_projected"] == overall_worst].iloc[0]
        primary = pd.Timestamp(row["asof_date"]); worst_min_date = row["min_date"]; primary_min = overall_worst

    seen = {worst_min_date}; demo = [primary]
    for _, r in danger.iterrows():
        if r["min_date"] in seen:
            continue
        seen.add(r["min_date"]); demo.append(pd.Timestamp(r["asof_date"]))

    bundles = [e.compute_remedies(T) for T in demo]

    bs = e.balance_series
    actual_series = [{"date": r["date"].strftime("%Y-%m-%d"), "balance": round(float(r["eod_balance"]), 2)}
                     for _, r in bs.iterrows()]
    nadir_idx = bs["eod_balance"].idxmin(); nadir_row = bs.iloc[nadir_idx]

    return {
        "meta": {
            "data_start": START.strftime("%Y-%m-%d"), "data_end": END.strftime("%Y-%m-%d"),
            "horizon_days": HORIZON, "danger_threshold": DANGER_THRESHOLD, "cash_floor_target": CASH_FLOOR_TARGET,
            "actual_nadir_gbp": round(float(nadir_row["eod_balance"]), 2),
            "actual_nadir_date": pd.Timestamp(nadir_row["date"]).strftime("%Y-%m-%d"),
            "primary_anchor": primary.strftime("%Y-%m-%d"),
            "primary_projected_nadir_gbp": round(float(primary_min), 2),
            "primary_projected_nadir_date": worst_min_date,
            "primary_forewarned_days": int((pd.Timestamp(worst_min_date) - primary).days),
        },
        "actual_balance_series": actual_series,
        "anchors_summary": [{"date": r["asof_date"], "asof_balance": round(r["asof_balance"], 2),
                             "min_projected": round(r["min_projected"], 2), "min_date": r["min_date"],
                             "is_danger": bool(r["is_danger"])} for r in anchor_summaries],
        "projections_thin": {k: [round(b, 2) for b in v] for k, v in projections_thin.items()},
        "demo_anchors": bundles,
    }
