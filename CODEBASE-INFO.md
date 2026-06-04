# CODEBASE-INFO.md — StockSense / Pretty Fly

> **Single-source reference for "scan codebase" tasks. Update whenever files are added, removed, or restructured.**

---

## 1. Project Overview

| Field | Value |
|---|---|
| **Name** | Pretty Fly — Working Capital OS / StockSense |
| **Context** | Wayflyer x Fin AI Hackathon (June 3-5, 2026) |
| **Purpose** | AI-powered working capital intelligence for a fictional DTC streetwear brand. Scores 645 SKU variants (0-100), generates recommendations (reorder/markdown/watch/healthy), simulates cash flow scenarios, runs a backtesting proof engine, and provides a grounded StockSense conversational agent. |
| **Repo** | `/Users/sascha/Desktop/WayFlyer-x-Fin-Hackathon-stock-sense-updated/` |

---

## 2. Directory Map

```
.
├── backend/                  # Flask API + compute engine (Python)
│   ├── .env.example          # ANTHROPIC_API_KEY + DATABASE_URL template
│   ├── app.py                # Flask routes (6 endpoints)
│   ├── agent.py              # StockSense Agent (intent-based retrieval + Claude LLM)
│   ├── db.py                 # DB engine (SQLite default, Postgres optional)
│   ├── dataset.py            # Cached pandas DataFrame loader
│   ├── load_data.py          # CSV→DB importer (21 tables)
│   ├── prettyfly.db          # SQLite database
│   ├── requirements.txt      # Python deps
│   └── run.sh                # Startup (venv→seed→Flask on :5055)
│   └── compute/
│       ├── stocksense.py     # StockSense scoring engine (0-100)
│       ├── cashengine.py     # Cash Flow Impact Engine (3 scenarios)
│       └── simulator.py      # Backtesting simulator (train/test split)
│
├── frontend/                 # Next.js 14 App Router (React + TypeScript)
│   ├── next.config.mjs       # API proxy rewrites → Flask :5055
│   ├── next-env.d.ts         # Next.js type declarations
│   └── app/
│       ├── globals.css       # Custom dark-theme CSS (~106 lines)
│       ├── layout.tsx        # Root layout + sidebar shell
│       ├── page.tsx          # Dashboard (KPIs, cash position, rec queue)
│       ├── inventory/
│       │   └── page.tsx      # StockSense grid (645 SKUs, filter/search)
│       ├── scenarios/
│       │   └── page.tsx      # Cash Engine scenario comparison + charts
│       ├── simulator/
│       │   └── page.tsx      # Backtest proof (cumulative chart, tables)
│       └── chat/
│           └── page.tsx      # StockSense Agent chat (suggested questions, citations)
│   └── components/
│       ├── Sidebar.tsx       # Nav sidebar with status indicators
│       └── charts.ts         # Chart.js config + dark color palette
│   └── lib/
│       ├── api.ts            # Typed API client (all 6 Flask endpoints)
│       ├── format.ts         # GBP/number/date formatters
│       └── md.tsx            # Tiny markdown renderer (no deps)
│
├── data/                     # 21 CSV files + 1 JSON dataset
│
├── stocksense/               # Static prototypes, reports & data scripts (earlier phase)
│   ├── stocksense.html       # Static StockSense dashboard
│   ├── stocksense_data.js    # Pre-generated StockSense JSON
│   ├── stocksense_data.py    # Original data pipeline
│   ├── chart_data.js         # Pre-generated chart JSON
│   ├── chart.min.js          # Chart.js library (minified)
│   ├── deepdive.html         # Deep-dive analytics dashboard
│   ├── report.html           # Rendered HTML report
│   ├── WC idea.html          # Strategic pitch document
│   ├── explore.py            # Exploratory data analysis (9 sections)
│   ├── extract_charts.py     # Chart JSON generator (17 charts)
│   └── validate.py           # 20-rule data validation
│
├── SCHEMA.md                 # Complete database schema + architecture
├── PROJECT-SUMMARY.md        # Project overview, features, run instructions
└── CODEBASE-INFO.md          # This file — single-source codebase reference
```

---

## 3. Tech Stack

### Frontend
| Category | Choice |
|---|---|
| Framework | Next.js 14.2.15 (App Router, React 18.3.1, TypeScript 5.6.3) |
| Charts | Chart.js 4.4.8 + react-chartjs-2 5.2.0 |
| Styling | **Pure CSS** — single `globals.css` with custom dark theme. No Tailwind, CSS modules, or CSS-in-JS |
| State | **No global state library** — React `useState`/`useEffect` per page |
| Fonts | Inter (Google Fonts, weights 300-900) |
| Breakpoint | 1100px (4-col→2-col, 3-col→1-col) |

### Backend
| Category | Choice |
|---|---|
| Framework | Flask 3.0+ / Flask-CORS 4.0 |
| ORM | SQLAlchemy 2.0 (dual: SQLite + optional Postgres) |
| Data | pandas 2.0+, numpy 1.24+ |
| AI | Anthropic Claude (via `anthropic>=0.40`, optional, falls back offline) |
| Caching | `functools.lru_cache` at startup (process-lifetime) |

---

## 4. Pages & Routes (Frontend)

| Route | File | Description |
|---|---|---|
| `/` | `app/page.tsx` | **Dashboard** — KPI rollup, cash position, recommendation queue, backtest summary |
| `/inventory` | `app/inventory/page.tsx` | **StockSense Grid** — 645 scored SKUs, filterable/searchable |
| `/scenarios` | `app/scenarios/page.tsx` | **Cash Engine** — conservative/moderate/aggressive comparison |
| `/simulator` | `app/simulator/page.tsx` | **Backtest Proof** — cumulative chart, tables, methodology |
| `/chat` | `app/chat/page.tsx` | **StockSense Agent** — chat with suggested questions + citations |

---

## 5. API Endpoints (Backend `app.py`)

| Method | Path | Module | Returns |
|---|---|---|---|
| GET | `/api/health` | — | `{db_backend, llm_available}` |
| GET | `/api/summary` | stocksense + cashengine + simulator | Dashboard rollup |
| GET | `/api/stocksense` | `compute/stocksense.py` | All 645 scored variants + summary |
| GET | `/api/simulate?cutoff=` | `compute/simulator.py` | Backtest proof point |
| GET | `/api/cashengine?scenario=` | `compute/cashengine.py` | Single scenario result |
| GET | `/api/cashengine/all` | `compute/cashengine.py` | All three scenarios |
| POST | `/api/agent` | `agent.py` | Grounded StockSense Agent answer `{question, use_llm}` |

**Data flow:** Browser → Next.js `:3010` → (rewrite `/api/*`) → Flask `:5055` → SQLite/Postgres

---

## 6. Compute Modules (Backend)

### `compute/stocksense.py` — StockSense Score (0-100)
- **Formula:** `stock_urgency(0-50) + demand_intensity(0-30) + trend_bonus(0-20)`
- Stock urgency: Linear 50→0 based on months of cover
- Demand intensity: Percentile rank scaled to 30
- Trend bonus: Min(20, trend×50) for positive velocity trend
- **Statuses:** `reorder` (<2mo cover or OOS), `markdown` (>12mo cover or 0 velocity), `watch` (≥50), `healthy`
- Each variant gets: score, status, recommendation, recommendation_cost, sparkline, margin_pct

### `compute/cashengine.py` — Cash Flow Impact Engine
- Three scenarios defined by discount + sell-through rates:
  - Conservative: 20% off, 50% sell-through
  - Moderate: 30% off, 70% sell-through
  - Aggressive: 40% off, 85% sell-through
- Computes: trapped cash, freed cash, reorder investment, revenue uplift
- Revenue multiplier derived from brand's own velocity data

### `compute/simulator.py` — Backtesting (The Proof Point)
- **Method:** Train months 1-12 (cutoff 2025-05-31), replay months 13-24
- For each variant: emit recommendation at cutoff, measure real outcomes
- Tracks: reorder precision (TP/FP), cash freed, revenue recovered
- Outputs: headline KPIs, 12-month cumulative series, top cited SKUs

### `agent.py` — StockSense Agent
- 6 intent skills: `reorder_first`, `free_cash`, `supplier_leadtime`, `losing_on_storage`, `backtest`, `summary`
- Regex intent matching → grounded markdown + structured citations (SKU, £, metric)
- Optional Claude (Haiku) layer for natural phrasing; defaults to grounded offline
- Model: `claude-haiku-4-5-20251001`
- System prompt enforces grounded-only responses (never invents data)

---

## 7. Key Data Types

### StockSense Variant
```typescript
{
  variant_id, product_id, product_name, product_type, gender_segment,
  sku, price, landed_cost, inventory, units_3mo, revenue_3mo,
  units_12mo, velocity_weekly, months_cover, trend,
  season_factor, stocksense_score, status, recommendation,
  recommendation_cost, recommendation_detail, sparkline: number[], margin_pct
}
```

### Cash Engine Response
```typescript
{
  scenario, label, blurb,
  assumptions: { discount_pct, sell_through_pct, reorder_share_pct, revenue_multiplier },
  trapped_cash_gbp, freed_cash_gbp, reorder_investment_gbp,
  fundable_reorder_gbp, projected_revenue_uplift_gbp,
  net_cash_position_gbp, markdown_sku_count, reorder_sku_count, headline
}
```

### Backtest Response
```typescript
{
  cutoff, test_window: { start, end, months },
  headline: { total_impact_gbp, cash_freed_gbp, revenue_recovered_gbp,
              stockouts_avoided, reorder_precision_pct },
  series: [{ month, cum_cash_freed, cum_revenue_recovered, cum_total }],
  top_reorder: [...], top_markdown: [...],
  assumptions: { capture_rate, markdown_discount, sell_through, ... }
}
```

### StockSense Agent Response
```typescript
{
  answer: string,         // LLM-phrased (or grounded fallback)
  grounded: string,       // Original grounded markdown
  citations: [{ sku, amount, metric }],
  used_llm: boolean,
  question: string
}
```

---

## 8. Dataset

- **21 CSV files** in `data/` (loaded into 21 DB tables)
- 24 months (June 2024 – May 2026)
- 62 products, 645 variants, 22,440 customers, 49,793 orders, 69,956 line items
- 76,444 inventory movements, 5,843 refunds, 1,204 support tickets
- 21 purchase orders, 5 suppliers, 560 bank transactions
- Revenue: ~£6.52M, PO spend: ~£2.20M
- All 20 validation rules pass (see `validate.py`)
- See `SCHEMA.md` for full ERD diagram

---

## 9. How to Run

```bash
# Backend (port 5055)
cd backend && bash run.sh

# Frontend (port 3010)
cd frontend && npm install && npm run dev
# Open http://localhost:3010
```

---

## 10. Key Design Decisions

1. **No global state management** — pages are self-contained with local `useState`
2. **No component library / no Tailwind** — custom dark-theme CSS with consistent class conventions
3. **Dual DB** — SQLite by default (zero-config demo), Postgres optionally (production)
4. **Offline-first** — StockSense Agent works without any API keys
5. **Backtest is the proof point** — honest train/test split, no peeking
6. **All data synthetic** — GDPR-clean, no real PII
7. **API proxy pattern** — Next.js rewrites `/api/*` to Flask, avoiding CORS in browser

---

## 11. Color Palette (CSS)

```
--bg = black (#000)        --t  = white (#fff)
--t2 = #888                --t3 = #444
--bl = #3b82f6 (blue)      --gr = #22c55e (green)
--rd = #ef4444 (red)       --am = #f59e0b (amber)
--pu = #a855f7 (purple)    --gy = #6b7280 (gray)
```

---

## 12. Environment Variables

```
# backend/.env (optional — both can be omitted)
ANTHROPIC_API_KEY=sk-ant-...            # Enables Claude LLM phrasing
DATABASE_URL=postgresql://...           # Switches from SQLite to Postgres

# frontend/next.config.mjs (via process.env)
API_BASE=http://localhost:5055          # Default Flask base URL
```

---

## 13. Validation

Run `python stocksense/validate.py` for the 20-rule data reconciliation check. All rules must pass before the app is considered valid.

---

## 14. Files to Ignore

- `node_modules/`, `backend/venv/` — standard ignores
- `stocksense/` — static prototypes and scripts from earlier phase, superseded by the live Next.js + Flask app

---

<!-- Last updated: 2026-06-04 -->
