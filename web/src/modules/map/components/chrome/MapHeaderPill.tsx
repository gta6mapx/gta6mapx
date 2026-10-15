// ─── modules/map/components/chrome/MapHeaderPill.tsx ───────────────────
// Slim centered floating header pill: logo lockup · launch countdown · about.
// All code below is original (CHROME TEAM, Sep 2026).

"use client";

import Link from "next/link";
import CountdownChip from "../CountdownChip";

interface MapHeaderPillProps {
  onOpenAbout: () => void;
}

/** Original neon sun-over-horizon mark (Vice City palette, no stock art). */
function SunMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="h-6 w-6 shrink-0"
    >
      <circle cx="12" cy="10" r="5.2" stroke="#ff50c5" strokeWidth="1.8" />
      <path
        d="M12 2.2v2.2M4.6 4.6l1.6 1.6M19.4 4.6l-1.6 1.6M3 10h2.2M18.8 10H21"
        stroke="#ff50c5"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M3.5 16.2h17M6.2 19.8h11.6"
        stroke="#8b5cf6"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 9.2v4.3" />
      <circle cx="10" cy="6.6" r="0.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function MapHeaderPill({ onOpenAbout }: MapHeaderPillProps) {
  return (
    <>
      <style>{`
        @keyframes gmx-pill-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes gmx-pill-in-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
      <header
        className="pointer-events-auto absolute top-3 left-1/2 z-30 -translate-x-1/2 animate-[gmx-pill-in_300ms_ease-out] motion-reduce:animate-[gmx-pill-in-fade_300ms_ease-out] md:fixed md:top-6"
        aria-label="Map header"
      >
        <div className="flex h-14 items-center gap-2 rounded-full border border-white/10 bg-black/60 px-2 shadow-[0_8px_32px_rgba(0,0,0,0.55)] backdrop-blur-md sm:gap-3 sm:px-3">
          <Link
            href="/"
            aria-label="GTA6mapx home"
            className="flex shrink-0 items-center gap-2 rounded-full px-1.5 py-1 transition-colors hover:bg-white/5"
          >
            <SunMark />
            <span className="font-display text-base tracking-[0.18em] text-white uppercase sm:text-lg">
              GTA6MAPX
            </span>
          </Link>
          <span className="h-6 w-px shrink-0 bg-white/10" aria-hidden="true" />
          <CountdownChip />
          <span className="h-6 w-px shrink-0 bg-white/10" aria-hidden="true" />
          <button
            type="button"
            onClick={onOpenAbout}
            aria-label="About GTA6mapx"
            title="About GTA6mapx"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#c6cdd8] transition-colors hover:bg-[#ff50c5]/15 hover:text-[#ff50c5]"
          >
            <InfoIcon />
          </button>
        </div>
      </header>
    </>
  );
}
