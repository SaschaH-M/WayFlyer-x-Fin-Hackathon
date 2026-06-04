# Pretty Fly — StockSense · Working Capital OS

**Wayflyer x Fin AI Hackathon — June 2026**

Full-stack working capital intelligence platform for Pretty Fly, a fictional
DTC London streetwear brand with 24 months of synthetic data (Jun 2024 –
May 2026). Scores 645 SKUs, runs a backtest simulator that proves £764K of
avoidable damage, and includes a grounded AI agent that answers operator
questions citing real SKUs, dates, and amounts.

---

## The Problem

Pretty Fly has a critical inventory imbalance:

- **£205K trapped** in 71 overstocked variants (>12 months cover)
- **361 best-sellers empty**, bleeding **£124K/month** in lost revenue
- The brand is buying the right products in the wrong quantities
- £1 freed from overstock generates **£8.04** in annual revenue (from the
  brand's own velocity data)

---

## Architecture

```
data/ (21 CSV + JSON files)
    │
    ▼  load_data.py
backend/prettyfly.db (SQLite)  ←  dataset.py  →  cached pandas DataFrames
    │
    ├── compute/stocksense.py    ←  645 scored SKUs (0–100)
    ├── compute/cashengine.py    ←  cash scenarios (conservative/moderate/aggressive)
    ├── compute/simulator.py     ←  backtest proof point
    └── agent.py                 ←  grounded retrieval + optional Claude LLM
    │
    ▼  Flask (port 5055) — 7 REST endpoints
frontend/ (Next.js, port 3010)
    └── 5 pages: Dashboard, StockSense grid, Scenarios, Backtest, StockSense Agent chat
```

No external APIs required. Runs fully offline by default. If
`ANTHROPIC_API_KEY` is set, the StockSense Agent uses Claude for natural-language
phrasing — falls back silently to the grounded answer if the key is missing.

---

## Key Features

### 1. StockSense — SKU Scoring Engine

Every one of 645 variant SKUs gets a score (0–100) from three components:

| Component | Range | What It Measures |
|---|---|---|
| Stock Urgency | 0–50 | How fast is stock running out? (0 = >12mo cover, 50 = empty now) |
| Demand Intensity | 0–30 | Revenue at stake, scaled against the top-selling variant |
| Trend Bonus | 0–20 | Is demand accelerating? |

Statuses derived from score + inventory:
- **Reorder** (361 SKUs) — out of stock or <2 months cover with velocity
- **Mark Down** (71 SKUs) — >12 months cover or zero velocity with stock
- **Watch** (69 SKUs) — score ≥ 50
- **Healthy** (144 SKUs) — everything else

Each variant receives a specific recommendation with a £ cost.

### 2. Backtest Proof — Simulator

The simulator proves the tool works without peeking at the future:

1. Cut the timeline at month 12 (2025-05-31)
2. Using ONLY data on/before that date, classify every variant as
   REORDER / MARKDOWN / HOLD
3. Replay the real months 13–24 against those recommendations
4. Measure what each recommendation would have been worth

**Result:** ~£764K total impact (£637K cash freed + £127K revenue recovered,
206 stockouts avoided). Precision: the tool correctly flags stockout-prone
SKUs with measured accuracy.

### 3. Cash Engine — Strategy Scenarios

Three preset strategies, togglable at runtime:

| | Conservative | Moderate | Aggressive |
|---|---|---|---|
| Discount | 20% | 30% | 40% |
| Sell-through | 50% | 70% | 85% |
| Reorder share | 50% | 80% | 100% |

Computes freed cash, reorder investment, projected revenue uplift, and net
cash position. Revenue multiplier (£1→£8) is derived from the brand's own
economics, not assumed.

### 4. StockSense Agent — Grounded Operator Assistant

Natural-language Q&A that ALWAYS works (demo-safe):

1. **Retrieval layer** (offline, deterministic): Regex intent matching routes
   questions to one of 6 skill functions. Each skill queries live data and
   returns markdown with cited SKUs, dates, and £ amounts.
2. **LLM phrasing layer** (optional): If `ANTHROPIC_API_KEY` is set, the
   retrieved facts are handed to Claude with strict grounding instructions.
   Falls back to the grounded answer on any error.

Example questions:
- "What should I reorder first?"
- "How much cash will I free by marking down overstock?"
- "Which supplier lead times are causing the most stockouts?"
- "Show me all SKUs where I'm losing money on storage."
- "Prove this tool would have saved money."

---

## The Dataset

21 files, fictional 24 months (Jun 2024 – May 2026), all synthetic PII.

| Domain | Files | Rows |
|---|---|---|
| Catalogue | products, variants, collections, product_collections | 62 products, 645 SKUs |
| Customers | customers, addresses | 22,440 each |
| Orders | orders, line_items, discount_codes, refunds | 49,793 orders, 69,956 items |
| Supply Chain | suppliers, purchase_orders, po_line_items, inventory_movements | 21 POs, 76,444 movements |
| Marketing | google_ads_daily, meta_ads_daily, email_campaigns, email_events | 5,110 + 3,102 ad rows |
| Support | support_tickets, support_messages | 1,204 tickets + transcripts |
| Banking | bank_transactions | 560 transactions |

Data quality is verified by 20 reconciliation rules in `validate.py` (all
passing). The validator uses Decimal arithmetic with 1-penny tolerance and
covers order totals, inventory movement reconciliation, bank balance
consistency, FK integrity, and cross-table campaign attribution checks.

GDPR-clean by design — all customer data is synthetic, and the tool operates
at SKU/transaction level only.

---

## File Inventory

### Backend (`backend/`)

| File | Purpose |
|---|---|
| `app.py` | Flask API server — 7 endpoints, cache warming on boot |
| `agent.py` | StockSense Agent — intent routing + 6 skill functions + optional LLM |
| `db.py` | SQLite/Postgres engine (auto-detects from `DATABASE_URL`) |
| `dataset.py` | Cached DataFrame loader for all 20 database tables |
| `load_data.py` | CSV-to-DB importer (idempotent: drop + recreate) |
| `requirements.txt` | Python dependencies (Flask, pandas, SQLAlchemy, anthropic, etc.) |
| `run.sh` | One-command launch (seed DB + start Flask) |
| `.env.example` | Template for `ANTHROPIC_API_KEY` + `DATABASE_URL` |
| `compute/stocksense.py` | StockSense score engine — 0–100 per variant |
| `compute/cashengine.py` | Cash flow impact engine — three strategy scenarios |
| `compute/simulator.py` | Backtest proof simulator — honest, no-peek methodology |

### Frontend (`frontend/`)

| File | Purpose |
|---|---|
| `app/page.tsx` | Dashboard — 3 KPIs, cash position card, reorder queue, backtest proof |
| `app/inventory/page.tsx` | StockSense grid — 645 SKU cards, filterable by status/type/search |
| `app/scenarios/page.tsx` | Cash Engine — toggle strategies, comparison chart |
| `app/simulator/page.tsx` | Backtest — cumulative impact chart, cited SKU tables |
| `app/chat/page.tsx` | StockSense Agent — chat UI with suggested questions + citations |
| `app/layout.tsx` | Root layout (sidebar + main shell) |
| `app/globals.css` | Dark theme CSS — KPIs, badges, cards, charts, loading skeletons |
| `components/Sidebar.tsx` | Navigation + health indicators (live dot, DB type, LLM status) |
| `components/charts.ts` | Chart.js base config + colour palette |
| `lib/api.ts` | Fetch wrapper for all 7 API endpoints |
| `lib/format.ts` | GBP/number/date formatting utilities |
| `lib/md.tsx` | Zero-dependency markdown renderer |
| `next.config.mjs` | Next.js config with `/api/*` → `:5055` proxy rewrites |

### Static Prototypes & Scripts (`stocksense/`)

| File | Purpose |
|---|---|
| `stocksense.html` | Original static StockSense dashboard (prototype) |
| `stocksense_data.py` | Static pipeline that generates `stocksense_data.js` |
| `stocksense_data.js` | Pre-computed StockSense data for the static dashboard |
| `deepdive.html` | Deep-dive analytics dashboard (12+ Chart.js charts) |
| `chart_data.js` | Pre-computed chart data (generated by `extract_charts.py`) |
| `chart.min.js` | Chart.js v4.4.8 library (minified) |
| `explore.py` | Pain-point & opportunity analysis (9 sections) |
| `extract_charts.py` | Chart data generator for deep-dive dashboard |
| `validate.py` | 20 reconciliation rules (data integrity checker) |
| `report.html` | Rendered HTML version of the Initial Report |
| `WC idea.html` | Strategic pitch document |

### Root-Level

| File | Purpose |
|---|---|
| `SCHEMA.md` | Complete database schema + architecture |
| `PROJECT-SUMMARY.md` | Project overview, features, run instructions |
| `CODEBASE-INFO.md` | Single-source codebase reference |

### Data (`data/`)

21 CSV + JSON files — see Dataset section above.

---

## Running It

Two terminals required:

```bash
# Terminal 1 — Backend API (http://localhost:5055)
cd backend
python3 -m venv venv && ./venv/bin/pip install -r requirements.txt  # first time only
./run.sh

# Terminal 2 — Frontend Console (http://localhost:3010)
cd frontend
npm install              # first time only
npm run dev
```

Open **http://localhost:3010**.

### Optional

- **Postgres**: Set `DATABASE_URL=postgresql://localhost/prettyfly` before
  running `run.sh`. The app auto-detects and switches. Nothing else changes.
- **Claude LLM**: Add `ANTHROPIC_API_KEY=sk-ant-...` to `backend/.env`. The
  StockSense Agent uses Claude for natural-language phrasing. Falls back to grounded
  answer if the key is missing.

Both are optional — the app runs fully offline by default.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Status: `{ok, db, llm}` |
| GET | `/api/summary` | Dashboard rollup: stocksense + cashengine + backtest headline |
| GET | `/api/stocksense` | Full 645-variant StockSense computation + summary |
| GET | `/api/simulate?cutoff=` | Backtest proof data (default cutoff: month 12) |
| GET | `/api/cashengine?scenario=` | Single cash scenario (conservative/moderate/aggressive) |
| GET | `/api/cashengine/all` | All three strategy scenarios |
| POST | `/api/agent` | StockSense Agent: `{question, use_llm}` → `{answer, grounded, citations, used_llm}` |

All endpoints return JSON. The frontend proxies `/api/*` → `localhost:5055`
via Next.js rewrites.

---

## Demo Narrative (~4 min)

1. **Dashboard** — "Pretty Fly buys the right products in the wrong
   quantities." £205K trapped, £124K/mo lost. One screen, the whole problem.
2. **StockSense** — 645 SKUs scored 0–100, filterable. Named, specific,
   defensible recommendations.
3. **Cash Engine** — toggle conservative / moderate / aggressive. Watch
   trapped cash convert to working capital and projected revenue.
4. **Backtest Proof** — trained on months 1–12, scored on real months 13–24.
   ~£764K better off. No peeking.
5. **StockSense Agent** — ask it anything; every answer cites the data.

---

## Key Numbers

| Metric | Value |
|---|---|
| Total SKUs | 645 |
| Total revenue (24 months) | £6.52M |
| Total orders | 49,793 |
| Total customers | 22,440 |
| Trapped cash in overstock | ~£205K |
| Monthly lost revenue (stockouts) | ~£124K |
| Reorder-needing SKUs | 361 |
| Overstocked SKUs (>12mo cover) | 71 |
| Backtest proven impact | ~£764K |
| Revenue multiplier (£1 freed) | £8.04 |
| Data validation rules | 20 (all passing) |
| Backend endpoints | 7 |
| Frontend pages | 5 |

---

*One email to a supplier, sent 20 days earlier, would have cut the overdraft
by £116K. The data was there. Nobody was looking.*
