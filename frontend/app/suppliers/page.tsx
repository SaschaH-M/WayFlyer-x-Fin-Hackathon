"use client";
import { useEffect, useState } from "react";
import EChart, { axisBase, catAxis, valAxis, C } from "@/components/EChart";
import { Explainer, HowItWorks, InfoTip } from "@/components/Explain";
import { api } from "@/lib/api";
import { gbp, num } from "@/lib/format";

export default function Suppliers() {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState("");
  const [queued, setQueued] = useState<Record<string, boolean>>({});
  useEffect(() => { api.suppliers().then(setD).catch((e) => setErr(String(e))); }, []);

  if (err) return <div className="loading">Backend unreachable on :5055.<br />{err}</div>;
  if (!d) return <div className="loading">Scoring your supply chain…</div>;

  const sups = (d.suppliers || []) as any[];
  const supplierCount = sups.length;
  const worstLead = sups.reduce((m, s) => Math.max(m, s.lead_time_days || 0), 0);
  const totalStockouts = sups.reduce((s, x) => s + (x.stockout_skus || 0), 0);
  const avgOnTime = supplierCount ? Math.round(sups.reduce((s, x) => s + (x.on_time_pct || 0), 0) / supplierCount) : 0;

  // Chart 1 — horizontal bar of lead times, colored by severity.
  const leadSorted = [...sups].sort((a, b) => a.lead_time_days - b.lead_time_days);
  const leadColor = (v: number) => (v > 60 ? C.rd : v > 40 ? C.am : C.gr);
  const leadOption = {
    ...axisBase, grid: { ...axisBase.grid, left: 130 },
    tooltip: { ...axisBase.tooltip, trigger: "item",
      formatter: (p: any) => { const s = leadSorted[p.dataIndex]; return `<b>${s.supplier}</b> (${s.country})<br/>Lead time: ${s.lead_time_days} days<br/>On-time: ${s.on_time_pct}%`; } },
    xAxis: valAxis((v: number) => v + "d"),
    yAxis: { ...catAxis(leadSorted.map((s) => s.supplier)), boundaryGap: true },
    series: [{ type: "bar", barWidth: 16, itemStyle: { borderRadius: [0, 5, 5, 0] },
      data: leadSorted.map((s) => ({ value: s.lead_time_days, itemStyle: { color: leadColor(s.lead_time_days) } })) }],
  };

  // Chart 2 — stockout SKUs by supplier.
  const stkSorted = [...sups].sort((a, b) => b.stockout_skus - a.stockout_skus);
  const stockoutOption = {
    ...axisBase, grid: { ...axisBase.grid, bottom: 96 },
    tooltip: { ...axisBase.tooltip, trigger: "item",
      formatter: (p: any) => { const s = stkSorted[p.dataIndex]; return `<b>${s.supplier}</b><br/>Stockout SKUs: ${s.stockout_skus}<br/>of ${s.skus} SKUs`; } },
    xAxis: { ...catAxis(stkSorted.map((s) => s.supplier)), axisLabel: { color: C.t3, fontSize: 9, rotate: 38, interval: 0 } },
    yAxis: valAxis((v: number) => String(v)),
    series: [{ type: "bar", barWidth: "55%", itemStyle: { borderRadius: [4, 4, 0, 0], color: C.rd },
      data: stkSorted.map((s) => s.stockout_skus) }],
  };

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Supplier Scorecard</div>
        <h1>Your supply chain, scored.</h1>
        <p>{d.headline}</p>
      </div>

      <Explainer tone="am">
        Long lead times and late deliveries turn into stockouts — see which supplier is the bottleneck and order earlier.
      </Explainer>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Kpi lbl="Suppliers" val={num(supplierCount)} cls="" sub="sourcing your catalogue" />
        <Kpi lbl="Worst lead time" val={`${worstLead}d`} cls="rd" sub="slowest to deliver" />
        <Kpi lbl="Stockout SKUs" val={num(totalStockouts)} cls="rd" sub="empty, traced to a supplier" />
        <Kpi lbl="Avg on-time" val={`${avgOnTime}%`} cls={avgOnTime >= 90 ? "gr" : avgOnTime >= 75 ? "am" : "rd"} sub="deliveries on schedule" />
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="sec-title">Lead time by supplier <InfoTip text="Days from placing a purchase order to stock landing. Over 60 days (red) means you must reorder weeks ahead to avoid running dry." /></div>
          <EChart option={leadOption} height={300} />
        </div>
        <div className="card">
          <div className="sec-title">Stockout SKUs by supplier</div>
          <EChart option={stockoutOption} height={300} />
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="sec-title">Every supplier, scored</div>
        <table className="tbl">
          <thead><tr>
            <th>Supplier</th><th>Country</th>
            <th style={{ textAlign: "right" }}>Lead time</th>
            <th style={{ textAlign: "right" }}>On-time</th>
            <th style={{ textAlign: "right" }}>SKUs</th>
            <th style={{ textAlign: "right" }}>Stockout SKUs</th>
          </tr></thead>
          <tbody>
            {[...sups].sort((a, b) => b.lead_time_days - a.lead_time_days).map((s) => (
              <tr key={s.supplier}>
                <td><b>{s.supplier}</b></td>
                <td>{s.country}</td>
                <td style={{ textAlign: "right", color: leadColor(s.lead_time_days) === C.rd ? "var(--rd)" : leadColor(s.lead_time_days) === C.am ? "var(--am)" : "var(--gr)" }}>{s.lead_time_days}d</td>
                <td style={{ textAlign: "right" }}>{s.on_time_pct}%</td>
                <td style={{ textAlign: "right" }}>{num(s.skus)}</td>
                <td style={{ textAlign: "right", color: s.stockout_skus > 0 ? "var(--rd)" : "var(--t2)" }}><b>{num(s.stockout_skus)}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="sec-title">Recommended actions</div>
        <div className="grid cols-2">
          {(d.actions || []).map((a: any) => (
            <div key={a.id} className="card tight" style={{ background: "rgba(255,255,255,.02)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.3px" }}>{a.title}</div>
                {a.impact_gbp > 0 && <span className="badge reorder">+{gbp(a.impact_gbp)}</span>}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.5, marginTop: 8 }}>{a.detail}</div>
              {a.why && <div className="mono" style={{ fontSize: 11.5, color: "var(--am)", marginTop: 10 }}>📊 {a.why}</div>}
              <button
                className="btn primary"
                style={{ marginTop: 14 }}
                disabled={!!queued[a.id]}
                onClick={() => setQueued((q) => ({ ...q, [a.id]: true }))}
              >
                {queued[a.id] ? "✓ Queued" : a.verb}
              </button>
            </div>
          ))}
        </div>
      </div>

      <HowItWorks title="How the supplier scorecard works" steps={[
        { title: "Lead time", detail: "Read straight from the suppliers table — the stated days from purchase order to stock landing in your warehouse." },
        { title: "On-time %", detail: "For each delivery we compare the actual arrival date against the expected date; the share that landed on or before schedule is the on-time rate." },
        { title: "Stockout SKUs", detail: "The count of variants sourced from that supplier that StockSense currently flags as reorder — empty winners whose refill depends on this supplier's speed." },
      ]} />
    </>
  );
}

function Kpi({ lbl, val, cls, sub, subTip }: any) {
  return (<div className="card kpi tight"><div className="lbl">{lbl}{subTip && <InfoTip text={subTip} />}</div><div className={`val ${cls} tnum`}>{val}</div><div className="sub">{sub}</div></div>);
}
