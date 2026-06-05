#!/usr/bin/env bash
# Start the Flask API on :5055. Loads data into the DB first if needed.
set -e
cd "$(dirname "$0")"

PY=./venv/bin/python
[ -x "$PY" ] || { echo "No venv. Run: python3.10 -m venv venv && ./venv/bin/pip install -r requirements.txt"; exit 1; }

# Load data if the DB is empty / missing (SQLite). Postgres: set DATABASE_URL first.
if [ -n "$DATABASE_URL" ]; then
  echo "Using Postgres: $DATABASE_URL"
  $PY load_data.py
elif [ ! -f prettyfly.db ]; then
  echo "Seeding SQLite…"
  $PY load_data.py
fi

exec $PY app.py
