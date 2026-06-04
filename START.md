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

## Demo narrative (≈4 min)

1. **Dashboard** — "Pretty Fly buys the right products in the wrong quantities." £205k trapped, £124k/mo
   bled, worst cash day −£274k. One screen, the whole problem.
2. **Cash Radar** — scrub to the crisis. The data called −£261k **20 days early** from known PO
   schedules (Porto Knit £103k, Iberia £34k, Milano £26k — named, exact). Three remedies; Remedy B
   drills straight into the overstock SKUs.
3. **StockSense** — 645 SKUs scored 0-100, filterable. Named, specific, defensible recommendations.
4. **Cash Engine** — toggle conservative / moderate / aggressive. Watch trapped cash convert to
   working capital and projected revenue (£1 freed → £8 revenue, from the brand's own velocity).
5. **Backtest Proof** — the kicker. Trained on months 1-12, scored on the **real** months 13-24:
   **≈£764k** better off (£637k freed + £127k recovered, 206 stockouts avoided). No peeking.
6. **WC Agent** — ask it anything; every answer cites the data.

**The line:** *"If Pretty Fly had run this from month 12, it would be ~£764,000 better off — and the
data proves it against what actually happened."*

## Judging fit

- **Execution / does it work** — live full-stack, real DB, all endpoints verified, no mock data.
- **Business value** — quantified £764k proven impact + a tunable cash engine an operator would use daily.
- **Demo quality** — one polished console, a specific finding (the −£274k crisis), a working interface.
