"use client";
import { useEffect, useState } from "react";
import EChart, { axisBase, catAxis, valAxis, C } from "@/components/EChart";
import { Explainer, HowItWorks } from "@/components/Explain";
import { api } from "@/lib/api";
import { num } from "@/lib/format";

export default function Support() {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<Record<string, boolean>>({});
  useEffect(() => { api.support().then(setD).catch((e) => setErr(String(e))); }, []);
  if (err) return <div className="loading">Backend unreachable on :5055.</div>;
  if (!d) return <div className="loading">Triaging the support queue…</div>;

  const cats = Object.entries(d.by_category).sort((a: any, b: any) => b[1] - a[1]);
  const catOpt = { ...axisBase, grid: { ...axisBase.grid, bottom: 80 },
    tooltip: { ...axisBase.tooltip, formatter: (p: any[]) => `${p[0].axisValue}: ${p[0].data} tickets` },
    xAxis: { ...catAxis(cats.map((c) => c[0])), axisLabel: { color: C.t3, fontSize: 9, rotate: 32, interval: 0 } }, yAxis: valAxis(),
    series: [{ type: "bar", barWidth: "55%", itemStyle: { color: C.bl, borderRadius: [4, 4, 0, 0] }, data: cats.map((c) => c[1]) }] };
  const cmpOpt = { ...axisBase, tooltip: { ...axisBase.tooltip, formatter: (p: any[]) => `${p[0].axisValue}: ${p[0].data}%` },
    xAxis: { ...catAxis(["Bot today", "Bot potential"]), boundaryGap: true }, yAxis: valAxis((v: number) => v + "%"),
    series: [{ type: "bar", barWidth: "45%", itemStyle: { borderRadius: [5, 5, 0, 0] },
      data: [{ value: d.current_bot_pct, itemStyle: { color: C.am } }, { value: d.potential_bot_pct, itemStyle: { color: C.gr } }] }] };

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Bo · Customer Support</div>
        <h1>A support bot that actually closes tickets.</h1>
        <p>Most tickets are tied to an order — so a bot with order and inventory data can resolve them end-to-end, leaving your humans for the hard ones.</p>
      </div>
      <Explainer><b>{d.linked_pct}%</b> of tickets are linked to an order. A bot could handle <b>{d.potential_bot_pct}%</b> end-to-end vs just <b>{d.current_bot_pct}%</b> today — freeing ~{num(d.hours_saved)} agent-hours per period.</Explainer>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Kpi lbl="Total tickets" val={num(d.bot + d.human)} cls="" sub={`${num(d.bot)} bot · ${num(d.human)} human`} />
        <Kpi lbl="Order-linked" val={`${d.linked_pct}%`} cls="bl" sub="resolvable with order data" />
        <Kpi lbl="Bot today" val={`${d.current_bot_pct}%`} cls="am" sub="auto-resolved now" />
        <Kpi lbl="Bot potential" val={`${d.potential_bot_pct}%`} cls="gr" sub="with full data access" />
      </div>

      <div className="grid cols-2">
        <div className="card"><div className="sec-title">Tickets by category</div><EChart option={catOpt} height={280} /></div>
        <div className="card"><div className="sec-title">Automation headroom</div><EChart option={cmpOpt} height={280} />
          <div style={{ background: "rgba(48,209,88,.1)", border: "1px solid rgba(48,209,88,.25)", borderRadius: 12, padding: "12px 14px", marginTop: 12, fontSize: 13, color: "var(--t2)" }}>
            ⏱ ~<b style={{ color: "var(--gr)" }}>{num(d.hours_saved)} agent-hours</b> freed per period if the bot takes order-status, returns and restock tickets.</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="sec-title">Recommended actions</div>
        {d.actions.map((a: any) => (
          <div key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", padding: "10px 0" }}>
            <div><div style={{ fontWeight: 700, fontSize: 14 }}>{a.title}</div>
              <div style={{ fontSize: 12.5, color: "var(--t2)", margin: "4px 0" }}>{a.detail}</div>
              <span className="mono" style={{ color: "var(--gr)" }}>📊 {a.why}</span></div>
            <button className={`btn ${done[a.id] ? "" : "primary"}`} onClick={() => setDone((s) => ({ ...s, [a.id]: true }))}>{done[a.id] ? "✓ Queued" : a.verb}</button>
          </div>
        ))}
      </div>

      <HowItWorks title="How the triage works" steps={[
        { title: "Order linkage", detail: "Share of tickets with a related_order_id — the bot can pull live order + inventory state to answer." },
        { title: "Automatable categories", detail: "order_status, returns/exchanges, drop/restock and discount-code queries are mechanically resolvable." },
        { title: "Hours saved", detail: "(automatable − already-bot) × average resolution minutes — the human time freed for complex cases." },
      ]} />
    </>
  );
}
function Kpi({ lbl, val, cls, sub }: any) { return (<div className="card kpi tight"><div className="lbl">{lbl}</div><div className={`val ${cls} tnum`}>{val}</div><div className="sub">{sub}</div></div>); }
