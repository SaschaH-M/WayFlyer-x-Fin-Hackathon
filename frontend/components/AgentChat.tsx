"use client";
import { useState, useRef, useEffect } from "react";

const AGENTS = [
  { id: "gordon", name: "Gordon", role: "Cash & Treasury", dept: "Treasury", icon: "📡", color: "#0a84ff",
    greeting: "Hey, I'm Gordon. I manage your cash flow and treasury. I caught the £274K cash crisis 20 days early — ask me how.",
    pills: ["How did you spot the cash crisis?", "What remedies do you recommend?", "How much cash can we free?"],
    demo: {
      "How did you spot the cash crisis?": "I project cash 30 days forward from every date in the 24-month bank ledger. On 17 March 2025, your balance dipped to −£274K — the supplier bills, payroll, and ad spend all converged. The system flagged it 20 days before it hit because the purchase order deadlines were already in the data.",
      "What remedies do you recommend?": "Three levers: **(A) Delay PO #12** to push £172K out of the danger window. **(B) Mark down overstock** to free ~£205K in 60 days at 30% off. **(C) A Wayflyer bridge** of £275K to float the gap if you can't move stock fast enough. Option B is the recommended balance — it funds the reorder list with zero debt.",
      "How much cash can we free?": "£205K trapped in overstock inventory — that's product sitting >12 months of cover. At 30% markdown with 70% sell-through, that's ~£143K net cash freed. Every £1 freed and reallocated to stockout best-sellers generates ~£8 in annual revenue.",
    },
  },
  { id: "ripley", name: "Ripley", role: "Inventory", dept: "Inventory", icon: "▦", color: "#30d158",
    greeting: "Hey, I'm Ripley. I score all 645 SKUs 0–100 and tell you what to reorder, mark down, or watch. 362 items need reordering right now.",
    pills: ["Which SKUs should I reorder first?", "How much is trapped in overstock?", "What's the StockSense score?"],
    demo: {
      "Which SKUs should I reorder first?": "Start with the 206 SKUs that are completely out of stock — they're lost revenue every day. Top picks: **Classic Tee (White, M)** has a score of 92/100 and 1,847 units of pent-up demand. **Hoodie (Black, L)** at 88/100. The system gives you exact size splits too — e.g. Classic Tee → XS 210, S 460, M 620, L 380, XL 177.",
      "How much is trapped in overstock?": "£205K across 118 SKUs flagged for markdown. These have >12 months of stock cover at current sell-through rates. Marking them down at 30% with 70% sell-through frees ~£143K — enough to fund the full reorder list for the stockout best-sellers.",
      "What's the StockSense score?": "Every SKU gets a 0–100 score: **0–50 points** for inventory urgency (how close to stockout), **0–30 points** for demand intensity (how much revenue it drives), and **0–20 points** for trend momentum (is it accelerating?). 50+ = Watch, 70+ = Reorder. 362 SKUs score above 70 right now.",
    },
  },
  { id: "draper", name: "Draper", role: "Marketing", dept: "Marketing", icon: "📣", color: "#bf5af2",
    greeting: "Hey, I'm Draper. I track true ROAS per campaign and find wasted ad spend. I found £56K in losing campaigns and a £324K TikTok goldmine.",
    pills: ["Which campaigns are wasting money?", "What's the TikTok insight?", "How does marketing connect to inventory?"],
    demo: {
      "Which campaigns are wasting money?": "Three campaigns run below the 1.8× break-even ROAS: **Google Brand (1.5×)** burning £32K, **Meta Retargeting (1.3×)** burning £18K, and **Google Display (1.1×)** burning £6K. That's £56K in annual spend that earns back less than it costs. Reallocate to winners like Google Shopping (4.2×) and Meta Prospecting (3.7×) — projected gain is ~£101K more revenue.",
      "What's the TikTok insight?": "TikTok is a free channel — Pretty Fly doesn't run paid ads there, but **£324K in revenue** came through TikTok organically. That's the highest revenue of any channel with £0 tracked ad spend. The data says: formalise TikTok content, even a tiny paid boost could 3-5× what's already working for free.",
      "How does marketing connect to inventory?": "This is the magic link. When ad demand for a product type surges (e.g. Tees are up 42%), and those SKUs are already out of stock, I automatically flag it to Ripley in Inventory. The freed cash from overstock funds the reorder — ads → inventory → cash, all in one loop. We caught the Tee surge 2 weeks before the launch would have sold out.",
    },
  },
  { id: "hamilton", name: "Hamilton", role: "Finance / P&L", dept: "Finance", icon: "⚖", color: "#ff9f0a",
    greeting: "Hey, I'm Hamilton. I track every pound across 24 months — revenue, COGS, fees, net margin. Your net margin is 7.2% over the period.",
    pills: ["What's our net margin trend?", "Where are costs growing?", "How does cash freed impact P&L?"],
    demo: {
      "What's our net margin trend?": "Over 24 months, net margin averages **7.2%** but it's volatile. Best month was **9.8%** (Nov '24), worst was **3.1%** (Mar '25 — the cash crisis month). The good news: H2 is trending up at 8.1% vs H1 at 6.3%. The reorder + markdown play could lift margin by ~140bps annually.",
      "Where are costs growing?": "Biggest cost growth drivers: **COGS** is steady at ~58% of revenue — healthy. But **ad spend** grew 22% YoY while only driving 9% more revenue — that's Draper's domain. **Refunds** at 7.8% of revenue, mostly sizing issues. **Payment processing fees** creeping up 40bps. The sizing fix alone could recover ~£90K in margin.",
      "How does cash freed impact P&L?": "Reallocating £143K from overstock to reordering best-sellers at 8.3× revenue multiplier = ~£1.19M in incremental annual revenue. At 7.2% net margin, that's ~£86K extra net profit. Plus you save ~£12K/year in warehousing costs on the cleared overstock. The P&L impact compounds every cycle.",
    },
  },
  { id: "edna", name: "Edna", role: "Merchandising / Fit", dept: "Merchandising", icon: "📐", color: "#ff375f",
    greeting: "Hey, I'm Edna. I analyse returns by size and shape your size curve. 31% of all refunds are sizing problems.",
    pills: ["What's wrong with our sizing?", "What's the real size curve?", "How do I fix fit issues?"],
    demo: {
      "What's wrong with our sizing?": "**31% of all refunds** are size-related — that's ~£187K in lost revenue over 24 months. 'Too small' returns outnumber 'too large' by 1.4×, meaning your range **systematically runs small**. The worst offenders: Jackets (42% of returns cite sizing) and Trousers (37%). A simple fit note on the product page could cut returns by 25%.",
      "What's the real size curve?": "Your actual demand curve is: **XS 8%, S 22%, M 34%, L 24%, XL 12%**. But if you look at what sizes sell out first, M and L consistently sell out 2× faster than you restock them. Your PO sizes are too flat — you're under-ordering M and L by ~18% and over-ordering XS by ~9%.",
      "How do I fix fit issues?": "Three fixes: **(1) Grade up** jackets and trousers one half-size — the return data says they run small. **(2) Add a 'fits small — size up'** note on product pages for flagged lines. **(3) Reorder to the real curve**: 34% M, 24% L, 22% S, not flat 20% each. Edna and Ripley already talk — your reorder suggestions include the corrected size splits.",
    },
  },
  { id: "gatsby", name: "Gatsby", role: "Growth / CRM", dept: "Growth", icon: "📈", color: "#30d158",
    greeting: "Hey, I'm Gatsby. I track lifetime value by channel. Your best customers come through organic search — £142 LTV.",
    pills: ["Which channel has the best LTV?", "Where should we spend more?", "What's the repeat purchase rate?"],
    demo: {
      "Which channel has the best LTV?": "**Organic Search** leads at £142 LTV with 3,840 customers. Close second: **Direct** at £128 LTV (5,100 customers). The worst: **Paid Social** at £68 LTV despite 6,200 customers — you're acquiring lots of low-value customers there. TikTok organic customers have £94 LTV with zero acquisition cost.",
      "Where should we spend more?": "Double down on **SEO** — organic search customers are worth 2.1× more than paid social customers and cost nothing to acquire. **Email** customers have £118 LTV with strong repeat rates. Shift £20K from low-ROAS paid social to email nurture flows — projected 30% LTV uplift in that cohort.",
      "What's the repeat purchase rate?": "Overall repeat rate is **28%** — 6,280 of 22,440 customers bought more than once. Organic search leads at 34% repeat. Paid social only 19% — these are one-and-done bargain hunters. The average time between first and second purchase is 47 days. A well-timed email at day 40 could lift repeats by ~15%.",
    },
  },
  { id: "marco", name: "Marco", role: "Supply Chain", dept: "Supply", icon: "🚢", color: "#5e5ce6",
    greeting: "Hey, I'm Marco. I track supplier lead times and on-time rates. Long lead times are silently killing your stockouts.",
    pills: ["Which supplier is the bottleneck?", "How do lead times cause stockouts?", "What's the fix?"],
    demo: {
      "Which supplier is the bottleneck?": "**ThreadWorks** has a 63-day lead time with only 71% on-time delivery — and they supply 142 of your SKUs. When they're late, 38% of their SKUs go out of stock before the next PO arrives. **FastStitch** is your best at 22 days / 94% on-time but only supplies 31 SKUs.",
      "How do lead times cause stockouts?": "The math is brutal: if a SKU sells 12 units/week and ThreadWorks takes 63 days (9 weeks), you need 108 units of safety stock. But you're ordering to a 45-day assumption. That 18-day gap = ~22 units of lost sales per reorder cycle per SKU. Across 142 SKUs, that's ~3,100 units/year in avoidable stockouts.",
      "What's the fix?": "**(1) Dual-source** the top 20 ThreadWorks SKUs with FastStitch where possible. **(2) Increase safety stock** by 40% on ThreadWorks items until lead times improve. **(3) Add lead-time buffer** to Ripley's reorder logic — she currently doesn't account for supplier variance. Marco and Ripley are now linked: your reorder suggestions include supplier-adjusted lead times.",
    },
  },
  { id: "baymax", name: "Baymax", role: "Customer Support", dept: "Support", icon: "💬", color: "#0a84ff",
    greeting: "Hey, I'm Baymax. I triage your support tickets. 74% are linked to an order — a bot with order data could handle 64% automatically.",
    pills: ["What can a support bot handle?", "How many hours can we save?", "What are the top ticket categories?"],
    demo: {
      "What can a support bot handle?": "**64% of tickets** are automatable with order data access. The top categories: 'Where is my order?' (38%), returns/exchanges (18%), restock requests (5%), and discount code issues (3%). These are all mechanically resolvable — the bot can pull tracking, initiate returns, check inventory, and verify codes instantly.",
      "How many hours can we save?": "Currently only **12%** of tickets are handled by a bot. Moving to the full 64% potential frees up ~**1,840 agent-hours** per year. That's roughly one full-time support agent you can redeploy to complex cases. At £18/hour fully loaded, that's ~£33K in annual savings.",
      "What are the top ticket categories?": "1. **Order status** (38%) — 'where's my order' 2. **Returns/exchanges** (18%) 3. **Product questions** (12%) 4. **Shipping issues** (9%) 5. **Discount codes** (5%) 6. **Restock inquiries** (4%) 7. **Complaints** (3%) 8. **Other** (11%). The first five = 82% of volume and are all automatable with access to order + inventory + marketing data.",
    },
  },
  { id: "delphi", name: "Delphi", role: "Demand Forecast", dept: "Demand", icon: "🔮", color: "#bf5af2",
    greeting: "Hey, I'm Delphi. I backtest the system against reality. The tool would have made Pretty Fly ~£764K better off.",
    pills: ["How accurate is the forecast?", "What's the £764K proof?", "Which products are trending up?"],
    demo: {
      "How accurate is the forecast?": "We trained StockSense on months 1–12 of actual data, then replayed months 13–24 as if you had the tool. **56.9% of reorder flags** were correct — those SKUs actually sold out during the test period. That's strong for an inventory system working purely from sales velocity. The markdown flags were even better: 82% of flagged items ended up with >12 months of cover.",
      "What's the £764K proof?": "Here's the math, all measured against what ACTUALLY happened: **(1)** £637K in cash freed from correctly flagged overstock. **(2)** 206 stockouts avoided by reordering before they hit zero. **(3)** £127K in recovered revenue from those avoided stockouts. Total impact: **£764K** — and that's conservative. The tool only needed 12 months of history to get that right.",
      "Which products are trending up?": "**Tees** (+42% in recent 3 months vs prior), **Hoodies** (+28%), and **Caps** (+19%) are all accelerating. Tees specifically — the ad demand surge from Draper's data PLUS the velocity trend makes this the #1 reorder priority. **Jackets** are trending down (−8%) — consider reducing future POs for outerwear and shifting that budget to tees and hoodies.",
    },
  },
];

type AgentInfo = typeof AGENTS[0];
type Msg = { role: "user" | "assistant"; content: string };

export default function AgentChat({ agent }: { agent: { name: string; role: string; dept: string; icon: string; greeting: string } }) {
  const [open, setOpen] = useState(false);
  const [activeAgent, setActiveAgent] = useState<AgentInfo>(
    AGENTS.find(a => a.name === agent.name) || AGENTS[0]
  );
  const [messages, setMessages] = useState<Msg[]>([{
    role: "assistant",
    content: activeAgent.greeting,
  }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [hoverAgent, setHoverAgent] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [savedKey, setSavedKey] = useState(() =>
    typeof window !== "undefined" ? (localStorage.getItem("deepseek_key") || "") : ""
  );
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  function switchAgent(a: AgentInfo) {
    setActiveAgent(a);
    setMessages([{ role: "assistant", content: a.greeting }]);
  }

  async function send(q?: string) {
    const question = (q || input).trim();
    if (!question || busy) return;

    setMessages((m) => [...m, { role: "user", content: question }]);
    if (!q) setInput("");
    setBusy(true);

    const demoAnswer = (activeAgent.demo as any)[question];
    if (demoAnswer) {
      await new Promise(r => setTimeout(r, 400));
      setMessages((m) => [...m, { role: "assistant", content: demoAnswer }]);
      setBusy(false);
      return;
    }

    const apiKey = savedKey || (typeof window !== "undefined" ? localStorage.getItem("deepseek_key") : null);
    if (!apiKey) {
      setShowSettings(true);
      setMessages((m) => [...m, { role: "assistant", content: "Add a DeepSeek API key in ⚙ Settings (top-right of this chat) to enable free-form questions. The suggested pills above work offline." }]);
      setBusy(false);
      return;
    }

    const hist = [...messages, { role: "user" as const, content: question }];
    try {
      const r = await fetch("/api/agent-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: hist.map(({ role, content }) => ({ role, content })),
          api_key: apiKey,
          system: `You are ${activeAgent.name}, the ${activeAgent.role} AI agent for Pretty Fly, a London streetwear brand. You work in the ${activeAgent.dept} department. Keep answers concise, data-driven, and specific to your department. Use GBP (£) currency. Be friendly and direct.`,
        }),
      });
      const d = await r.json();
      setMessages((m) => [...m, { role: "assistant", content: d.content || d.error || "No response." }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Chat unavailable — is the backend running?" }]);
    }
    setBusy(false);
  }

  return (
    <div style={{
      position: "fixed", right: 22, bottom: 22, zIndex: 250,
      width: open ? 440 : "auto",
    }}>
      {/* collapsed pill */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            fontFamily: "inherit", fontSize: 13, fontWeight: 700, border: "1px solid var(--bh)",
            borderRadius: 16, padding: "10px 16px", cursor: "pointer", color: "var(--t)",
            background: "linear-gradient(135deg, rgba(10,132,255,.15), rgba(10,132,255,.06))",
            backdropFilter: "blur(20px)", display: "flex", alignItems: "center", gap: 10,
            boxShadow: "0 4px 20px rgba(0,0,0,.4)",
            animation: "fadeUp .4s ease",
          }}
        >
          <span style={{ fontSize: 22 }}>{activeAgent.icon}</span>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-.2px" }}>{activeAgent.name}</div>
            <div style={{ fontSize: 10, color: "var(--t3)" }}>{activeAgent.role} — ask me anything</div>
          </div>
        </button>
      )}

      {/* expanded chat */}
      {open && (
        <div style={{
          background: "var(--bg)", border: "1px solid var(--bh)", borderRadius: 18,
          boxShadow: "0 8px 40px rgba(0,0,0,.55)", overflow: "hidden",
          display: "flex", flexDirection: "column", maxHeight: 580,
          animation: "fadeUp .25s ease",
        }}>
          {/* agent selector strip */}
          <div style={{
            display: "flex", gap: 6, padding: "10px 12px", overflowX: "auto",
            borderBottom: "1px solid var(--bh)",
            background: "linear-gradient(135deg, rgba(10,132,255,.08), transparent)",
          }}>
            {AGENTS.map((a) => {
              const isActive = a.id === activeAgent.id;
              const isHovered = hoverAgent === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => switchAgent(a)}
                  onMouseEnter={() => setHoverAgent(a.id)}
                  onMouseLeave={() => setHoverAgent(null)}
                  title={`${a.name} · ${a.role}`}
                  style={{
                    flexShrink: 0, width: 40, height: 40, borderRadius: 12, border: isActive ? `2px solid ${a.color}` : "2px solid transparent",
                    background: isActive ? `${a.color}18` : "rgba(255,255,255,.04)",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 19, transition: "all .2s ease",
                    transform: isHovered && !isActive ? "scale(1.12)" : "scale(1)",
                    opacity: isActive ? 1 : 0.55,
                  }}
                >
                  {a.icon}
                </button>
              );
            })}
          </div>

          {/* header */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
            borderBottom: "1px solid var(--bh)",
          }}>
            <span style={{ fontSize: 24 }}>{activeAgent.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-.2px", color: activeAgent.color }}>{activeAgent.name}</div>
              <div style={{ fontSize: 10, color: "var(--t3)" }}>{activeAgent.role}{savedKey ? " · DeepSeek connected" : ""}</div>
            </div>
            <button className="chip" title="DeepSeek API key" onClick={() => setShowSettings((s) => !s)}
              style={{ fontSize: 12, padding: "5px 9px", borderColor: savedKey ? "rgba(48,209,88,.4)" : undefined }}>
              {savedKey ? "✓ Key" : "⚙ Key"}
            </button>
            <button className="chip" onClick={() => setOpen(false)} style={{ fontSize: 16 }}>✕</button>
          </div>

          {/* settings panel */}
          {showSettings && (
            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--bh)", background: "rgba(255,255,255,.02)" }}>
              <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 6 }}>
                DeepSeek API key — enables free-form questions. Get one at{" "}
                <a href="https://platform.deepseek.com" target="_blank" rel="noreferrer" style={{ color: "var(--bl)" }}>platform.deepseek.com</a>.
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)}
                  placeholder={savedKey ? "••••••••••• (saved)" : "sk-…"}
                  style={{ flex: 1, background: "rgba(255,255,255,.04)", border: "1px solid var(--bh)", borderRadius: 8,
                    padding: "7px 10px", fontSize: 12, color: "var(--t)", fontFamily: "inherit", outline: "none" }}
                />
                <button className="btn primary" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => {
                  const k = keyInput.trim();
                  if (k) { localStorage.setItem("deepseek_key", k); setSavedKey(k); setKeyInput(""); setShowSettings(false); }
                }}>Save</button>
                {savedKey && <button className="btn" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => {
                  localStorage.removeItem("deepseek_key"); setSavedKey(""); setKeyInput(""); setShowSettings(false);
                }}>Clear</button>}
              </div>
            </div>
          )}

          {/* messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10, maxHeight: 240 }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "88%", fontSize: 12.5, lineHeight: 1.5, padding: "9px 13px", borderRadius: 14,
                background: m.role === "user" ? "var(--bl)" : "rgba(255,255,255,.06)",
                color: m.role === "user" ? "#fff" : "var(--t)",
                animation: "fadeUp .3s ease",
              }}>
                <span dangerouslySetInnerHTML={{ __html: m.content.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>") }} />
              </div>
            ))}
            {busy && (
              <div style={{ alignSelf: "flex-start", display: "flex", gap: 4, padding: "4px 0" }}>
                {[0, 1, 2].map((d) => (
                  <div key={d} style={{
                    width: 6, height: 6, borderRadius: "50%", background: "var(--t3)",
                    animation: `pulse2 1.2s ${d * 0.15}s infinite`,
                  }} />
                ))}
              </div>
            )}
            <div ref={bottom} />
          </div>

          {/* suggestion pills */}
          <div style={{
            display: "flex", gap: 6, padding: "8px 12px", flexWrap: "wrap",
            borderTop: "1px solid var(--bh)",
          }}>
            {activeAgent.pills.map((pill) => (
              <button
                key={pill}
                onClick={() => send(pill)}
                disabled={busy}
                style={{
                  fontFamily: "inherit", fontSize: 11, fontWeight: 600, border: "1px solid var(--bh)",
                  borderRadius: 14, padding: "6px 12px", cursor: "pointer",
                  background: "rgba(255,255,255,.04)", color: "var(--t2)",
                  transition: "all .15s ease", whiteSpace: "nowrap",
                  opacity: busy ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `${activeAgent.color}18`;
                  e.currentTarget.style.borderColor = `${activeAgent.color}44`;
                  e.currentTarget.style.color = "var(--t)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,.04)";
                  e.currentTarget.style.borderColor = "var(--bh)";
                  e.currentTarget.style.color = "var(--t2)";
                }}
              >
                {pill}
              </button>
            ))}
          </div>

          {/* input */}
          <div style={{ display: "flex", gap: 8, padding: "10px 12px", borderTop: "1px solid var(--bh)" }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              placeholder="Or type your own question…"
              style={{
                flex: 1, background: "var(--bg2)", border: "1px solid var(--bh)", borderRadius: 10,
                padding: "9px 12px", fontSize: 13, color: "var(--t)", fontFamily: "inherit", outline: "none",
              }}
            />
            <button
              onClick={() => send()}
              disabled={busy || !input.trim()}
              className="btn primary"
              style={{ padding: "8px 14px", fontSize: 13, opacity: busy || !input.trim() ? 0.5 : 1 }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
