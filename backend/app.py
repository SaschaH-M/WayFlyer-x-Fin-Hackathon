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
from compute import stocksense, cashradar, simulator, cashengine, marketing, departments, hq
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


@app.get("/api/cashengine/custom")
def cashengine_custom_ep():
    """Live slider-driven what-if: ?discount=&sell_through=&reorder_share= (0–1)."""
    def f(name, default):
        try:
            return float(request.args.get(name, default))
        except (TypeError, ValueError):
            return default
    return jsonify(cashengine.compute_custom(
        f("discount", 0.30), f("sell_through", 0.70), f("reorder_share", 0.80)))


@app.get("/api/marketing")
def marketing_ep():
    return jsonify(marketing.compute())


@app.get("/api/hq")
def hq_ep():
    return jsonify(hq.compute())


_decisions: dict[str, dict] = {}

@app.get("/api/actions")
def actions_ep():
    all_ = hq.compute()["actions"]
    open_ = [a for a in all_ if a["id"] not in _decisions]
    return jsonify({"actions": open_})

@app.post("/api/actions/decide")
def actions_decide_ep():
    body = request.get_json(force=True, silent=True) or {}
    aid = body.get("id", "")
    approved = body.get("approved", False)
    if not aid:
        return jsonify({"ok": False, "error": "missing id"}), 400
    for a in hq.compute()["actions"]:
        if a["id"] == aid:
            _decisions[aid] = {"action": a, "approved": approved}
            return jsonify({"ok": True})
    return jsonify({"ok": False, "error": "action not found"}), 404

@app.get("/api/actions/history")
def actions_history_ep():
    items = []
    for aid, d in _decisions.items():
        items.append({"id": aid, "action": d["action"], "approved": d["approved"]})
    items.sort(key=lambda i: list(_decisions.keys()).index(i["id"]), reverse=True)
    return jsonify({"history": items})

@app.post("/api/actions/revert")
def actions_revert_ep():
    body = request.get_json(force=True, silent=True) or {}
    aid = body.get("id", "")
    if not aid:
        return jsonify({"ok": False, "error": "missing id"}), 400
    if aid in _decisions:
        del _decisions[aid]
        return jsonify({"ok": True})
    return jsonify({"ok": False, "error": "not found"}), 404


@app.get("/api/pnl")
def pnl_ep():
    return jsonify(departments.pnl())


@app.get("/api/sizing")
def sizing_ep():
    return jsonify(departments.sizing())


@app.get("/api/customers")
def customers_ep():
    return jsonify(departments.customers())


@app.get("/api/suppliers")
def suppliers_ep():
    return jsonify(departments.suppliers())


@app.get("/api/support")
def support_ep():
    return jsonify(departments.support())


@app.get("/api/anomaly")
def anomaly_ep():
    return jsonify(departments.anomaly())


@app.get("/api/forecast")
def forecast_ep():
    return jsonify(departments.forecast())


@app.post("/api/agent")
def agent_ep():
    body = request.get_json(force=True, silent=True) or {}
    q = body.get("question", "")
    use_llm = body.get("use_llm", True)
    return jsonify(agent.answer(q, use_llm=use_llm))


@app.post("/api/agent-chat")
def agent_chat_ep():
    """Chat with an AI agent using the server-side Anthropic key."""
    import anthropic as _anthropic
    body = request.get_json(force=True, silent=True) or {}
    messages = body.get("messages", [])
    system_prompt = body.get("system", "")
    if not messages:
        return jsonify({"error": "missing messages"}), 400
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return jsonify({"error": "ANTHROPIC_API_KEY not configured on server"}), 503
    # Strip any system messages from the array (Claude uses the system param instead)
    chat_msgs = [m for m in messages if m.get("role") in ("user", "assistant")]
    try:
        client = _anthropic.Anthropic(api_key=api_key)
        resp = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=system_prompt or "You are a helpful AI agent for Pretty Fly, a London streetwear brand.",
            messages=chat_msgs,
        )
        content = resp.content[0].text
        return jsonify({"content": content})
    except _anthropic.APIError as e:
        return jsonify({"error": f"Claude API error: {e}"}), 502
    except Exception as e:
        return jsonify({"error": str(e)}), 502


def warm():
    """Pre-compute the heavy caches so first requests are instant."""
    print("Warming caches...", flush=True)
    stocksense.compute(); cashradar.compute(); simulator.compute()
    cashengine.all_scenarios(); marketing.compute(); hq.compute()
    print("Caches warm.", flush=True)


if __name__ == "__main__":
    warm()
    port = int(os.environ.get("PORT", 5055))
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
