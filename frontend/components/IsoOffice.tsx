"use client";
import React from "react";

/* ── Isometric colored box (CSS 3D, 5 faces) ── */
function Box({ W, D, H, x, y, z = 0, top, side1, side2, glow, onClick }:
  { W: number; D: number; H: number; x: number; y: number; z?: number; top: string; side1: string; side2: string; glow?: string; onClick?: () => void }) {
  const base: React.CSSProperties = { position: "absolute", left: "50%", top: "50%", backfaceVisibility: "hidden" };
  return (
    <div onClick={onClick} style={{ position: "absolute", left: x, top: y, transformStyle: "preserve-3d", transform: `translateZ(${z + H / 2}px)`, boxShadow: glow }}>
      <div style={{ ...base, width: W, height: D, marginLeft: -W / 2, marginTop: -D / 2, transform: `rotateX(90deg) translateZ(${H / 2}px)`, background: top }} />
      <div style={{ ...base, width: W, height: H, marginLeft: -W / 2, marginTop: -H / 2, transform: `translateZ(${D / 2}px)`, background: side1 }} />
      <div style={{ ...base, width: W, height: H, marginLeft: -W / 2, marginTop: -H / 2, transform: `rotateY(180deg) translateZ(${D / 2}px)`, background: side1 }} />
      <div style={{ ...base, width: D, height: H, marginLeft: -D / 2, marginTop: -H / 2, transform: `rotateY(90deg) translateZ(${W / 2}px)`, background: side2 }} />
      <div style={{ ...base, width: D, height: H, marginLeft: -D / 2, marginTop: -H / 2, transform: `rotateY(-90deg) translateZ(${W / 2}px)`, background: side2 }} />
    </div>
  );
}

/* ── Billboard: counter-rotates the stage to face viewer ── */
function Bill({ x, y, z, children, className, onClick }: any) {
  return (
    <div onClick={onClick} style={{ position: "absolute", left: x, top: y, transformStyle: "preserve-3d", transform: `translateZ(${z}px)` }}>
      <div className={`billboard ${className || ""}`}>{children}</div>
    </div>
  );
}

/* ── Simple isometric person as SVG ── */
function PersonSVG({ accent, size = 28 }: { accent: string; size?: number }) {
  const s = size;
  const h = s * 1.35;
  return (
    <svg width={s} height={h} viewBox="0 0 28 38" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,.5))" }}>
      <circle cx="14" cy="10" r="7" fill={accent} />
      <rect x="6" y="17" width="16" height="14" rx="4" fill={accent} opacity={0.85} />
      <rect x="2" y="19" width="5" height="4" rx="2" fill={accent} opacity={0.6} />
      <rect x="21" y="19" width="5" height="4" rx="2" fill={accent} opacity={0.6} />
      <rect x="7" y="31" width="5" height="7" rx="2" fill={accent} opacity={0.5} />
      <rect x="16" y="31" width="5" height="7" rx="2" fill={accent} opacity={0.5} />
    </svg>
  );
}

/* ── SVG plant in a pot ── */
function PlantSVG() {
  return (
    <svg width="32" height="42" viewBox="0 0 32 42" style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,.4))" }}>
      <rect x="8" y="28" width="16" height="14" rx="3" fill="#3a3f52" />
      <rect x="6" y="26" width="20" height="5" rx="2" fill="#454b60" />
      <ellipse cx="16" cy="20" rx="10" ry="8" fill="#2d8a4e" />
      <ellipse cx="12" cy="15" rx="6" ry="5" fill="#3aa35d" />
      <ellipse cx="20" cy="16" rx="5" ry="4" fill="#34a05a" />
    </svg>
  );
}

/* ── SVG couch ── */
function CouchSVG() {
  return (
    <svg width="48" height="32" viewBox="0 0 48 32" style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,.4))" }}>
      <rect x="2" y="10" width="44" height="16" rx="4" fill="#3a3f52" />
      <rect x="4" y="6" width="40" height="8" rx="3" fill="#4a5068" />
      <rect x="0" y="22" width="6" height="10" rx="2" fill="#2d3242" />
      <rect x="42" y="22" width="6" height="10" rx="2" fill="#2d3242" />
      <rect x="12" y="26" width="8" height="6" rx="2" fill="#252a38" />
      <rect x="28" y="26" width="8" height="6" rx="2" fill="#252a38" />
    </svg>
  );
}

/* Colour per status */
const STATUS_COLORS: Record<string, string> = {
  alert: "#ff453a",
  working: "#30d158",
  idle: "#6e6e73",
};

/* Department accent colours for person figures */
const DEPT_COLORS: Record<string, string> = {
  Treasury: "#0a84ff",
  Inventory: "#ff9f0a",
  Marketing: "#bf5af2",
  Finance: "#30d158",
  Merchandising: "#ff375f",
  Growth: "#64d2ff",
  Supply: "#ff9f0a",
  Support: "#5e5ce6",
  Risk: "#ff453a",
  Demand: "#30d158",
};

/* ── Workstation: desk + monitor + chair + person + label ── */
function Workstation({ a, statusColor, deptColor, x, y, onPick }: any) {
  return (
    <div className="ws" style={{ position: "absolute", left: x, top: y, transformStyle: "preserve-3d" }}>
      {/* Desk */}
      <Box W={64} D={40} H={18} x={0} y={0} top="#3a3f52" side1="#2d3242" side2="#252a38" onClick={() => onPick(a.route)} />
      {/* Monitor glowing */}
      <Box W={3} D={28} H={18} x={0} y={-10} z={18} top="#0a84ff" side1="#0b1830" side2="#0a1428"
        glow="0 0 22px rgba(10,132,255,.6)" onClick={() => onPick(a.route)} />
      {/* Monitor stand */}
      <Box W={2} D={5} H={5} x={0} y={-10} z={18} top="#2a2f3a" side1="#1d212a" side2="#171a22" />
      {/* Chair */}
      <Box W={20} D={20} H={8} x={0} y={28} z={0} top="#3d4359" side1="#2f3447" side2="#282c3d" onClick={() => onPick(a.route)} />
      <Box W={20} D={3} H={16} x={0} y={37} z={8} top="#353a4d" side1="#2a2e40" side2="#232736" />
      {/* Person sitting on chair (billboarded) */}
      <Bill x={0} y={20} z={24} onClick={() => onPick(a.route)}>
        <PersonSVG accent={deptColor} size={26} />
      </Bill>
      {/* Floating label */}
      <Bill x={0} y={-6} z={76} onClick={() => onPick(a.route)}>
        <div className="ws-label">
          <div className="nm">{a.name} <span className={`sled ${a.status}`} style={{ boxShadow: `0 0 10px ${statusColor}` }} /></div>
          <div className="rl">{a.role}</div>
          {a.pending > 0 && <div className="pill2" style={{ background: `${deptColor}22`, borderColor: `${deptColor}66`, color: deptColor }}>{a.pending} pending</div>}
        </div>
      </Bill>
    </div>
  );
}

/* ── Office room with walls, floor, desks, décor ── */
export default function IsoOffice({ agents, onPick }: { agents: any[]; onPick: (r: string) => void }) {
  const pos = (i: number) => {
    const c = i % 5, r = Math.floor(i / 5);
    return { x: -210 + c * 105, y: -90 + r * 165 };
  };
  return (
    <div className="office">
      <div className="stage">
        <div className="floor" />
        <div className="wall wall-back"><div className="wall-stripe" /></div>
        <div className="wall wall-left"><div className="wall-stripe" /></div>

        {/* Wall clock */}
        <Bill x={-180} y={-248} z={20}>
          <svg width="28" height="28" viewBox="0 0 28 28">
            <circle cx="14" cy="14" r="13" fill="#1a1e28" stroke="#4a5068" strokeWidth="1.5" />
            <circle cx="14" cy="14" r="2" fill="#0a84ff" />
            <line x1="14" y1="14" x2="14" y2="6" stroke="#0a84ff" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="14" y1="14" x2="20" y2="14" stroke="#4a5068" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </Bill>

        {/* Framed poster */}
        <Bill x={160} y={-248} z={12}>
          <svg width="40" height="30" viewBox="0 0 40 30">
            <rect x="0" y="0" width="40" height="30" rx="2" fill="#0f131c" stroke="#3a3f52" strokeWidth="1" />
            <rect x="4" y="4" width="32" height="22" rx="1" fill="url(#g)" />
            <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#0a84ff" /><stop offset="100%" stopColor="#bf5af2" /></linearGradient></defs>
          </svg>
        </Bill>

        {/* Plants in corners */}
        <Bill x={-248} y={-248} z={22}><PlantSVG /></Bill>
        <Bill x={248} y={-248} z={22}><PlantSVG /></Bill>

        {/* Couch in far-right corner */}
        <Bill x={240} y={230} z={10}><CouchSVG /></Bill>

        {/* Workstations */}
        {agents.map((a, i) => {
          const p = pos(i);
          const statusColor = STATUS_COLORS[a.status] || "#6e6e73";
          const deptColor = DEPT_COLORS[a.dept] || "#0a84ff";
          return <Workstation key={a.id} a={a} statusColor={statusColor} deptColor={deptColor} x={p.x} y={p.y} onPick={onPick} />;
        })}
      </div>
      <div className="iso-cap">Your office floor — each desk is a live AI agent. Click to enter their workspace.</div>
    </div>
  );
}
