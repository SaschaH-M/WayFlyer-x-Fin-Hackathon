"use client";
import { useEffect, useRef, useState } from "react";
import { Bar } from "react-chartjs-2";
import { baseOptions, COLORS } from "@/components/charts";
import { api } from "@/lib/api";
import { gbp } from "@/lib/format";
import CountUp from "@/components/CountUp";
import { Explainer, HowItWorks } from "@/components/Explain";

// Slider mix -> {discount, sell_through, reorder_share} in 0..1.
const PRESETS = [
  { key: "conservative", label: "Conservative", d: 0.2, s: 0.5, r: 0.5 },
  { key: "moderate", label: "Moderate", d: 0.3, s: 0.7, r: 0.8 },
  { key: "aggressive", label: "Aggressive", d: 0.4, s: 0.85, r: 1.0 },
];

export default function Scenarios() {
  const [mix, setMix] = useState({ d: 0.3, s: 0.7, r: 0.8 });
  const [S, setS] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const reqId = useRef(0);

  // Debounced live recompute whenever a knob moves — only the latest result wins.
  useEffect(() => {
    const id = ++reqId.current;
    setBusy(true);
    const t = setTimeout(() => {
      api.cashengineCustom(mix.d, mix.s, mix.r)
        .then((res) => { if (id === reqId.current) { setS(res); setBusy(false); } })
        .catch((e) => { if (id === reqId.current) { setErr(String(e)); setBusy(false); } });
    }, 120);
    return () => clearTimeout(t);
  }, [mix]);

  if (err) return <div className="loading">Backend unreachable on :5055.<br />{err}</div>;

  const activePreset = PRESETS.find((p) => p.d === mix.d && p.s === mix.s && p.r === mix.r)?.key;
  const chartData = {
    labels: ["Trapped", "Cash freed", "Reorder invest", "Net cash", "Revenue uplift"],
    datasets: [{
      data: S ? [S.trapped_cash_gbp, S.freed_cash_gbp, S.reorder_investment_gbp, S.net_cash_position_gbp, S.projected_revenue_uplift_gbp] : [0, 0, 0, 0, 0],
      backgroundColor: [COLORS.rd, COLORS.gr, COLORS.bl, COLORS.am, COLORS.pu],
      borderRadius: 6, barPercentage: 0.62,
    }],
  };
  const opts = {
    ...baseOptions,
    animation: { duration: 500, easing: "easeOutCubic" },
    plugins: {
      ...baseOptions.plugins,
      tooltip: { ...baseOptions.plugins.tooltip, callbacks: { label: (c: any) => gbp(c.parsed.y) } },
    },
    scales: { ...baseOptions.scales, y: { ...baseOptions.scales.y, ticks: { ...baseOptions.scales.y.ticks, callback: (v: any) => gbp(v) } } },
  };

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Cash Flow Impact Engine</div>
        <h1>Free trapped cash. Refuel the winners.</h1>
        <p>Drag the dials — markdown depth, sell-through, reorder coverage — and watch trapped cash convert into
          working capital and projected revenue, recomputed live from the dataset on every move.</p>
      </div>

      <Explainer>
        Same inventory, your call on the appetite. Discount deeper to free more cash now (at lower prices); reorder a
        wider slice of stockouts to capture more revenue. Every number below is recomputed on the backend as you drag.
      </Explainer>

      {/* Live controls */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="sec-title" style={{ display: "flex", justifyContent: "space-between" }}>
          <span><span className="live-dot" />Live strategy dials</span>
          <span style={{ color: "var(--t3)", letterSpacing: 1 }}>{S ? `£1 freed → £${S.assumptions.revenue_multiplier} revenue` : ""}</span>
        </div>
        <div className="grid cols-3" style={{ gap: 22 }}>
          <Slider label="Markdown depth" val={mix.d} min={0} max={0.6} step={0.05} color={COLORS.gr}
            fmt={(v: number) => `${Math.round(v * 100)}%`} onChange={(d: number) => setMix((m) => ({ ...m, d }))} />
          <Slider label="Sell-through" val={mix.s} min={0.2} max={1} step={0.05} color={COLORS.bl}
            fmt={(v: number) => `${Math.round(v * 100)}%`} onChange={(s: number) => setMix((m) => ({ ...m, s }))} />
          <Slider label="Reorder coverage" val={mix.r} min={0} max={1} step={0.05} color={COLORS.pu}
            fmt={(v: number) => `${Math.round(v * 100)}%`} onChange={(r: number) => setMix((m) => ({ ...m, r }))} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 18, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--t3)" }}>Quick presets:</span>
          {PRESETS.map((p) => (
            <button key={p.key} className={activePreset === p.key ? "chip active" : "chip"}
              onClick={() => setMix({ d: p.d, s: p.s, r: p.r })}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* KPIs (animated) */}
      <div className={`grid cols-4 recompute ${busy ? "busy" : ""}`} style={{ marginBottom: 16 }}>
        <Kpi lbl="Cash freed" cls="gr" val={S?.freed_cash_gbp ?? 0}
          sub={S ? `${S.markdown_sku_count} SKUs marked down` : ""} />
        <Kpi lbl="Reorder investment" cls="bl" val={S?.reorder_investment_gbp ?? 0}
          sub={S ? `${S.reorder_sku_count} reorders funded` : ""} />
        <Kpi lbl="Projected revenue uplift" cls="gr" val={S?.projected_revenue_uplift_gbp ?? 0}
          sub={S ? `£1 freed → £${S.assumptions.revenue_multiplier}` : ""} />
        <Kpi lbl="Net cash position" cls="am" val={S?.net_cash_position_gbp ?? 0} sub="freed − reorder" />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="sec-title">{S?.headline ?? "Modelling…"}</div>
        <p className="mono" style={{ fontSize: 12.5, color: "var(--t2)", marginTop: 8 }}>
          {S ? `${S.assumptions.discount_pct}% off · ${S.assumptions.sell_through_pct}% sell-through · reorder top ${S.assumptions.reorder_share_pct}%` : ""}
        </p>
        <p style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.6, marginTop: 8 }}>{S?.blurb}</p>
      </div>

      <div className="card">
        <div className="sec-title">Where this mix lands · live</div>
        <div style={{ height: 320 }}><Bar data={chartData} options={opts} /></div>
      </div>

      <HowItWorks title="How the cash engine works" steps={[{ title: "Freed cash", detail: "For overstock SKUs: units × price × (1 − discount) × sell-through. Deeper discounts clear more units but at lower prices." }, { title: "Reorder investment", detail: "Cost to refill the flagged stockout SKUs, scaled by the reorder-coverage dial." }, { title: "Revenue uplift", detail: "Freed cash funds reorders; each £1 of freed inventory is worth several pounds of annual revenue, derived from the brand's own sales velocity." }, { title: "Net cash", detail: "Freed cash minus reorder investment — the immediate change to the bank balance." }]} />
    </>
  );
}

function Slider({ label, val, min, max, step, color, fmt, onChange }: any) {
  const pct = ((val - min) / (max - min)) * 100;
  return (
    <div className="ctrl">
      <div className="ctrl-top">
        <span className="ctrl-lbl">{label}</span>
        <span className="ctrl-val" style={{ color }}>{fmt(val)}</span>
      </div>
      <input type="range" className="slider" min={min} max={max} step={step} value={val}
        style={{ ["--pct" as any]: `${pct}%`, ["--accent" as any]: color }}
        onChange={(e) => onChange(parseFloat(e.target.value))} />
    </div>
  );
}

function Kpi({ lbl, val, cls, sub }: any) {
  return (
    <div className="card kpi tight">
      <div className="lbl">{lbl}</div>
      <div className={`val ${cls} tnum`}><CountUp value={val} format={gbp} /></div>
      <div className="sub">{sub}</div>
    </div>
  );
}
