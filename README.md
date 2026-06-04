# Pretty Fly — Cash Radar + StockSense

A cash flow projector and inventory triage tool for DTC brands. No ML. No backend. No excuses.

---

## The finding

On 3 September 2024, Pretty Fly's bank balance hit −£274,113.93. Their worst day in two years. Three purchase order balance payments landed on the same morning — £163k out the door at once. Those POs were placed in June and July. The information was sitting in the data the whole time.

Our projection, run from 14 August 2024, forecast −£261,435 on the same day. 20 days early, 95% accurate. No machine learning. Just known PO schedules, trailing Shopify payouts, and trailing opex.

That's the product.

---

## What it does

**Cash Radar** (`index.html`) scrubs through 24 months of bank history. At any point in the timeline it projects the next 30 days using scheduled PO payments, trailing payouts, and opex. When it detects a danger window it fires an alert and offers three honestly-costed remedies:

- Remedy A: delay the largest PO balance. Costs nothing. One supplier email.
- Remedy B: discount overstock to free trapped cash. Opens StockSense pre-filtered to the exact SKUs.
- Remedy C: Wayflyer bridge financing. Real fee shown (£16,629 on a £281k 90-day bridge). The last resort, labelled honestly.

**StockSense** (`stocksense.html`) scores every variant by days-of-cover, reorder urgency, and margin. It stands alone, and it wires directly into Remedy B — click through from the alert and you land on the overstock candidates ready to act on.

---

## How it's built

Static site. Python + pandas pipeline pre-computes two JS data files. Vanilla JS and Chart.js render everything in the browser. All 20 validate.py reconciliation rules pass. Works from `file://` — if the Wi-Fi dies on stage, we demo from a USB stick.

---

## GDPR

All data is aggregated at the SKU and transaction level. No personal customer data — no names, emails, or addresses — is ingested, stored, or displayed anywhere in the product. GDPR-clean by design.

---

## Sponsor note

Wayflyer is Remedy C. Not the hero — the honest last resort. Cash Radar earns trust by showing you the cheaper options first, which is exactly when Remedy C lands. A founder who trusts the tool will reach for the financing when it's genuinely the right call.

---

## Running it

```
open index.html
```

Or, if you want a proper server: `python -m http.server 8765`, then `localhost:8765`.
