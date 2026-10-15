"use client";

// ─── modules/engagement/countdown/Countdown.tsx ─────────────────────────
// Reusable launch countdown (engagement spec §4). Variants:
//  - "full":    large HUD readout DAYS : HRS : MIN : SEC, Anton digits,
//               neon glow, grain/scanline treatment.
//  - "compact": "56d 04h 12m" / "LAUNCH IN 56D".
//
// SSR-safe: the server (and first hydration paint) renders a static `--`
// placeholder; the live value only ever computes client-side. The target is
// an absolute UTC instant, so it never shifts with the visitor's timezone.
// Post-launch flips one-way to "OUT NOW" — no negative numbers, ever.
//
// Accessibility: ticking digits are aria-hidden; a visually-hidden live
// region announces the remaining time at most once per minute
// (aria-live="polite"). Accessible name: "Countdown to GTA VI launch".
//
// NOTE: this component is not mounted anywhere here — the coordinator
// integrates it into the landing page (full) and the header (compact).

import { useEffect, useRef, useState } from "react";
import {
  describeCountdown,
  getCountdownParts,
  LAUNCH_DATE_MS,
  type CountdownParts,
} from "./launchDate";

export type CountdownVariant = "full" | "compact";

interface CountdownProps {
  variant?: CountdownVariant;
  className?: string;
}

/** Announce at most once per minute (spec §4). */
const ANNOUNCE_INTERVAL_MS = 60_000;

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function TimeCell({ value, label }: { value: string; label: string }) {
  return (
    <span className="flex min-w-[3.2rem] flex-col items-center">
      <span className="countdown-digits font-display text-4xl tabular-nums sm:text-5xl">
        {value}
      </span>
      <span className="mt-1 text-[0.625rem] font-semibold uppercase tracking-[0.22em] text-[#8b94a3]">
        {label}
      </span>
    </span>
  );
}

export function Countdown({ variant = "full", className = "" }: CountdownProps) {
  // null until the first client tick: SSR and hydration render the `--`
  // placeholder identically, so there is no hydration mismatch.
  const [now, setNow] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  // One-way latch: once OUT NOW shows, clock skew can never flip it back.
  const [outNow, setOutNow] = useState(false);
  const lastAnnounced = useRef(0);

  useEffect(() => {
    const tick = () => {
      const n = Date.now();
      setNow(n);
      if (n >= LAUNCH_DATE_MS) setOutNow(true);
      if (n - lastAnnounced.current >= ANNOUNCE_INTERVAL_MS) {
        lastAnnounced.current = n;
        setAnnouncement(describeCountdown(n));
      }
    };
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, []);

  const parts: CountdownParts | null = now === null ? null : getCountdownParts(now);
  const showOutNow = outNow || parts?.outNow === true;

  const name = "Countdown to GTA VI launch";

  if (variant === "compact") {
    return (
      <span role="timer" aria-label={name} className={className}>
        <span aria-hidden="true" className="font-mono text-sm text-[var(--accent)]">
          {parts === null ? (
            "--d --h --m"
          ) : showOutNow ? (
            <strong className="font-bold">OUT NOW</strong>
          ) : (
            <>
              {parts.days}d {pad(parts.hours)}h {pad(parts.minutes)}m
            </>
          )}
        </span>
        <span className="sr-only" aria-live="polite">
          {announcement}
        </span>
      </span>
    );
  }

  // ── full variant ──
  return (
    <div role="timer" aria-label={name} className={className}>
      <div
        aria-hidden="true"
        className="vice-grain vice-scanlines relative flex items-start justify-center gap-2 overflow-hidden rounded-2xl border border-[var(--accent-line)] bg-black/40 px-4 py-5 sm:gap-3 sm:px-8 sm:py-6"
      >
        {parts === null ? (
          <span className="countdown-digits font-display text-4xl tabular-nums sm:text-5xl">
            -- : -- : -- : --
          </span>
        ) : showOutNow ? (
          <p className="countdown-outnow font-display px-2 py-1 text-center text-3xl tracking-wide text-[var(--accent)] sm:text-5xl">
            GTA VI IS OUT NOW
          </p>
        ) : (
          <>
            <TimeCell value={String(parts.days)} label="Days" />
            <span aria-hidden="true" className="countdown-digits font-display pt-0.5 text-3xl sm:text-4xl">
              :
            </span>
            <TimeCell value={pad(parts.hours)} label="Hours" />
            <span aria-hidden="true" className="countdown-digits font-display pt-0.5 text-3xl sm:text-4xl">
              :
            </span>
            <TimeCell value={pad(parts.minutes)} label="Minutes" />
            <span aria-hidden="true" className="countdown-digits font-display pt-0.5 text-3xl sm:text-4xl">
              :
            </span>
            <TimeCell value={pad(parts.seconds)} label="Seconds" />
          </>
        )}
      </div>
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}
