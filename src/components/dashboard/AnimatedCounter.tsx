"use client";

import { useEffect, useState } from "react";

const DURATION = 400;
const EASING = (t: number) => 1 - Math.pow(1 - t, 3);

export function AnimatedCounter({
  value,
  format = (n) => String(Math.round(n)),
  duration = DURATION,
  start = true,
  className = "",
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  start?: boolean;
  className?: string;
}) {
  const [display, setDisplay] = useState(start ? value : 0);

  useEffect(() => {
    if (!start) return;
    if (value === 0) {
      setDisplay(0);
      return;
    }
    const startVal = display;
    const endVal = value;
    if (startVal === endVal) return;
    const startTime = performance.now();
    let rafId: number;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = EASING(t);
      setDisplay(startVal + (endVal - startVal) * eased);
      if (t < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [value, start, duration]);

  return <span className={className}>{format(display)}</span>;
}
