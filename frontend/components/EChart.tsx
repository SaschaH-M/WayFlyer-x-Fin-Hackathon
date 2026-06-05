"use client";
import dynamic from "next/dynamic";
import ErrorBoundary from "./ErrorBoundary";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

export const C = { bl: "#0a84ff", gr: "#30d158", rd: "#ff453a", am: "#ff9f0a", pu: "#bf5af2", pk: "#ff375f", t: "#f5f5f7", t2: "#98989d", t3: "#6e6e73" };

// shared dark-theme axis/grid/tooltip styling for analytical (not marketing) charts
export const axisBase = {
  animation: false, // analytical charts; prevents re-animation thrash when scrubbing
  textStyle: { fontFamily: "Inter", color: C.t2 },
  grid: { left: 64, right: 24, top: 28, bottom: 64, containLabel: false },
  tooltip: {
    trigger: "axis",
    backgroundColor: "rgba(28,28,30,0.97)", borderColor: "rgba(255,255,255,0.1)", borderWidth: 1,
    textStyle: { color: C.t, fontSize: 12 }, padding: 12,
  },
  legend: { textStyle: { color: C.t2, fontSize: 11 }, top: 0, icon: "roundRect", itemHeight: 8, itemWidth: 16 },
};

export const catAxis = (data: string[]) => ({
  type: "category", data, boundaryGap: false,
  axisLine: { lineStyle: { color: "rgba(255,255,255,0.12)" } },
  axisLabel: { color: C.t3, fontSize: 10 },
  splitLine: { show: false },
});

export const valAxis = (fmt?: (v: number) => string) => ({
  type: "value",
  axisLine: { show: false }, axisTick: { show: false },
  axisLabel: { color: C.t3, fontSize: 10, formatter: fmt ? (v: number) => fmt(v) : undefined },
  splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } },
});

export default function EChart({ option, height = 340 }: { option: any; height?: number }) {
  return (
    <ErrorBoundary fallback={<div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t3)", fontSize: 12 }}>chart updating…</div>}>
      <ReactECharts option={option} notMerge={false} lazyUpdate style={{ height, width: "100%" }} opts={{ renderer: "canvas" }} />
    </ErrorBoundary>
  );
}
