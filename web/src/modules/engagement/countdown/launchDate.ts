// ─── modules/engagement/countdown/launchDate.ts ─────────────────────────
// Single source of truth for the GTA VI launch instant, shared by every
// countdown placement (spec §4).

/** GTA VI launch date — the one constant every countdown consumes. */
export const LAUNCH_DATE_ISO = "2026-11-19";

/** Absolute launch instant in UTC — timezone-proof by construction. */
export const LAUNCH_DATE_MS: number = Date.parse(`${LAUNCH_DATE_ISO}T00:00:00Z`);

export interface CountdownParts {
  /** True once now >= launch. One-way: never flips back. No negatives. */
  outNow: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * Pure countdown math. `outNow` is true when `nowMs >= LAUNCH_DATE_MS`;
 * remaining parts are always >= 0 (never negative).
 */
export function getCountdownParts(nowMs: number): CountdownParts {
  if (!Number.isFinite(nowMs)) {
    return { outNow: false, days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  const diff = LAUNCH_DATE_MS - nowMs;
  if (diff <= 0) {
    return { outNow: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  const totalSeconds = Math.floor(diff / 1000);
  return {
    outNow: false,
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor(totalSeconds / 3600) % 24,
    minutes: Math.floor(totalSeconds / 60) % 60,
    seconds: totalSeconds % 60,
  };
}

/** Human sentence for the throttled live region. */
export function describeCountdown(nowMs: number): string {
  const p = getCountdownParts(nowMs);
  if (p.outNow) return "GTA VI is out now.";
  const bits: string[] = [];
  if (p.days > 0) bits.push(`${p.days} ${p.days === 1 ? "day" : "days"}`);
  if (p.hours > 0) bits.push(`${p.hours} ${p.hours === 1 ? "hour" : "hours"}`);
  bits.push(`${p.minutes} ${p.minutes === 1 ? "minute" : "minutes"}`);
  return `${bits.join(", ")} until the GTA VI launch.`;
}
