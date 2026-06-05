"use client";
import { useEffect, useState } from "react";
import EChart, { axisBase, catAxis, valAxis, C } from "@/components/EChart";
import { Explainer, HowItWorks, InfoTip } from "@/components/Explain";
import { api } from "@/lib/api";
import { gbp, num, fmtMonth } from "@/lib/format";

export default function Pnl() {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState("");
  const [queued, setQueued] = useState<Record<string, boolean>>({});

  useEffect(() => { api.pnl().then(setD).catch((e) => setErr(String(e))); }, []);

  if (err) return <div className="loading">Backend unreachable on :5055.<br />{err}</div>;
  if (!d) return <div className="loading">Building your P&L from sales, COGS, fees and bank data…</div>;

  const series = (d.series || []) as any[];
  const totals = d.totals || {};
  const months = series.map((p) => fmtMonth(p.month));
  const last = series.length ? series[series.length - 1] : {};
  const last12 = series.slice(-12);
  const actions = (d.actions || []) as any[];

  // Chart 1 — monthly revenue bars + net profit line.
  const profitOption = {
    ...axisBase,
    tooltip: {
      ...axisBase.tooltip,
      formatter: (ps: any[]) =>
        `<b>${ps[0].axisValue}</b><br/>` +
        ps.map((p) => `${p.marker} ${p.seriesName}: ${gbp(p.data)}`).join("<br/>"),
    },
    legend: { ...axisBase.legend, data: ["Revenue", "Net profit"] },
    xAxis: catAxis(months),
    yAxis: valAxis((v: number) => "£" + (v / 1000).toFixed(0) + "k"),
    series: [
      { name: "Revenue", type: "bar", data: series.map((p) => p.revenue),
        itemStyle: { color: C.t2, borderRadius: [3, 3, 0, 0] }, barMaxWidth: 22 },
      { name: "Net profit", type: "line", data: series.map((p) => p.net_profit), smooth: true,
        symbol: "circle", symbolSize: 5, lineStyle: { color: C.gr, width: 2.5 }, itemStyle: { color: C.gr } },
    ],
  };

  // Chart 2 — net margin %.
  const marginOption = {
    ...axisBase,
    tooltip: {
      ...axisBase.tooltip,
      formatter: (ps: any[]) => `<b>${ps[0].axisValue}</b><br/>${ps[0].marker} Net margin: ${ps[0].data}%`,
    },
    xAxis: catAxis(months),
    yAxis: valAxis((v: number) => v + "%"),
    series: [
      { name: "Net margin", type: "line", data: series.map((p) => p.net_margin_pct), smooth: true,
        symbol: "circle", symbolSize: 5, lineStyle: { color: C.bl, width: 2.5 }, itemStyle: { color: C.bl },
        areaStyle: { color: "rgba(10,132,255,0.07)" } },
    ],
  };

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Profit &amp; Loss</div>
        <h1>Your P&amp;L, without an accountant.</h1>
        <p>Every month, automatically: what you sold, what those goods actually cost, and what was left after overheads, fees and refunds.</p>
      </div>

      <Explainer tone="gr">
        Revenue minus what it cost to make the goods (<b>COGS</b> at the moment of sale), minus overheads, payment fees
        and refunds = your <b>real profit</b> each month. No spreadsheets, no month-end scramble.
      </Explainer>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Kpi lbl="24-mo revenue" val={gbp(totals.revenue)} sub="top line, last two years" />
        <Kpi lbl="24-mo net profit" val={gbp(totals.net_profit)} cls="gr" sub="after all costs" />
        <Kpi lbl="Net margin" val={`${num(totals.net_margin_pct)}%`} cls="bl" sub="profit per £ of revenue" />
        <Kpi lbl="Last month net" val={gbp(last.net_profit)} cls={(last.net_profit || 0) >= 0 ? "gr" : "rd"} sub={fmtMonth(last.month || "") || "latest"} />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="sec-title">Monthly revenue &amp; net profit <InfoTip text="Bars are revenue billed each month. The green line is what survived after COGS, overheads, fees and refunds." /></div>
        <EChart option={profitOption} height={320} />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="sec-title">Net margin over time</div>
        <EChart option={marginOption} height={280} />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="sec-title">Last 12 months</div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Month</th>
              <th style={{ textAlign: "right" }}>Revenue</th>
              <th style={{ textAlign: "right" }}>Gross profit</th>
              <th style={{ textAlign: "right" }}>Opex</th>
              <th style={{ textAlign: "right" }}>Refunds</th>
              <th style={{ textAlign: "right" }}>Net profit</th>
            </tr>
          </thead>
          <tbody>
            {last12.map((p) => (
              <tr key={p.month}>
                <td><b>{fmtMonth(p.month)}</b></td>
                <td style={{ textAlign: "right" }}>{gbp(p.revenue)}</td>
                <td style={{ textAlign: "right" }}>{gbp(p.gross_profit)}</td>
                <td style={{ textAlign: "right" }}>{gbp(p.opex)}</td>
                <td style={{ textAlign: "right" }}>{gbp(p.refunds)}</td>
                <td style={{ textAlign: "right", color: (p.net_profit || 0) >= 0 ? "var(--gr)" : "var(--rd)" }}>
                  <b>{gbp(p.net_profit)}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ActionsSection actions={actions} queued={queued} setQueued={setQueued} />

      <HowItWorks
        title="How the P&L is built"
        steps={[
          { title: "COGS recognised at sale", detail: "When a unit sells, we book its landed cost (units × per-unit landed cost) — so margin reflects the goods actually shipped, not what was bought." },
          { title: "Shopify fees ~2.9%", detail: "Payment processing is estimated at roughly 2.9% of revenue and deducted as a cost each month." },
          { title: "Refunds from the refunds table", detail: "Actual refund amounts are pulled from the refunds table and netted off." },
          { title: "Opex from bank categories", detail: "Overheads are categorised from bank transactions (rent, software, ads, payroll) and subtracted to reach net profit." },
        ]}
      />
    </>
  );
}

function ActionsSection({ actions, queued, setQueued }: any) {
  if (!actions || actions.length === 0) return null;
  return (
    <div style={{ marginTop: 16 }}>
      <div className="sec-title" style={{ marginBottom: 12 }}>Actions</div>
      <div className="grid cols-2">
        {actions.map((a: any) => {
          const done = !!queued[a.id];
          return (
            <div key={a.id} className="card">
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span className="badge reorder">Action</span>
                {a.impact_gbp ? (
                  <span className="mono" style={{ marginLeft: "auto", color: "var(--gr)", fontWeight: 700 }}>+{gbp(a.impact_gbp)}</span>
                ) : null}
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-.3px", lineHeight: 1.25 }}>{a.title}</div>
              <div style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.5, marginTop: 6 }}>{a.detail}</div>
              {a.why && (
                <div style={{
                  fontFamily: "'SF Mono',ui-monospace,Menlo,Consolas,monospace", fontSize: 11.5, fontWeight: 600,
                  color: "var(--gr)", background: "rgba(48,209,88,.1)", border: "1px solid rgba(48,209,88,.25)",
                  borderRadius: 10, padding: "7px 11px", marginTop: 12, lineHeight: 1.4,
                }}>📊 {a.why}</div>
              )}
              <button
                className="btn primary"
                style={{ marginTop: 14, ...(done ? { background: "var(--gr)", borderColor: "var(--gr)" } : {}) }}
                disabled={done}
                onClick={() => setQueued((q: any) => ({ ...q, [a.id]: true }))}
              >
                {done ? "✓ Queued" : a.verb}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Kpi({ lbl, val, cls, sub, subTip }: any) {
  return (
    <div className="card kpi tight">
      <div className="lbl">{lbl}{subTip && <InfoTip text={subTip} />}</div>
      <div className={`val ${cls || ""} tnum`}>{val}</div>
      <div className="sub">{sub}</div>
    </div>
  );
}
