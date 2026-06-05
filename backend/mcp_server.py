"""
mcp_server.py — Model Context Protocol server for Pretty Fly's Working Capital OS.

Exposes the company's AI workforce as MCP tools, so any MCP client (Claude
Desktop, IDEs, agents) can query live cash, inventory, marketing, P&L and the
action feed — and the operator can drive the business from their assistant.

Run:  ./venv/bin/python mcp_server.py        (stdio transport)

Claude Desktop config (claude_desktop_config.json):
{
  "mcpServers": {
    "pretty-fly": {
      "command": "/abs/path/backend/venv/bin/python",
      "args": ["/abs/path/backend/mcp_server.py"],
      "env": {"DATABASE_URL": "postgresql://localhost/prettyfly"}
    }
  }
}
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from mcp.server.fastmcp import FastMCP

from compute import stocksense, cashradar, marketing, cashengine, simulator, departments, hq
import agent as wc_agent

mcp = FastMCP("pretty-fly")


@mcp.tool()
def company_overview() -> dict:
    """CEO snapshot: trapped cash, lost revenue, cash nadir, ad leak, proven impact, open actions."""
    return hq.compute()["ceo_summary"]


@mcp.tool()
def list_actions(limit: int = 15) -> list:
    """The prioritised action feed across every department (what to approve next)."""
    return hq.compute()["actions"][:limit]


@mcp.tool()
def cash_position() -> dict:
    """Cash Radar meta: worst day, forewarning, projected nadir, and the top remedy."""
    cr = cashradar.compute()
    return {"meta": cr["meta"], "top_remedy": cr["demo_anchors"][0]["remedies"]["B"]}


@mcp.tool()
def reorders(limit: int = 10) -> list:
    """SKUs to reorder first, with size-aware split, cost and reasoning."""
    ss = stocksense.compute()["variants"]
    out = []
    for v in sorted([x for x in ss if x["status"] == "reorder"],
                    key=lambda x: (-(x["inventory"] <= 0), -x["stocksense_score"]))[:limit]:
        try:
            qty = int(v["recommendation"].split()[1])
        except Exception:
            qty = 0
        out.append({"sku": v["sku"], "product": v["product_name"], "units": qty,
                    "cost_gbp": v["recommendation_cost"], "size_split": departments.size_split(qty), "why": v["why"]})
    return out


@mcp.tool()
def marketing_roi() -> dict:
    """Channel/campaign ROAS, wasted spend, reallocation, and the ads→inventory signals."""
    mk = marketing.compute()
    return {"meta": mk["meta"], "waste": mk["waste"], "winners": mk["winners"][:3],
            "reallocation": mk["reallocation"], "launch_signals": mk["launch_signals"][:3]}


@mcp.tool()
def profit_and_loss() -> dict:
    """True monthly P&L (revenue, COGS at sale, opex, refunds, net margin)."""
    return departments.pnl()


@mcp.tool()
def backtest_proof() -> dict:
    """Proof the tool works: trained on months 1-12, scored on real 13-24."""
    return simulator.compute()["headline"]


@mcp.tool()
def ask(question: str) -> str:
    """Ask the WC Agent any natural-language question about the business; returns a grounded, cited answer."""
    return wc_agent.answer(question, use_llm=False)["answer"]


if __name__ == "__main__":
    mcp.run()
