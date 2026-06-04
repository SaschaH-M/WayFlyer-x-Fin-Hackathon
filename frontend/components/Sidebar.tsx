"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const NAV = [
  { section: "Operator" },
  { href: "/", label: "Dashboard", ico: "◎" },
  { href: "/cashradar", label: "Cash Radar", ico: "📡" },
  { href: "/inventory", label: "StockSense", ico: "▦" },
  { href: "/scenarios", label: "Cash Engine", ico: "⚖" },
  { section: "Intelligence" },
  { href: "/simulator", label: "Backtest Proof", ico: "⏮" },
  { href: "/chat", label: "WC Agent", ico: "✦" },
];

export default function Sidebar() {
  const path = usePathname();
  const [health, setHealth] = useState<any>(null);
  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth({ ok: false }));
  }, []);
  return (
    <aside className="sidebar">
      <div className="brand">
        Stock<span className="ss">Sense</span> · <span className="pf">WC</span>
        <span className="sub">PRETTY FLY · WORKING CAPITAL OS</span>
      </div>
      {NAV.map((n, i) =>
        "section" in n ? (
          <div className="nav-section" key={i}>{n.section}</div>
        ) : (
          <Link key={n.href} href={n.href!}
            className={`navlink ${path === n.href ? "active" : ""}`}>
            <span className="ico">{n.ico}</span> {n.label}
          </Link>
        )
      )}
      <div className="side-foot">
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
          <span className={`dot ${health?.ok ? "live" : "off"}`} />
          {health?.ok ? "Live" : "Connecting…"} · {health?.db || "—"} db
        </div>
        WC Agent: {health?.llm ? "Claude + grounded" : "grounded (offline)"}<br />
        24 months · 645 SKUs · GBP
      </div>
    </aside>
  );
}
