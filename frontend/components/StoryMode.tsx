"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Step = { route: string; title: string; caption: string; secs: number };

const STEPS: Step[] = [
  { route: "/", title: "The problem, one screen", secs: 22,
    caption: "Pretty Fly buys the right products in the wrong quantities. £205k is frozen in overstock while best-sellers sit empty — bleeding £124k every month." },
  { route: "/cashradar", title: "The crisis it saw coming", secs: 26,
    caption: "Their worst day was −£274k. Our Cash Radar called it 20 days early — from three supplier payments the data already knew about. Then it offers three ways to fix it." },
  { route: "/inventory", title: "Every SKU, scored & explained", secs: 22,
    caption: "All 645 products scored 0–100 on urgency, demand and trend. Tap any card and it tells you, in plain English, exactly why — no black box." },
  { route: "/marketing", title: "Where the money leaks", secs: 28,
    caption: "They burn £32k on a campaign returning 1.5× (below break-even) while TikTok quietly prints £324k for free. Move the budget → +£101k revenue." },
  { route: "/marketing", title: "✦ The magic: ads → inventory", secs: 26,
    caption: "Watch it connect: ad demand for Tees just jumped — but Tees are already out of stock. The system auto-flags a reorder before the launch sells out. Marketing and inventory, talking to each other." },
  { route: "/simulator", title: "The proof", secs: 26,
    caption: "We trained on months 1–12, then replayed the REAL months 13–24. If Pretty Fly had used this, they'd be ~£764k better off. Revenue line lifts, measured against what actually happened." },
  { route: "/chat", title: "Just ask it", secs: 20,
    caption: "And anyone can drive it — ask a plain question, get an answer that cites real SKUs, dates and pounds." },
];

export default function StoryMode() {
  const router = useRouter();
  const [on, setOn] = useState(false);
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);

  useEffect(() => { if (on) router.push(STEPS[i].route); }, [i, on]);
  useEffect(() => {
    if (!on || !auto) return;
    const t = setTimeout(() => { i < STEPS.length - 1 ? setI(i + 1) : stop(); }, STEPS[i].secs * 1000);
    return () => clearTimeout(t);
  }, [on, auto, i]);

  const start = () => { setI(0); setOn(true); setAuto(true); };
  const stop = () => { setOn(false); };

  if (!on) return (
    <button onClick={start} title="Auto-play the 3-minute story"
      style={{ position: "fixed", right: 22, bottom: 22, zIndex: 300, fontFamily: "inherit", fontSize: 13, fontWeight: 700,
        padding: "12px 18px", borderRadius: 14, border: "none", cursor: "pointer", color: "#fff",
        background: "linear-gradient(135deg,#0a84ff,#bf5af2)", boxShadow: "0 8px 28px rgba(10,132,255,.4)" }}>
      ▶ Play 3-min demo
    </button>
  );

  const s = STEPS[i];
  return (
    <div style={{ position: "fixed", left: "var(--sidebar)", right: 0, bottom: 0, zIndex: 300,
      background: "linear-gradient(0deg,rgba(0,0,0,.96),rgba(0,0,0,.82))", borderTop: "1px solid var(--bh)",
      padding: "16px 28px", backdropFilter: "blur(20px)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase",
            color: "var(--pu)" }}>Story {i + 1}/{STEPS.length}</span>
          <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: -.3 }}>{s.title}</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="chip" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>‹ Back</button>
            <button className="chip" onClick={() => setAuto((a) => !a)}>{auto ? "⏸ Pause" : "▶ Auto"}</button>
            <button className="chip" onClick={() => (i < STEPS.length - 1 ? setI(i + 1) : stop())}>{i < STEPS.length - 1 ? "Next ›" : "Finish"}</button>
            <button className="chip" onClick={stop}>✕ Exit</button>
          </div>
        </div>
        <p style={{ fontSize: 14, color: "var(--t)", lineHeight: 1.5, margin: 0 }}>{s.caption}</p>
        <div style={{ display: "flex", gap: 4, marginTop: 12 }}>
          {STEPS.map((_, j) => (
            <div key={j} style={{ flex: 1, height: 3, borderRadius: 2, background: j <= i ? "var(--bl)" : "rgba(255,255,255,.12)", transition: ".3s" }} />
          ))}
        </div>
      </div>
    </div>
  );
}
