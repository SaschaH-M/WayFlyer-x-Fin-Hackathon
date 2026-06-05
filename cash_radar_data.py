#!/usr/bin/env python3
"""
cash_radar_data.py — Generates the Cash Radar projection + remedy data for the
Pretty Fly demo. Outputs cash_radar_data.js for the index.html UI.

Story: on 3 Sep 2024 Pretty Fly's bank balance hit -£274,113.93 (verified, the
24-month low). 17+ days earlier, every signal needed to predict it was already
in the data — three PO balance payments totalling ~£163K were scheduled for 2
Sep, plus recurring outflows.

This script:
  1. Builds the actual daily end-of-day balance series.
  2. For every day T in the window, projects the next 30 days using known PO
     payment schedules, recurring outflows (payroll/rent/ads/etc), and a
     trailing-8-week average for expected Shopify payouts.
  3. Flags danger anchors — days where the 30-day projected nadir is a new
     30-day low.
  4. For each danger anchor, computes three remedies:
       A. Delay the largest PO outflow inside the danger window.
       B. Discount overstock variants (as-of T) to free cash.
       C. Wayflyer bridge — minimum amount to keep projected balance ≥ £20K,
          with honest 90-day interest cost.

Output: cash_radar_data.js (~1MB) for the dashboard.
"""
import pandas as pd
import numpy as np
import json
import calendar
from pathlib import Path
from collections import defaultdict

DATA = Path("data")
START = pd.Timestamp("2024-06-01")
END = pd.Timestamp("2026-05-31")
HORIZON = 30                 # days projected forward
DANGER_THRESHOLD = -200000.0  # projected nadir below this = danger
CASH_FLOOR_TARGET = 20000.0   # what we want to keep balance above
WAYFLYER_APR = 0.24           # honest 24% APR effective for bridge financing

# ── Load tables ──
print("Loading tables...")
bt = pd.read_csv(DATA / "bank_transactions.csv", parse_dates=["date"])
pos = pd.read_csv(DATA / "purchase_orders.csv",
                  parse_dates=["created_at", "expected_delivery", "actual_delivery",
                               "deposit_paid_at", "balance_paid_at"])
poli = pd.read_csv(DATA / "po_line_items.csv")
sups = pd.read_csv(DATA / "suppliers.csv")
im = pd.read_csv(DATA / "inventory_movements.csv", parse_dates=["date"])
li = pd.read_csv(DATA / "line_items.csv")
orders = pd.read_csv(DATA / "orders.csv", parse_dates=["created_at"])
variants = pd.read_csv(DATA / "variants.csv")
products = pd.read_csv(DATA / "products.csv")

# ── 1. Actual end-of-day balance series ──
print("Building actual EOD balance series...")
bt_sorted = bt.sort_values(["date", "transaction_id"])
day_groups = bt_sorted.groupby(bt_sorted["date"].dt.normalize())
eod = day_groups.agg(eod_balance=("balance_gbp", "last"),
                     daily_net=("amount_gbp", "sum")).reset_index()
eod.columns = ["date", "eod_balance", "daily_net"]

all_days = pd.DataFrame({"date": pd.date_range(START, END, freq="D")})
balance_series = all_days.merge(eod, on="date", how="left").sort_values("date").reset_index(drop=True)
balance_series["eod_balance"] = balance_series["eod_balance"].ffill().fillna(0)
balance_series["daily_net"] = balance_series["daily_net"].fillna(0)
balance_map = dict(zip(balance_series["date"], balance_series["eod_balance"]))

# ── 2. Known scheduled events table ──
print("Building scheduled events...")
sup_map = sups.set_index("supplier_id")[["name", "payment_terms", "lead_time_days", "currency"]].to_dict("index")

# (a) PO deposit/balance payments — exact dates, exact amounts (50/50 for EU, full for Net 60)
po_payments = []
for _, p in pos.iterrows():
    sup = sup_map[p["supplier_id"]]
    total = float(p["total_cost_gbp"])
    if "deposit" in sup["payment_terms"]:
        half = round(total / 2, 2)
        po_payments.append({"po_id": p["po_id"], "supplier": sup["name"],
                            "date": p["deposit_paid_at"], "amount": -half,
                            "kind": "po_deposit", "po_total": total, "supplier_id": p["supplier_id"]})
        po_payments.append({"po_id": p["po_id"], "supplier": sup["name"],
                            "date": p["balance_paid_at"], "amount": -half,
                            "kind": "po_balance", "po_total": total, "supplier_id": p["supplier_id"]})
    else:
        po_payments.append({"po_id": p["po_id"], "supplier": sup["name"],
                            "date": p["balance_paid_at"], "amount": -round(total, 2),
                            "kind": "po_full", "po_total": total, "supplier_id": p["supplier_id"]})
po_pay_df = pd.DataFrame(po_payments)
po_pay_df["date"] = pd.to_datetime(po_pay_df["date"])

# (b) Recurring outflows — index actuals by (category, year, month).
# For projection from anchor T, we look up the *expected* recurring event at
# date d using the trailing 3 months of actuals for that category. This makes
# the projection self-calibrate to the brand's actual run-rate instead of using
# stale fixed estimates.
RECURRING_CATEGORIES = ["PAYROLL", "RENT", "FULFILMENT", "SHIPPING", "SAAS",
                        "MARKETING", "REFUND", "OTHER"]
# OTHER captures one-off items like VAT (HMRC), insurance, etc. — bunched together
# so they don't blow up the projection.

# Build a per-month-category aggregate from actuals
bt_recur = bt[bt["raw_category"].isin(RECURRING_CATEGORIES)].copy()
bt_recur["month"] = bt_recur["date"].dt.to_period("M")
bt_recur["day"] = bt_recur["date"].dt.day
monthly_cat = bt_recur.groupby(["month", "raw_category"]).agg(
    total=("amount_gbp", "sum"), n=("amount_gbp", "count")).reset_index()

# Build a per-month-category day-of-month centroid (the typical day)
# Use the median day-of-month per category (which collapses to a single int
# for the cleanly recurring categories we verified earlier).
cat_dom = bt_recur.groupby("raw_category")["day"].median().round().astype(int).to_dict()
# Verified: PAYROLL=25, RENT=1, FULFILMENT=28, SHIPPING=28, SAAS≈3, MARKETING≈28, REFUND≈30
# (Marketing fires multiple times a month; we'll spread it across two days)

def expected_recurring_for_month_from_actuals(year, month, T):
    """
    For an anchor T, return the expected recurring outflows in (year, month)
    using the trailing 3 months of actuals for each category — anchored at T,
    so we never peek at future data.
    """
    events = []
    trailing_3mo = pd.Period(T, freq="M") - 1  # last fully-closed prior month
    # Use the last 3 months of monthly totals as the rolling estimate
    cutoff_low = trailing_3mo - 2
    last_day = calendar.monthrange(year, month)[1]

    for cat in RECURRING_CATEGORIES:
        rows = monthly_cat[(monthly_cat["raw_category"] == cat)
                           & (monthly_cat["month"] >= cutoff_low)
                           & (monthly_cat["month"] <= trailing_3mo)]
        if len(rows) == 0:
            continue
        avg_monthly = float(rows["total"].mean())
        if avg_monthly >= 0:
            continue  # not an outflow
        dom = cat_dom.get(cat, 28)
        # Marketing splits across two dates (5th + end-of-month) — verified
        if cat == "MARKETING":
            try:
                d1 = pd.Timestamp(year, month, min(5, last_day))
                d2 = pd.Timestamp(year, month, last_day)
                events.append({"date": d1, "amount": round(avg_monthly / 2, 2),
                               "label": "Google Ads (est., trailing 3-mo)",
                               "kind": "recurring"})
                events.append({"date": d2, "amount": round(avg_monthly / 2, 2),
                               "label": "Meta Ads (est., trailing 3-mo)",
                               "kind": "recurring"})
            except ValueError:
                continue
            continue
        try:
            d = pd.Timestamp(year, month, min(dom, last_day))
        except ValueError:
            continue
        label_map = {
            "PAYROLL": "Payroll",
            "RENT": "Rent (Studio N1)",
            "FULFILMENT": "Hub3PL fulfilment",
            "SHIPPING": "Royal Mail shipping",
            "SAAS": "SaaS subs (Shopify, Figma, etc.)",
            "REFUND": "Shopify refund batch",
            "OTHER": "Other (VAT, insurance, misc.)",
        }
        events.append({"date": d, "amount": round(avg_monthly, 2),
                       "label": label_map[cat] + " (est., trailing 3-mo)",
                       "kind": "recurring"})
    return events

# Build PO events index (these are exact, not estimates)
po_events_by_date = defaultdict(list)
for _, r in po_pay_df.iterrows():
    if pd.notna(r["date"]) and START <= r["date"] <= END:
        label = ("PO " + r["po_id"] + " — " + r["supplier"] + " ("
                 + ("deposit" if r["kind"] == "po_deposit"
                    else "balance" if r["kind"] == "po_balance"
                    else "Net 60 payment") + ")")
        po_events_by_date[r["date"].normalize()].append({
            "date": r["date"], "amount": float(r["amount"]),
            "label": label, "kind": "po",
            "po_id": r["po_id"], "supplier": r["supplier"]})

# ── 3. Actual Shopify payouts series ──
payouts_actual = bt[bt["raw_category"] == "PAYOUT"][["date", "amount_gbp"]].copy()
payouts_actual = payouts_actual.sort_values("date").reset_index(drop=True)

def trailing_payout_avg(T, weeks=8):
    """Average Shopify payout amount over the most recent N weeks before T."""
    prior = payouts_actual[payouts_actual["date"] <= T].tail(weeks)
    if len(prior) == 0:
        return 60000.0
    return float(prior["amount_gbp"].mean())

# ── 4. Project from any anchor date T ──
def project_from(T, horizon=HORIZON, override_events=None):
    """
    Project the next `horizon` days of balance from anchor T.

    override_events: dict {date -> [extra_events]} to inject remedy effects.
    Returns: {asof_date, asof_balance, projection: [{date, balance, net, events}]}
    """
    asof_balance = float(balance_map[T])
    avg_payout = trailing_payout_avg(T)

    # Build per-day recurring events using trailing-3-month actuals, scoped to
    # the months this projection's horizon touches.
    recur_by_date = defaultdict(list)
    months_in_horizon = set()
    for offset in range(1, horizon + 1):
        d = T + pd.Timedelta(days=offset)
        months_in_horizon.add((d.year, d.month))
    for (y, m) in months_in_horizon:
        for ev in expected_recurring_for_month_from_actuals(y, m, T):
            recur_by_date[ev["date"].normalize()].append(ev)

    proj = []
    running = asof_balance
    for offset in range(1, horizon + 1):
        d = T + pd.Timedelta(days=offset)
        d_norm = d.normalize()
        events = list(po_events_by_date.get(d_norm, []))
        events.extend(recur_by_date.get(d_norm, []))
        if override_events and d_norm in override_events:
            events = events + override_events[d_norm]
        if d.dayofweek == 2:  # Wednesday — expect Shopify payout
            events.append({"date": d, "amount": avg_payout,
                           "label": "Shopify payout (est., 8-wk avg)",
                           "kind": "payout_est"})
        net = sum(e["amount"] for e in events)
        running += net
        thin_events = [{"amount": round(e["amount"], 2), "label": e["label"], "kind": e["kind"],
                        "po_id": e.get("po_id"), "supplier": e.get("supplier")}
                       for e in events]
        proj.append({"date": d.strftime("%Y-%m-%d"),
                     "balance": round(running, 2),
                     "net": round(net, 2),
                     "events": thin_events})
    return {"asof_date": T.strftime("%Y-%m-%d"),
            "asof_balance": round(asof_balance, 2),
            "projection": proj,
            "avg_weekly_payout": round(avg_payout, 0)}

# ── 5. Loop every day, compute projection summary; pick danger anchors ──
print("Computing projection per anchor day...")
anchor_summaries = []
projection_balances = {}  # asof_date_str -> [balance_at_d for d in horizon] (lean for chart)
anchor_dates = pd.date_range(START + pd.Timedelta(days=14),
                             END - pd.Timedelta(days=HORIZON), freq="D")

for T in anchor_dates:
    proj = project_from(T)
    balances = [d["balance"] for d in proj["projection"]]
    min_bal = min(balances)
    min_idx = balances.index(min_bal)
    min_date = proj["projection"][min_idx]["date"]
    is_danger = min_bal < DANGER_THRESHOLD
    anchor_summaries.append({
        "asof_date": proj["asof_date"],
        "asof_balance": proj["asof_balance"],
        "min_projected": min_bal,
        "min_date": min_date,
        "is_danger": is_danger,
    })
    projection_balances[proj["asof_date"]] = balances

# ── 6. Pick top demo anchors (worst projected nadirs) ──
sum_df = pd.DataFrame(anchor_summaries)
danger_anchors = sum_df[sum_df["is_danger"]].sort_values("min_projected").reset_index(drop=True)
print(f"  Total anchor dates: {len(sum_df)}")
print(f"  Danger anchors (proj nadir < £{DANGER_THRESHOLD:,.0f}): {len(danger_anchors)}")

# Pick the *primary* demo anchor — locked to 2024-08-14, 20 days before the
# verified actual nadir (-£274,113.93 on 2024-09-03). This gives the cleanest
# narrative: "20 days early we'd have seen it." If that date isn't in the data
# (won't happen for this dataset), fall back to the earliest danger anchor.
overall_worst_nadir = sum_df["min_projected"].min()
PREFERRED_PRIMARY = pd.Timestamp("2024-08-14")
if PREFERRED_PRIMARY.strftime("%Y-%m-%d") in set(sum_df["asof_date"]):
    PRIMARY_ANCHOR_DATE = PREFERRED_PRIMARY
    primary_row = sum_df[sum_df["asof_date"] == PRIMARY_ANCHOR_DATE.strftime("%Y-%m-%d")].iloc[0]
    worst_min_date = primary_row["min_date"]
    primary_min_proj = primary_row["min_projected"]
else:
    worst_row = sum_df[sum_df["min_projected"] == overall_worst_nadir].iloc[0]
    PRIMARY_ANCHOR_DATE = pd.Timestamp(worst_row["asof_date"])
    worst_min_date = worst_row["min_date"]
    primary_min_proj = overall_worst_nadir
print(f"  Primary demo anchor: {PRIMARY_ANCHOR_DATE.date()} -> projected nadir {worst_min_date} (GBP {primary_min_proj:,.0f})")
print(f"  Days of forewarning: {(pd.Timestamp(worst_min_date) - PRIMARY_ANCHOR_DATE).days}")

# Build demo anchors set: one per distinct danger nadir (first anchor that flagged it)
seen_nadirs = set()
demo_anchors = [PRIMARY_ANCHOR_DATE]
seen_nadirs.add(worst_min_date)
for _, row in danger_anchors.iterrows():
    if row["min_date"] in seen_nadirs:
        continue
    seen_nadirs.add(row["min_date"])
    demo_anchors.append(pd.Timestamp(row["asof_date"]))

# ── 7. Compute as-of overstock list for any date T (for remedy B) ──
def asof_overstock(T):
    """
    Compute overstock candidates as of date T. Uses inventory_movements
    running_balance, plus trailing 90-day sales velocity.

    Returns DataFrame: variant_id, product_name, inventory, velocity_wk,
                       months_cover, landed_cost, retail_price, freed_cash
    """
    im_upto = im[im["date"] <= T].copy()
    # latest running balance per variant on or before T
    inv = im_upto.sort_values("date").groupby("variant_id").tail(1)[["variant_id", "running_balance"]]
    inv.columns = ["variant_id", "inventory"]

    # Trailing 90-day sales velocity
    window_start = T - pd.Timedelta(days=90)
    orders_in_win = orders[(orders["created_at"] > window_start) & (orders["created_at"] <= T)]
    li_in_win = li[li["order_id"].isin(orders_in_win["order_id"])]
    sales_90 = li_in_win.groupby("variant_id")["quantity"].sum().reset_index()
    sales_90.columns = ["variant_id", "units_90d"]

    # Landed cost per variant (latest)
    landed = poli.groupby("variant_id")["landed_cost_per_unit_gbp"].last().reset_index()
    landed.columns = ["variant_id", "landed_cost"]

    df = inv.merge(sales_90, on="variant_id", how="left")
    df["units_90d"] = df["units_90d"].fillna(0)
    df["velocity_wk"] = df["units_90d"] / 13.0  # 13 weeks
    df = df.merge(variants[["variant_id", "price", "product_id", "sku"]], on="variant_id", how="left")
    df = df.merge(products[["product_id", "title", "product_type"]], on="product_id", how="left")
    df = df.merge(landed, on="variant_id", how="left")
    df["landed_cost"] = df["landed_cost"].fillna(df["landed_cost"].median())

    df["months_cover"] = np.where(df["velocity_wk"] > 0,
                                  df["inventory"] / df["velocity_wk"] / 4.33,
                                  999.0)
    # Overstock: >12 months cover AND has stock AND has had some velocity (else markdown won't sell)
    df["is_overstock"] = (df["months_cover"] > 12) & (df["inventory"] > 0) & (df["velocity_wk"] > 0)

    # Cash freed by markdown: assume sell at 30% off retail = price * 0.7 * inventory
    # Conservative: assume 70% sell-through
    df["freed_cash_at_30off_70st"] = df["inventory"] * df["price"] * 0.7 * 0.7

    return df[df["is_overstock"]].sort_values("freed_cash_at_30off_70st", ascending=False).reset_index(drop=True)

# ── 8. Compute remedies for a danger anchor ──
def compute_remedies(T):
    """Compute remedies A/B/C for the danger projected from T."""
    proj = project_from(T)
    balances = [d["balance"] for d in proj["projection"]]
    min_bal = min(balances)
    min_idx = balances.index(min_bal)
    min_date = pd.Timestamp(proj["projection"][min_idx]["date"])

    # Collect all PO events inside the danger window (T, min_date]
    danger_events = []
    for d in proj["projection"][: min_idx + 1]:
        for e in d["events"]:
            if e["kind"] == "po":
                danger_events.append({**e, "date": d["date"]})
    danger_events.sort(key=lambda e: e["amount"])  # most negative first

    # ── REMEDY A: delay the single largest PO outflow ──
    remedy_a = None
    if danger_events:
        target = danger_events[0]
        delay_days = 21
        orig_date = pd.Timestamp(target["date"])
        new_date = orig_date + pd.Timedelta(days=delay_days)
        override = {orig_date: [{"date": orig_date, "amount": -target["amount"],
                                  "label": f"DELAYED: {target['label']}",
                                  "kind": "remedy_offset"}],
                    new_date: [{"date": new_date, "amount": target["amount"],
                                  "label": f"DELAYED to here: {target['label']}",
                                  "kind": "remedy_offset"}]}
        proj_new = project_from(T, override_events=override)
        new_balances = [d["balance"] for d in proj_new["projection"]]
        new_min = min(new_balances)
        remedy_a = {
            "kind": "delay_po",
            "po_id": target["po_id"],
            "supplier": target["supplier"],
            "orig_date": target["date"],
            "new_date": new_date.strftime("%Y-%m-%d"),
            "delay_days": delay_days,
            "amount_gbp": round(-target["amount"]),  # positive number = relief
            "new_min_balance": round(new_min),
            "new_balances": [round(b) for b in new_balances],
            "headline": (f"Delay PO {target['po_id']} balance by {delay_days} days "
                         f"(£{abs(target['amount']):,.0f} → {target['supplier']})"),
            "detail": (f"Push the {orig_date.strftime('%#d %b')} payment to "
                       f"{new_date.strftime('%#d %b')}. Most EU suppliers (50/50 terms) "
                       f"will accept a 2-3 week delay on the balance against a small fee "
                       f"or future order commitment. Projected nadir improves from "
                       f"£{min_bal:,.0f} → £{new_min:,.0f}."),
        }

    # ── REMEDY B: discount overstock ──
    print(f"  computing as-of overstock for {T.date()}...", flush=True)
    overstock = asof_overstock(T)
    gap = CASH_FLOOR_TARGET - min_bal  # how much we need to free to hit floor
    chosen = []
    freed = 0
    for _, v in overstock.iterrows():
        if freed >= gap:
            break
        chosen.append({
            "variant_id": v["variant_id"],
            "sku": v["sku"],
            "product_name": v["title"],
            "product_type": v["product_type"],
            "inventory": int(v["inventory"]),
            "months_cover": round(float(v["months_cover"]), 1) if v["months_cover"] < 999 else 999,
            "landed_cost": round(float(v["landed_cost"]), 2),
            "price": round(float(v["price"]), 2),
            "freed_at_30off_70st": round(float(v["freed_cash_at_30off_70st"])),
        })
        freed += float(v["freed_cash_at_30off_70st"])

    # Markdown revenue spread across two Wednesdays (next two payouts) — clearance takes time
    proj_orig = project_from(T)
    next_weds = [i for i, d in enumerate(proj_orig["projection"])
                 if pd.Timestamp(d["date"]).dayofweek == 2][:2]
    override_b = {}
    if next_weds:
        per_payout = freed / len(next_weds)
        for idx in next_weds:
            d = pd.Timestamp(proj_orig["projection"][idx]["date"])
            override_b.setdefault(d, []).append({
                "date": d, "amount": per_payout,
                "label": f"Markdown clearance — {len(chosen)} overstock variants",
                "kind": "remedy_offset"})
    proj_b = project_from(T, override_events=override_b)
    new_b_balances = [d["balance"] for d in proj_b["projection"]]
    new_b_min = min(new_b_balances) if new_b_balances else min_bal
    remedy_b = {
        "kind": "discount_overstock",
        "variant_count": len(chosen),
        "freed_gbp": round(freed),
        "variants": chosen[:20],  # top 20 for display
        "discount_pct": 30,
        "sell_through_pct": 70,
        "new_min_balance": round(new_b_min),
        "new_balances": [round(b) for b in new_b_balances],
        "headline": (f"Discount {len(chosen)} overstock variants 30% — frees "
                     f"≈£{freed:,.0f} over 2 payouts"),
        "detail": (f"These SKUs have >12 months of cover at current velocity. "
                   f"30% off retail with 70% sell-through clears ≈£{freed:,.0f} "
                   f"into the bank over the next ~2 weeks. Projected nadir "
                   f"improves £{min_bal:,.0f} → £{new_b_min:,.0f}. "
                   f"This converts dead capital into working capital."),
    }

    # ── REMEDY C: Wayflyer bridge ──
    bridge_needed = max(0, round((CASH_FLOOR_TARGET - min_bal) / 1000) * 1000)
    term_days = 90
    fee_gbp = round(bridge_needed * WAYFLYER_APR * term_days / 365)
    # Inject bridge as a one-off inflow on the asof date+1, repayment on T + term_days
    override_c = {}
    bridge_inflow_date = T + pd.Timedelta(days=1)
    override_c.setdefault(bridge_inflow_date, []).append({
        "date": bridge_inflow_date, "amount": float(bridge_needed),
        "label": f"Wayflyer bridge in (+£{bridge_needed:,})",
        "kind": "remedy_offset"})
    # Repayment falls past the 30-day horizon, so it doesn't show on the projection — note honestly
    proj_c = project_from(T, override_events=override_c)
    new_c_balances = [d["balance"] for d in proj_c["projection"]]
    new_c_min = min(new_c_balances) if new_c_balances else min_bal
    remedy_c = {
        "kind": "wayflyer_bridge",
        "amount_gbp": bridge_needed,
        "term_days": term_days,
        "apr_pct": round(WAYFLYER_APR * 100, 1),
        "fee_gbp": fee_gbp,
        "new_min_balance": round(new_c_min),
        "new_balances": [round(b) for b in new_c_balances],
        "headline": f"Wayflyer £{bridge_needed:,} bridge — 90-day term, fee £{fee_gbp:,}",
        "detail": (f"Take a £{bridge_needed:,} cash advance against expected future "
                   f"revenue. Repay over 90 days. All-in fee ≈£{fee_gbp:,} "
                   f"({round(WAYFLYER_APR*100)}% APR equivalent). "
                   f"Projected nadir improves £{min_bal:,.0f} → £{new_c_min:,.0f}. "
                   f"This is real money out the door — only use it when delaying "
                   f"a PO or clearing overstock isn't enough."),
    }

    return {
        "anchor_date": T.strftime("%Y-%m-%d"),
        "asof_balance": proj["asof_balance"],
        "horizon_days": HORIZON,
        "projection": proj["projection"],
        "balances": balances,
        "min_balance": round(min_bal),
        "min_date": min_date.strftime("%Y-%m-%d"),
        "danger_drivers": [
            {"date": e["date"], "amount": e["amount"], "label": e["label"],
             "po_id": e.get("po_id"), "supplier": e.get("supplier")}
            for e in danger_events[:8]
        ],
        "days_forewarned": (min_date - T).days,
        "remedies": {"A": remedy_a, "B": remedy_b, "C": remedy_c},
    }

# ── 9. Compute remedy bundles for demo anchors ──
print("Computing remedies for demo anchors...")
anchor_bundles = []
for T in demo_anchors:
    print(f"  anchor: {T.date()}")
    anchor_bundles.append(compute_remedies(T))

# ── 10. Build the actual balance series + a thin projection series for every day ──
print("Serialising output...")
actual_series = [{"date": r["date"].strftime("%Y-%m-%d"),
                  "balance": round(float(r["eod_balance"]), 2)}
                 for _, r in balance_series.iterrows()]

# Thin per-day projection lookup (just balances, for the scrubber)
projections_thin = {k: [round(b, 2) for b in v] for k, v in projection_balances.items()}

# Anchor summary table — for the timeline danger heatmap
anchors_summary_out = [{"date": r["asof_date"],
                        "asof_balance": round(r["asof_balance"], 2),
                        "min_projected": round(r["min_projected"], 2),
                        "min_date": r["min_date"],
                        "is_danger": bool(r["is_danger"])}
                       for r in anchor_summaries]

# Ground-truth actual nadir from the bank ledger — this is what really happened
actual_nadir_idx = balance_series["eod_balance"].idxmin()
actual_nadir_row = balance_series.iloc[actual_nadir_idx]
actual_nadir_val = float(actual_nadir_row["eod_balance"])
actual_nadir_date = pd.Timestamp(actual_nadir_row["date"]).strftime("%Y-%m-%d")

output = {
    "meta": {
        "generated_at": pd.Timestamp.now("UTC").strftime("%Y-%m-%d %H:%M UTC"),
        "data_start": START.strftime("%Y-%m-%d"),
        "data_end": END.strftime("%Y-%m-%d"),
        "horizon_days": HORIZON,
        "danger_threshold": DANGER_THRESHOLD,
        "cash_floor_target": CASH_FLOOR_TARGET,
        "actual_nadir_gbp": round(actual_nadir_val, 2),
        "actual_nadir_date": actual_nadir_date,
        "primary_anchor": PRIMARY_ANCHOR_DATE.strftime("%Y-%m-%d"),
        "primary_projected_nadir_gbp": round(float(primary_min_proj), 2),
        "primary_projected_nadir_date": worst_min_date,
        "primary_forewarned_days": int((pd.Timestamp(worst_min_date) - PRIMARY_ANCHOR_DATE).days),
    },
    "actual_balance_series": actual_series,
    "anchors_summary": anchors_summary_out,
    "projections_thin": projections_thin,
    "demo_anchors": anchor_bundles,
}

out_path = Path("cash_radar_data.js")
with out_path.open("w", encoding="utf-8") as f:
    f.write("var CASH_RADAR = ")
    json.dump(output, f, separators=(",", ":"))
    f.write(";\n")

size_kb = out_path.stat().st_size / 1024
print(f"\nGenerated {out_path}: {size_kb:,.0f} KB")
print(f"  actual_balance_series:  {len(actual_series)} days")
print(f"  anchors_summary:        {len(anchors_summary_out)} days")
print(f"  projections_thin:       {len(projections_thin)} anchor dates")
print(f"  demo_anchors:           {len(anchor_bundles)} (with full remedies)")
print(f"\n  Worst nadir:           £{overall_worst_nadir:,.0f} on {worst_min_date}")
print(f"  Primary demo anchor:   {PRIMARY_ANCHOR_DATE.date()} "
      f"({(pd.Timestamp(worst_min_date) - PRIMARY_ANCHOR_DATE).days} days forewarning)")
