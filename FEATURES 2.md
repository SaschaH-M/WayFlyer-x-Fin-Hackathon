# Data-driven feature backlog

Every item below is grounded in a specific finding from the Pretty Fly dataset. ✅ = built in this app.

## ✅ Built

1. **Cash Radar** — projects 30 days of cash from known PO schedules + trailing payouts/overheads.
   Caught the −£274,113 crisis 20 days early. *(bank_transactions, purchase_orders)*
2. **StockSense** — 645 SKUs scored 0–100 (urgency + demand + trend), each with a plain-English "why".
   £205k trapped, £124k/mo bled. *(variants, line_items, inventory_movements)*
3. **Backtest simulator** — trains on months 1-12, scores against the *real* 13-24. ≈£764k proven impact,
   plus an actual-vs-with-tool revenue line with exact datapoints.
4. **Cash Flow Impact Engine** — conservative/moderate/aggressive scenarios over the live inventory.
5. **Marketing Command Center** — true ROAS (spend ÷ Shopify-attributed revenue), break-even from margin,
   waste→winner reallocation, TikTok free-channel insight, **ads→inventory launch loop**. *(google/meta_ads, orders.utm_*, email_campaigns)*
6. **WC Agent** — grounded NL assistant; cites real SKU/£/date; Claude phrasing when a key is present.

## 🔜 Highest-value next (with the finding that justifies each)

7. **Sizing-fit predictor / size-curve optimiser** — **41% of all refunds are sizing** (1,284 "too small" +
   1,109 "too large" of 5,843 refunds; £602k / 9.2% refund rate). Flag SKUs with skewed return reasons,
   recommend size-curve reorder mixes, and add a storefront fit-advisor. Directly cuts the biggest refund driver.
8. **Support auto-resolve bot** — 1,204 tickets, **100% linked to an order**, only 504/1,204 bot-resolved today.
   order_status (367) + returns (187) + drop_restock (139) are mechanically answerable with order+inventory data
   the app already has. Push bot-resolution well past 40%. *(support_tickets, support_messages, orders)*
9. **True P&L** — COGS recognised at sale (line_items × po_line_items landed cost), Shopify fees derived from
   payout vs orders, returns from refunds. The PDF explicitly flags this. Monthly P&L without an accountant.
10. **Customer LTV by channel** — `Womens_Welcome_Flow` email shows the **highest LTV (£382)** on just 56
    customers — under-scaled. Retargeting-IG £311. Steer acquisition spend toward high-LTV sources. *(customers, orders)*
11. **Womenswear launch health** — only 16% of catalogue, launched Dec 2025; `Womens_Launch` ad ROAS 1.52×
    (below break-even) yet womens email LTV is the highest. A dedicated new-line tracker: right audience, wrong ads.
12. **Demand forecast (Phase 4 ML)** — seasonality + ad-signal features → per-SKU up/flat/down. **Gate behind the
    backtest** (ship only if it beats the heuristic); otherwise fall back to scoring. Never demo shaky predictions.
13. **Supplier scorecard** — lead time vs stockouts vs landed cost vs actual-vs-expected delivery reliability.
    Iberia Footwear (90-day lead time) already shows as the stockout bottleneck in the agent.
14. **Bank anomaly detection** — flag unusual outflows vs the recurring run-rate the Cash Radar already models.

## Note on live connectors

Google & Meta ad **spend** is real dataset. TikTok / Instagram / organic **revenue** is real (via `orders.utm_source`)
but has no spend file — shown as free/under-invested channels. Productionising TikTok Ads / Vinted / Meta APIs is a
thin connector layer on top: the attribution join, break-even maths, and the ads→inventory loop already run on real data.
