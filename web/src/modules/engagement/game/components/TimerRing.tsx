"use client";

// ─── TimerRing.tsx — 90-second countdown ring for a game round ───────────────
// SVG ring; turns red under 15 s. Pulse animation honors reduced motion via
// the site's global prefers-reduced-motion CSS.

import { gameStrings as S } from "../strings";

const SIZE = 56;
const R = 24;
const CIRC = 2 * Math.PI * R;

export default function TimerRing({
  remaining,
  total,
  paused,
}: {
  remaining: number; // seconds remaining (display)
  total: number; // total round seconds
  paused: boolean;
}) {
  const frac = Math.max(0, Math.min(1, remaining / total));
  const offset = CIRC * (1 - frac);
  const urgent = remaining <= 15 && !paused;
  const color = urgent ? "#f87171" : paused ? "#8b94a3" : "#22d3ee";
  return (
    <div
      role="timer"
      aria-label={S.timeLeft(remaining)}
      className="relative h-14 w-14 shrink-0"
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full -rotate-90" aria-hidden="true">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={4}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          className="timer-ring-arc"
        />
      </svg>
      <span
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center font-mono text-sm font-bold text-white"
      >
        {remaining}
      </span>
    </div>
  );
}
