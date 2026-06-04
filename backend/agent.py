"""
agent.py — the WC Agent. A grounded operator assistant.

Every answer is built from real computed facts and cites specific SKUs, dates,
and £ amounts. The deterministic retrieval layer ALWAYS works (demo-safe, no
network). If ANTHROPIC_API_KEY is set, the same retrieved facts are handed to
Claude to phrase a natural-language answer — Claude is told to use ONLY the
provided facts, so it stays grounded.
"""
import os
import re

import dataset as ds
from compute import stocksense, cashengine, simulator, cashradar

GBP = lambda n: f"£{round(n):,}"


# ── retrieval skills (return markdown + structured citations) ──

def skill_reorder_first(_):
    data = stocksense.compute()
    recs = sorted([v for v in data["variants"] if v["status"] == "reorder"],
                  key=lambda v: (-(v["inventory"] <= 0), -v["stocksense_score"], -v["revenue_3mo"]))[:5]
    lines = ["**Reorder these first** — ranked by StockSense score and revenue at risk:\n"]
    cites = []
    for i, v in enumerate(recs, 1):
        oos = " (OUT OF STOCK)" if v["inventory"] <= 0 else f" ({v['inventory']} left)"
        lines.append(f"{i}. **{v['product_name']} — {v['sku']}**{oos} · score {v['stocksense_score']}/100 · "
                     f"{v['recommendation']} · est. {GBP(v['recommendation_cost'])} · "
                     f"sold {v['units_3mo']} units / 3mo ({GBP(v['revenue_3mo'])}).")
        cites.append({"sku": v["sku"], "amount": v["recommendation_cost"], "metric": "reorder cost"})
    s = data["summary"]
    lines.append(f"\n{s['reorder_count']} SKUs need reordering, ~{GBP(s['lost_monthly_revenue'])}/month in lost "
                 f"revenue while they sit at zero. Total reorder cost {GBP(s['total_reorder_cost'])}.")
    return "\n".join(lines), cites


def skill_free_cash(_):
    e = cashengine.compute("moderate")
    data = stocksense.compute()
    top = sorted([v for v in data["variants"] if v["status"] == "markdown" and v["inventory"] > 0],
                 key=lambda v: -(v["price"] * v["inventory"]))[:5]
    lines = [f"Marking down overstock at 30% (70% sell-through) frees **{GBP(e['freed_cash_gbp'])}** "
             f"from **{e['markdown_sku_count']} SKUs**. Biggest contributors:\n"]
    cites = []
    for v in top:
        freed = v["price"] * v["inventory"] * 0.7 * 0.7
        lines.append(f"- **{v['product_name']} — {v['sku']}** · {v['inventory']} units · {v['months_cover']} months cover · "
                     f"frees ≈{GBP(freed)}.")
        cites.append({"sku": v["sku"], "amount": round(freed), "metric": "cash freed"})
    lines.append(f"\nThat freed cash funds **{e['reorder_sku_count']} reorders** and projects "
                 f"**{GBP(e['projected_revenue_uplift_gbp'])}** in recovered annual revenue "
                 f"(£1 freed → £{e['assumptions']['revenue_multiplier']} revenue).")
    return "\n".join(lines), cites


def skill_supplier_leadtime(_):
    variants = ds.variants(); poli = ds.po_lines(); pos = ds.purchase_orders(); sups = ds.suppliers()
    data = stocksense.compute()
    status = {v["variant_id"]: v for v in data["variants"]}
    # variant -> supplier via latest PO line
    vp = poli.merge(pos[["po_id", "supplier_id"]], on="po_id")
    vsup = vp.sort_values("po_id").groupby("variant_id")["supplier_id"].last().to_dict()
    sup_info = sups.set_index("supplier_id")[["name", "country", "lead_time_days"]].to_dict("index")
    agg = {}
    for vid, sid in vsup.items():
        v = status.get(vid)
        if not v or v["status"] != "reorder":
            continue
        a = agg.setdefault(sid, {"stockouts": 0, "lost_rev": 0.0})
        a["stockouts"] += 1
        a["lost_rev"] += v["revenue_3mo"] / 3.0
    rows = []
    for sid, a in agg.items():
        info = sup_info.get(sid, {})
        rows.append({"supplier": info.get("name", sid), "country": info.get("country", ""),
                     "lead_time_days": int(info.get("lead_time_days", 0)),
                     "stockout_skus": a["stockouts"], "lost_monthly": round(a["lost_rev"])})
    rows.sort(key=lambda r: (-r["lead_time_days"], -r["stockout_skus"]))
    lines = ["**Supplier lead times vs stockouts** — long lead times concentrate the damage:\n"]
    cites = []
    for r in rows:
        lines.append(f"- **{r['supplier']}** ({r['country']}, {r['lead_time_days']}-day lead time): "
                     f"{r['stockout_skus']} stocked-out SKUs, ~{GBP(r['lost_monthly'])}/month at risk.")
        cites.append({"sku": r["supplier"], "amount": r["lost_monthly"], "metric": "monthly lost rev"})
    worst = rows[0] if rows else None
    if worst:
        lines.append(f"\n**{worst['supplier']}** is the bottleneck — at {worst['lead_time_days']} days, reorders "
                     f"must be placed ~{round(worst['lead_time_days']/7)} weeks before stock runs out.")
    return "\n".join(lines), cites


def skill_losing_on_storage(_):
    data = stocksense.compute()
    md = sorted([v for v in data["variants"] if v["status"] == "markdown" and v["inventory"] > 0],
                key=lambda v: -(v["landed_cost"] * v["inventory"]))
    total = sum(v["landed_cost"] * v["inventory"] for v in md)
    lines = [f"**{len(md)} SKUs are bleeding money in storage** — {GBP(total)} of capital trapped at cost. "
             f"Worst offenders:\n"]
    cites = []
    for v in md[:8]:
        trapped = v["landed_cost"] * v["inventory"]
        mc = v["months_cover"]
        lines.append(f"- **{v['product_name']} — {v['sku']}** · {v['inventory']} units · "
                     f"{mc if mc != 999 else '∞'} months cover · {GBP(trapped)} trapped.")
        cites.append({"sku": v["sku"], "amount": round(trapped), "metric": "trapped cash"})
    return "\n".join(lines), cites


def skill_cash_crisis(_):
    cr = cashradar.compute(); m = cr["meta"]
    a = cr["demo_anchors"][0]
    b = a["remedies"]["B"]
    lines = [f"Your worst day was **{GBP(m['actual_nadir_gbp'])}** on **{m['actual_nadir_date']}** "
             f"(verified from the bank ledger).",
             f"\nThe data saw it coming **{m['primary_forewarned_days']} days early** — from "
             f"{m['primary_anchor']} the 30-day projection already called {GBP(m['primary_projected_nadir_gbp'])}.",
             "\nDrivers in the danger window:"]
    cites = []
    for d in a["danger_drivers"][:4]:
        lines.append(f"- {d['date']} · {d['label']} · {GBP(d['amount'])}")
        if d.get("po_id"):
            cites.append({"sku": d["po_id"], "amount": round(d["amount"]), "metric": "scheduled outflow"})
    lines.append(f"\n**Fix:** discount {b['variant_count']} overstock SKUs to free ≈{GBP(b['freed_gbp'])}, "
                 f"lifting the projected nadir to {GBP(b['new_min_balance'])} — no financing needed.")
    return "\n".join(lines), cites


def skill_backtest(_):
    r = simulator.compute(); h = r["headline"]
    lines = [f"**Backtest — months 13-24, using only month 1-12 data to decide:**\n",
             f"- Total impact: **{GBP(h['total_impact_gbp'])}**",
             f"- Cash freed from overstock: {GBP(h['cash_freed_gbp'])}",
             f"- Revenue recovered from stockouts: {GBP(h['revenue_recovered_gbp'])}",
             f"- Stockouts avoided: {h['stockouts_avoided']} SKUs",
             f"- Stockout-prediction precision: {h['reorder_precision_pct']}%",
             f"\nIf Pretty Fly had run this tool from month 12, it would have been ~{GBP(h['total_impact_gbp'])} better off."]
    cites = [{"sku": v["sku"], "amount": v["revenue_recovered"], "metric": "revenue recovered"} for v in r["top_reorder"][:3]]
    return "\n".join(lines), cites


def skill_summary(_):
    s = stocksense.compute()["summary"]
    cr = cashradar.compute()["meta"]
    lines = [f"**Pretty Fly at a glance ({s['total_variants']} SKUs):**",
             f"- {s['reorder_count']} need reordering · {s['markdown_count']} overstocked · {s['watch_count']} to watch · {s['healthy_count']} healthy",
             f"- {GBP(s['total_trapped_cash'])} trapped in overstock · {GBP(s['lost_monthly_revenue'])}/month lost to stockouts",
             f"- Worst cash day: {GBP(cr['actual_nadir_gbp'])} on {cr['actual_nadir_date']} (forewarned {cr['primary_forewarned_days']} days)",
             "\nAsk me: *what to reorder first*, *how much cash markdowns free*, *which suppliers cause stockouts*, "
             "*where I'm losing money on storage*, or *show the cash crisis*."]
    return "\n".join(lines), []


# order matters — specific intents are checked before broad ones
INTENTS = [
    (r"supplier|lead[ -]?time|bottleneck", skill_supplier_leadtime),
    (r"crisis|overdraw|overdraft|worst day|nadir|cash radar|negative balance", skill_cash_crisis),
    (r"backtest|prove|proof|simulat|would have|saved", skill_backtest),
    (r"free.*cash|markdown|mark down|discount|how much cash", skill_free_cash),
    (r"losing money|storage|trapped|dead (stock|capital)", skill_losing_on_storage),
    (r"reorder|restock|buy|order first|out of stock|stockout", skill_reorder_first),
    (r"summary|overview|glance|status|how.*doing|hello|hi|help", skill_summary),
]


def _retrieve(question: str):
    q = question.lower()
    for pat, fn in INTENTS:
        if re.search(pat, q):
            return fn(question)
    return skill_summary(question)


def _llm_phrase(question, grounded_md, cites):
    """Optionally re-phrase using Claude, grounded strictly on retrieved facts."""
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        return grounded_md, False
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=key)
        sys_prompt = ("You are the WC Agent, an operator assistant for Pretty Fly, a DTC streetwear brand. "
                      "Answer the operator's question using ONLY the facts in the GROUNDED DATA block. "
                      "Never invent SKUs, dates, or numbers. Be concise, confident, and cite specific "
                      "SKUs and £ amounts. Use British currency formatting. Markdown ok.")
        msg = client.messages.create(
            model="claude-haiku-4-5-20251001", max_tokens=700,
            system=sys_prompt,
            messages=[{"role": "user",
                       "content": f"OPERATOR QUESTION:\n{question}\n\nGROUNDED DATA:\n{grounded_md}"}])
        text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
        return (text or grounded_md), True
    except Exception:
        return grounded_md, False


def answer(question: str, use_llm: bool = True):
    grounded_md, cites = _retrieve(question or "")
    final = grounded_md
    used_llm = False
    if use_llm:
        final, used_llm = _llm_phrase(question, grounded_md, cites)
    return {"answer": final, "grounded": grounded_md, "citations": cites,
            "used_llm": used_llm, "question": question}
