"use client";
import { useState } from "react";

/* InfoTip — a "?" you can hover/tap for a plain-language explanation. */
export function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span
        onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onClick={() => setOpen((o) => !o)}
        style={{ cursor: "help", display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 16, height: 16, borderRadius: "50%", border: "1px solid var(--bh)", color: "var(--t3)",
          fontSize: 10, fontWeight: 700, marginLeft: 6, verticalAlign: "middle" }}>?</span>
      {open && (
        <span style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: "140%", zIndex: 200,
          width: 240, background: "rgba(28,28,30,0.98)", border: "1px solid var(--bh)", borderRadius: 10,
          padding: "10px 12px", fontSize: 12, fontWeight: 400, color: "var(--t2)", lineHeight: 1.5,
          boxShadow: "0 8px 30px rgba(0,0,0,.5)", textTransform: "none", letterSpacing: 0 }}>{text}</span>
      )}
    </span>
  );
}

/* Explainer — a plain-language banner. "In plain English: ..." */
export function Explainer({ children, tone = "bl" }: { children: React.ReactNode; tone?: string }) {
  const c = `var(--${tone})`;
  return (
    <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid var(--b)", borderLeft: `3px solid ${c}`,
      borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "var(--t2)", lineHeight: 1.55, marginBottom: 16 }}>
      <span style={{ color: c, fontWeight: 700, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginRight: 8 }}>In plain English</span>
      {children}
    </div>
  );
}

/* HowItWorks — a collapsible "show me the maths" panel so nothing is a black box. */
export function HowItWorks({ title = "How this works", steps }: { title?: string; steps: { title: string; detail: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card tight" style={{ marginTop: 16 }}>
      <button onClick={() => setOpen((o) => !o)}
        style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, width: "100%",
          fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--t3)" }}>
        <span style={{ transform: open ? "rotate(90deg)" : "none", transition: ".15s", display: "inline-block" }}>▸</span>
        {title} — {open ? "hide" : "show the maths, no black box"}
      </button>
      {open && (
        <ol style={{ margin: "14px 0 2px 0", padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
          {steps.map((s, i) => (
            <li key={i} style={{ display: "flex", gap: 12 }}>
              <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: "50%", background: "rgba(10,132,255,.16)",
                color: "var(--bl)", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
              <span style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.5 }}><b style={{ color: "var(--t)" }}>{s.title}.</b> {s.detail}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
