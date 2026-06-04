# Pretty Fly — Initial Data Pack Report

**Wayflyer × Fin AI Hackathon — 3–5 June 2026**
*Prepared: 3 June 2026*

---

## Executive Summary

Pretty Fly is a fictional London streetwear brand with 24 months of data (Jun 2024 – May 2026) across 20 CSV tables and 1 JSON file. The brand has grown from **£164K/mo to £257K/mo net revenue** (1.6x), but carries significant operational inefficiencies. Total revenue over the period: **£6.52M** across **49,793 orders** from **22,440 customers**.

This report surfaces the most critical pain points found during exploratory data analysis and recommends build directions.

---

## 1. Business Overview

### Revenue & Orders

| Metric | Value |
|---|---|
| Total Revenue (gross) | £6,522,560 |
| Total Refunds | £602,389 (9.2% rate) |
| Total Orders | 49,793 |
| Average Order Value | ~£131 |
| Monthly Revenue Range | £155K – £485K |
| Growth (first 3mo vs last 3mo) | 1.6x |

**Seasonality:** November consistently peaks (Black Friday — £407K–£485K). December drops but with elevated refund volume. January–February are trough months.

### Revenue by Product Type

| Product Type | Revenue | % of Total | Avg Price | Gross Margin |
|---|---|---|---|---|
| Hoodie | £2,193,882 | 32.6% | £158.94 | 68.3% |
| Tee | £1,956,557 | 29.1% | £52.14 | 66.7% |
| Sweatpants | £894,569 | 13.3% | £141.43 | 54.2% |
| Trainer | £831,055 | 12.4% | £201.08 | 64.2% |
| Outerwear | £575,960 | 8.6% | £267.39 | 66.7% |
| Cap | £275,127 | 4.1% | £45.75 | 51.7% |

**Key insight:** Hoodies and Tees drive 62% of revenue. Caps have the weakest margins (51.7%) and lowest contribution (4.1%). Sweatpants margins are surprisingly low at 54.2%.

---

## 2. Pain Points

### 2.1 Cash Flow & Working Capital

**Severity: Critical**

| Metric | Value |
|---|---|
| Total PO spend | £2,197,252 (33.7% of revenue) |
| Avg payment cycle (PO to full payment) | 71 days |
| First month net cash flow (Jun 2024) | **-£507,111** |
| Months with negative cash flow | 3 of 24 |

Pretty Fly front-loaded over **£682K** in supplier costs in month one alone. The gap between paying suppliers and collecting revenue creates a working capital strain. While net cash flow is positive in 21 of 24 months, the business runs dangerously lean — single-digit thousands in some months (e.g., Feb 2025: +£6,211).

**Supplier breakdown:** 5 suppliers across Portugal, Italy, and Turkey. PO deposit and balance payments are spread across the 24-month window. The validator confirms all PO payments reconcile to bank transactions.

**Build opportunity:** A cash forecasting tool that models expected PO payments against sales projections, showing exactly when Pretty Fly runs out of cash and how much they'd need to bridge.

---

### 2.2 Inventory Imbalance

**Severity: Critical**

| Issue | Count | Value |
|---|---|---|
| Overstock variants (>12 months cover) | 69 | £475,344 at retail |
| Stockout variants (previously sold, now zero) | **301** | Lost revenue opportunity |
| Dead stock (zero sales in 12 months) | 0 | N/A |

**Overstock highlights:**
- Womens Relaxed Sweatpant (var_000633): 54 months of cover
- Light Parka (var_000641): 48 months of cover
- Classic Hoodie (var_000018): 28 months of cover
- Everyday Sweatpants (var_000038): 23 months of cover

**Stockout severity:** 301 variants (nearly half of all 645 variants) are fully depleted despite having recent sales. This affects virtually every product line — Essential Tee, Heavyweight Hoodie, Classic Hoodie, Track Hoodie, Court Trainer, Puffer Jacket, and many more. Most stockouts happened in the last 30 days (May 2026), suggesting a systemic restocking failure.

**The contradiction:** Pretty Fly has £475K sitting in overstocked inventory while simultaneously running out of their best-selling SKUs. They're buying the wrong things in the wrong quantities.

**Build opportunity:** An inventory health dashboard that ranks every SKU by "reorder urgency" (sales velocity vs. current stock), flags overstock risks, and generates recommended PO quantities.

---

### 2.3 Marketing Waste

**Severity: High**

| Platform | Total Spend | Reported ROAS | Avg CPC | Conv Rate |
|---|---|---|---|---|
| Google Ads | £505,765 | 3.71x | £1.43 | 3.3% |
| Meta Ads | £528,717 | 2.99x | £1.47 | 3.1% |

**Declining Meta ROAS (monthly trend, last 12 months):**

| Month | Google ROAS | Meta ROAS |
|---|---|---|
| Jun 2025 | 3.69 | 3.11 |
| Jul 2025 | 3.75 | 3.12 |
| Aug 2025 | 3.71 | 3.14 |
| Sep 2025 | 3.72 | 3.12 |
| Oct 2025 | 3.72 | 3.13 |
| Nov 2025 | 3.73 | 3.11 |
| Dec 2025 | 3.67 | **2.73** |
| Jan 2026 | 3.69 | **2.71** |
| Feb 2026 | 3.74 | **2.74** |
| Mar 2026 | 3.70 | **2.75** |
| Apr 2026 | 3.70 | **2.67** |
| May 2026 | 3.73 | **2.70** |

**Specific failing campaigns:**

| Campaign | Platform | Spend | ROAS | Verdict |
|---|---|---|---|---|
| `Womens_Launch_Prospecting` | Meta | £32,123 | **0.98x** | Losing money |
| `Generic_Streetwear_UK` | Google | £24,342 | **1.20x** | Barely break-even |
| `Brand_Awareness_UK` | Meta | £56,070 | **0.00x** | No conversions tracked |
| `Prospecting_Mens_EU` | Meta | £98,835 | **2.50x** | Below acceptable threshold |

Meta ROAS collapsed from ~3.1x to ~2.7x the moment womenswear launched (Dec 2025) and never recovered. The `Brand_Awareness_UK` campaign spent £56K with literally zero tracked conversions — this is a pure brand play but warrants scrutiny.

**Build opportunity:** A true ROAS calculator that reconciles ad platform data against actual Shopify-attributed orders (via `utm_campaign`), shows which campaigns are genuinely profitable, and recommends budget reallocation with £-impact estimates.

---

### 2.4 Customer Retention Crisis

**Severity: High**

| Cohort | Customer Count | % of Total |
|---|---|---|
| 1 order only | 10,376 | **46.2%** |
| 2+ orders | 12,064 | 53.8% |
| 3+ orders | 6,708 | 29.9% |
| 4+ orders | 3,744 | 16.7% |
| 5+ orders | 2,067 | 9.2% |
| 6+ orders | 1,156 | 5.2% |

**Cohort revenue decay (last 6 cohorts):**

The average cohort loses ~75% of its month-0 revenue by month 1, then halves again by month 2. A Dec 2025 cohort worth £180K in month 0 is worth only £9K by month 5.

**Acquisition channel LTV differences:**

| Source | Avg Customer Spend | Avg Orders |
|---|---|---|
| organic | £308.86 | 2.36 |
| google/cpc/PMax_Menswear_UK | £308.57 | 2.37 |
| klaviyo/email/Womens_Welcome_Flow | £381.80 | 2.66 |
| instagram/Womens_Launch_Prospecting | £296.36 | 2.20 |
| facebook/Womens_Launch_Prospecting | £266.92 | 2.10 |

**Key insight:** Womenswear customers acquired via paid social (FB/IG Womens Launch) have the lowest LTV, while organic and email-acquired customers outperform. The womenswear paid customer acquisition appears to be bringing in lower-value customers.

**Gender segment differences:**

| Segment | Customers | Avg Spend | Avg Orders |
|---|---|---|---|
| Mens | 21,749 | £289.23 | 2.21 |
| Womens | 691 | **£335.92** | **2.60** |

Womenswear customers spend 16% more and order more frequently — but there are only 691 of them after 6 months. The segment is profitable but underscaled.

**Build opportunity:** A churn prediction and re-engagement tool that identifies at-risk customers, segments by predicted LTV, and generates targeted re-engagement campaigns with specific product recommendations.

---

### 2.5 Returns & Sizing Problem

**Severity: Medium-High**

| Metric | Value |
|---|---|
| Total refund amount | £602,389 |
| Refund rate | 9.2% of gross revenue |
| Avg days to refund | 17.3 days |
| Returns within 7 days | 7.7% |
| Returns within 7–30 days | 92.3% |

**Refund reasons:**

| Reason | Count | % |
|---|---|---|
| size_too_small | 1,284 | 22.0% |
| changed_mind | 1,211 | 20.7% |
| size_too_large | 1,109 | 19.0% |
| not_as_described | 758 | 13.0% |
| damaged_in_transit | 752 | 12.9% |
| quality_issue | 729 | 12.5% |

**41% of all returns are sizing-related.** If Pretty Fly could solve fit, they'd recover approximately **£247K** in saved refunds over the dataset period. December has a 15.6% refund rate (seasonal gifting).

**Build opportunity:** A sizing assistant that uses customer purchase history, return history (what sizes did they return?), and product measurements to recommend the right size at checkout. This is a customer-facing tool with direct £-impact.

---

### 2.6 Support Inefficiency

**Severity: Medium-High**

| Metric | Value |
|---|---|
| Total tickets | 1,204 |
| Bot-resolved | 504 (41.9%) |
| Human-resolved | 700 (58.1%) |
| Avg human resolution time | **756.5 minutes (12.6 hours)** |
| Avg bot resolution time | 16.9 minutes |
| Median resolution time (all) | 242 minutes |

**Tickets by channel:**

| Channel | Tickets | Avg Resolution |
|---|---|---|
| Email | 615 | 449 min |
| Chat | 419 | 465 min |
| Instagram DM | 170 | 393 min |

**Automation opportunity by category (sorted by bot rate):**

| Category | Total | Bot % | Human % |
|---|---|---|---|
| discount_code | 147 | 38.1% | 61.9% |
| other | 59 | 39.0% | 61.0% |
| order_status | 367 | 40.6% | 59.4% |
| drop_restock | 139 | 41.7% | 58.3% |
| sizing_fit | 171 | 42.7% | 57.3% |
| returns_exchanges | 187 | 44.4% | 55.6% |
| product_quality | 134 | 46.3% | 53.7% |

**Satisfaction by category (1–5 scale):**

| Category | Avg Rating |
|---|---|
| drop_restock | 3.92 |
| discount_code | 3.79 |
| other | 3.80 |
| order_status | 3.64 |
| returns_exchanges | 3.63 |
| sizing_fit | 3.59 |
| product_quality | 3.45 |

Low satisfaction in `product_quality` (3.45) and `sizing_fit` (3.59) suggests customers are unhappy with the resolution quality, not just the speed.

**The gap:** If a bot with full access to order history, product data, inventory, and return policies could resolve even 60% of `order_status` tickets (currently 40.6%), that's **73 more tickets** handled instantly instead of taking ~12 hours each. Across all categories, moving from 42% to 65% bot resolution would save roughly **275+ hours of human agent time.**

**Build opportunity:** An AI support agent that has access to the full Pretty Fly dataset — it can look up orders, check inventory, recommend sizes, process simple returns, and answer product questions. When it can't resolve, it creates a perfectly-contextualized handoff to a human agent.

---

### 2.7 Discount Impact

**Severity: Low-Medium**

| | Orders | Avg AOV | Avg Discount |
|---|---|---|---|
| No discount | 42,422 (85.2%) | £136.07 | £0.00 |
| With discount | 7,371 (14.8%) | £101.78 | £10.05 |

Discounted orders have a **£34 lower AOV** — the discount is only £10, suggesting discount users are generally lower-value customers buying fewer/cheaper items, not just the discount itself.

**Top discount codes by usage:**

| Code | Type | Usage |
|---|---|---|
| WELCOME10 | 10% | 3,139 |
| PRETTYNEW | £10 off | 3,134 |
| SPRING26 | 10% | 292 |
| WOMENSLAUNCH | 10% | 267 |
| AUTUMN24 | 15% | 218 |
| SUMMER24 | 15% | 216 |

---

## 3. Recommended Build Paths

### Path A: AI Support Agent with Full Business Context (Recommended)

**Type:** Operator-focused / Customer-facing hybrid

**What it does:** A chat-based AI agent that can answer customer questions using real Pretty Fly data. Grounded in orders, products, variants, inventory, refunds, support history, and customer profiles.

**Tables needed (7):** `orders`, `line_items`, `customers`, `products`, `variants`, `support_tickets`, `support_messages`, `inventory_movements`, `refunds`

**Demo scenarios:**
1. *"Where is my order #XXXX?"* — Pulls order status, tracking, items
2. *"I bought a Medium hoodie but it's too small. Can I exchange?"* — Checks their order, finds the Large variant, checks inventory, initiates return
3. *"What size should I get?"* — Looks at their purchase history, any past size returns, recommends based on product fit data
4. *"Is the Heritage Hoodie in Black available in Large?"* — Queries inventory in real-time

**Why it wins:**
- Demos instantly — type a question, get an answer
- Proves business value: reduces 12.6hr human resolution time
- Touches multiple domains through a single lens
- AI is literally in the hackathon name (Wayflyer × Fin AI)
- You can quote specific figures: "We'd save 275+ hours of agent time"
- `support_messages.json` gives you 1,204 real training examples of how Pretty Fly customers actually communicate

---

### Path B: True ROAS & Marketing Triage

**Type:** Operator-focused

**What it does:** A tool that reconciles ad platform reported conversions against actual Shopify-attributed orders (via `utm_campaign`), shows per-campaign true ROAS, and flags campaigns to cut or scale.

**Tables needed (5):** `orders`, `google_ads_daily`, `meta_ads_daily`, `email_campaigns`, `email_events`

**Demo scenarios:**
1. Surface `Womens_Launch_Prospecting` at 0.98x ROAS and recommend pausing it
2. Show Meta ROAS decline timeline overlaid with womenswear launch
3. Calculate true cost-per-acquisition vs. reported
4. Recommend budget shift: £32K from Meta womens prospecting → Google Shopping

**Why it might work:**
- Clear £-impact pitch ("We found £56K in wasted ad spend")
- Data is clean and well-structured
- ROAS is a universal DTC pain point

**Risk:** Judges may see it as a dashboard rather than an AI tool. Needs strong AI layer (e.g., natural language querying of marketing data).

---

### Path C: Inventory & Cash Forecaster

**Type:** Operator-focused

**What it does:** A tool that shows inventory health across all SKUs, predicts stockout dates based on sales velocity, calculates reorder quantities, and models cash position based on upcoming PO payments.

**Tables needed (6):** `variants`, `inventory_movements`, `line_items`, `orders`, `purchase_orders`, `po_line_items`, `bank_transactions`

**Demo scenarios:**
1. Flag the 69 overstock variants tying up £475K
2. Show the 301 stockout variants and estimated lost revenue
3. Predict when each SKU runs out at current sales velocity
4. Model a PO schedule that balances cash constraints
5. *"If we reorder Heavyweight Hoodies today, when does cash run negative?"*

**Why it might work:**
- Visually compelling (gauges, red/yellow/green health scores)
- Addresses the single biggest operational problem

**Risk:** Heavy data processing, less flashy demo unless the UX is exceptional.

---

### Path D: Customer Retention & Re-engagement Engine

**Type:** Operator-focused / Customer-facing hybrid

**What it does:** Identifies at-risk customers, segments by predicted LTV, and generates personalized re-engagement (product recs, discount offers, win-back emails).

**Tables needed (4):** `customers`, `orders`, `line_items`, `products`, `variants`

**Demo scenarios:**
1. Show the 10,376 one-time customers and their acquisition sources
2. Identify high-value customers who haven't purchased in 90+ days
3. Generate a personalized "We miss you" email with their exact past purchase and a recommended product
4. Predict which first-time buyers will become repeat customers

**Why it might work:**
- 46% one-time buyer stat is a killer pitch opener
- Natural AI layer (personalized recommendations, churn prediction)

**Risk:** Lighter on data complexity. Needs a strong demo with real personalization.

---

## 4. Decision Matrix

| Criterion | Path A (Support AI) | Path B (ROAS) | Path C (Inventory) | Path D (Retention) |
|---|---|---|---|---|
| Demo wow-factor | ★★★★★ | ★★★ | ★★★★ | ★★★ |
| Business value clarity | ★★★★★ | ★★★★ | ★★★★★ | ★★★★ |
| AI integration fit | ★★★★★ | ★★★ | ★★★ | ★★★★ |
| Data complexity (tables touched) | ★★★★★ | ★★★ | ★★★★ | ★★★ |
| Specific £-figure pitch | ★★★★★ | ★★★★★ | ★★★★★ | ★★★★ |
| Buildable in 2 days | ★★★★ | ★★★★★ | ★★★ | ★★★★ |
| Risk of being "just a dashboard" | ★ (Low) | ★★★★ (High) | ★★★ | ★★ |

**Recommendation: Path A — AI Support Agent.** It scores highest across all criteria, demonstrates the most data integration, provides the most natural AI use case, and maps directly to the Wayflyer × Fin AI theme.

---

## 5. Data Quality Notes

- All 20 validation rules pass on this dataset
- Timestamps are UTC — convert to Europe/London for local-time patterns
- Currency is GBP throughout (supplier invoices in EUR/USD converted)
- VAT is inclusive in UK retail prices
- Womenswear launched December 2025 — only 6 months of data
- All customer PII is synthetic (`firstname.lastname@example-fake.com`)
- `bank_transactions.category` is deliberately blank — an intentional build opportunity

---

*End of report.*
