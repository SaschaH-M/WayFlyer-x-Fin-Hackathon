"""
cashengine.py — Cash Flow Impact Engine. Real-time what-if over the current
(month-24) inventory picture. Three strategy presets toggle markdown depth,
sell-through, and reorder appetite; the engine returns trapped/freed cash,
reorder investment, and projected revenue uplift.

Built on the live StockSense output, so every £ is traceable to named SKUs.
The revenue multiplier (£ freed -> £ annual revenue) is derived from the
brand's own velocity, not assumed.
"""
from functools import lru_cache

from . import stocksense

SCENARIOS = {
    "conservative": {"discount": 0.20, "sell_through": 0.50, "reorder_share": 0.50,
                     "label": "Conservative", "blurb": "Shallow 20% markdowns, clear the worst overstock, reorder only the highest-confidence stockouts."},
    "moderate":     {"discount": 0.30, "sell_through": 0.70, "reorder_share": 0.80,
                     "label": "Moderate", "blurb": "30% markdowns at 70% sell-through, reorder the priority stockout list. The recommended balance."},
    "aggressive":   {"discount": 0.40, "sell_through": 0.85, "reorder_share": 1.00,
                     "label": "Aggressive", "blurb": "Deep 40% markdowns to clear fast, reorder every flagged stockout. Maximum cash velocity."},
}


@lru_cache(maxsize=1)
def _revenue_multiplier():
    """£1 of inventory at landed cost -> £X of annual retail revenue, from the
    brand's own reorder economics (annual lost revenue / reorder cost)."""
    s = stocksense.compute()["summary"]
    cost = max(1, s["total_reorder_cost"])
    annual_lost = s["lost_monthly_revenue"] * 12
    return round(annual_lost / cost, 2)


@lru_cache(maxsize=8)
def compute(scenario: str = "moderate"):
    scenario = scenario if scenario in SCENARIOS else "moderate"
    cfg = SCENARIOS[scenario]
    data = stocksense.compute()
    variants = data["variants"]
    mult = _revenue_multiplier()

    markdown = [v for v in variants if v["status"] == "markdown" and v["inventory"] > 0]
    reorder = sorted([v for v in variants if v["status"] == "reorder"],
                     key=lambda v: -v["stocksense_score"])

    trapped_at_cost = sum(v["landed_cost"] * v["inventory"] for v in markdown)
    freed = sum(v["price"] * v["inventory"] * (1 - cfg["discount"]) * cfg["sell_through"] for v in markdown)

    n_reorder = int(len(reorder) * cfg["reorder_share"])
    reorder_pick = reorder[:n_reorder]
    reorder_invest = sum(v["recommendation_cost"] for v in reorder_pick)
    # revenue uplift from filling those stockouts, capped by what freed cash can fund
    fundable = min(reorder_invest, freed)
    revenue_uplift = round(fundable * mult)
    net_cash = round(freed - reorder_invest)

    return {
        "scenario": scenario, "label": cfg["label"], "blurb": cfg["blurb"],
        "assumptions": {"discount_pct": round(cfg["discount"] * 100), "sell_through_pct": round(cfg["sell_through"] * 100),
                        "reorder_share_pct": round(cfg["reorder_share"] * 100), "revenue_multiplier": mult},
        "trapped_cash_gbp": round(trapped_at_cost),
        "freed_cash_gbp": round(freed),
        "reorder_investment_gbp": round(reorder_invest),
        "fundable_reorder_gbp": round(fundable),
        "projected_revenue_uplift_gbp": revenue_uplift,
        "net_cash_position_gbp": net_cash,
        "markdown_sku_count": len(markdown),
        "reorder_sku_count": len(reorder_pick),
        "headline": (f"Free £{round(freed):,} from {len(markdown)} overstock SKUs, fund {len(reorder_pick)} "
                     f"reorders, project £{revenue_uplift:,} in recovered annual revenue."),
    }


def all_scenarios():
    return {k: compute(k) for k in SCENARIOS}
