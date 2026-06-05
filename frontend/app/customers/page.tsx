"use client";
import { useEffect, useState } from "react";
import EChart, { axisBase, catAxis, valAxis, C } from "@/components/EChart";
import { Explainer, HowItWorks } from "@/components/Explain";
import { api } from "@/lib/api";
import { gbp, num } from "@/lib/format";

export default function Customers() {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<Record<string, boolean>>({});
  useEffect(() => { api.customers().then(setD).catch((e) => setErr(String(e))); }, []);
  if (err) return <div className="loading">Backend unreachable on :5055.</div>;
  if (!d || !d.channels.length) return <div className="loading">Crunching customer cohorts…</div>;

  const ch = d.channels;
  const best = ch[0];
  const totCust = ch.reduce((s: number, c: any) => s + c.customers, 0);
  const totRev = ch.reduce((s: number, c: any) => s + c.revenue, 0);

  const ltvOpt = { ...axisBase, grid: { ...axisBase.grid, left: 92 },
    tooltip: { ...axisBase.tooltip, formatter: (p: any[]) => `${p[0].axisValue}: ${gbp(p[0].data)} LTV` },
    xAxis: valAxis((v: number) => "£" + v), yAxis: { ...catAxis([...ch].reverse().map((c: any) => c.channel)), boundaryGap: true },
    series: [{ type: "bar", barWidth: 14, itemStyle: { borderRadius: [0, 5, 5, 0] },
      data: [...ch].reverse().map((c: any, i: number) => ({ value: c.ltv, itemStyle: { color: i === ch.length - 1 ? C.gr : C.t2 } })) }] };
  const cntOpt = { ...axisBase, grid: { ...axisBase.grid, left: 92 },
    tooltip: { ...axisBase.tooltip, formatter: (p: any[]) => `${p[0].axisValue}: ${num(p[0].data)} customers` },
    xAxis: valAxis((v: number) => num(v)), yAxis: { ...catAxis([...ch].reverse().map((c: any) => c.channel)), boundaryGap: true },
    series: [{ type: "bar", barWidth: 14, itemStyle: { color: C.bl, borderRadius: [0, 5, 5, 0] }, data: [...ch].reverse().map((c: any) => c.customers) }] };

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Cole · Growth & CRM</div>
        <h1>Not all customers are worth the same.</h1>
        <p>Lifetime value swings ~2× depending on where you acquired them. Spend more to win the valuable ones, less on the rest.</p>
      </div>
      <Explainer tone="gr"><b>{best.channel}</b> customers are worth <b>{gbp(best.ltv)}</b> each — your most valuable. Weight acquisition there.</Explainer>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Kpi lbl="Best channel" val={best.channel} cls="gr" sub={`${gbp(best.ltv)} LTV`} />
        <Kpi lbl="Customers" val={num(totCust)} cls="" sub={`${ch.length} channels`} />
        <Kpi lbl="Total revenue" val={gbp(totRev)} cls="bl" sub="lifetime" />
        <Kpi lbl="LTV spread" val={`${(best.ltv / ch[ch.length - 1].ltv).toFixed(1)}×`} cls="am" sub="best vs worst" />
      </div>

      <div className="grid cols-2">
        <div className="card"><div className="sec-title">Lifetime value by channel</div><EChart option={ltvOpt} height={280} /></div>
        <div className="card"><div className="sec-title">Customers by channel</div><EChart option={cntOpt} height={280} /></div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="sec-title">Channels</div>
        <table className="tbl"><thead><tr><th>Channel</th><th style={{ textAlign: "right" }}>Customers</th><th style={{ textAlign: "right" }}>Avg LTV</th><th style={{ textAlign: "right" }}>Revenue</th></tr></thead>
          <tbody>{ch.map((c: any) => (<tr key={c.channel}><td><b>{c.channel}</b></td><td style={{ textAlign: "right" }}>{num(c.customers)}</td>
            <td style={{ textAlign: "right", color: "var(--gr)" }}>{gbp(c.ltv)}</td><td style={{ textAlign: "right" }}>{gbp(c.revenue)}</td></tr>))}</tbody></table>
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

      <HowItWorks title="How LTV is computed" steps={[
        { title: "By acquisition source", detail: "Each customer's first-touch utm source, grouped (channels with ≥20 customers)." },
        { title: "Lifetime value", detail: "Mean total_spent per customer in that channel — what an average customer from there is worth." },
        { title: "Value vs scale", detail: "High-LTV channels are often small; the count chart shows where there's room to scale acquisition profitably." },
      ]} />
    </>
  );
}
function Kpi({ lbl, val, cls, sub }: any) { return (<div className="card kpi tight"><div className="lbl">{lbl}</div><div className={`val ${cls} tnum`} style={{ fontSize: 22 }}>{val}</div><div className="sub">{sub}</div></div>); }
