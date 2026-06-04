"""
app.py — Flask API for the Pretty Fly operator console.

Endpoints
  GET  /api/health
  GET  /api/summary              dashboard rollup
  GET  /api/stocksense           645 scored variants + summary
  GET  /api/cashradar            full projection + remedy bundle
  GET  /api/simulate?cutoff=     backtest proof point
  GET  /api/cashengine?scenario= one scenario
  GET  /api/cashengine/all       all three scenarios
  POST /api/agent {question,use_llm}   grounded WC Agent
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from flask import Flask, jsonify, request
from flask_cors import CORS

from db import backend_name
from compute import stocksense, cashradar, simulator, cashengine
import agent

app = Flask(__name__)
CORS(app)


@app.get("/api/health")
def health():
    return jsonify({"ok": True, "db": backend_name(),
                    "llm": bool(os.environ.get("ANTHROPIC_API_KEY"))})


@app.get("/api/summary")
def summary():
    ss = stocksense.compute()["summary"]
    cr = cashradar.compute()["meta"]
    eng = cashengine.compute("moderate")
    sim = simulator.compute()["headline"]
    return jsonify({"stocksense": ss, "cashradar": cr, "cashengine": eng, "backtest": sim})


@app.get("/api/stocksense")
def stocksense_ep():
    return jsonify(stocksense.compute())


@app.get("/api/cashradar")
def cashradar_ep():
    return jsonify(cashradar.compute())


@app.get("/api/simulate")
def simulate_ep():
    cutoff = request.args.get("cutoff")
    return jsonify(simulator.compute(cutoff))


@app.get("/api/cashengine")
def cashengine_ep():
    return jsonify(cashengine.compute(request.args.get("scenario", "moderate")))


@app.get("/api/cashengine/all")
def cashengine_all_ep():
    return jsonify(cashengine.all_scenarios())


@app.post("/api/agent")
def agent_ep():
    body = request.get_json(force=True, silent=True) or {}
    q = body.get("question", "")
    use_llm = body.get("use_llm", True)
    return jsonify(agent.answer(q, use_llm=use_llm))


def warm():
    """Pre-compute the heavy caches so first requests are instant."""
    print("Warming caches...", flush=True)
    stocksense.compute(); cashradar.compute(); simulator.compute()
    cashengine.all_scenarios()
    print("Caches warm.", flush=True)


if __name__ == "__main__":
    warm()
    port = int(os.environ.get("PORT", 5055))
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
