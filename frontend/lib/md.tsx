// Tiny markdown renderer — bold, bullet lists, line breaks. No deps.
import React from "react";

export function Markdown({ text }: { text: string }) {
  const lines = (text || "").split("\n");
  const out: React.ReactNode[] = [];
  let list: React.ReactNode[] = [];
  const flush = () => {
    if (list.length) { out.push(<ul key={out.length} style={{ margin: "6px 0 6px 18px", display: "grid", gap: 4 }}>{list}</ul>); list = []; }
  };
  const inline = (s: string) => {
    const parts = s.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, i) =>
      p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>);
  };
  lines.forEach((ln, i) => {
    const t = ln.trim();
    if (t.startsWith("- ")) { list.push(<li key={i}>{inline(t.slice(2))}</li>); return; }
    flush();
    if (!t) { out.push(<div key={i} style={{ height: 6 }} />); return; }
    out.push(<p key={i} style={{ margin: "2px 0", lineHeight: 1.55 }}>{inline(t)}</p>);
  });
  flush();
  return <div>{out}</div>;
}
