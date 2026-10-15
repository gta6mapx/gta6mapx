"use client";

import { useEffect } from "react";
import type { Pin } from "@/data/pins";
import { CATEGORIES } from "@/data/pins";
import { EVIDENCE_META } from "@/modules/entities/types";
import { discoveryStrings as S } from "@/modules/discovery/strings";
// NOTE: ../../gameCoords is the single coordinate-truth module: every
// coordinate surface formats through it (anti-false-precision policy).
import { honestCoordString } from "../../gameCoords";
import { IntelPlateArt } from "./MarkerPopup";

/* ─── MarkerDetailModal — full dossier dialog for a pin ──────────────────
 * role=dialog + aria-modal; Escape closes; backdrop click closes.
 * Reuses IntelPlateArt and the CaseFilePanel date-format logic. All copy
 * honesty-labeled: coordinates "approx.", no invented specs/prices/gameplay. */

interface MarkerDetailModalProps {
  pin: Pin | null;
  onClose: () => void;
  onGoTo: (pin: Pin) => void;
  onCopyLink: () => void;
  linkCopied: boolean;
  found: boolean;
  onToggleFound: () => void;
}

/** Same honest date formatting as CaseFilePanel (small pure helper). */
function formatUpdatedAt(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function CloseGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-4 w-4" aria-hidden="true">
      <path d="m5 5 10 10M15 5 5 15" />
    </svg>
  );
}

function NavGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M10 18s-6-5-6-10a6 6 0 0 1 12 0c0 5-6 10-6 10Z" />
      <circle cx="10" cy="8" r="2" />
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

function InfoCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-white/5 bg-black/25 px-3.5 py-3">
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8b94a3]">
        {label}
      </span>
      <div className="min-w-0 text-sm text-[#e8ecf1]">{children}</div>
    </div>
  );
}

export default function MarkerDetailModal({
  pin,
  onClose,
  onGoTo,
  onCopyLink,
  linkCopied,
  found,
  onToggleFound,
}: MarkerDetailModalProps) {
  // Escape closes — guarded when no pin is open.
  useEffect(() => {
    if (!pin) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pin, onClose]);

  if (!pin) return null;

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
      {/* scoped keyframes: fade + scale-up; reduced-motion → fade only */}
      <style>{`
        @keyframes gva-modal-rise {
          from { transform: translateY(10px) scale(0.98); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes gva-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes gva-sheen-sweep {
          from { transform: translateX(-130%) skewX(-18deg); }
          to { transform: translateX(230%) skewX(-18deg); }
        }
        .gva-modal-anim { animation: gva-modal-rise 200ms ease-out; }
        .gva-sheen {
          background: linear-gradient(100deg, transparent 20%, rgba(255,255,255,0.08) 50%, transparent 80%);
          animation: gva-sheen-sweep 7s linear infinite;
          width: 55%;
        }
        @media (prefers-reduced-motion: reduce) {
          .gva-modal-anim { animation: gva-fade-in 200ms ease-out; }
          .gva-sheen { animation: none; display: none; }
        }
      `}</style>

      <div
        className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-md"
        onClick={onClose}
        aria-hidden={false}
      >
        <div className="gva-modal-anim w-full">
          <section
            role="dialog"
            aria-modal="true"
            aria-label={pin.name}
            onClick={(e) => e.stopPropagation()}
            className="glass-panel pointer-events-auto mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 shadow-[0_32px_80px_rgba(0,0,0,0.7)]"
          >
            {/* header */}
            <div className="flex items-start justify-between gap-3 px-5 pt-5">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8b94a3]">
                  Case file
                </p>
                <h2 className="font-display mt-1 text-2xl uppercase leading-tight tracking-wide text-[#f2f5f9]">
                  {pin.name}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
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
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close details"
                title="Close"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#9aa3b2] transition-colors hover:bg-white/5 hover:text-white"
              >
                <CloseGlyph />
              </button>
            </div>

            <div className="flex flex-col gap-4 px-5 pb-5 pt-4">
              <IntelPlateArt categorySlug={pin.categorySlug} />

              {/* INFO grid */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2" aria-label="Pin intel">
                <InfoCell label="Coordinates">
                  <span className="font-mono text-[13px] text-[#ff9ec4]">
                    {honestCoordString(pin.lat, pin.lng)}
                  </span>{" "}
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5b6472]">
                    approx.
                  </span>
                  <div className="mt-0.5 text-xs text-[#8b94a3]">{pin.region}</div>
                </InfoCell>
                <InfoCell label="Evidence status">
                  <span className="font-semibold text-[#e8ecf1]" title={meta.blurb}>
                    {meta.label}
                  </span>
                  <p className="mt-0.5 text-xs leading-snug text-[#8b94a3]">{meta.blurb}</p>
                </InfoCell>
                <InfoCell label="Category">
                  {category ? category.name : pin.categorySlug}
                </InfoCell>
                <InfoCell label="Source">
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
                    <span className="text-[#8b94a3]">community reporting</span>
                  )}
                </InfoCell>
                <InfoCell label="Last updated">
                  <span title={pin.updatedAt}>{S.intelUpdated(formatUpdatedAt(pin.updatedAt))}</span>
                </InfoCell>
                <InfoCell label="Intel">
                  <span className="text-xs leading-relaxed text-[#c3cad4]">
                    {pin.evidence.detail}
                  </span>
                </InfoCell>
              </div>

              {/* description — original editorial text from data, as-is */}
              <p className="text-sm leading-relaxed text-[#c3cad4]">{pin.description}</p>

              {/* action bar */}
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => onGoTo(pin)}
                  className="btn-neon font-display h-11 flex-1 rounded-xl text-sm uppercase tracking-[0.18em]"
                >
                  <NavGlyph />
                  Go to location
                </button>
                <button
                  type="button"
                  onClick={onCopyLink}
                  className={`btn-ghost h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold transition-all hover:border-[rgba(255,80,197,0.55)] hover:shadow-[0_0_16px_rgba(255,80,197,0.35)] ${
                    linkCopied ? "text-[#ff7fb0]" : "text-[#c3cad4]"
                  }`}
                >
                  {linkCopied ? <CheckGlyph /> : <LinkGlyph />}
                  {linkCopied ? "Copied" : "Copy share link"}
                </button>
                <button
                  type="button"
                  onClick={onToggleFound}
                  aria-pressed={found}
                  className={`btn-ghost h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-all hover:border-[rgba(255,80,197,0.55)] hover:shadow-[0_0_16px_rgba(255,80,197,0.35)] ${
                    found
                      ? "border-[rgba(255,80,197,0.7)] text-[#ff50c5]"
                      : "border-white/10 text-[#c3cad4]"
                  }`}
                >
                  {found ? <BookmarkFilledGlyph /> : <BookmarkGlyph />}
                  {found ? "Found — undo" : "Mark found"}
                </button>
              </div>

              {/* honesty footer */}
              <p className="text-center text-[11px] text-[#5b6472]">
                Positions are approximate — community-mapped from public footage.
              </p>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
