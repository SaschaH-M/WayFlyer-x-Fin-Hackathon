# Pretty Fly — Cash Radar + StockSense

Pretty Fly went −£274,113.93 overdrawn on 3 September 2024. Three PO balance payments — Porto Knit £103k, Iberia £34k, Milano £26k — landed on 2 Sep while Shopify payouts were weekly and slow. The data knew from June. No tool was watching.

A projection run from 14 August 2024 calls −£261,435 on the same day. 20 days early. 95% accurate. No ML — known PO schedules, trailing Shopify payouts, trailing opex.

---

## Cash Radar

Scrubs through 24 months of bank history. At any point in the timeline, projects cash 30 days forward using only what the operator could have known that day: scheduled PO payments, trailing payouts, trailing overheads.

On a danger window, shows the exact cause — named POs, named amounts — and three remedies:

**Remedy A** — Delay Porto Knit balance 21 days. New cash low: −£158k. Costs nothing.  
**Remedy B** — Discount 26 overstock SKUs at 30% off, 70% sell-through. Frees £287,762. New low: −£80k. Opens StockSense pre-filtered to those exact SKUs.  
**Remedy C** — Wayflyer £281k bridge, 90 days, fee £16,629. Shown as the most expensive option. The last resort, not the first pitch.

`?apply=A`, `?apply=B`, `?apply=C` URL params auto-apply a remedy on load.

---

## StockSense

645 variants scored across days-of-cover and margin: **Reorder Now / Watch / Healthy / Mark Down**.

Classic Hoodie Washed Black M — 44 months of cover. Relaxed Hoodie Burgundy M — 36 months. Named, specific, defensible.

Connects from Cash Radar Remedy B — opens pre-filtered to the exact overstock SKUs that free the cash.

---

## Data

Six tables: `bank_transactions.csv`, `purchase_orders.csv`, `po_line_items.csv`, `inventory_movements.csv`, `variants.csv`, `products.csv`. Focused build, not a broad one.

---

## GDPR

All customer data in the source files is synthetic. The tool operates at SKU and transaction level only — no personal data is ingested, processed, or displayed. GDPR-clean by design.

---

## Running it

Static site. No backend, no login, no API keys.

```
python -m http.server 8765
```

Open `http://127.0.0.1:8765/index.html`. Or open `index.html` directly from `file://` — works offline.

---

One email to a supplier, sent 20 days earlier, would have cut that overdraft by £116k. The data was there. Nobody was looking.
