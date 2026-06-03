# Initial Action Plan -- Pretty Fly x Wayflyer Hackathon

## The Main Idea

**Pretty Fly** is a fictional London streetwear brand with a critical inventory imbalance:
- **£186K+ of cash is trapped** in 69 overstocked variants (>12 months of stock cover).
- **301 best-selling variants are completely stocked out**, bleeding ~£124K/month in lost revenue.

The core insight: Pretty Fly is buying the *right products* in the *wrong quantities*. 19 products exhibit a "split personality" -- some variants overstocked, others stocked out simultaneously. The cash position runs dangerously thin (9 of 24 months below £50K net cash).

**The fix**: Free cash trapped in overstock (via markdowns) and redirect it to reorder stockout variants. **Every £1 freed generates £8.04 in annual revenue** -- with no new customers, products, or marketing spend.

## The Vision: An AI-Powered Working Capital Intelligence Platform

We're building more than a dashboard. The end goal is an **AI-driven operator tool** that:

1. **Scores every SKU** -- StockSense Score (0-100) combining stock urgency, demand intensity, and trend.
2. **Tells the operator what to do** -- specific reorder quantities, markdown percentages, and cash impact forecasts -- via an AI conversational interface.
3. **Predicts future demand** -- ML-driven market trend analysis to forecast which items will sell well and which won't, enabling *proactive* purchasing decisions.
4. **Proves it works** -- a backtesting simulator that replays historical data against the tool's recommendations to demonstrate the actual cash saved and revenue gained.
5. **Surfaces everything in a clean operator frontend** -- a production-grade UI where a Pretty Fly operator can see actionable intelligence at a glance and drill into any SKU or scenario.

## The Data

The project operates on a **fictional 24-month dataset** (June 2024 - May 2026) comprising 21 files:

| Table | Rows | What It Tracks |
|---|---|---|
| `products.csv` | 62 | Product catalogue |
| `variants.csv` | 645 | Sellable SKUs (size + colour, prices, stock) |
| `orders.csv` | 49,793 | Order history with timestamps |
| `line_items.csv` | 69,956 | Individual items sold |
| `inventory_movements.csv` | 76,444 | Every stock change |
| `customers.csv` | 22,440 | Customer profiles & acquisition |
| `purchase_orders.csv` | 21 | Supplier POs with payment schedules |
| `po_line_items.csv` | 645 | Landed costs per unit |
| `bank_transactions.csv` | 560 | Every penny in/out |
| `google_ads_daily.csv` | 5,110 | Google Ads performance |
| `meta_ads_daily.csv` | 3,102 | Meta Ads performance |
| `email_campaigns.csv` | 6 | Klaviyo campaigns |
| `email_events.csv` | 11,368 | Email sends, opens, conversions |
| `refunds.csv` | 5,843 | Returns & refunds |
| `support_tickets.csv` | 1,204 | Customer support |
| `support_messages.json` | 1,204 convos | Actual chat/email/DM transcripts |
| `discount_codes.csv` | 8 | Discount code definitions |
| `collections.csv` | 9 | Product collections |
| `addresses.csv` | 22,440 | Shipping addresses |
| `suppliers.csv` | 5 | Supplier details |

Data integrity is verified by **20 reconciliation rules** (validate.py -- all passing).

## How StockSense Scoring Works

Every one of the 645 variant SKUs gets a **StockSense Score (0-100)** -- a composite of three floating-point sub-scores computed from the data pipeline (`stocksense_data.py`):

| Component | Range | Type | What It Measures |
|---|---|---|---|
| **Stock Urgency** | 0.0 - 50.0 | Float | How fast is stock running out? 50 = out of stock now, 0 = >12 months cover |
| **Demand Intensity (Demand Score)** | 0.0 - 30.0 | Float | How much revenue is at stake? Scaled against the top-selling variant's 12-month volume |
| **Trend Bonus** | 0.0 - 20.0 | Float | Is demand accelerating? Positive trend = bonus; flat or declining = 0 |

These three floats are summed and rounded to an integer StockSense Score (capped at 0-100). Each variant then gets a status based on score thresholds and inventory levels:

| Status | Criteria | Count |
|---|---|---|
| **Reorder** | Out of stock, or <2 months cover with velocity | 361 |
| **Mark Down** | >12 months cover, or zero velocity with stock on hand | 71 |
| **Watch** | StockSense Score >= 50 | 69 |
| **Healthy** | Everything else | 144 |

The **Demand Score** (demand intensity float) is the key number for the prediction model -- it tells us which SKUs carry the most weight and where forecasting accuracy matters most.

## What's Already Built

| Component | Status | Description |
|---|---|---|
| StockSense Dashboard (`stocksense.html`) | Built | Interactive grid of 645 SKU cards with scores, sparklines, and recommendations |
| StockSense Data Pipeline (`stocksense_data.py`) | Built | Computes StockSense Scores, statuses, and recommendations from 7 CSVs |
| WC Idea Pitch (`WC idea.html`) | Built | Strategic document: business case, what-if analysis, proposed AI agent architecture |
| Deep-Dive Analytics (`deepdive.html`) | Built | 12+ Chart.js dashboards across revenue, cash, ads, inventory, customers |
| Data Validation (`validate.py`) | Built | 20 reconciliation rules (all passing) |
| Schema Explorer (`schema.html`) | Built | ER diagrams and join references |

## What Needs Building

### Phase 1: AI Conversational Agent (WC Agent)

An LLM-powered operator tool grounded in the dataset that answers natural-language questions like:
- "What should I reorder first?"
- "How much cash will I free by marking down overstock?"
- "Which supplier lead times are causing the most stockouts?"
- "Show me all SKUs where I'm losing money on storage."

The agent must cite specific data (SKU, date, £ amount) in every response.

### Phase 2: Operator Frontend

A clean, professional UI for the Pretty Fly operator. Should include:
- **StockSense grid** -- all 645 SKU cards, filterable, searchable (already prototyped)
- **AI chat panel** -- conversational interface to the WC Agent
- **Cash position dashboard** -- live view of trapped cash, freed cash, revenue impact
- **Recommendation queue** -- prioritised action list (reorder first, mark down next)
- **Deep-dive views** -- drill into any SKU, product, or supplier

### Phase 3: Backtesting Simulator

A simulator that replays historical data to **prove the tool works**:
- Feed the tool data from months 1-12, generate recommendations
- Simulate what happens in months 13-24 if the operator follows those recommendations
- Compare simulated outcomes (cash freed, revenue gained, stockouts avoided) against what *actually* happened
- Output: "If Pretty Fly had used this tool, they would have freed £X in trapped cash and generated £Y in additional revenue."

This is the **proof point** for the demo.

### Phase 4: Market Trend Prediction Model

An ML model that predicts which product types and variants will trend up or down:
- **Inputs**: historical sales velocity, seasonality patterns, Google/Meta ad performance, email engagement, refund rates, customer acquisition sources, gender affinity
- **Output**: a "trend forecast" per product type/variant -- up, flat, or down
- **Backtesting requirement**: validate predictions against actual months 13-24 data. Measure accuracy. **If the model is inaccurate, scrap it and fall back to the heuristic scoring only.** The demo should never present shaky predictions.

### Phase 5: Cash Flow Impact Engine

Wire up the financial model from the WC Idea what-if scenarios:
- Real-time calculation of trapped cash, freed cash, and projected revenue uplift
- Scenario toggles: conservative / moderate / aggressive markdown and reorder strategies
- Visualised as cash flow charts in the operator frontend

## Immediate Next Steps (Ordered)

1. **Build the backtesting simulator** -- this is the demo's killer feature. Prove the tool saves money.
2. **Build the WC AI conversational agent** -- the intelligence layer that ties everything together.
3. **Build the operator frontend** -- unify StockSense, AI chat, cash dashboard, and simulator into one UI.
4. **Experiment with the trend prediction model** -- but gate it behind backtesting accuracy. Ship or scrap.
5. **Polish the demo narrative** -- tell the story: problem -> data -> tool -> simulator proof -> business impact.
