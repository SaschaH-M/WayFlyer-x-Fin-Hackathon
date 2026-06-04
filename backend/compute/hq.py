"""
hq.py — the Agent HQ. Turns every engine into a virtual employee with a live
status, and flattens every recommendation into one swipeable action feed.
The operator is the CEO; these are the staff.
"""
from functools import lru_cache

from . import stocksense, cashradar, cashengine, marketing, simulator, departments

GBP = lambda n: f"£{round(n):,}"


def _act(id, dept, agent, title, detail, impact, why, verb, severity="medium", linked=None):
    return {"id": id, "dept": dept, "agent": agent, "title": title, "detail": detail,
            "impact_gbp": round(impact), "why": why, "verb": verb, "severity": severity, "linked": linked}


@lru_cache(maxsize=1)
def compute():
    ss = stocksense.compute(); ssum = ss["summary"]
    cr = cashradar.compute(); crm = cr["meta"]; anchor = cr["demo_anchors"][0]
    mk = marketing.compute()
    eng = cashengine.compute("moderate")
    sim = simulator.compute()["headline"]
    pnl = departments.pnl(); sizing = departments.sizing(); cust = departments.customers()
    sup = departments.suppliers(); supp = departments.support(); anom = departments.anomaly(); fc = departments.forecast()

    actions = []

    # Cash & Treasury — the crisis remedy
    actions.append(_act("cash-remedy-b", "Treasury", "Gordon",
        f"Free {GBP(anchor['remedies']['B']['freed_gbp'])} from overstock to clear the cash dip",
        anchor["remedies"]["B"]["headline"], anchor["remedies"]["B"]["freed_gbp"],
        f"Projected nadir {GBP(anchor['min_balance'])} on {anchor['min_date']}", "Apply markdown", "high"))
    actions.append(_act("cash-delay-po", "Treasury", "Gordon",
        anchor["remedies"]["A"]["headline"], anchor["remedies"]["A"]["detail"],
        anchor["remedies"]["A"]["amount_gbp"], f"PO {anchor['remedies']['A']['po_id']} in danger window", "Delay PO", "medium"))

    # Inventory — top reorders, size-aware
    reorder = sorted([v for v in ss["variants"] if v["status"] == "reorder"],
                     key=lambda v: (-(v["inventory"] <= 0), -v["stocksense_score"]))[:3]
    for v in reorder:
        try:
            qty = int(v["recommendation"].split()[1])
        except Exception:
            qty = 0
        split = departments.size_split(qty) if qty else {}
        sstr = " · ".join(f"{k} {n}" for k, n in split.items() if n)
        actions.append(_act(f"reorder-{v['variant_id']}", "Inventory", "Ripley",
            f"Reorder {v['product_name']} — {qty} units", f"{v['why']} Size split: {sstr}.",
            v["recommendation_cost"], v["why"], "Reorder", "high" if v["inventory"] <= 0 else "medium"))

    # Marketing — reallocate + the cross-department magic link
    re = mk["reallocation"]
    if mk["waste"]:
        actions.append(_act("mkt-realloc", "Marketing", "Draper",
            f"Move {GBP(re['rescuable_spend'])} from losing ads to winners",
            f"{', '.join(re['from_campaigns'])} run below break-even; shift to {', '.join(re['to_campaigns'])} "
            f"({re['winner_avg_roas']}×) → ~{GBP(re['projected_gain'])} more revenue.",
            re["projected_gain"], f"waste ROAS below {mk['meta']['break_even_roas']}×", "Reallocate", "high"))
    hot = [s for s in mk["launch_signals"] if s["severity"] in ("high", "medium")]
    if hot:
        s = hot[0]
        # estimate cash impact of capturing the surge: recovered revenue ~ units * avg price proxy via reorder cost margin
        impact = round(s["recommended_units"] * 18)  # conservative gross contribution proxy
        actions.append(_act("magic-link", "Cross-team", "Draper → Ripley → Gordon",
            f"✦ Catch the {s['product_type']} surge before it sells out",  # cross-team
            f"Ad demand for {s['product_type']} is up {s['surge_pct']}% while {s['out_of_stock']} SKUs are already out of "
            f"stock. Reorder {s['recommended_units']} units now; the freed cash from overstock funds it.",
            impact, f"ads +{s['surge_pct']}% × {s['out_of_stock']} OOS", "Run the play", "high",
            linked=["Marketing", "Inventory", "Treasury"]))

    # other departments
    for d in (pnl, sizing, cust, sup, supp, anom, fc):
        for a in d.get("actions", []):
            dept = {"pnl-margin": "Finance", "size-curve": "Merchandising", "size-bias": "Merchandising",
                    "ltv-shift": "Growth", "supplier-buffer": "Supply", "support-bot": "Support",
                    "anomaly-review": "Risk", "forecast-preorder": "Demand"}.get(a["id"], "Ops")
            agent = {"Finance": "Hamilton", "Merchandising": "Edna", "Growth": "Gatsby", "Supply": "Marco",
                     "Support": "Baymax", "Risk": "Holmes", "Demand": "Delphi"}.get(dept, "Ops")
            actions.append(_act(a["id"], dept, agent, a["title"], a["detail"], a["impact_gbp"], a["why"], a["verb"],
                               "high" if a["impact_gbp"] > 50000 else "medium"))

    total_impact = sum(a["impact_gbp"] for a in actions)

    agents = [
        {"id": "aria", "name": "Gordon", "role": "Cash & Treasury", "dept": "Treasury", "icon": "📡", "route": "/cashradar",
         "status": "alert", "metric": f"nadir {GBP(crm['actual_nadir_gbp'])}", "headline": f"Crisis spotted {crm['primary_forewarned_days']}d early",
         "pending": sum(1 for a in actions if a["dept"] == "Treasury")},
        {"id": "sten", "name": "Ripley", "role": "Inventory", "dept": "Inventory", "icon": "▦", "route": "/inventory",
         "status": "alert", "metric": f"{ssum['reorder_count']} to reorder", "headline": f"{GBP(ssum['total_trapped_cash'])} trapped in overstock",
         "pending": sum(1 for a in actions if a["dept"] == "Inventory")},
        {"id": "mira", "name": "Draper", "role": "Marketing", "dept": "Marketing", "icon": "📣", "route": "/marketing",
         "status": "alert", "metric": f"{mk['meta']['blended_roas']}× ROAS", "headline": f"{GBP(re['rescuable_spend'])} ad spend leaking",
         "pending": sum(1 for a in actions if a["dept"] in ("Marketing", "Cross-team"))},
        {"id": "fin", "name": "Hamilton", "role": "Finance / P&L", "dept": "Finance", "icon": "⚖", "route": "/pnl",
         "status": "working", "metric": pnl["headline"], "headline": f"{pnl['totals']['net_margin_pct']}% net margin (24mo)",
         "pending": sum(1 for a in actions if a["dept"] == "Finance")},
        {"id": "vera", "name": "Edna", "role": "Merchandising / Fit", "dept": "Merchandising", "icon": "📐", "route": "/sizing",
         "status": "alert", "metric": sizing["headline"], "headline": f"Fit {('runs small' if sizing['reasons']['too_small']>sizing['reasons']['too_large'] else 'issue')}",
         "pending": sum(1 for a in actions if a["dept"] == "Merchandising")},
        {"id": "cole", "name": "Gatsby", "role": "Growth / CRM", "dept": "Growth", "icon": "📈", "route": "/customers",
         "status": "working", "metric": cust["headline"], "headline": "LTV varies 2× by channel",
         "pending": sum(1 for a in actions if a["dept"] == "Growth")},
        {"id": "sam", "name": "Marco", "role": "Supply Chain", "dept": "Supply", "icon": "🚢", "route": "/suppliers",
         "status": "working", "metric": sup["headline"], "headline": "Lead times drive stockouts",
         "pending": sum(1 for a in actions if a["dept"] == "Supply")},
        {"id": "bo", "name": "Baymax", "role": "Support", "dept": "Support", "icon": "💬", "route": "/support",
         "status": "working", "metric": supp["headline"], "headline": f"{supp['linked_pct']}% tickets order-linked",
         "pending": sum(1 for a in actions if a["dept"] == "Support")},
        {"id": "rex", "name": "Holmes", "role": "Risk / Anomaly", "dept": "Risk", "icon": "🛡", "route": "/cashradar",
         "status": "working" if anom["flags"] else "idle", "metric": anom["headline"], "headline": "Watching every outflow",
         "pending": sum(1 for a in actions if a["dept"] == "Risk")},
        {"id": "dash", "name": "Delphi", "role": "Demand Forecast", "dept": "Demand", "icon": "🔮", "route": "/simulator",
         "status": "working" if fc["trustworthy"] else "idle", "metric": fc["headline"], "headline": "Predicts what trends next",
         "pending": sum(1 for a in actions if a["dept"] == "Demand")},
    ]

    return {
        "tagline": "Run your whole company with an AI workforce that never sleeps.",
        "ceo_summary": {
            "trapped_cash": ssum["total_trapped_cash"], "lost_monthly": ssum["lost_monthly_revenue"],
            "nadir": crm["actual_nadir_gbp"], "ad_leak": re["rescuable_spend"],
            "proven_impact": sim["total_impact_gbp"], "open_actions": len(actions),
            "total_action_value": total_impact, "net_margin_pct": pnl["totals"]["net_margin_pct"],
        },
        "agents": agents,
        "actions": sorted(actions, key=lambda a: ({"high": 0, "medium": 1, "low": 2}[a["severity"]], -a["impact_gbp"])),
    }
