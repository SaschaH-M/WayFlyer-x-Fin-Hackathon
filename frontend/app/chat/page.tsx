"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Markdown } from "@/lib/md";

const SUGGESTED = [
  "What should I reorder first?",
  "How much cash will I free by marking down overstock?",
  "Which supplier lead times are causing the most stockouts?",
  "Show me all SKUs where I'm losing money on storage.",
  "Show me the cash crisis.",
  "Prove this tool would have saved money.",
];

type Msg = { role: "user" | "agent"; text: string; cites?: any[]; used_llm?: boolean };

export default function Chat() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [llm, setLlm] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { api.health().then((h) => setLlm(!!h.llm)).catch(() => {}); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  async function ask(q: string) {
    if (!q.trim() || busy) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setBusy(true);
    try {
      const r = await api.agent(q, true);
      setMsgs((m) => [...m, { role: "agent", text: r.answer, cites: r.citations, used_llm: r.used_llm }]);
    } catch {
      setMsgs((m) => [...m, { role: "agent", text: "Backend unreachable — start the Flask server on :5055." }]);
    }
    setBusy(false);
  }

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">WC Agent</div>
        <h1>Ask anything about Pretty Fly's working capital.</h1>
        <p>Grounded in the live dataset — every answer cites specific SKUs, dates, and £ amounts.
          {llm ? " Powered by Claude over the data." : " Running fully offline on the grounded retrieval engine."}</p>
      </div>

      <div className="card" style={{ minHeight: 460, display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
        <div style={{ flex: 1, overflowY: "auto", padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
          {msgs.length === 0 && (
            <div style={{ color: "var(--t3)", fontSize: 13, textAlign: "center", margin: "auto", maxWidth: 420, lineHeight: 1.6 }}>
              ✦ Ask the WC Agent a question, or tap a suggestion below.<br />
              It reads your live inventory, cash, and supplier data to answer.
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "82%" }}>
              <div style={{
                background: m.role === "user" ? "var(--bl)" : "var(--bg3)",
                color: m.role === "user" ? "#fff" : "var(--t)",
                border: m.role === "user" ? "none" : "1px solid var(--b)",
                borderRadius: 16, padding: "12px 16px", fontSize: 13.5,
              }}>
                {m.role === "user" ? m.text : <Markdown text={m.text} />}
              </div>
              {m.role === "agent" && m.cites && m.cites.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {m.cites.slice(0, 5).map((c: any, j: number) => (
                    <span key={j} className="mono" style={{ background: "rgba(48,209,88,.1)", color: "var(--gr)", padding: "3px 8px", borderRadius: 8, border: "1px solid rgba(48,209,88,.2)" }}>
                      {c.sku} · £{Number(c.amount).toLocaleString()} {c.metric}
                    </span>
                  ))}
                  {m.used_llm && <span className="mono" style={{ color: "var(--pu)" }}>✦ Claude</span>}
                </div>
              )}
            </div>
          ))}
          {busy && <div style={{ alignSelf: "flex-start", color: "var(--t3)", fontSize: 13 }}>WC Agent is thinking…</div>}
          <div ref={endRef} />
        </div>

        <div style={{ borderTop: "1px solid var(--b)", padding: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 12 }}>
            {SUGGESTED.map((q) => (
              <button key={q} className="chip" onClick={() => ask(q)} disabled={busy}>{q}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask(input)}
              placeholder="Ask about reorders, cash, suppliers, overstock…"
              style={{ flex: 1, background: "rgba(255,255,255,.04)", border: "1px solid var(--b)", borderRadius: 13, padding: "12px 16px", color: "var(--t)", fontSize: 13.5, fontFamily: "inherit", outline: "none" }}
            />
            <button className="btn primary" onClick={() => ask(input)} disabled={busy}>Send</button>
          </div>
        </div>
      </div>
    </>
  );
}
