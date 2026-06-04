"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Line } from "react-chartjs-2";
import { baseOptions, COLORS } from "@/components/charts";
import { api } from "@/lib/api";
import { gbp, fmtDate } from "@/lib/format";

export default function CashRadar() {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api.cashradar().then(setD).catch((e) => setErr(String(e))); }, []);

  if (err) return <div className="loading">Backend unreachable on :5055.<br />{err}</div>;
  if (!d) return <div className="loading">Projecting cash 30 days forward…</div>;

  const m = d.meta;
  const A = d.demo_anchors[0];

  const labels = d.actual_balance_series.map((p: any) => p.date);
  const idxOf: Record<string, number> = {};
  labels.forEach((l: string, i: number) => { idxOf[l] = i; });

  const projData: (number | null)[] = new Array(labels.length).fill(null);
  const anchorIdx = idxOf[A.anchor_date];
  if (anchorIdx != null) {
    projData[anchorIdx] = A.asof_balance;
    for (let i = 0; i < A.projection.length; i++) {
      const j = anchorIdx + 1 + i;
      if (j >= 0 && j < projData.length) projData[j] = A.projection[i].balance;
    }
  }

  const data = {
    labels,
    datasets: [
      { label: "Actual balance", data: d.actual_balance_series.map((p: any) => p.balance),
        borderColor: COLORS.t, fill: true, backgroundColor: "rgba(245,245,247,0.05)",
        borderWidth: 1.6, pointRadius: 0, tension: 0.15 },
      { label: "30-day projection", data: projData,
        borderColor: COLORS.rd, borderDash: [5, 4], borderWidth: 2.5, pointRadius: 0 },
    ],
  };

  const opts = {
    ...baseOptions,
    plugins: { ...baseOptions.plugins, tooltip: { ...baseOptions.plugins.tooltip,
      callbacks: { label: (c: any) => `${c.dataset.label}: ${gbp(c.parsed.y)}` } } },
    scales: {
      ...baseOptions.scales,
      x: { ...baseOptions.scales.x, ticks: { ...baseOptions.scales.x.ticks, maxTicksLimit: 14,
        callback: (v: any, i: number) => { const dt = labels[i]; return dt && dt.endsWith("-01") ? new Date(dt).toLocaleDateString("en-GB", { month: "short", year: "2-digit" }) : ""; } } },
      y: { ...baseOptions.scales.y, ticks: { ...baseOptions.scales.y.ticks, callback: (v: any) => gbp(v) } },
    },
  };

  const B = A.remedies.B;

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Cash Radar</div>
        <h1>Pretty Fly hit {gbp(m.actual_nadir_gbp)} on {fmtDate(m.actual_nadir_date)}.</h1>
        <p>The data saw it coming {m.primary_forewarned_days} days early. From {fmtDate(m.primary_anchor)} the
          30-day projection already called {gbp(m.primary_projected_nadir_gbp)} — using only known PO schedules,
          trailing payouts, and trailing overheads.</p>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Kpi lbl="Actual nadir" val={gbp(m.actual_nadir_gbp)} cls="rd" sub={fmtDate(m.actual_nadir_date)} />
        <Kpi lbl="Forewarning" val={`${m.primary_forewarned_days}d`} cls="am" sub={`from ${fmtDate(m.primary_anchor)}`} />
        <Kpi lbl="Projected nadir" val={gbp(m.primary_projected_nadir_gbp)} cls="rd" sub={fmtDate(m.primary_projected_nadir_date)} />
        <Kpi lbl="Fixable to" val={gbp(B.new_min_balance)} cls="gr" sub="with overstock discount" />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="sec-title">Two years of cash, with the projection that called the crisis</div>
        <div style={{ height: 320 }}><Line data={data} options={opts} /></div>
        <div style={{ display: "flex", gap: 20, fontSize: 11.5, color: "var(--t2)", marginTop: 12 }}>
          <Legend c={COLORS.t} t="Actual" /><Legend c={COLORS.rd} t="30-day projection" dashed />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="sec-title">What drives the danger window</div>
        <table className="tbl">
          <thead><tr><th>Date</th><th>Driver</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
          <tbody>{A.danger_drivers.map((dr: any, i: number) => (
            <tr key={i}>
              <td>{fmtDate(dr.date)}</td>
              <td><b>{dr.label}</b>{dr.supplier ? <><br /><span className="mono">{dr.supplier}{dr.po_id ? ` · ${dr.po_id}` : ""}</span></> : null}</td>
              <td style={{ textAlign: "right", color: "var(--rd)" }}><b>{gbp(dr.amount)}</b></td>
            </tr>))}</tbody>
        </table>
      </div>

      <div className="sec-title">Three ways to clear it</div>
      <div className="grid cols-3">
        <div className="card tight">
          <div className="tag">A · Delay PO</div>
          <div style={{ fontWeight: 600, margin: "8px 0 6px" }}>{A.remedies.A.headline}</div>
          <div style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.6 }}>{A.remedies.A.detail}</div>
          <div style={{ marginTop: 12, color: "var(--gr)", fontWeight: 600, fontSize: 13 }}>New projected low: {gbp(A.remedies.A.new_min_balance)}</div>
        </div>

        <div className="card tight">
          <div className="tag">B · Discount overstock</div>
          <div style={{ fontWeight: 600, margin: "8px 0 6px" }}>{B.headline}</div>
          <div style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.6 }}>{B.detail}</div>
          <div style={{ marginTop: 12, color: "var(--gr)", fontWeight: 600, fontSize: 13 }}>New projected low: {gbp(B.new_min_balance)}</div>
          <Link className="btn" href={`/inventory?ids=${B.variants.map((v: any) => v.variant_id).join(",")}`} style={{ marginTop: 12, display: "inline-block" }}>Drill into the SKUs →</Link>
        </div>

        <div className="card tight">
          <div className="tag">C · Wayflyer bridge</div>
          <div style={{ fontWeight: 600, margin: "8px 0 6px" }}>{A.remedies.C.headline}</div>
          <div style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.6 }}>{A.remedies.C.detail}</div>
          <div style={{ marginTop: 12, color: "var(--gr)", fontWeight: 600, fontSize: 13 }}>New projected low: {gbp(A.remedies.C.new_min_balance)}</div>
        </div>
      </div>
    </>
  );
}

function Kpi({ lbl, val, cls, sub }: any) {
  return (<div className="card kpi tight"><div className="lbl">{lbl}</div><div className={`val ${cls} tnum`}>{val}</div><div className="sub">{sub}</div></div>);
}
function Legend({ c, t, dashed }: any) {
  return (<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 18, height: dashed ? 0 : 3, borderTop: dashed ? `2px dashed ${c}` : "none", background: dashed ? "transparent" : c, display: "inline-block", borderRadius: 2 }} />{t}</span>);
}
