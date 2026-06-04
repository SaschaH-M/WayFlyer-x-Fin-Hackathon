"use client";
import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import { baseOptions, COLORS } from "@/components/charts";
import { api } from "@/lib/api";
import { gbp, num, fmtMonth } from "@/lib/format";

export default function Simulator() {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api.simulate().then(setD).catch((e) => setErr(String(e))); }, []);

  if (err) return <div className="loading">Backend unreachable on :5055.<br />{err}</div>;
  if (!d) return <div className="loading">Running the backtest over months 13–24…</div>;

  const h = d.headline;
  const labels = d.series.map((p: any) => fmtMonth(p.month));
  const data = {
    labels,
    datasets: [
      { label: "Cumulative cash freed", data: d.series.map((p: any) => p.cum_cash_freed),
        borderColor: COLORS.gr, backgroundColor: "rgba(48,209,88,0.08)", borderWidth: 2.5, pointRadius: 0, tension: 0.2, fill: true },
      { label: "Cumulative revenue recovered", data: d.series.map((p: any) => p.cum_revenue_recovered),
        borderColor: COLORS.bl, backgroundColor: "rgba(10,132,255,0.06)", borderWidth: 2.5, pointRadius: 0, tension: 0.2, fill: true },
      { label: "Total impact", data: d.series.map((p: any) => p.cum_total),
        borderColor: COLORS.am, backgroundColor: "transparent", borderWidth: 2, pointRadius: 0, tension: 0.2, borderDash: [5, 4] },
    ],
  };
  const opts = { ...baseOptions, plugins: { ...baseOptions.plugins, tooltip: { ...baseOptions.plugins.tooltip,
    callbacks: { label: (c: any) => `${c.dataset.label}: ${gbp(c.parsed.y)}` } } },
    scales: { ...baseOptions.scales, y: { ...baseOptions.scales.y, ticks: { ...baseOptions.scales.y.ticks, callback: (v: any) => gbp(v) } } } };

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">The proof point</div>
        <h1>If Pretty Fly had used this tool, it would be {gbp(h.total_impact_gbp)} better off.</h1>
        <p>We fed the tool only months 1–12 ({d.cutoff} cutoff), generated recommendations, then replayed the
          <b> real</b> months 13–24 to measure what those recommendations were actually worth. No peeking — outcomes are
          scored against what truly happened.</p>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Kpi lbl="Total impact" val={gbp(h.total_impact_gbp)} cls="gr" sub="cash freed + revenue recovered" />
        <Kpi lbl="Cash freed" val={gbp(h.cash_freed_gbp)} cls="gr" sub={`${h.markdown_flagged} overstock SKUs cleared`} />
        <Kpi lbl="Revenue recovered" val={gbp(h.revenue_recovered_gbp)} cls="bl" sub={`${h.stockouts_avoided} stockouts avoided`} />
        <Kpi lbl="Prediction precision" val={`${h.reorder_precision_pct}%`} cls="am" sub={`of ${h.reorder_flagged} reorder flags hit`} />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="sec-title">Cumulative impact across the test window</div>
        <div style={{ height: 320 }}><Line data={data} options={opts} /></div>
        <div style={{ display: "flex", gap: 20, fontSize: 11.5, color: "var(--t2)", marginTop: 12 }}>
          <Legend c={COLORS.gr} t="Cash freed" /><Legend c={COLORS.bl} t="Revenue recovered" /><Legend c={COLORS.am} t="Total impact" />
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="sec-title">Top recovered stockouts (cited)</div>
          <table className="tbl">
            <thead><tr><th>SKU</th><th style={{ textAlign: "right" }}>Wks OOS</th><th style={{ textAlign: "right" }}>Recovered</th></tr></thead>
            <tbody>{d.top_reorder.slice(0, 8).map((v: any) => (
              <tr key={v.variant_id}><td><b>{v.product_name}</b><br /><span className="mono">{v.sku}</span></td>
                <td style={{ textAlign: "right" }}>{v.weeks_out_of_stock}</td>
                <td style={{ textAlign: "right" }}><b style={{ color: "var(--gr)" }}>{gbp(v.revenue_recovered)}</b></td></tr>))}</tbody>
          </table>
        </div>
        <div className="card">
          <div className="sec-title">Top freed overstock (cited)</div>
          <table className="tbl">
            <thead><tr><th>SKU</th><th style={{ textAlign: "right" }}>Cover</th><th style={{ textAlign: "right" }}>Freed</th></tr></thead>
            <tbody>{d.top_markdown.slice(0, 8).map((v: any) => (
              <tr key={v.variant_id}><td><b>{v.product_name}</b><br /><span className="mono">{v.sku}</span></td>
                <td style={{ textAlign: "right" }}>{v.months_cover === 999 ? "∞" : v.months_cover + "m"}</td>
                <td style={{ textAlign: "right" }}><b style={{ color: "var(--gr)" }}>{gbp(v.cash_freed)}</b></td></tr>))}</tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="sec-title">Method & assumptions</div>
        <p style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.6 }}>{d.assumptions.note} Markdown:
          {" "}{Math.round(d.assumptions.markdown_discount * 100)}% off at {Math.round(d.assumptions.sell_through * 100)}% sell-through ·
          velocity from a {d.assumptions.velocity_window_days}-day trailing window · recovered revenue capped at a
          {" "}{Math.round(d.assumptions.capture_rate * 100)}% capture rate.</p>
      </div>
    </>
  );
}

function Kpi({ lbl, val, cls, sub }: any) {
  return (<div className="card kpi tight"><div className="lbl">{lbl}</div><div className={`val ${cls} tnum`}>{val}</div><div className="sub">{sub}</div></div>);
}
function Legend({ c, t }: any) {
  return (<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 18, height: 3, background: c, display: "inline-block", borderRadius: 2 }} />{t}</span>);
}
