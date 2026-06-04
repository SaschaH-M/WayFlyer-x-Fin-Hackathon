# Pretty Fly — Working Capital OS · run + demo

Full-stack, **real** app. Flask API (live compute over a database) + Next.js operator console.
Not a static mock — every number is computed from the 21-file dataset on each request.

## Run (two terminals)

```bash
# 1 — backend API  (http://localhost:5055)
cd backend
python3.10 -m venv venv && ./venv/bin/pip install -r requirements.txt   # first time only
./run.sh

# 2 — frontend console  (http://localhost:3010)
cd frontend
npm install        # first time only
npm run dev
```

Open **http://localhost:3010**.

## Database

- **Default: SQLite** — zero config. `run.sh` seeds `backend/prettyfly.db` from `data/*.csv` automatically.
- **Postgres (optional upgrade):** install, then
  ```bash
  createdb prettyfly
  cd backend
  DATABASE_URL=postgresql://localhost/prettyfly ./venv/bin/python load_data.py
  DATABASE_URL=postgresql://localhost/prettyfly ./venv/bin/python app.py
  ```
  The app detects `DATABASE_URL` and switches automatically. Nothing else changes.

## WC Agent (LLM)

Works **fully offline** by default — a grounded retrieval engine that answers from live data and
cites real SKUs / £ / dates. To add natural-language phrasing via Claude, drop a key in `backend/.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

The agent never fails the demo: if the key is missing or the call errors, it falls back to the
grounded answer.

---

## Demo narrative (3 min — or hit ▶ Play 3-min demo, bottom-right)

The **Story Mode** button auto-plays this, navigating pages with plain-language captions. Manual order:

1. **Dashboard** — "Right products, wrong quantities." £205k trapped, £124k/mo bled, worst day −£274k.
2. **Cash Radar** — −£274k crisis called **20 days early** from named POs (Porto Knit £103k, Iberia £34k,
   Milano £26k). Three remedies; Remedy B drills into the exact overstock SKUs. Now with a "how the
   projection works" panel — nothing hidden.
3. **StockSense** — 645 SKUs scored 0-100. **Tap any card** → it shows *why* (urgency + demand + trend bars).
4. **Marketing** — the new headline. They burn **£32k on a 1.52× campaign** (below the 1.56× break-even) while
   **TikTok prints £324k for free**. Move the budget → **+£101k**. Then the ✦ magic: ad demand for Tees ▲6.6%
   while Tees are **out of stock** → the system **auto-flags a 3,352-unit reorder**. Marketing and inventory, talking.
5. **Backtest Proof** — trained on months 1-12, replayed the **real** 13-24: **≈£764k** better off. The
   **actual-vs-with-StockSense revenue chart** (ECharts, exact datapoints) shows the lift, with a visible method.
6. **WC Agent** — ask anything ("where am I wasting ad spend?"); every answer cites real SKU/£/date. Uses
   Claude when `ANTHROPIC_API_KEY` is set, grounded-offline otherwise.

**The line:** *"It found the cash crisis, the dead stock, AND the ad waste — then proved, against what actually
happened, that it'd have made Pretty Fly ~£764,000 better off. And a 5-year-old can drive it."*

See `FEATURES.md` for the full data-driven feature backlog (sizing-fit predictor, support auto-resolve, P&L…).

## Judging fit

- **Execution / does it work** — live full-stack, real DB, all endpoints verified, no mock data.
- **Business value** — quantified £764k proven impact + a tunable cash engine an operator would use daily.
- **Demo quality** — one polished console, a specific finding (the −£274k crisis), a working interface.
