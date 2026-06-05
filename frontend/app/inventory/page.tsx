"use client";
import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { gbp, num } from "@/lib/format";
import { Explainer, HowItWorks, InfoTip } from "@/components/Explain";
import EChart, { C } from "@/components/EChart";
import AgentChat from "@/components/AgentChat";

const STATUS_LABEL: Record<string, string> = {
  reorder: "Reorder",
  markdown: "Mark Down",
  watch: "Watch",
  healthy: "Healthy",
};

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "reorder", label: "Reorder" },
  { key: "markdown", label: "Mark Down" },
  { key: "watch", label: "Watch" },
  { key: "healthy", label: "Healthy" },
];

export default function InventoryPage() {
  return (
    <Suspense fallback={<div className="loading">Loading…</div>}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const params = useSearchParams();
  const idsParam = params.get("ids");
  const ids = useMemo(
    () => (idsParam ? idsParam.split(",").map((s) => s.trim()).filter(Boolean) : null),
    [idsParam]
  );

  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string>("");

  const [status, setStatus] = useState<string>("all");
  const [ptype, setPtype] = useState<string>("all");
  const [q, setQ] = useState<string>("");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api.stocksense().then(setData).catch((e) => setErr(String(e)));
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    let vs: any[] = data.variants;

    if (ids) {
      const set = new Set(ids);
      vs = vs.filter((v) => set.has(String(v.variant_id)));
    } else {
      if (status !== "all") vs = vs.filter((v) => v.status === status);
      if (ptype !== "all") vs = vs.filter((v) => v.product_type === ptype);
      const term = q.trim().toLowerCase();
      if (term) {
        vs = vs.filter(
          (v) =>
            String(v.sku).toLowerCase().includes(term) ||
            String(v.product_name).toLowerCase().includes(term)
        );
      }
    }

    return [...vs].sort((a, b) => {
      const ao = a.status === "reorder" ? 1 : 0;
      const bo = b.status === "reorder" ? 1 : 0;
      if (ao !== bo) return bo - ao;
      const az = a.inventory <= 0 ? 1 : 0;
      const bz = b.inventory <= 0 ? 1 : 0;
      if (az !== bz) return bz - az;
      return b.stocksense_score - a.stocksense_score;
    });
  }, [data, ids, status, ptype, q]);

  if (err) return <div className="loading">Backend unreachable on :5055.</div>;
  if (!data) return <div className="loading">Scoring 645 SKUs…</div>;

  const sm = data.summary;
  const productTypes: string[] = sm.product_types || [];
  const capped = filtered.slice(0, 150);
  const overflow = filtered.length - capped.length;

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Ripley · Inventory</div>
        <h1>645 SKUs, scored and ranked.</h1>
        <p>
          Every variant is scored 0–100 on stock urgency, demand and trend, then paired with a
          single clear recommendation — reorder the winners, mark down the dead weight, watch the
          rest.
        </p>
      </div>

      <Explainer tone="gr">
        Every product gets a 0–100 score: how fast it'll run out (urgency), how much money it makes (demand), and whether it's heating up (trend). High score = act now. Tap any card to see exactly why — no black box.
      </Explainer>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Kpi lbl="Need reordering" val={num(sm.reorder_count)} cls="rd" sub="Best-sellers running empty" />
        <Kpi lbl="Markdown / overstock" val={num(sm.markdown_count)} cls="am" sub="> 12 months of cover" />
        <Kpi lbl="Trapped cash" val={gbp(sm.total_trapped_cash)} cls="rd" sub="Locked in overstock" />
        <Kpi lbl="Lost revenue / month" val={gbp(sm.lost_monthly_revenue)} cls="am" sub="From empty winners" />
      </div>

      {ids && (
        <div className="card tight" style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontSize: 13, color: "var(--t2)" }}>
            Showing {filtered.length} SKUs from Cash Radar Remedy B
          </span>
          <Link href="/inventory" className="btn">Clear filter</Link>
        </div>
      )}

      {!ids && (
        <div className="card tight" style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                className={`chip${status === f.key ? " active" : ""}`}
                onClick={() => setStatus(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button
              className={`chip${ptype === "all" ? " active" : ""}`}
              onClick={() => setPtype("all")}
            >
              All types
            </button>
            {productTypes.map((t) => (
              <button
                key={t}
                className={`chip${ptype === t ? " active" : ""}`}
                onClick={() => setPtype(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search SKU or product name…"
            style={{ background: "rgba(255,255,255,.04)", border: "1px solid var(--b)", borderRadius: 13, padding: "12px 16px", color: "var(--t)", fontSize: 13.5, fontFamily: "inherit", outline: "none" }}
          />
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))" }}>
        {capped.map((v) => {
          const isOpen = !!open[v.variant_id];
          return (
          <div
            className="card tight"
            key={v.variant_id}
            style={{ cursor: "pointer" }}
            onClick={() => setOpen((o) => ({ ...o, [v.variant_id]: !o[v.variant_id] }))}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
              <b style={{ fontSize: 14, lineHeight: 1.3 }}>{v.product_name}</b>
              <span className={`badge ${v.status}`}>{STATUS_LABEL[v.status] || v.status}</span>
            </div>
            <div className="mono" style={{ marginTop: 4 }}>{v.sku}</div>

            <div className="grid" style={{ gridTemplateColumns: "repeat(2,1fr)", gap: 8, marginTop: 14 }}>
              <Stat lbl={<>Score<InfoTip text="0–100: urgency to act. 50 from stockout risk + 30 from revenue + 20 from rising trend." /></>} val={`${v.stocksense_score}/100`} />
              <Stat lbl="Inventory" val={num(v.inventory)} />
              <Stat lbl="Cover" val={v.months_cover === 999 ? "∞" : `${v.months_cover}m`} />
              <Stat lbl="Velocity" val={`${v.velocity_weekly}/wk`} />
              <Stat lbl="Price" val={gbp(v.price)} />
              <Stat lbl="Margin" val={`${v.margin_pct}%`} />
            </div>

            <div style={{ fontSize: 12, color: "var(--t2)", marginTop: 14, lineHeight: 1.5 }}>
              {v.recommendation}
              {v.recommendation_cost > 0 && (
                <span style={{ color: "var(--t)", fontWeight: 600 }}> · {gbp(v.recommendation_cost)}</span>
              )}
            </div>

            <div style={{ marginTop: 12, fontSize: 11, fontWeight: 700, color: "var(--t3)", display: "flex", alignItems: "center", gap: 6 }}>
              <span>{isOpen ? "▾" : "▸"}</span>
              {isOpen ? "Hide breakdown" : "Why this score?"}
            </div>

            {isOpen && (
              <div style={{ marginTop: 12 }}>
                {v.why && (
                  <div style={{ fontSize: 12.5, color: "var(--t2)", fontStyle: "italic", lineHeight: 1.5, marginBottom: 12 }}>{v.why}</div>
                )}
                <ScoreBar label="Urgency" value={v.score_stock_urgency} max={50} color="rd" />
                <ScoreBar label="Demand" value={v.score_demand_intensity} max={30} color="am" />
                <ScoreBar label="Trend" value={v.score_trend_bonus} max={20} color="gr" />
                {Array.isArray(v.sparkline) && v.sparkline.length > 1 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: "var(--t3)", marginBottom: 2 }}>Monthly units sold (24 mo)</div>
                    <EChart height={70} option={{
                      grid: { left: 4, right: 4, top: 6, bottom: 4 },
                      xAxis: { type: "category", show: false, data: v.sparkline.map((_: any, i: number) => i) },
                      yAxis: { type: "value", show: false }, tooltip: { show: false },
                      series: [{ type: "line", data: v.sparkline, smooth: true, symbol: "none",
                        lineStyle: { color: C.bl, width: 2 }, areaStyle: { color: "rgba(10,132,255,.12)" } }],
                    }} />
                  </div>
                )}
              </div>
            )}
          </div>
          );
        })}
      </div>

      {overflow > 0 && (
        <div className="loading">+ {num(overflow)} more — refine filters</div>
      )}

      <HowItWorks title="How the StockSense score works" steps={[{title:"Stock urgency (0–50)",detail:"How many months of stock are left at the current sales rate. Out of stock = 50 (max urgency); over 12 months of cover = 0."},{title:"Demand intensity (0–30)",detail:"How much this SKU sells versus the best-seller over the last 12 months. Bigger sellers score higher — protect the revenue that matters."},{title:"Trend bonus (0–20)",detail:"Is it accelerating? Recent 3-month velocity vs the 12-month average. Heating up earns a bonus so you reorder before it spikes."},{title:"Status",detail:"Out of stock or <2 months cover → Reorder. Over 12 months cover → Mark Down. Score ≥50 → Watch. Otherwise Healthy."}]} />
      <AgentChat agent={{ name: "Ripley", role: "Inventory", dept: "Inventory", icon: "▦", greeting: `Hey, I'm Ripley. This is the Inventory section where I manage your stock. I score every SKU 0-100 and flag what to reorder, mark down, or watch. Happy to help.` }} />
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

function Stat({ lbl, val }: any) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--t3)", marginBottom: 3 }}>{lbl}</div>
      <div className="tnum" style={{ fontSize: 14, fontWeight: 700, color: "var(--t)" }}>{val}</div>
    </div>
  );
}

function ScoreBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const v = Number(value) || 0;
  const pct = Math.max(0, Math.min(100, (v / max) * 100));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <div style={{ width: 56, flexShrink: 0, fontSize: 11, fontWeight: 600, color: "var(--t3)" }}>{label}</div>
      <div style={{ flex: 1, background: "rgba(255,255,255,.06)", height: 6, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: `var(--${color})`, borderRadius: 3 }} />
      </div>
      <div className="tnum" style={{ width: 40, flexShrink: 0, textAlign: "right", fontSize: 11, fontWeight: 700, color: "var(--t2)" }}>{v}/{max}</div>
    </div>
  );
}
