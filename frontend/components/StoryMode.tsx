"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Step = { route: string; title: string; caption: string; secs: number };

const STEPS: Step[] = [
  { route: "/", title: "Meet your AI workforce", secs: 22,
    caption: "You're the CEO of Pretty Fly. This is your staff — ten AI agents for cash, inventory, marketing, finance, fit, growth, supply, support, risk and demand. Each reads the same live data and tells you what to do." },
  { route: "/inbox", title: "Run the company in one swipe", secs: 22,
    caption: "Every recommendation lands here as a card, backed by the data. Swipe right to approve, left to skip. £706k of moves, triaged for you — like Tinder for running your business." },
  { route: "/cashradar", title: "The crisis it saw coming", secs: 26,
    caption: "Drag the timeline. White is what happened; red dashed is the 30-day forecast from that day. Their worst day was −£274k — called 20 days early from supplier bills the data already knew about." },
  { route: "/inventory", title: "Every SKU scored & explained", secs: 20,
    caption: "All 645 products scored 0–100. Tap a card: it shows exactly why, the size curve to reorder, and the sales trend. No black box." },
  { route: "/marketing", title: "✦ The magic: ads → inventory → cash", secs: 28,
    caption: "They burn £32k on a 1.5× campaign while TikTok prints £324k for free. And watch the live link: ad demand for Tees jumps while Tees are out of stock → the system auto-flags a reorder before the launch sells out." },
  { route: "/simulator", title: "The proof", secs: 24,
    caption: "Trained on months 1–12, replayed the REAL months 13–24. If Pretty Fly had used this, they'd be ~£764k better off — actual revenue vs with-the-tool, measured against what truly happened." },
  { route: "/chat", title: "And it speaks MCP", secs: 18,
    caption: "Ask any agent in plain English — answers cite real SKUs, dates and pounds. Wire it into Claude Desktop over MCP and run the whole company from chat." },
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
