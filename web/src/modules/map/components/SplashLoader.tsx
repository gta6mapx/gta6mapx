"use client";

import { useEffect, useState } from "react";

interface SplashLoaderProps {
  progress: number | null;
  stalled: boolean;
  /** True once progress hits 100 — the splash fades out before unmount. */
  leaving: boolean;
  onSkip(): void;
}

/** Honest tips about the transparency system — rotated while loading. */
const TIPS = [
  "Every pin carries its proof — check the evidence chain.",
  "Speculation is labeled as speculation. Nothing is sold as fact.",
  "Disputed leaks stay visible, so you can see what is uncertain.",
];

/** Original neon sun-over-horizon mark (Vice City palette, no stock art). */
function SunMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="h-16 w-16 sm:h-20 sm:w-20"
      style={{ filter: "drop-shadow(0 0 18px rgba(255,80,197,0.45))" }}
    >
      <circle cx="12" cy="10" r="5.2" stroke="#ff50c5" strokeWidth="1.6" />
      <path
        d="M12 2.2v2.2M4.6 4.6l1.6 1.6M19.4 4.6l-1.6 1.6M3 10h2.2M18.8 10H21"
        stroke="#ff50c5"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M3.5 16.2h17M6.2 19.8h11.6"
        stroke="#8b5cf6"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * SplashLoader — full-screen map boot loader.
 *
 * Our own illustrated Leonida artwork sits behind as a darkened, blurred
 * backdrop; centered above it: the neon sun mark, the brand title, and a
 * wide glowing progress bar (no numeric readout — the bar alone carries
 * progress, like the reference loader). The footer carries
 * a rotating transparency tip and the fan-project disclaimer.
 * Progress is never faked to 100%. Reduced-motion users get no animation.
 */
export default function SplashLoader({
  progress,
  stalled,
  leaving,
  onSkip,
}: SplashLoaderProps) {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const t = window.setInterval(
      () => setTipIndex((i) => (i + 1) % TIPS.length),
      6000
    );
    return () => window.clearInterval(t);
  }, []);

  // Never display a fake 100% — cap determinate progress at 99.
  const pct = progress === null ? null : Math.min(99, Math.max(0, progress));

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#07040f] transition-opacity duration-500 ${
        leaving ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      role="status"
      aria-label="Loading the map"
    >
      {/* Backdrop: our own illustrated Leonida, darkened + blurred */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative splash backdrop; the webp is pre-optimized, next/image adds nothing here */}
        <img
          src="/maps/leonida-base.webp"
          alt=""
          className="h-full w-full scale-105 object-cover opacity-40 blur-[6px]"
        />
        {/* Darken + neon tint so the foreground stays readable */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, rgba(7,4,15,0.92) 0%, rgba(255,80,197,0.08) 40%, rgba(139,92,246,0.06) 70%, rgba(7,4,15,0.94) 100%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 42%, transparent 30%, rgba(7,4,15,0.9) 100%)",
          }}
        />
      </div>

      {/* Center: logo + progress */}
      <div className="relative flex flex-col items-center gap-5 px-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <SunMark />
          <h1 className="vice-neon-title font-display text-5xl leading-none tracking-wide uppercase sm:text-6xl">
            GTA6MAPX
          </h1>
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#8b94a3]">
            Mapping Leonida…
          </p>
        </div>

        <div className="flex w-[320px] max-w-[80vw] flex-col items-center gap-2.5">
          <div
            className="h-3 w-full overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            {...(pct === null
              ? { "aria-label": "Loading the map" }
              : { "aria-valuenow": Math.round(pct), "aria-label": "Map loading progress" })}
          >
            {pct === null ? (
              <div className="skeleton-shimmer h-full w-full rounded-full" />
            ) : (
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#ff50c5] via-[#a855f7] to-[#8b5cf6] transition-[width] duration-300"
                style={{
                  width: `${pct}%`,
                  boxShadow:
                    "0 0 12px rgba(255,80,197,0.55), 0 0 24px rgba(168,85,247,0.3)",
                }}
              />
            )}
          </div>
          {/* No percentage readout — the bar alone carries progress, like the
              reference loader. Screen readers still get aria-valuenow. */}
        </div>
      </div>

      {/* Footer: tip + disclaimer + skip */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 px-6 pb-6 text-center">
        <p
          className="max-w-sm text-[13px] leading-relaxed text-white/60 italic"
          aria-live="polite"
        >
          {TIPS[tipIndex]}
        </p>
        <p className="max-w-md text-[10px] leading-relaxed text-white/35">
          Independent fan project. Not affiliated with, endorsed by, or
          connected to Rockstar Games or Take-Two Interactive.
        </p>
        {stalled && (
          <button
            type="button"
            onClick={onSkip}
            className="mt-1 text-sm font-semibold text-[#8b94a3] underline-offset-4 transition-colors hover:text-white hover:underline"
          >
            Skip loading screen
          </button>
        )}
      </div>
    </div>
  );
}
