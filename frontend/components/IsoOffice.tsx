"use client";
import React from "react";

/* A CSS 3D box (5 faces, back faces auto-hidden) sitting on the floor at (x,y). */
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

/* upright billboarded element (counter-rotates the stage so it faces the viewer) */
function Bill({ x, y, z, children, className, onClick }: any) {
  return (
    <div onClick={onClick} style={{ position: "absolute", left: x, top: y, transformStyle: "preserve-3d", transform: `translateZ(${z}px)` }}>
      <div className={`billboard ${className || ""}`}>{children}</div>
    </div>
  );
}

const SEAT = ["🧑‍💼", "👩‍💼", "🧑‍💻", "👨‍💼", "👩‍💻", "🧑‍🔧", "👨‍💻", "👩‍🔧", "🧑‍💼", "👨‍🔬"];
const WOOD = { top: "#2a2f3a", s1: "#1d212a", s2: "#171a22" };

function Workstation({ a, i, x, y, onPick }: any) {
  const seat = SEAT[i % SEAT.length];
  return (
    <div className="ws" style={{ position: "absolute", left: x, top: y, transformStyle: "preserve-3d" }}>
      {/* desk */}
      <Box W={62} D={38} H={20} x={0} y={0} top={WOOD.top} side1={WOOD.s1} side2={WOOD.s2} onClick={() => onPick(a.route)} />
      {/* monitor (glowing) — back edge of desk */}
      <Box W={3} D={26} H={17} x={0} y={-9} z={20} top="#0a84ff" side1="#0b1830" side2="#0a1428"
        glow="0 0 18px rgba(10,132,255,.55)" onClick={() => onPick(a.route)} />
      {/* monitor stand */}
      <Box W={2} D={4} H={5} x={0} y={-9} z={20} top="#222" side1="#1a1a1a" side2="#141414" />
      {/* chair seat + back */}
      <Box W={18} D={18} H={8} x={0} y={26} z={0} top="#26303f" side1="#1a222e" side2="#161c26" onClick={() => onPick(a.route)} />
      <Box W={18} D={3} H={16} x={0} y={34} z={8} top="#222a36" side1="#1a212b" side2="#151a22" />
      {/* seated agent (billboard) */}
      <Bill x={0} y={20} z={26} className="" onClick={() => onPick(a.route)}>
        <div style={{ fontSize: 26, marginLeft: -14, filter: "drop-shadow(0 3px 5px rgba(0,0,0,.6))" }}>{seat}</div>
      </Bill>
      {/* floating label (billboard) */}
      <Bill x={0} y={-4} z={74} onClick={() => onPick(a.route)}>
        <div className="ws-label">
          <div className="nm">{a.icon} {a.name} <span className={`sled ${a.status}`} /></div>
          <div className="rl">{a.role}</div>
          {a.pending > 0 && <div className="pill2">⚡ {a.pending} waiting</div>}
        </div>
      </Bill>
    </div>
  );
}

export default function IsoOffice({ agents, onPick }: { agents: any[]; onPick: (r: string) => void }) {
  // 5 columns × 2 rows on the floor
  const pos = (i: number) => { const c = i % 5, r = Math.floor(i / 5); return { x: -210 + c * 105, y: -90 + r * 165 }; };
  return (
    <div className="office">
      <div className="stage">
        <div className="floor" />
        <div className="wall wall-back"><div className="wall-stripe" /></div>
        <div className="wall wall-left"><div className="wall-stripe" /></div>
        {/* plants in two corners (billboarded) */}
        <Bill x={-250} y={-250} z={28}><div style={{ fontSize: 30 }}>🪴</div></Bill>
        <Bill x={250} y={-250} z={28}><div style={{ fontSize: 30 }}>🪴</div></Bill>
        <Bill x={250} y={250} z={28}><div style={{ fontSize: 26 }}>🛋️</div></Bill>
        {agents.map((a, i) => { const p = pos(i); return <Workstation key={a.id} a={a} i={i} x={p.x} y={p.y} onPick={onPick} />; })}
      </div>
      <div className="iso-cap" style={{ position: "absolute", left: 22, bottom: 16, zIndex: 5, fontSize: 12, color: "var(--t3)" }}>
        Your office floor · each desk is a live AI agent — click to enter their workspace
      </div>
    </div>
  );
}
