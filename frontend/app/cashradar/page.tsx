"use client";
import { useEffect, useState, useMemo } from "react";
import EChart, { axisBase, catAxis, valAxis, C } from "@/components/EChart";
import { Explainer, HowItWorks, InfoTip } from "@/components/Explain";
import { api } from "@/lib/api";
import { gbp, fmtDate } from "@/lib/format";
import Link from "next/link";
import AgentChat from "@/components/AgentChat";

const DAY = 86400000;
const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY);

export default function CashRadar() {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState("");
  const [pos, setPos] = useState(0); // position within anchorDates

  useEffect(() => { api.cashradar().then(setD).catch((e) => setErr(String(e))); }, []);

  // ---- derived structures (must run unconditionally; guard on missing data) ----
  const labels: string[] = useMemo(
    () => (d ? d.actual_balance_series.map((p: any) => p.date) : []),
    [d]
  );
  const balances: number[] = useMemo(
    () => (d ? d.actual_balance_series.map((p: any) => p.balance) : []),
    [d]
  );
  const idxOf: Record<string, number> = useMemo(() => {
    const m: Record<string, number> = {};
    labels.forEach((l, i) => { m[l] = i; });
    return m;
  }, [labels]);

  const anchorDates: string[] = useMemo(
    () => (d ? d.anchors_summary.map((a: any) => a.date) : []),
    [d]
  );

  // default the scrubber to the primary crisis anchor once data lands
  useEffect(() => {
    if (!d) return;
    const p = anchorDates.indexOf(d.meta.primary_anchor);
    setPos(p >= 0 ? p : 0);
  }, [d, anchorDates]);

  const safePos = Math.min(Math.max(pos, 0), Math.max(anchorDates.length - 1, 0));
  const asofDate = anchorDates[safePos];
  const asofIdx = asofDate != null ? idxOf[asofDate] : undefined;
  const summary = d ? d.anchors_summary[safePos] : null;
  const demo = d ? d.demo_anchors.find((a: any) => a.anchor_date === asofDate) : null;

  // ---- chart option recomputed on every scrub ----
  const option = useMemo(() => {
    if (!d || asofIdx == null || !summary) return null;
    const n = labels.length;

    // past: actual balance up to and including as-of, null after
    const past: (number | null)[] = balances.map((b, i) => (i <= asofIdx ? b : null));

    // future: 30-day projection from projections_thin, anchored at as-of
    const future: (number | null)[] = new Array(n).fill(null);
    future[asofIdx] = summary.asof_balance;
    const proj: number[] = (d.projections_thin?.[asofDate]) || [];
    for (let i = 0; i < proj.length; i++) {
      const j = asofIdx + 1 + i;
      if (j >= 0 && j < n) future[j] = proj[i];
    }

    const winEnd = labels[Math.min(asofIdx + 30, n - 1)];
    const danger = d.meta.danger_threshold;

    return {
      ...axisBase,
      tooltip: {
        ...axisBase.tooltip,
        formatter: (ps: any[]) => {
          const date = ps[0]?.axisValue;
          const rows = ps
            .filter((p) => p.data != null)
            .map((p) => `${p.marker} ${p.seriesName}: ${gbp(p.data)}`)
            .join("<br/>");
          return `<b>${fmtDate(date)}</b><br/>${rows}`;
        },
      },
      legend: { ...axisBase.legend, data: ["Actual balance (past)", "30-day projection (future)"] },
      xAxis: {
        ...catAxis(labels),
        axisLabel: {
          color: C.t3, fontSize: 10,
          formatter: (dt: string) =>
            dt && dt.endsWith("-01")
              ? new Date(dt).toLocaleDateString("en-GB", { month: "short", year: "2-digit" })
              : "",
        },
      },
      yAxis: valAxis((v: number) => gbp(v)),
      series: [
        {
          name: "Actual balance (past)",
          type: "line",
          data: past,
          symbol: "none",
          lineStyle: { color: C.t, width: 1.6 },
          itemStyle: { color: C.t },
          areaStyle: { color: "rgba(245,245,247,0.05)" },
          z: 2,
          // markers carried on this series so they render regardless of future data
          markArea: {
            silent: true,
            itemStyle: { color: "rgba(255,69,58,0.07)" },
            data: [[{ xAxis: asofDate }, { xAxis: winEnd }]],
          },
          markLine: {
            silent: true,
            symbol: "none",
            data: [
              {
                xAxis: asofDate,
                lineStyle: { color: C.am, width: 1.2, type: "dashed" },
                label: { show: true, formatter: "today", color: C.am, fontSize: 10, position: "insideEndTop" },
              },
              {
                yAxis: danger,
                lineStyle: { color: C.rd, width: 1, type: "dashed" },
                label: { show: true, formatter: "danger", color: C.rd, fontSize: 10, position: "insideEndTop" },
              },
            ],
          },
        },
        {
          name: "30-day projection (future)",
          type: "line",
          data: future,
          symbol: "none",
          connectNulls: true,
          lineStyle: { color: C.rd, width: 2.5, type: "dashed" },
          itemStyle: { color: C.rd },
          z: 3,
        },
      ],
    };
  }, [d, asofIdx, asofDate, summary, labels, balances]);

  if (err) return <div className="loading">Backend unreachable on :5055.<br />{err}</div>;
  if (!d || asofIdx == null || !summary || !option) return <div className="loading">Projecting cash…</div>;

  const m = d.meta;
  const minProjected = summary.min_projected;
  const projLow = minProjected < m.danger_threshold;
  const status = summary.is_danger ? "DANGER" : minProjected < 0 ? "WATCH" : "CLEAR";
  const statusCls = summary.is_danger ? "rd" : minProjected < 0 ? "am" : "gr";
  const forewarn = summary.min_date ? daysBetween(asofDate, summary.min_date) : 0;
  const showCrisis = !!demo || summary.is_danger;

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Gordon · Cash & Treasury</div>
        <h1>Pretty Fly hit {gbp(m.actual_nadir_gbp)} on {fmtDate(m.actual_nadir_date)}.</h1>
        <p>Drag the timeline to any day in the last two years to see exactly what the next 30 days of cash
          looked like <i>from there</i> — using only the data that was knowable on that date.</p>
      </div>

      <Explainer tone="rd">
        The <b style={{ color: "var(--t)" }}>white solid line</b> is what actually happened — the real past balance.
        The <b style={{ color: "var(--rd)" }}>red dashed line</b> is the 30-day forecast made <i>from the day you're viewing</i> —
        the future as it looked then. It only ever uses outflows, payouts and costs known on that date, so there's no hindsight.
      </Explainer>

      {/* ---- SCRUBBER ---- */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div className="lbl" style={{ fontSize: 11, color: "var(--t3)", letterSpacing: 1, textTransform: "uppercase" }}>
              Viewing as of <InfoTip text="The projection on this chart uses only data available on this date — outflows, payouts and overheads known at the time." />
            </div>
            <div className="tnum" style={{ fontSize: 28, fontWeight: 700, color: "var(--t)", lineHeight: 1.2 }}>
              {fmtDate(asofDate)}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="btn" onClick={() => setPos(0)} title="Earliest">«</button>
            <button className="btn" onClick={() => setPos((p) => Math.max(0, p - 1))} title="Previous day">‹</button>
            <button className="btn" onClick={() => setPos((p) => Math.min(anchorDates.length - 1, p + 1))} title="Next day">›</button>
            <button className="btn" onClick={() => { const i = anchorDates.indexOf(m.primary_anchor); if (i >= 0) setPos(i); }}
              style={{ borderColor: "var(--rd)", color: "var(--rd)" }}>Jump to crisis</button>
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(anchorDates.length - 1, 0)}
          value={safePos}
          onChange={(e) => setPos(Number(e.target.value))}
          style={{ width: "100%", marginTop: 14, accentColor: C.rd, cursor: "pointer" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--t3)", marginTop: 4 }}>
          <span>{anchorDates.length ? fmtDate(anchorDates[0]) : ""}</span>
          <span>{anchorDates.length ? fmtDate(anchorDates[anchorDates.length - 1]) : ""}</span>
        </div>
      </div>

      {/* ---- CHART ---- */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="sec-title">Two years of cash, with the 30-day projection from the day you're viewing</div>
        <EChart option={option} height={340} />
        <div style={{ display: "flex", gap: 20, fontSize: 11.5, color: "var(--t2)", marginTop: 12 }}>
          <Legend c={C.t} t="Actual balance (past)" />
          <Legend c={C.rd} t="30-day projection (future)" dashed />
        </div>
      </div>

      {/* ---- STATUS ROW ---- */}
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Kpi lbl="As-of balance" val={gbp(summary.asof_balance)} cls="" sub={fmtDate(asofDate)} />
        <Kpi lbl="30-day projected low" val={gbp(minProjected)} cls={projLow ? "rd" : ""}
          sub={summary.min_date ? `on ${fmtDate(summary.min_date)}` : ""} />
        <Kpi lbl="Status" val={status} cls={statusCls} sub={`vs danger ${gbp(m.danger_threshold)}`} />
        <Kpi lbl="Days of forewarning" val={`${forewarn}d`} cls="am" sub="until projected low" />
      </div>

      {/* ---- CRISIS BREAKDOWN ---- */}
      {showCrisis && demo ? (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="sec-title">What drives the danger window</div>
            <table className="tbl">
              <thead><tr><th>Date</th><th>Driver</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
              <tbody>{demo.danger_drivers.map((dr: any, i: number) => (
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
              <div style={{ fontWeight: 600, margin: "8px 0 6px" }}>{demo.remedies.A.headline}</div>
              <div style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.6 }}>{demo.remedies.A.detail}</div>
              <div style={{ marginTop: 12, color: "var(--gr)", fontWeight: 600, fontSize: 13 }}>New projected low: {gbp(demo.remedies.A.new_min_balance)}</div>
            </div>

            <div className="card tight">
              <div className="tag">B · Discount overstock</div>
              <div style={{ fontWeight: 600, margin: "8px 0 6px" }}>{demo.remedies.B.headline}</div>
              <div style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.6 }}>{demo.remedies.B.detail}</div>
              <div style={{ marginTop: 12, color: "var(--gr)", fontWeight: 600, fontSize: 13 }}>New projected low: {gbp(demo.remedies.B.new_min_balance)}</div>
              <Link className="btn" href={`/inventory?ids=${(demo.remedies.B.variants || []).map((v: any) => v.variant_id).join(",")}`} style={{ marginTop: 12, display: "inline-block" }}>Drill into the SKUs →</Link>
            </div>

            <div className="card tight">
              <div className="tag">C · Wayflyer bridge</div>
              <div style={{ fontWeight: 600, margin: "8px 0 6px" }}>{demo.remedies.C.headline}</div>
              <div style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.6 }}>{demo.remedies.C.detail}</div>
              <div style={{ marginTop: 12, color: "var(--gr)", fontWeight: 600, fontSize: 13 }}>New projected low: {gbp(demo.remedies.C.new_min_balance)}</div>
            </div>
          </div>
      <AgentChat agent={{ name: "Gordon", role: "Cash & Treasury", dept: "Treasury", icon: "📡", greeting: `Hey, I'm Gordon. This is the Treasury section where I manage your cash flow. I project 30 days forward, flag danger zones, and find remedies before a crisis hits.` }} />
    </>
      ) : (
        <div className="card" style={{ marginBottom: 16, fontSize: 13, color: "var(--t2)" }}>
          {status === "CLEAR"
            ? "No projected danger from this date. "
            : "Cash dips below zero in this window, but no full remedy plan is staged for this date. "}
          Drag to {fmtDate(m.primary_anchor)} for the full crisis breakdown.
        </div>
      )}

      <HowItWorks title="How the cash projection works" steps={[
        { title: "Known outflows", detail: "Scheduled PO payments — exact dates and amounts." },
        { title: "Expected income", detail: "Shopify payouts estimated from the trailing 8-week average." },
        { title: "Recurring costs", detail: "Payroll, rent, ads etc. from the trailing 3 months." },
        { title: "No hindsight", detail: "Each projection uses only data available on the as-of date." },
      ]} />
    </>
  );
}

function Kpi({ lbl, val, cls, sub }: any) {
  return (<div className="card kpi tight"><div className="lbl">{lbl}</div><div className={`val ${cls} tnum`}>{val}</div><div className="sub">{sub}</div></div>);
}
function Legend({ c, t, dashed }: any) {
  return (<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 18, height: dashed ? 0 : 3, borderTop: dashed ? `2px dashed ${c}` : "none", background: dashed ? "transparent" : c, display: "inline-block", borderRadius: 2 }} />{t}</span>);
}
