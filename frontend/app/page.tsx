"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { gbp, num, fmtDate } from "@/lib/format";

export default function Dashboard() {
  const [s, setS] = useState<any>(null);
  const [ss, setSs] = useState<any>(null);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    api.summary().then(setS).catch((e) => setErr(String(e)));
    api.stocksense().then(setSs).catch(() => {});
  }, []);

  if (err) return <div className="loading">Backend not reachable on :5055 — start it with <code>./backend/run.sh</code><br/>{err}</div>;
  if (!s) return <Loading />;

  const cr = s.cashradar, st = s.stocksense, eng = s.cashengine, bt = s.backtest;
  const queue = ss
    ? [...ss.variants]
        .filter((v: any) => v.status === "reorder")
        .sort((a: any, b: any) => (b.inventory <= 0 ? 1 : 0) - (a.inventory <= 0 ? 1 : 0) || b.stocksense_score - a.stocksense_score)
        .slice(0, 7)
    : [];

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Working Capital OS · live</div>
        <h1>Pretty Fly is buying the right products in the wrong quantities.</h1>
        <p>
          <b style={{ color: "var(--rd)" }}>{gbp(st.total_trapped_cash)}</b> trapped in {st.markdown_count} overstocked
          SKUs while {st.reorder_count} best-sellers sit empty — bleeding <b style={{ color: "var(--am)" }}>{gbp(st.lost_monthly_revenue)}/month</b>.
          Free the cash, refill the winners. The backtest below proves it was worth <b style={{ color: "var(--gr)" }}>{gbp(bt.total_impact_gbp)}</b>.
        </p>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Kpi lbl="Trapped in overstock" val={gbp(st.total_trapped_cash)} cls="rd" sub={`${st.markdown_count} SKUs · >12 months cover`} />
        <Kpi lbl="Lost revenue / month" val={gbp(st.lost_monthly_revenue)} cls="am" sub={`${st.reorder_count} SKUs need reordering`} />
        <Kpi lbl="Worst cash day" val={gbp(cr.actual_nadir_gbp)} cls="rd" sub={`${fmtDate(cr.actual_nadir_date)} · forewarned ${cr.primary_forewarned_days}d`} />
        <Kpi lbl="Backtest proven impact" val={gbp(bt.total_impact_gbp)} cls="gr" sub={`${bt.stockouts_avoided} stockouts avoided · ${bt.reorder_precision_pct}% precision`} />
      </div>

      <div className="grid cols-2">
        {/* Cash position */}
        <div className="card">
          <div className="sec-title">Cash position · moderate strategy</div>
          <div className="grid cols-2" style={{ gap: 12 }}>
            <Mini lbl="Cash freed by markdowns" val={gbp(eng.freed_cash_gbp)} cls="gr" />
            <Mini lbl="Reorder investment" val={gbp(eng.reorder_investment_gbp)} cls="bl" />
            <Mini lbl="Projected revenue uplift" val={gbp(eng.projected_revenue_uplift_gbp)} cls="gr" />
            <Mini lbl="Net cash position" val={gbp(eng.net_cash_position_gbp)} cls="am" />
          </div>
          <p style={{ fontSize: 12.5, color: "var(--t2)", marginTop: 14, lineHeight: 1.5 }}>
            {eng.headline} <span className="mono">£1 freed → £{eng.assumptions.revenue_multiplier} revenue</span>
          </p>
          <Link href="/scenarios" className="btn" style={{ marginTop: 14, display: "inline-block" }}>Tune the strategy →</Link>
        </div>

        {/* Recommendation queue */}
        <div className="card">
          <div className="sec-title">Recommendation queue · reorder first</div>
          {queue.length === 0 ? (
            <div className="skel" style={{ height: 180 }} />
          ) : (
            <table className="tbl">
              <thead><tr><th>SKU</th><th>Status</th><th>Action</th><th style={{ textAlign: "right" }}>Cost</th></tr></thead>
              <tbody>
                {queue.map((v: any) => (
                  <tr key={v.variant_id}>
                    <td><b>{v.product_name}</b><br /><span className="mono">{v.sku}</span></td>
                    <td><span className={`badge ${v.inventory <= 0 ? "reorder" : "watch"}`}>{v.inventory <= 0 ? "OUT" : `${v.inventory} left`}</span></td>
                    <td>{v.recommendation}</td>
                    <td style={{ textAlign: "right" }}><b>{gbp(v.recommendation_cost)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Link href="/inventory" className="btn" style={{ marginTop: 14, display: "inline-block" }}>Open StockSense grid →</Link>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="sec-title">The proof · backtest months 13–24</div>
        <div className="grid cols-3">
          <Mini lbl="Cash freed (overstock)" val={gbp(bt.cash_freed_gbp)} cls="gr" />
          <Mini lbl="Revenue recovered (stockouts)" val={gbp(bt.revenue_recovered_gbp)} cls="gr" />
          <Mini lbl="Stockout-prediction precision" val={`${bt.reorder_precision_pct}%`} cls="bl" />
        </div>
        <p style={{ fontSize: 12.5, color: "var(--t2)", marginTop: 14, lineHeight: 1.5 }}>
          Recommendations were made using only months 1–12, then scored against what actually happened in months 13–24.
          <Link href="/simulator" style={{ color: "var(--bl)" }}> See the full backtest →</Link>
        </p>
      </div>
    </>
  );
}

function Kpi({ lbl, val, cls, sub }: any) {
  return (
    <div className="card kpi tight">
      <div className="lbl">{lbl}</div>
      <div className={`val ${cls || ""} tnum`}>{val}</div>
      <div className="sub">{sub}</div>
    </div>
  );
}
function Mini({ lbl, val, cls }: any) {
  return (
    <div>
      <div className="lbl" style={{ fontSize: 10.5, color: "var(--t3)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 5 }}>{lbl}</div>
      <div className={`val ${cls || ""} tnum`} style={{ fontSize: 24, fontWeight: 800, letterSpacing: -.5, color: cls ? `var(--${cls})` : "var(--t)" }}>{val}</div>
    </div>
  );
}
function Loading() {
  return (
    <>
      <div className="page-head"><div className="skel" style={{ height: 28, width: 420, marginBottom: 10 }} /><div className="skel" style={{ height: 16, width: 600 }} /></div>
      <div className="grid cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skel" style={{ height: 110 }} />)}</div>
    </>
  );
}
