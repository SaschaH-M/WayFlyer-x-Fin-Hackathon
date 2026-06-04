"use client";
import { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import { baseOptions, COLORS } from "@/components/charts";
import { api } from "@/lib/api";
import { gbp } from "@/lib/format";
import { Explainer, HowItWorks } from "@/components/Explain";

const SCENARIOS = [
  { key: "conservative", label: "Conservative" },
  { key: "moderate", label: "Moderate" },
  { key: "aggressive", label: "Aggressive" },
];

export default function Scenarios() {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState("");
  const [selected, setSelected] = useState("moderate");

  useEffect(() => { api.cashengineAll().then(setD).catch((e) => setErr(String(e))); }, []);

  if (err) return <div className="loading">Backend unreachable on :5055.<br />{err}</div>;
  if (!d) return <div className="loading">Modelling scenarios…</div>;

  const S = d[selected];
  const order = ["conservative", "moderate", "aggressive"];

  const data = {
    labels: ["Conservative", "Moderate", "Aggressive"],
    datasets: [
      { label: "Cash freed", data: order.map((k) => d[k].freed_cash_gbp),
        backgroundColor: COLORS.gr, borderRadius: 6, barPercentage: 0.7 },
      { label: "Revenue uplift", data: order.map((k) => d[k].projected_revenue_uplift_gbp),
        backgroundColor: COLORS.bl, borderRadius: 6, barPercentage: 0.7 },
      { label: "Net cash", data: order.map((k) => d[k].net_cash_position_gbp),
        backgroundColor: COLORS.am, borderRadius: 6, barPercentage: 0.7 },
    ],
  };

  const opts = {
    ...baseOptions,
    plugins: {
      ...baseOptions.plugins,
      legend: { display: true, labels: { color: "#98989d" } },
      tooltip: {
        ...baseOptions.plugins.tooltip,
        callbacks: { label: (c: any) => `${c.dataset.label}: ${gbp(c.parsed.y)}` },
      },
    },
    scales: {
      ...baseOptions.scales,
      y: { ...baseOptions.scales.y, ticks: { ...baseOptions.scales.y.ticks, callback: (v: any) => gbp(v) } },
    },
  };

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Cash Flow Impact Engine</div>
        <h1>Free trapped cash. Refuel the winners.</h1>
        <p>Three strategies trade markdown depth against speed. Pick one and watch trapped cash convert into
          working capital and projected revenue.</p>
      </div>

      <Explainer>
        Same inventory, three appetites. Conservative discounts gently and reorders cautiously; Aggressive clears stock fast and refills everything. Pick one and watch trapped cash turn into working capital and projected revenue.
      </Explainer>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {SCENARIOS.map((s) => (
          <button key={s.key} className={selected === s.key ? "chip active" : "chip"}
            onClick={() => setSelected(s.key)}>{s.label}</button>
        ))}
      </div>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Kpi lbl="Cash freed" val={gbp(S.freed_cash_gbp)} cls="gr"
          sub={`${S.markdown_sku_count} SKUs marked down`} />
        <Kpi lbl="Reorder investment" val={gbp(S.reorder_investment_gbp)} cls="bl"
          sub={`${S.reorder_sku_count} reorders funded`} />
        <Kpi lbl="Projected revenue uplift" val={gbp(S.projected_revenue_uplift_gbp)} cls="gr"
          sub={`£1 freed → £${S.assumptions.revenue_multiplier}`} />
        <Kpi lbl="Net cash position" val={gbp(S.net_cash_position_gbp)} cls="am"
          sub="freed − reorder" />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="sec-title">{S.headline}</div>
        <p className="mono" style={{ fontSize: 12.5, color: "var(--t2)", marginTop: 8 }}>
          {S.assumptions.discount_pct}% off · {S.assumptions.sell_through_pct}% sell-through · reorder top {S.assumptions.reorder_share_pct}%
        </p>
        <p style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.6, marginTop: 8 }}>{S.blurb}</p>
      </div>

      <div className="card">
        <div className="sec-title">Strategy comparison</div>
        <div style={{ height: 320 }}><Bar data={data} options={opts} /></div>
      </div>

      <HowItWorks title="How the cash engine works" steps={[{title:"Freed cash",detail:"For overstock SKUs: units × price × (1 − discount) × sell-through. Deeper discounts clear more units but at lower prices."},{title:"Reorder investment",detail:"Cost to refill the flagged stockout SKUs, scaled by how aggressive the strategy is."},{title:"Revenue uplift",detail:"Freed cash funds reorders; each £1 of freed inventory is worth several pounds of annual revenue, derived from the brand's own sales velocity."},{title:"Net cash",detail:"Freed cash minus reorder investment — the immediate change to the bank balance."}]} />
    </>
  );
}

function Kpi({ lbl, val, cls, sub }: any) {
  return (<div className="card kpi tight"><div className="lbl">{lbl}</div><div className={`val ${cls} tnum`}>{val}</div><div className="sub">{sub}</div></div>);
}
