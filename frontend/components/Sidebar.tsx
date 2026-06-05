"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const NAV = [
  { href: "/", label: "Agent HQ", ico: "🏢" },
  { href: "/inbox", label: "Action Inbox", ico: "⚡" },
  { section: "Operations" },
  { href: "/cashradar", label: "Cash Radar", ico: "📡" },
  { href: "/inventory", label: "StockSense", ico: "▦" },
  { href: "/scenarios", label: "Cash Engine", ico: "⚖" },
  { href: "/marketing", label: "Marketing", ico: "📣" },
  { section: "Departments" },
  { href: "/pnl", label: "Finance · P&L", ico: "⚖" },
  { href: "/sizing", label: "Fit & Sizing", ico: "📐" },
  { href: "/customers", label: "Growth · CRM", ico: "📈" },
  { href: "/suppliers", label: "Supply Chain", ico: "🚢" },
  { href: "/support", label: "Support", ico: "💬" },
  { section: "Intelligence" },
  { href: "/simulator", label: "Backtest Proof", ico: "⏮" },
  { href: "/chat", label: "WC Agent", ico: "✦" },
];

export default function Sidebar() {
  const path = usePathname();
  const [health, setHealth] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [saved, setSaved] = useState(false);
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth({ ok: false }));
    setKeyInput(localStorage.getItem("deepseek_key") || "");
    setHasKey(!!localStorage.getItem("deepseek_key"));
  }, []);

  function saveKey() {
    if (keyInput.trim()) {
      localStorage.setItem("deepseek_key", keyInput.trim());
      setHasKey(true);
    } else {
      localStorage.removeItem("deepseek_key");
      setHasKey(false);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <>
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
          <div style={{ marginTop: 8 }}>
            <button
              onClick={() => setShowSettings(true)}
              className="chip"
              style={{ fontSize: 10, padding: "3px 8px", cursor: "pointer" }}
            >
              ⚙ Settings
            </button>
            {hasKey && (
              <span style={{ fontSize: 9, color: "var(--gr)", marginLeft: 6 }}>DS ✓</span>
            )}
          </div>
        </div>
      </aside>

      {showSettings && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,.65)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setShowSettings(false)}>
          <div style={{
            background: "var(--bg)", border: "1px solid var(--bh)", borderRadius: 18,
            padding: "24px 28px", maxWidth: 440, width: "90%",
            boxShadow: "0 12px 60px rgba(0,0,0,.6)",
          }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-.3px", marginBottom: 4 }}>⚙ Settings</h2>
            <p style={{ fontSize: 12, color: "var(--t2)", marginBottom: 16 }}>
              Add a DeepSeek API key to enable the agent chatbot on each department page.
              Your key is stored only in your browser (localStorage).
            </p>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--t2)", display: "block", marginBottom: 4 }}>
              DeepSeek API Key
            </label>
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="sk-..."
              style={{
                width: "100%", background: "var(--bg2)", border: "1px solid var(--bh)", borderRadius: 10,
                padding: "10px 14px", fontSize: 13, color: "var(--t)", fontFamily: "monospace",
                outline: "none", boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button className="btn primary" onClick={saveKey} style={{ flex: 1 }}>
                {saved ? "✓ Saved" : "Save"}
              </button>
              <button className="btn" onClick={() => setShowSettings(false)}>Close</button>
            </div>
            {keyInput.trim() && (
              <p style={{ fontSize: 10, color: "var(--gr)", marginTop: 8 }}>
                Key set — agent chats will use DeepSeek.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
