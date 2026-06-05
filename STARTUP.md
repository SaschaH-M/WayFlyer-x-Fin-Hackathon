# Startup Guide

## Prerequisites (one-time setup)

### Node 20 (required — Node 26 breaks Next.js 14)
```
brew install node@20
```

### Python venv for backend
```
/opt/homebrew/bin/python3 -m venv /tmp/hackathon-venv
/tmp/hackathon-venv/bin/pip install -r backend/requirements.txt
```

---

## Start Backend (Flask — port 5055)

```bash
cd backend
PYTHONUNBUFFERED=1 /tmp/hackathon-venv/bin/python -u app.py
```

Wait for: `Running on http://127.0.0.1:5055`

---

## Start Frontend (Next.js — port 3010)

```bash
cd frontend
PATH="/opt/homebrew/opt/node@20/bin:$PATH" npm run dev
```

Wait for: `✓ Ready — http://localhost:3010`

---

## Open App

http://localhost:3010

---

## Kill Everything

```bash
pkill -f "next dev"; pkill -f "app.py"
```

---

## Notes

- **pandas 2.3.x hangs** on Python 3.10 — `requirements.txt` pins `pandas<2.3`
- Backend venv lives at `/tmp/hackathon-venv` — recreate if machine reboots (see Prerequisites)
- Backend uses port **5055**, frontend proxies `/api/*` to it automatically
