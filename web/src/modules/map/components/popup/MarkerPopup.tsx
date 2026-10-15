"use client";

import { useId } from "react";
import type { Pin } from "@/data/pins";
import { CATEGORIES } from "@/data/pins";
import { EVIDENCE_META } from "@/modules/entities/types";
import { discoveryStrings as S } from "@/modules/discovery/strings";
// NOTE: ../../gameCoords is the single coordinate-truth module: every
// coordinate surface formats through it (anti-false-precision policy).
import { honestCoordString } from "../../gameCoords";

/* ─── MarkerPopup — floating intel card for a selected map pin ────────────
 * Desktop-only (hidden md:block): the coordinator shows MobileSheet on
 * small screens. Positioned by itself: left of the 56px rail, vertically
 * centered. All copy is honesty-labeled — coordinates always "approx.",
 * nothing invented about gameplay/prices/specs. Original neon Vice City
 * styling, original inline SVGs, no emoji. */

/* ─── Original category glyphs (pure inline SVG, one per pin category) ─── */

function CategoryGlyph({ slug }: { slug: string }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-9 w-9",
    "aria-hidden": true,
  };
  switch (slug) {
    case "collectibles":
      return (
        <svg {...common}>
          <path d="M7 3h10l4 6-9 12L3 9l4-6Z" />
          <path d="M3 9h18M7 3l5 6 5-6M12 15v6" />
        </svg>
      );
    case "stores":
      return (
        <svg {...common}>
          <path d="M4 10v10h16V10" />
          <path d="M3 6.5 4.8 3h14.4L21 6.5V10H3V6.5Z" />
          <path d="M3 6.5h18" />
          <path d="M12 20v-5.5" />
        </svg>
      );
    case "missions":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" />
        </svg>
      );
    case "vehicles":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="2.5" />
          <path d="M12 14.5V3.5M9.8 13.4 3.7 16.8M14.2 13.4l6.1 3.4" />
        </svg>
      );
    case "secrets":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4.5" />
          <path d="M10.5 8a1.5 1.5 0 0 0 3 0v2.5l3.5 8a2 2 0 0 1-3.6 1.5L12 17.6l-1.4 2.4a2 2 0 0 1-3.6-1.5l3.5-8V8Z" />
        </svg>
      );
    case "stunt-jumps":
      return (
        <svg {...common}>
          <path d="M4 20 20 4" />
          <path d="M14 4h6v6" />
          <path d="M4 14v6h6" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M12 21s-6.5-5.4-6.5-10.5A6.5 6.5 0 0 1 12 4a6.5 6.5 0 0 1 6.5 6.5C18.5 15.6 12 21 12 21Z" />
          <circle cx="12" cy="10.5" r="2.2" />
        </svg>
      );
  }
}

/* ─── Original small action glyphs ─── */

function CopyGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <rect x="7" y="7" width="9.5" height="9.5" rx="2" />
      <path d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

function LinkGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M8.5 11.5a3.6 3.6 0 0 0 5 5l2.8-2.8a3.6 3.6 0 0 0-5-5l-1.2 1.2" />
      <path d="M11.5 8.5a3.6 3.6 0 0 0-5-5L3.7 6.3a3.6 3.6 0 0 0 5 5l1.2-1.2" />
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="m4 10.5 4 4 8-9" />
    </svg>
  );
}

function BookmarkGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M5.5 2.5h9a1 1 0 0 1 1 1V17.5L10 14l-5.5 3.5v-14a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

function BookmarkFilledGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M5.5 2.5h9a1 1 0 0 1 1 1V17.5L10 14l-5.5 3.5v-14a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-4 w-4" aria-hidden="true">
      <path d="m5 5 10 10M15 5 5 15" />
    </svg>
  );
}

/* ─── IntelPlateArt: original generative "intel plate" header band ────────
 * Pure CSS/SVG art — gradient, grid, pink glow, animated sheen. Shared by
 * MarkerDetailModal. Never a third-party still. */

export function IntelPlateArt({
  categorySlug,
  className = "",
}: {
  categorySlug: string;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const gradId = `gva-grad-${uid}`;
  const gridId = `gva-grid-${uid}`;
  const glowId = `gva-glow-${uid}`;
  return (
    <div
      className={`relative h-24 overflow-hidden rounded-xl border border-[rgba(255,80,197,0.22)] ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 400 96" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2b1033" />
            <stop offset="0.55" stopColor="#121a2b" />
            <stop offset="1" stopColor="#0a1a26" />
          </linearGradient>
          <pattern id={gridId} width="22" height="22" patternUnits="userSpaceOnUse">
            <path d="M22 0H0V22" fill="none" stroke="rgba(255,80,197,0.10)" strokeWidth="1" />
          </pattern>
          <radialGradient id={glowId} cx="0.72" cy="0.18" r="0.75">
            <stop offset="0" stopColor="#ff50c5" stopOpacity="0.42" />
            <stop offset="1" stopColor="#ff50c5" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="400" height="96" fill={`url(#${gradId})`} />
        <rect width="400" height="96" fill={`url(#${gridId})`} />
        <rect width="400" height="96" fill={`url(#${glowId})`} />
        <line x1="0" y1="72" x2="400" y2="72" stroke="rgba(255,80,197,0.25)" strokeWidth="1" strokeDasharray="6 5" />
        <circle cx="52" cy="28" r="1.6" fill="#ff50c5" opacity="0.9" />
        <circle cx="348" cy="64" r="1.6" fill="#8b5cf6" opacity="0.8" />
        <circle cx="318" cy="24" r="1" fill="#ffffff" opacity="0.5" />
      </svg>
      {/* sheen sweep — disabled under reduced motion */}
      <div className="gva-sheen pointer-events-none absolute inset-0" />
      <div className="absolute inset-0 flex items-center justify-center text-[#ff7fb0]">
        <CategoryGlyph slug={categorySlug} />
      </div>
    </div>
  );
}

/* ─── Props ─── */

interface MarkerPopupProps {
  pin: Pin;
  found: boolean;
  onToggleFound: () => void;
  onClose: () => void;
  onCopyCoords: () => void;
  onCopyLink: () => void;
  onFullDetails: () => void;
  coordsCopied: boolean;
  linkCopied: boolean;
}

const actionBtnBase =
  "btn-ghost flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[#c3cad4] transition-all hover:border-[rgba(255,80,197,0.55)] hover:text-white hover:shadow-[0_0_16px_rgba(255,80,197,0.35)]";

export default function MarkerPopup({
  pin,
  found,
  onToggleFound,
  onClose,
  onCopyCoords,
  onCopyLink,
  onFullDetails,
  coordsCopied,
  linkCopied,
}: MarkerPopupProps) {
  const category = CATEGORIES.find((c) => c.slug === pin.categorySlug);
  const meta = EVIDENCE_META[pin.evidence.status];
  const host =
    pin.sourceUrl != null
      ? (() => {
          try {
            return new URL(pin.sourceUrl).hostname.replace(/^www\./, "");
          } catch {
            return null;
          }
        })()
      : null;

  return (
    <>
      {/* scoped keyframes: scale-pop (desktop) + sheen; reduced-motion → fade only */}
      <style>{`
        @keyframes gva-popup-pop {
          from { transform: scale(0.96); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes gva-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes gva-sheen-sweep {
          from { transform: translateX(-130%) skewX(-18deg); }
          to { transform: translateX(230%) skewX(-18deg); }
        }
        .gva-popup-anim { animation: gva-popup-pop 180ms ease-out; }
        .gva-sheen {
          background: linear-gradient(100deg, transparent 20%, rgba(255,255,255,0.08) 50%, transparent 80%);
          animation: gva-sheen-sweep 7s linear infinite;
          width: 55%;
        }
        @media (prefers-reduced-motion: reduce) {
          .gva-popup-anim { animation: gva-fade-in 180ms ease-out; }
          .gva-sheen { animation: none; display: none; }
        }
      `}</style>

      {/* Desktop only: the coordinator renders MobileSheet on small screens. */}
      <div className="absolute left-[76px] top-1/2 z-30 hidden -translate-y-1/2 md:block">
        <div className="gva-popup-anim">
          <section
            role="dialog"
            aria-label={pin.name}
            className="glass-panel hud-corner pointer-events-auto w-[360px] max-w-full overflow-hidden rounded-2xl border border-white/10 shadow-[0_24px_60px_rgba(0,0,0,0.6)]"
          >
            <IntelPlateArt categorySlug={pin.categorySlug} className="rounded-none rounded-t-2xl border-0 border-b" />

            <button
              type="button"
              onClick={onClose}
              aria-label="Close pin details"
              title="Close"
              className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-lg bg-black/45 text-[#9aa3b2] backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white"
            >
              <CloseGlyph />
            </button>

            <div className="flex flex-col gap-3 p-4">
              {/* title */}
              <h2 className="font-display text-lg uppercase leading-tight tracking-wide text-[#f2f5f9]">
                {pin.name}
              </h2>

              {/* evidence + category chips */}
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`badge ${meta.className} text-[11px] font-bold uppercase tracking-[0.08em]`}
                  title={meta.blurb}
                >
                  {meta.label}
                </span>
                {category && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#c3cad4]">
                    {category.name}
                  </span>
                )}
              </div>

              {/* coordinates — always approximate-labeled */}
              <div className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-black/25 px-3 py-2">
                <span className="truncate font-mono text-xs text-[#ff9ec4]">
                  {honestCoordString(pin.lat, pin.lng)}
                </span>
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5b6472]">
                  approx.
                </span>
              </div>

              {/* evidence summary + source */}
              <div className="flex flex-col gap-1.5">
                <p className="line-clamp-3 text-sm leading-snug text-[#c3cad4]">
                  {pin.evidence.detail}
                </p>
                <p className="text-[11px] text-[#8b94a3]">
                  Source:{" "}
                  {pin.sourceUrl && host ? (
                    <a
                      href={pin.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#ff8fb3] underline-offset-2 hover:underline"
                    >
                      {host}
                    </a>
                  ) : (
                    <span className="text-[#c3cad4]">community reporting</span>
                  )}
                </p>
              </div>

              {/* action row */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onCopyCoords}
                  title={coordsCopied ? S.coordsCopied : "Copy coordinates"}
                  aria-label={coordsCopied ? S.coordsCopied : "Copy coordinates"}
                  className={`${actionBtnBase} ${coordsCopied ? "border-[rgba(255,80,197,0.55)] text-[#ff7fb0]" : ""}`}
                >
                  {coordsCopied ? <CheckGlyph /> : <CopyGlyph />}
                </button>
                <button
                  type="button"
                  onClick={onCopyLink}
                  title={linkCopied ? S.linkCopied : S.sharePin}
                  aria-label={linkCopied ? S.linkCopied : S.sharePin}
                  className={`${actionBtnBase} ${linkCopied ? "border-[rgba(255,80,197,0.55)] text-[#ff7fb0]" : ""}`}
                >
                  {linkCopied ? <CheckGlyph /> : <LinkGlyph />}
                </button>
                <button
                  type="button"
                  onClick={onToggleFound}
                  aria-pressed={found}
                  title={found ? "Mark as not found" : "Mark as found"}
                  aria-label={found ? "Mark as not found" : "Mark as found"}
                  className={`${actionBtnBase} ${found ? "border-[rgba(255,80,197,0.7)] text-[#ff50c5] shadow-[0_0_14px_rgba(255,80,197,0.45)]" : ""}`}
                >
                  {found ? <BookmarkFilledGlyph /> : <BookmarkGlyph />}
                </button>
              </div>

              {/* full details */}
              <button
                type="button"
                onClick={onFullDetails}
                className="btn-neon font-display h-11 w-full rounded-xl text-sm uppercase tracking-[0.18em]"
              >
                Full details
              </button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
