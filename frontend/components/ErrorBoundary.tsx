"use client";
import React from "react";

type P = { children: React.ReactNode; fallback?: React.ReactNode };
type S = { err: Error | null };

export default class ErrorBoundary extends React.Component<P, S> {
  state: S = { err: null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch() { /* swallow — keep the app alive */ }
  // recover automatically when children/props change (e.g. next scrub tick)
  componentDidUpdate(prev: P) { if (prev.children !== this.props.children && this.state.err) this.setState({ err: null }); }
  render() {
    if (this.state.err) {
      return this.props.fallback ?? (
        <div style={{ padding: 24, color: "var(--t3)", fontSize: 13, border: "1px solid var(--b)", borderRadius: 14, background: "rgba(255,255,255,.02)" }}>
          This view hit a snag and recovered. Try again or adjust the controls.
          <button className="chip" style={{ marginLeft: 12 }} onClick={() => this.setState({ err: null })}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}
