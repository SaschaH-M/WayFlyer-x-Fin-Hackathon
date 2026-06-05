"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { gbp } from "@/lib/format";
import IsoOffice from "@/components/IsoOffice";

export default function HQ() {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState("");
  const [view, setView] = useState<"floor" | "grid">("floor");
  const router = useRouter();
  useEffect(() => { api.hq().then(setD).catch((e) => setErr(String(e))); }, []);

  if (err) return <div className="loading">Backend not reachable on :5055 — run <code>backend/run.sh</code>.<br />{err}</div>;
  if (!d) return <div className="loading">Waking up your AI workforce…</div>;

  const c = d.ceo_summary;
  return (
    <>
      <div className="hq-hero">
        <div className="eyebrow">Pretty Fly · Working Capital OS</div>
        <h1>You're the CEO. This is your AI staff.</h1>
        <p className="tag">{d.tagline}</p>
        <div className="ceo-strip">
          <M k="Trapped cash" v={gbp(c.trapped_cash)} cls="rd" />
          <M k="Lost / month" v={gbp(c.lost_monthly)} cls="am" />
          <M k="Worst cash day" v={gbp(c.nadir)} cls="rd" />
          <M k="Ad spend leaking" v={gbp(c.ad_leak)} cls="am" />
          <M k="Proven impact" v={gbp(c.proven_impact)} cls="gr" />
          <M k="Net margin" v={`${c.net_margin_pct}%`} cls="bl" />
        </div>
      </div>

      {/* Today's priorities */}
      <div className="card" style={{ marginBottom: 22, borderColor: "rgba(10,132,255,.3)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div className="sec-title" style={{ marginBottom: 6 }}>Today's priorities · {c.open_actions} actions worth {gbp(c.total_action_value)}</div>
            <div style={{ fontSize: 13, color: "var(--t2)" }}>Your staff drafted {c.open_actions} moves. Review and approve them in one swipe.</div>
          </div>
          <Link href="/inbox" className="btn primary" style={{ fontSize: 14 }}>Open Action Inbox →</Link>
        </div>
        <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
          {d.actions.slice(0, 3).map((a: any) => (
            <Link key={a.id} href="/inbox" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
              background: "rgba(255,255,255,.025)", border: "1px solid var(--b)", borderRadius: 12 }}>
              <span className={`badge ${a.severity === "high" ? "reorder" : "watch"}`}>{a.agent}</span>
              <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1 }}>{a.title}</span>
              <span style={{ fontSize: 13, color: "var(--gr)", fontWeight: 700 }}>{a.impact_gbp > 0 ? "+" + gbp(a.impact_gbp) : "—"}</span>
            </Link>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div className="sec-title" style={{ margin: 0 }}>Your office · {d.agents.length} AI agents on the floor</div>
        <div className="view-toggle">
          <button className={`chip ${view === "floor" ? "active" : ""}`} onClick={() => setView("floor")}>🏢 Floor</button>
          <button className={`chip ${view === "grid" ? "active" : ""}`} onClick={() => setView("grid")}>▦ Grid</button>
        </div>
      </div>

      {view === "floor" ? (
        <IsoOffice agents={d.agents} onPick={(r: string) => router.push(r)} />
      ) : (
        <div className="agent-grid">
          {d.agents.map((a: any) => (
            <div key={a.id} className="agent-tile" onClick={() => router.push(a.route)}>
              <div className={`stat-dot ${a.status}`}><span className="d" />{a.status}</div>
              <div className="agent-av">{a.icon}</div>
              <div className="nm">{a.name}</div>
              <div className="rl">{a.role}</div>
              <div className="mt">{a.metric}</div>
              <div className="hd">{a.headline}</div>
              {a.pending > 0
                ? <div className="pending-pill">⚡ {a.pending} action{a.pending > 1 ? "s" : ""} waiting</div>
                : <div className="pending-pill" style={{ color: "var(--t3)", background: "rgba(255,255,255,.03)", borderColor: "var(--b)" }}>✓ all clear</div>}
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: 12, color: "var(--t3)", marginTop: 22, lineHeight: 1.6 }}>
        Every agent reads the same reconciled dataset and surfaces only what's backed by it. Click any agent to see its full
        workspace, or open the Action Inbox to approve their recommendations. They also speak MCP — wire them into Claude Desktop
        and run the business from chat.
      </p>
    </>
  );
}

function M({ k, v, cls }: any) {
  return (<div className="m"><div className="k">{k}</div><div className="v" style={{ color: `var(--${cls})` }}>{v}</div></div>);
}
