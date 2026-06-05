"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { gbp } from "@/lib/format";

type Action = {
  id: string; dept: string; agent: string; title: string; detail: string;
  impact_gbp: number; why: string; verb: string;
  severity: "high" | "medium" | "low"; linked: null | string[];
};

export default function Inbox() {
  const [actions, setActions] = useState<Action[] | null>(null);
  const [err, setErr] = useState("");
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [flyOff, setFlyOff] = useState(0);          // animated exit offset
  const [approvedCount, setApprovedCount] = useState(0);
  const [approvedValue, setApprovedValue] = useState(0);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);

  const startX = useRef(0);
  const animating = useRef(false);
  const toastTimer = useRef<any>(null);

  useEffect(() => {
    api.actions().then((d: any) => setActions(d.actions || [])).catch((e) => setErr(String(e)));
  }, []);

  const total = actions ? actions.length : 0;
  const current = actions && index < total ? actions[index] : null;

  function showToast(text: string, ok: boolean) {
    setToast({ text, ok });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1600);
  }

  // commit a decision: animate the top card off-screen, then advance.
  function decide(approve: boolean) {
    if (animating.current || !current) return;
    animating.current = true;
    const card = current;
    setDragging(false);
    setFlyOff(approve ? 700 : -700);
    setDragX(0);
    if (approve) {
      setApprovedCount((c) => c + 1);
      setApprovedValue((v) => v + (card.impact_gbp || 0));
      showToast(`✓ ${card.verb} — approved`, true);
    } else {
      showToast("✕ Skipped", false);
    }
    setTimeout(() => {
      setIndex((i) => i + 1);
      setFlyOff(0);
      animating.current = false;
    }, 260);
  }

  // ── keyboard ──
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!current) return;
      if (e.key === "ArrowRight") { e.preventDefault(); decide(true); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); decide(false); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, index]);

  // ── pointer drag ──
  function onPointerDown(e: any) {
    if (animating.current) return;
    startX.current = e.clientX;
    setDragging(true);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  }
  function onPointerMove(e: any) {
    if (!dragging) return;
    setDragX(e.clientX - startX.current);
  }
  function onPointerUp(e: any) {
    if (!dragging) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    setDragging(false);
    if (dragX > 120) decide(true);
    else if (dragX < -120) decide(false);
    else setDragX(0);
  }

  if (err) return <div className="loading">Backend unreachable on :5055.<br />{err}</div>;
  if (!actions) return <div className="loading">Gathering your team's recommendations…</div>;

  const totalImpact = actions.reduce((s, a) => s + (a.impact_gbp || 0), 0);

  // depth offset for stacked card transforms (active card uses drag/fly)
  const liveOffset = flyOff !== 0 ? flyOff : dragX;
  const rot = liveOffset / 18;
  const edge = Math.min(Math.abs(liveOffset) / 260, 1);
  const topTransition = dragging ? "none" : "transform .25s cubic-bezier(.22,1,.36,1), opacity .25s";

  const sevBadge = (s: string) => (s === "high" ? "reorder" : s === "medium" ? "watch" : "healthy");

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Action Inbox</div>
        <h1>Approve your staff's moves.</h1>
        <p>Each card is a recommendation backed by the data. Swipe right to approve, left to skip — or use the buttons. Keyboard: ← skip, → approve.</p>
      </div>

      {/* KPI strip */}
      <div className="grid cols-3" style={{ marginBottom: 24 }}>
        <div className="card kpi tight">
          <div className="lbl">Open actions</div>
          <div className="val tnum">{total}</div>
          <div className="sub">across every department</div>
        </div>
        <div className="card kpi tight">
          <div className="lbl">Total £ impact on the table</div>
          <div className="val bl tnum">{gbp(totalImpact)}</div>
          <div className="sub">if you approve everything</div>
        </div>
        <div className="card kpi tight">
          <div className="lbl">Approved so far</div>
          <div className="val gr tnum">{approvedCount} · {gbp(approvedValue)}</div>
          <div className="sub">queued for execution</div>
        </div>
      </div>

      {index >= total ? (
        <div className="card" style={{ maxWidth: 540, margin: "0 auto", textAlign: "center", padding: "48px 28px" }}>
          <div style={{ fontSize: 52, marginBottom: 8 }}>🎉</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.5px" }}>Inbox zero.</h1>
          <p style={{ fontSize: 14, color: "var(--t2)", margin: "12px 0 24px", lineHeight: 1.5 }}>
            {approvedCount} action{approvedCount === 1 ? "" : "s"} approved · <b style={{ color: "var(--gr)" }}>{gbp(approvedValue)}</b> of impact queued.
          </p>
          <Link href="/" className="btn primary" style={{ display: "inline-block" }}>← Back to HQ</Link>
        </div>
      ) : (
        <>
          {/* card stack */}
          <div className="swipe-wrap">
            {actions.slice(index, index + 3).map((a, i) => {
              const isTop = i === 0;
              // depth styling for cards behind the top one
              const depthScale = 1 - i * 0.05;
              const depthY = i * 14;
              let style: any;
              if (isTop) {
                style = {
                  transform: `translateX(${liveOffset}px) rotate(${rot}deg)`,
                  opacity: 1 - edge * 0.35,
                  transition: topTransition,
                  zIndex: 30,
                  cursor: dragging ? "grabbing" : "grab",
                };
              } else {
                style = {
                  transform: `translateY(${depthY}px) scale(${depthScale})`,
                  transition: "transform .25s ease",
                  zIndex: 30 - i,
                  opacity: 0.7,
                  pointerEvents: "none",
                };
              }
              return (
                <div
                  key={a.id}
                  className="swipe-card"
                  style={style}
                  onPointerDown={isTop ? onPointerDown : undefined}
                  onPointerMove={isTop ? onPointerMove : undefined}
                  onPointerUp={isTop ? onPointerUp : undefined}
                  onPointerCancel={isTop ? onPointerUp : undefined}
                >
                  {/* approve / skip overlays (only meaningful on top card) */}
                  {isTop && (
                    <>
                      <div style={{
                        position: "absolute", top: 22, left: 22, padding: "6px 14px", borderRadius: 12,
                        border: "2px solid var(--gr)", color: "var(--gr)", fontWeight: 800, fontSize: 18,
                        letterSpacing: ".5px", transform: "rotate(-10deg)", pointerEvents: "none",
                        opacity: liveOffset > 40 ? Math.min((liveOffset - 40) / 90, 1) : 0,
                      }}>✓ APPROVE</div>
                      <div style={{
                        position: "absolute", top: 22, right: 22, padding: "6px 14px", borderRadius: 12,
                        border: "2px solid var(--rd)", color: "var(--rd)", fontWeight: 800, fontSize: 18,
                        letterSpacing: ".5px", transform: "rotate(10deg)", pointerEvents: "none",
                        opacity: liveOffset < -40 ? Math.min((-liveOffset - 40) / 90, 1) : 0,
                      }}>✕ SKIP</div>
                    </>
                  )}

                  {/* top row: severity badge + agent + dept */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className={`badge ${sevBadge(a.severity)}`}>{a.agent}</span>
                    <span className="mono" style={{ marginLeft: "auto" }}>{a.dept}</span>
                  </div>

                  <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-.4px", lineHeight: 1.2, margin: "16px 0 8px" }}>
                    {a.title}
                  </div>
                  <div style={{ fontSize: 13.5, color: "var(--t2)", lineHeight: 1.5 }}>{a.detail}</div>

                  {/* why chip */}
                  <div style={{
                    fontFamily: "'SF Mono',ui-monospace,Menlo,Consolas,monospace", fontSize: 11.5, fontWeight: 600,
                    color: "var(--gr)", background: "rgba(48,209,88,.1)", border: "1px solid rgba(48,209,88,.25)",
                    borderRadius: 10, padding: "7px 11px", marginTop: 14, alignSelf: "flex-start", lineHeight: 1.4,
                  }}>📊 {a.why}</div>

                  {/* linked cross-team chips */}
                  {a.linked && a.linked.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                      {a.linked.map((dep, di) => (
                        <span key={dep} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          {di > 0 && <span style={{ color: "var(--gr)", fontSize: 13 }}>➜</span>}
                          <span className="chip" style={{ padding: "4px 10px", fontSize: 11 }}>{dep}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* footer: impact + verb */}
                  <div className="swipe-hint" style={{ marginTop: "auto", alignItems: "center" }}>
                    <span style={{ color: a.impact_gbp ? "var(--gr)" : "var(--t3)", fontSize: 17, fontWeight: 800, letterSpacing: "-.3px", textTransform: "none" }}>
                      {a.impact_gbp ? `+${gbp(a.impact_gbp)}` : "—"}
                    </span>
                    <span style={{ color: "var(--t3)" }}>→ {a.verb}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* toast */}
          <div style={{ height: 22, textAlign: "center", marginTop: 14 }}>
            {toast && (
              <span style={{ fontSize: 12.5, fontWeight: 700, color: toast.ok ? "var(--gr)" : "var(--rd)" }}>
                {toast.text}
              </span>
            )}
          </div>

          {/* buttons */}
          <div style={{ display: "flex", gap: 14, justifyContent: "center", maxWidth: 540, margin: "8px auto 0" }}>
            <button className="btn" style={{ flex: 1, color: "var(--rd)", borderColor: "rgba(255,69,58,.4)" }} onClick={() => decide(false)}>
              ✕ Skip
            </button>
            <button className="btn primary" style={{ flex: 1, background: "var(--gr)", borderColor: "var(--gr)" }} onClick={() => decide(true)}>
              ✓ {current ? current.verb : "Approve"}
            </button>
          </div>

          {/* progress */}
          <div style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: "var(--t3)" }}>
            Card {Math.min(index + 1, total)} of {total}
          </div>
        </>
      )}
    </>
  );
}
