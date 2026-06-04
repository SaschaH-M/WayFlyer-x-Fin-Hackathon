"use client";
import { useEffect, useRef, useState } from "react";

/**
 * CountUp — animates a number from its previous value to the next whenever
 * `value` changes, easing over ~`duration` ms. `format` renders each frame
 * (e.g. the gbp() / num() helpers). Makes live updates feel alive instead of
 * snapping. Respects prefers-reduced-motion.
 */
export default function CountUp({
  value,
  format = (n: number) => String(Math.round(n)),
  duration = 550,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number>();

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    const to = value;
    if (reduce || from === to) {
      setDisplay(to);
      fromRef.current = to;
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(from + (to - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = value;
    };
  }, [value, duration]);

  return <>{format(display)}</>;
}
