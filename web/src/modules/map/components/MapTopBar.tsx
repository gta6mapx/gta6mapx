"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import CountdownChip from "./CountdownChip";

interface MapTopBarProps {
  onShare(): void;
  copied: boolean;
  onOpenSettings(): void;
  cityJump: ReactNode;
  search: ReactNode;
}

/** Original share-arrow glyph. */
function ShareGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M12 3h4a1 1 0 0 1 1 1v4" />
      <path d="M16 4 9.5 10.5" />
      <path d="M15 11v4.5a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 4 15.5v-8A1.5 1.5 0 0 1 5.5 6H10" />
    </svg>
  );
}

/** Original gear glyph. */
function GearGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-5 w-5" aria-hidden="true">
      <circle cx="10" cy="10" r="2.6" />
      <path d="M10 1.8v2.4M10 15.8v2.4M1.8 10h2.4M15.8 10h2.4M4.2 4.2l1.7 1.7M14.1 14.1l1.7 1.7M15.8 4.2l-1.7 1.7M5.9 14.1l-1.7 1.7" strokeLinecap="round" />
    </svg>
  );
}

/**
 * MapTopBar — map chrome header: brand lockup, city quick-jump slot,
 * search slot, countdown chip, settings, share.
 * Countdown chip hides under 400px so the map stays the hero on phones.
 */
export default function MapTopBar({
  onShare,
  copied,
  onOpenSettings,
  cityJump,
  search,
}: MapTopBarProps) {
  return (
    <header
      className="glass-panel pointer-events-auto flex items-center gap-2 px-2.5 py-2 sm:gap-3 sm:px-3.5"
    >
      {/* Brand lockup */}
      <Link
        href="/"
        aria-label="GTA6MAPX home"
        className="vice-neon-title font-display shrink-0 text-xl leading-none tracking-wide uppercase sm:text-2xl"
      >
        GTA6MAPX
      </Link>

      {/* City quick-jump pills */}
      <div className="min-w-0 shrink-0">{cityJump}</div>

      {/* Search slot — flexes to fill */}
      <div className="min-w-0 flex-1 sm:max-w-md">{search}</div>

      {/* Countdown chip — hidden on very small screens */}
      <div className="hidden shrink-0 min-[401px]:block">
        <CountdownChip />
      </div>

      {/* Settings */}
      <button
        type="button"
        onClick={onOpenSettings}
        aria-label="Map settings"
        title="Map settings"
        className="btn-ghost flex h-10 w-10 shrink-0 items-center justify-center text-[#c3cad4] transition-colors hover:text-white"
      >
        <GearGlyph />
      </button>

      {/* Share */}
      <button
        type="button"
        onClick={onShare}
        aria-label="Share map view"
        title={copied ? "Link copied" : "Share map view"}
        className={`btn-ghost flex h-10 shrink-0 items-center gap-1.5 px-3 text-sm font-semibold transition-colors ${
          copied ? "text-[#8b5cf6]" : "text-[#c3cad4] hover:text-white"
        }`}
      >
        <ShareGlyph />
        <span className="hidden sm:inline">{copied ? "Copied" : "Share"}</span>
      </button>
    </header>
  );
}
