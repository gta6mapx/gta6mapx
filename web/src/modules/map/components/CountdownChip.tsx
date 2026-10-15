"use client";

import { useEffect, useState } from "react";
import { LAUNCH_DATE } from "@/data/pins";

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/**
 * CountdownChip — HUD-style countdown to the GTA 6 launch date.
 * Mono cyan text; ticks once per second after mount.
 */
export default function CountdownChip() {
  const [now, setNow] = useState<number | null>(null);

  // Interval callback only — no synchronous setState in the effect body.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  if (now === null) {
    return (
      <span className="btn-hud inline-flex h-10 items-center rounded-lg border border-[rgba(139,92,246,0.35)] bg-[rgba(139,92,246,0.06)] px-3 font-mono text-sm text-[#8b5cf6]">
        --d --h --m
      </span>
    );
  }

  const diff = Math.max(0, LAUNCH_DATE.getTime() - now);
  if (diff === 0) {
    return (
      <span className="btn-hud inline-flex h-10 items-center rounded-lg border border-[rgba(139,92,246,0.35)] bg-[rgba(139,92,246,0.06)] px-3 font-mono text-sm font-bold text-[#8b5cf6]">
        LAUNCHED
      </span>
    );
  }

  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor(diff / 3_600_000) % 24;
  const m = Math.floor(diff / 60_000) % 60;

  return (
    <span
      role="timer"
      aria-label="Countdown to GTA 6 launch"
      title="Countdown to GTA 6 launch"
      className="btn-hud inline-flex h-10 items-center rounded-lg border border-[rgba(139,92,246,0.35)] bg-[rgba(139,92,246,0.06)] px-3 font-mono text-sm text-[#8b5cf6]"
    >
      {d}d {pad(h)}h {pad(m)}m
    </span>
  );
}
