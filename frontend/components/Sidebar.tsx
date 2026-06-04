"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

function HQIco() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="3" y="5" width="4" height="4" rx=".8" stroke="currentColor" strokeWidth="1"/><rect x="9" y="5" width="4" height="7" rx=".8" stroke="currentColor" strokeWidth="1"/><rect x="3" y="11" width="4" height="3" rx=".8" stroke="currentColor" strokeWidth="1"/></svg>; }
function InboxIco() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M1 9h4l1.5 2h3L11 9h4" stroke="currentColor" strokeWidth="1.3"/></svg>; }
function RadarIco() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3"/><circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1"/><path d="M8 2v3M8 11v3M2 8h3M11 8h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>; }
function InventoryIco() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="14" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="1" y="10" width="14" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M4 3.5h8M4 12.5h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>; }
function ScaleIco() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M5 2l-3 12h12L11 2H5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M8 2v12" stroke="currentColor" strokeWidth="1.3"/></svg>; }
function MarketingIco() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 7a6 6 0 0112 0M4 7a4 4 0 018 0" stroke="currentColor" strokeWidth="1.3"/><path d="M8 7l2 7M8 7l-2 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>; }
function PnLIco() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 12l4-5 3 3 5-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M11 3h4v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function SizingIco() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M1 5h14M1 8h14M1 11h14" stroke="currentColor" strokeWidth="1"/></svg>; }
function GrowthIco() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 14l4-6 3 2 5-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M11 3h4v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function SupplyIco() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="4" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M4 4V2.5A1.5 1.5 0 015.5 1h5A1.5 1.5 0 0112 2.5V4" stroke="currentColor" strokeWidth="1.3"/></svg>; }
function SupportIco() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M14 8A6 6 0 112 8a6 6 0 0112 0z" stroke="currentColor" strokeWidth="1.3"/><path d="M6 6.5c0-1 .9-1.5 2-1.5s2 .5 2 1.5c0 1.5-2 2-2 3v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><circle cx="8" cy="12" r=".8" fill="currentColor"/></svg>; }
function SimIco() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 3h12v10H2z" stroke="currentColor" strokeWidth="1.3" rx="1"/><path d="M5 1v2M11 1v2M2 6h12" stroke="currentColor" strokeWidth="1.3"/></svg>; }
function ChatIco() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 2h14v9H5l-4 3V2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>; }

const NAV = [
  { href: "/", label: "Agent HQ", ico: HQIco },
  { href: "/inbox", label: "Action Inbox", ico: InboxIco },
  { section: "Operations" },
  { href: "/cashradar", label: "Cash Radar", ico: RadarIco },
  { href: "/inventory", label: "StockSense", ico: InventoryIco },
  { href: "/scenarios", label: "Cash Engine", ico: ScaleIco },
  { href: "/marketing", label: "Marketing", ico: MarketingIco },
  { section: "Departments" },
  { href: "/pnl", label: "Finance · P&L", ico: PnLIco },
  { href: "/sizing", label: "Fit & Sizing", ico: SizingIco },
  { href: "/customers", label: "Growth · CRM", ico: GrowthIco },
  { href: "/suppliers", label: "Supply Chain", ico: SupplyIco },
  { href: "/support", label: "Support", ico: SupportIco },
  { section: "Intelligence" },
  { href: "/simulator", label: "Backtest Proof", ico: SimIco },
  { href: "/chat", label: "WC Agent", ico: ChatIco },
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
            <span className="ico"><n.ico /></span> {n.label}
          </Link>
        )
      )}
      <div className="side-foot">
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
          <span className={`dot ${health?.ok ? "live" : "off"}`} />
          {health?.ok ? "Live" : "Connecting..."} · {health?.db || "\u2014"} db
        </div>
        WC Agent: {health?.llm ? "Claude + grounded" : "grounded (offline)"}<br />
        24 months · 645 SKUs · GBP
      </div>
    </aside>
  );
}
