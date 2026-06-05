"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import EChart, { axisBase, catAxis, valAxis, C } from "@/components/EChart";
import { Explainer, HowItWorks, InfoTip } from "@/components/Explain";
import { api } from "@/lib/api";
import { gbp, num } from "@/lib/format";
import AgentChat from "@/components/AgentChat";

export default function Marketing() {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api.marketing().then(setD).catch((e) => setErr(String(e))); }, []);

  if (err) return <div className="loading">Backend unreachable on :5055.<br />{err}</div>;
  if (!d) return <div className="loading">Joining ad spend to revenue…</div>;

  const m = d.meta, re = d.reallocation;
  const hot = d.launch_signals.filter((s: any) => s.severity === "high" || s.severity === "medium");
  const magic = hot[0] || d.launch_signals[0];
  const tiktok = d.channels.find((c: any) => c.channel === "tiktok");

  // channel revenue bar (colored: green=profitable, purple=free/untracked, red=unprofitable)
  const chTop = [...d.channels].slice(0, 7);
  const channelOption = {
    ...axisBase, grid: { ...axisBase.grid, left: 90 },
    tooltip: { ...axisBase.tooltip, trigger: "item",
      formatter: (p: any) => { const c = chTop[p.dataIndex]; return `<b>${c.channel}</b><br/>Revenue: ${gbp(c.revenue)}<br/>${c.tracked_spend ? `Spend: ${gbp(c.spend)}<br/>ROAS: ${c.roas}×` : "No tracked ad spend"}`; } },
    xAxis: valAxis((v: number) => "£" + (v / 1000).toFixed(0) + "k"),
    yAxis: { ...catAxis(chTop.map((c) => c.channel).reverse()), boundaryGap: true },
    series: [{ type: "bar", barWidth: 16, itemStyle: { borderRadius: [0, 5, 5, 0] },
      data: [...chTop].reverse().map((c) => ({ value: c.revenue,
        itemStyle: { color: c.tracked_spend ? (c.profitable ? C.gr : C.rd) : C.pu } })) }],
  };

  // campaign ROAS bar with break-even markLine
  const campTop = [...d.campaigns].slice(0, 10);
  const campaignOption = {
    ...axisBase, grid: { ...axisBase.grid, bottom: 96 },
    tooltip: { ...axisBase.tooltip, trigger: "item",
      formatter: (p: any) => { const c = campTop[p.dataIndex]; return `<b>${c.campaign}</b><br/>Spend: ${gbp(c.spend)}<br/>Attributed: ${gbp(c.attributed_revenue)}<br/>ROAS: ${c.roas}×`; } },
    xAxis: { ...catAxis(campTop.map((c) => c.campaign)), axisLabel: { color: C.t3, fontSize: 9, rotate: 38, interval: 0 } },
    yAxis: valAxis((v: number) => v + "×"),
    series: [{ type: "bar", barWidth: "55%", itemStyle: { borderRadius: [4, 4, 0, 0] },
      data: campTop.map((c) => ({ value: c.roas, itemStyle: { color: c.status === "winner" ? C.gr : c.status === "waste" ? C.rd : C.t2 } })),
      markLine: { silent: true, symbol: "none", lineStyle: { color: C.am, type: "dashed" },
        data: [{ yAxis: m.break_even_roas, label: { formatter: `break-even ${m.break_even_roas}×`, color: C.am, fontSize: 10 } }] } }],
  };

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Draper · Marketing</div>
        <h1>You're spending £1M on ads. Some of it prints money. Some of it burns.</h1>
        <p>Every pound of ad spend joined to the revenue it actually drove (Shopify attribution, not the platform's inflated claim), then wired straight into inventory.</p>
      </div>

      <Explainer>
        Break-even is <b>{m.break_even_roas}×</b> (you keep {m.gross_margin_pct}% of each sale). Anything below that loses money.
        Blended you run <b>{m.blended_roas}×</b> — healthy on average, but the average hides a <b>{gbp(re.rescuable_spend)}</b> leak and a free channel you're ignoring.
      </Explainer>

      {/* ✦ THE MAGIC */}
      {magic && magic.action && (
        <div className="card" style={{ marginBottom: 16, borderColor: "rgba(48,209,88,.3)" }}>
          <div className="sec-title" style={{ color: "var(--gr)" }}>✦ Live link — marketing is talking to inventory <InfoTip text="The system watches ad demand per product type and cross-checks it against live stock. When demand rises and stock is thin, it raises a reorder before the launch sells out — automatically." /></div>
          <div className="flow">
            <div className="flow-node signal">
              <div className="nlabel">① Ad demand signal</div>
              <div className="nbig" style={{ color: "var(--bl)" }}>{magic.product_type} ▲ {magic.surge_pct}%</div>
              <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 6 }}>{num(magic.ad_impressions_recent)} impressions · {num(magic.clicks_recent)} clicks, last 60 days</div>
            </div>
            <div className="arrow"><span>➜</span></div>
            <div className="flow-node stock">
              <div className="nlabel">② Inventory reality</div>
              <div className="nbig" style={{ color: "var(--rd)" }}>{magic.out_of_stock} out of stock</div>
              <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 6 }}>{magic.reorder_skus} {magic.product_type} SKUs thin · {magic.avg_months_cover}m avg cover</div>
            </div>
            <div className="arrow"><span>➜</span></div>
            <div className="flow-node action">
              <div className="nlabel">③ Auto-action</div>
              <div className="nbig" style={{ color: "var(--gr)" }}>Reorder {num(magic.recommended_units)} units</div>
              <Link href={`/inventory`} className="btn" style={{ marginTop: 8, display: "inline-block", fontSize: 12, padding: "6px 12px" }}>See the SKUs →</Link>
            </div>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--t2)", marginTop: 14, lineHeight: 1.5 }}>{magic.action}</p>
        </div>
      )}

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Kpi lbl="Total ad spend" val={gbp(m.total_ad_spend)} cls="" sub="Google + Meta, 24 months" />
        <Kpi lbl="Blended true ROAS" val={`${m.blended_roas}×`} cls="bl" subTip="Total Shopify-attributed revenue ÷ total ad spend. The platforms claim more; this is what really landed." sub={`break-even ${m.break_even_roas}×`} />
        <Kpi lbl="Wasted / rescuable" val={gbp(re.rescuable_spend)} cls="rd" sub={`${d.waste.length} campaign(s) below break-even`} />
        <Kpi lbl="If reallocated" val={`+${gbp(re.projected_gain)}`} cls="gr" sub={`move to winners (${re.winner_avg_roas}×)`} />
      </div>

      {/* reallocation */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="sec-title">Stop the leak — move budget from losers to winners</div>
        <div className="flow" style={{ gridTemplateColumns: "1fr auto 1fr" }}>
          <div className="flow-node stock">
            <div className="nlabel">❌ Burning money</div>
            {d.waste.map((c: any) => (
              <div key={c.campaign} style={{ fontSize: 13, marginTop: 4 }}><b>{c.campaign}</b> · {gbp(c.spend)} @ <span style={{ color: "var(--rd)" }}>{c.roas}×</span></div>
            ))}
            {d.waste.length === 0 && <div style={{ fontSize: 13, color: "var(--t3)" }}>No campaigns below break-even 🎉</div>}
          </div>
          <div className="arrow"><span>➜</span></div>
          <div className="flow-node action">
            <div className="nlabel">✅ Feed these instead</div>
            {d.winners.slice(0, 3).map((c: any) => (
              <div key={c.campaign} style={{ fontSize: 13, marginTop: 4 }}><b>{c.campaign}</b> · <span style={{ color: "var(--gr)" }}>{c.roas}×</span></div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="sec-title">Revenue by channel <InfoTip text="Green = profitable paid channel. Red = paid but below break-even. Purple = driving real revenue with NO tracked ad spend (free / organic)." /></div>
          <EChart option={channelOption} height={260} />
          {tiktok && (
            <div style={{ background: "rgba(191,90,242,.1)", border: "1px solid rgba(191,90,242,.25)", borderRadius: 12, padding: "12px 14px", marginTop: 12, fontSize: 13, color: "var(--t2)", lineHeight: 1.5 }}>
              💡 <b style={{ color: "var(--pu)" }}>TikTok drove {gbp(tiktok.revenue)}</b> across {num(tiktok.orders)} orders with <b>zero tracked spend</b>. You're under-invested in a channel that's already working for free.
            </div>
          )}
        </div>
        <div className="card">
          <div className="sec-title">Campaign ROAS vs break-even</div>
          <EChart option={campaignOption} height={300} />
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="sec-title">Email — the quietest money printer</div>
        <table className="tbl">
          <thead><tr><th>Campaign / flow</th><th>Type</th><th style={{ textAlign: "right" }}>Open rate</th><th style={{ textAlign: "right" }}>Orders</th><th style={{ textAlign: "right" }}>Revenue</th><th style={{ textAlign: "right" }}>£ / send</th></tr></thead>
          <tbody>{d.email.map((e: any) => (
            <tr key={e.name}><td><b>{e.name}</b></td><td>{e.type}</td>
              <td style={{ textAlign: "right" }}>{e.open_rate}%</td>
              <td style={{ textAlign: "right" }}>{num(e.attributed_orders)}</td>
              <td style={{ textAlign: "right" }}><b style={{ color: "var(--gr)" }}>{gbp(e.attributed_revenue)}</b></td>
              <td style={{ textAlign: "right" }}>£{e.revenue_per_send}</td></tr>))}</tbody>
        </table>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="sec-title">What to do next</div>
        <div className="grid cols-3">
          {d.recommendations.map((r: any, i: number) => (
            <div key={i} className="card tight" style={{ background: "rgba(255,255,255,.02)" }}>
              <span className={`badge ${r.tag === "inventory" ? "reorder" : r.tag === "reallocate" ? "markdown" : "watch"}`}>{r.tag}</span>
              <div style={{ fontSize: 14, fontWeight: 700, margin: "8px 0 6px" }}>{r.title}</div>
              <div style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.5 }}>{r.detail}</div>
            </div>
          ))}
        </div>
      </div>

      <HowItWorks title="How the marketing maths works" steps={[
        { title: "True ROAS, not platform ROAS", detail: "We ignore the platform's self-reported conversion value (it over-claims) and divide ad spend by the revenue Shopify actually attributes to that campaign via utm_campaign." },
        { title: "Break-even from your own margin", detail: `You keep ${m.gross_margin_pct}% of each sale, so a campaign must return at least ${m.break_even_roas}× to wash its face. Below that, every pound spent loses money.` },
        { title: "Free channels count", detail: "TikTok, Instagram-organic and direct have no ad-spend file, but their orders carry utm_source — so we still show the real revenue they drive, surfacing under-invested winners." },
        { title: "Ads → inventory loop", detail: "Ad impressions are mapped to product types by campaign name, compared 60-days-recent vs prior, then cross-checked against live stock cover. Rising demand + thin stock = an automatic reorder flag." },
      ]} />
      <AgentChat agent={{ name: "Draper", role: "Marketing", dept: "Marketing", icon: "📣", greeting: `Hey, I'm Draper. This is the Marketing section where I manage your ad spend. I track true ROAS per campaign, reallocate waste to winners, and spot ad surges that signal reorder opportunities.` }} />
    </>
  );
}

function Kpi({ lbl, val, cls, sub, subTip }: any) {
  return (<div className="card kpi tight"><div className="lbl">{lbl}{subTip && <InfoTip text={subTip} />}</div><div className={`val ${cls} tnum`}>{val}</div><div className="sub">{sub}</div></div>);
}
