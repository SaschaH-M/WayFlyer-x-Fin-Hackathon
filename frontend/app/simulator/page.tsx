"use client";
import { useEffect, useState } from "react";
import EChart, { axisBase, catAxis, valAxis, C } from "@/components/EChart";
import { Explainer, HowItWorks, InfoTip } from "@/components/Explain";
import { api } from "@/lib/api";
import { gbp, fmtMonth } from "@/lib/format";

export default function Simulator() {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api.simulate().then(setD).catch((e) => setErr(String(e))); }, []);

  if (err) return <div className="loading">Backend unreachable on :5055.<br />{err}</div>;
  if (!d) return <div className="loading">Running the backtest over months 13–24…</div>;

  const h = d.headline;
  const rs = d.revenue_series as any[];
  const rt = d.revenue_totals;
  const months = rs.map((p) => fmtMonth(p.month));

  // Actual vs with-tool revenue — analytical chart, exact datapoints on hover.
  const revenueOption = {
    ...axisBase,
    tooltip: {
      ...axisBase.tooltip,
      formatter: (ps: any[]) => {
        const m = ps[0].axisValue;
        const a = ps.find((p) => p.seriesName === "Actual revenue")?.data ?? 0;
        const w = ps.find((p) => p.seriesName === "With StockSense")?.data ?? 0;
        return `<b>${m}</b><br/>Actual: ${gbp(a)}<br/>With tool: ${gbp(w)}<br/><span style="color:${C.gr}">Uplift: +${gbp(w - a)}</span>`;
      },
    },
    legend: { ...axisBase.legend, data: ["Actual revenue", "With StockSense"] },
    xAxis: catAxis(months),
    yAxis: { ...valAxis((v: number) => "£" + (v / 1000).toFixed(0) + "k"), min: (x: any) => Math.floor(x.min * 0.95) },
    series: [
      { name: "Actual revenue", type: "line", data: rs.map((p) => p.actual_revenue), smooth: true,
        symbol: "circle", symbolSize: 6, lineStyle: { color: C.t2, width: 2 }, itemStyle: { color: C.t2 } },
      { name: "With StockSense", type: "line", data: rs.map((p) => p.with_tool_revenue), smooth: true,
        symbol: "circle", symbolSize: 6, lineStyle: { color: C.gr, width: 2.5 }, itemStyle: { color: C.gr },
        areaStyle: { color: "rgba(48,209,88,0.08)" } },
    ],
  };

  // Cumulative impact
  const cumOption = {
    ...axisBase,
    tooltip: { ...axisBase.tooltip, formatter: (ps: any[]) => `<b>${ps[0].axisValue}</b><br/>` + ps.map((p) => `${p.marker} ${p.seriesName}: ${gbp(p.data)}`).join("<br/>") },
    legend: { ...axisBase.legend, data: ["Cash freed", "Revenue recovered", "Total impact"] },
    xAxis: catAxis(d.series.map((p: any) => fmtMonth(p.month))),
    yAxis: valAxis((v: number) => "£" + (v / 1000).toFixed(0) + "k"),
    series: [
      { name: "Cash freed", type: "line", data: d.series.map((p: any) => p.cum_cash_freed), smooth: true, symbol: "none", lineStyle: { color: C.gr, width: 2.5 }, areaStyle: { color: "rgba(48,209,88,0.08)" } },
      { name: "Revenue recovered", type: "line", data: d.series.map((p: any) => p.cum_revenue_recovered), smooth: true, symbol: "none", lineStyle: { color: C.bl, width: 2.5 }, areaStyle: { color: "rgba(10,132,255,0.06)" } },
      { name: "Total impact", type: "line", data: d.series.map((p: any) => p.cum_total), smooth: true, symbol: "none", lineStyle: { color: C.am, width: 2, type: "dashed" } },
    ],
  };

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">The proof point</div>
        <h1>If Pretty Fly had used this tool, it would be {gbp(h.total_impact_gbp)} better off.</h1>
        <p>Trained on months 1–12 only ({d.cutoff} cutoff), then replayed against the <b>real</b> months 13–24 — actual sales, actual stockouts, actual leftover stock. No peeking.</p>
      </div>

      <Explainer tone="gr">
        We hid the last year from the tool, let it make calls, then fast-forwarded reality to grade them. The green line is what
        revenue <b>would</b> have been if it had refilled the best-sellers it flagged — <b>+{gbp(rt.uplift)}</b> over the year,
        on top of <b>{gbp(h.cash_freed_gbp)}</b> unlocked from dead stock.
      </Explainer>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Kpi lbl="Total impact" val={gbp(h.total_impact_gbp)} cls="gr" sub="cash freed + revenue recovered" />
        <Kpi lbl="Cash freed" val={gbp(h.cash_freed_gbp)} cls="gr" sub={`${h.markdown_flagged} overstock SKUs cleared`} />
        <Kpi lbl="Revenue recovered" val={gbp(h.revenue_recovered_gbp)} cls="bl" sub={`${h.stockouts_avoided} stockouts avoided`} />
        <Kpi lbl="Prediction precision" val={`${h.reorder_precision_pct}%`} cls="am" subTip="Of the SKUs the tool flagged to reorder, the share that genuinely ran out of stock in the test window. We only count recovered revenue on those — never overclaim." sub={`of ${h.reorder_flagged} reorder flags`} />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="sec-title">Actual revenue vs. revenue with StockSense <InfoTip text="Actual = what Pretty Fly really earned each month. With StockSense = actual plus the sales it lost to stockouts that the tool would have prevented (capped at an 80% capture rate)." /></div>
        <EChart option={revenueOption} height={320} />
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: "pointer", fontSize: 12, color: "var(--t3)", fontWeight: 600 }}>Show exact monthly datapoints</summary>
          <table className="tbl" style={{ marginTop: 10 }}>
            <thead><tr><th>Month</th><th style={{ textAlign: "right" }}>Actual</th><th style={{ textAlign: "right" }}>With tool</th><th style={{ textAlign: "right" }}>Uplift</th><th style={{ textAlign: "right" }}>%</th></tr></thead>
            <tbody>
              {rs.map((p) => (
                <tr key={p.month}>
                  <td><b>{fmtMonth(p.month)}</b></td>
                  <td style={{ textAlign: "right" }}>{gbp(p.actual_revenue)}</td>
                  <td style={{ textAlign: "right" }}>{gbp(p.with_tool_revenue)}</td>
                  <td style={{ textAlign: "right", color: "var(--gr)" }}>+{gbp(p.uplift)}</td>
                  <td style={{ textAlign: "right", color: "var(--gr)" }}>+{p.uplift_pct}%</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700 }}>
                <td><b>Total</b></td>
                <td style={{ textAlign: "right" }}><b>{gbp(rt.actual)}</b></td>
                <td style={{ textAlign: "right" }}><b>{gbp(rt.with_tool)}</b></td>
                <td style={{ textAlign: "right", color: "var(--gr)" }}><b>+{gbp(rt.uplift)}</b></td>
                <td style={{ textAlign: "right", color: "var(--gr)" }}><b>+{(rt.uplift / rt.actual * 100).toFixed(1)}%</b></td>
              </tr>
            </tbody>
          </table>
        </details>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="sec-title">Cumulative impact across the test window</div>
        <EChart option={cumOption} height={300} />
      </div>

      <HowItWorks title="How the backtest works" steps={d.method_steps} />

      <div className="grid cols-2" style={{ marginTop: 16 }}>
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
    </>
  );
}

function Kpi({ lbl, val, cls, sub, subTip }: any) {
  return (<div className="card kpi tight"><div className="lbl">{lbl}{subTip && <InfoTip text={subTip} />}</div><div className={`val ${cls} tnum`}>{val}</div><div className="sub">{sub}</div></div>);
}
