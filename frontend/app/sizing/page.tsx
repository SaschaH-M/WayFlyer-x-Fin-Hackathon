"use client";
import { useEffect, useState } from "react";
import EChart, { axisBase, catAxis, valAxis, C } from "@/components/EChart";
import { Explainer, HowItWorks } from "@/components/Explain";
import { api } from "@/lib/api";
import { num } from "@/lib/format";

const SZ = ["XS", "S", "M", "L", "XL"];

export default function Sizing() {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<Record<string, boolean>>({});
  useEffect(() => { api.sizing().then(setD).catch((e) => setErr(String(e))); }, []);
  if (err) return <div className="loading">Backend unreachable on :5055.</div>;
  if (!d) return <div className="loading">Analysing fit & returns…</div>;

  const r = d.reasons;
  const share = Math.round((r.too_small + r.too_large) / r.total * 100);
  const bias = r.too_small > r.too_large * 1.15 ? "runs small" : r.too_large > r.too_small * 1.15 ? "runs large" : "balanced";

  const curveOpt = { ...axisBase, tooltip: { ...axisBase.tooltip, formatter: (p: any[]) => `${p[0].axisValue}: ${p[0].data}%` },
    xAxis: { ...catAxis(SZ), boundaryGap: true }, yAxis: valAxis((v: number) => v + "%"),
    series: [{ type: "bar", barWidth: "55%", itemStyle: { color: C.bl, borderRadius: [5, 5, 0, 0] }, data: SZ.map((s) => d.curve[s]) }] };
  const retOpt = { ...axisBase, tooltip: { ...axisBase.tooltip, formatter: (p: any[]) => `${p[0].axisValue}: ${p[0].data} returns` },
    xAxis: { ...catAxis(SZ), boundaryGap: true }, yAxis: valAxis(),
    series: [{ type: "bar", barWidth: "55%", itemStyle: { color: C.rd, borderRadius: [5, 5, 0, 0] }, data: SZ.map((s) => d.returns_by_size[s] || 0) }] };

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Vera · Merchandising & Fit</div>
        <h1>Stop losing money to bad fit.</h1>
        <p>{share}% of every refund is a sizing problem. Order to the size curve customers actually buy — and fix the lines that run small or large.</p>
      </div>
      <Explainer tone="am">The range currently <b>{bias}</b> ({num(r.too_small)} "too small" vs {num(r.too_large)} "too large" returns).
        Matching reorders to the real demand curve and adding fit notes directly cuts the biggest refund driver.</Explainer>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Kpi lbl="Total refunds" val={num(r.total)} cls="" sub="across 24 months" />
        <Kpi lbl="Too small" val={num(r.too_small)} cls="rd" sub="size returns" />
        <Kpi lbl="Too large" val={num(r.too_large)} cls="am" sub="size returns" />
        <Kpi lbl="Sizing share" val={`${share}%`} cls="rd" sub="of all refunds" />
      </div>

      <div className="grid cols-2">
        <div className="card"><div className="sec-title">What sizes actually sell</div><EChart option={curveOpt} height={260} /></div>
        <div className="card"><div className="sec-title">Returns by size</div><EChart option={retOpt} height={260} /></div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="sec-title">Recommended actions</div>
        {d.actions.map((a: any) => (
          <div key={a.id} className="card tight" style={{ background: "rgba(255,255,255,.02)", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <div><div style={{ fontWeight: 700, fontSize: 14 }}>{a.title}</div>
                <div style={{ fontSize: 12.5, color: "var(--t2)", margin: "6px 0", lineHeight: 1.5 }}>{a.detail}</div>
                <span className="mono" style={{ color: "var(--gr)" }}>📊 {a.why}</span></div>
              <button className={`btn ${done[a.id] ? "" : "primary"}`} onClick={() => setDone((s) => ({ ...s, [a.id]: true }))}>{done[a.id] ? "✓ Queued" : a.verb}</button>
            </div>
          </div>
        ))}
      </div>

      <HowItWorks title="How the fit analysis works" steps={[
        { title: "Size curve", detail: "Share of units sold by size, from line_items joined to variant size. The natural demand mix to reorder against." },
        { title: "Return attribution", detail: "Each refund's variant ids are matched to their size, and the reason (too small / too large) tallied per size." },
        { title: "Fit bias", detail: "When 'too small' and 'too large' diverge by >15%, the range systematically runs small or large — grade up/down or add a fit note." },
      ]} />
    </>
  );
}
function Kpi({ lbl, val, cls, sub }: any) { return (<div className="card kpi tight"><div className="lbl">{lbl}</div><div className={`val ${cls} tnum`}>{val}</div><div className="sub">{sub}</div></div>); }
