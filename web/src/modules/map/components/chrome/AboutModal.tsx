// ─── modules/map/components/chrome/AboutModal.tsx ──────────────────────
// About dialog: what GTA6mapx is, the fan-project disclaimer, data credits,
// and quick links. Original wording throughout; no claims beyond what the
// site itself states. All code below is original (CHROME TEAM, Sep 2026).

"use client";

import { useEffect } from "react";

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
}

function CloseIcon() {
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
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

const QUICK_LINKS = [
  { href: "/community", label: "Community" },
  { href: "/library", label: "Library" },
  { href: "/game/find-the-location", label: "Find the Location" },
];

export default function AboutModal({ open, onClose }: AboutModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <style>{`
        @keyframes gmx-modal-in {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes gmx-modal-in-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
      <button
        type="button"
        aria-label="Close about dialog"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gmx-about-title"
        className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#0b0f16]/95 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.7)] backdrop-blur-md animate-[gmx-modal-in_200ms_ease-out] motion-reduce:animate-[gmx-modal-in-fade_200ms_ease-out]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          title="Close"
          autoFocus
          className="absolute top-3 right-3 flex h-11 w-11 items-center justify-center rounded-full text-[#8b94a3] transition-colors hover:bg-white/5 hover:text-white"
        >
          <CloseIcon />
        </button>

        <h2
          id="gmx-about-title"
          className="font-display pr-10 text-2xl tracking-wide text-white uppercase"
        >
          About GTA6mapx
        </h2>

        <p className="mt-3 text-sm leading-relaxed text-[#c6cdd8]">
          GTA6mapx is a fan-made interactive map of GTA VI&rsquo;s Leonida.
          Every pin carries an evidence label &mdash; from Rockstar-confirmed
          down to community-reported &mdash; so you can always see how solid a
          location really is instead of guessing.
        </p>

        <p className="mt-3 rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-xs leading-relaxed text-[#8b94a3]">
          Independent fan project. Not affiliated with, endorsed by, or
          connected to Rockstar Games or Take-Two Interactive.
        </p>

        <h3 className="mt-5 text-[11px] font-bold tracking-[0.14em] text-white/70 uppercase">
          Data &amp; credit
        </h3>
        <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-[#8b94a3]">
          <li>
            Community mapping data &mdash; map data &copy; gtadb.org
            contributors (
            <a
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#ff7aa8] underline decoration-[#ff50c5]/40 underline-offset-2 hover:text-[#ff50c5]"
            >
              CC BY 4.0
            </a>
            )
          </li>
          <li>Base map &copy; OpenMapTiles &copy; OpenStreetMap contributors</li>
        </ul>

        <h3 className="mt-5 text-[11px] font-bold tracking-[0.14em] text-white/70 uppercase">
          Quick links
        </h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {QUICK_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="inline-flex h-11 items-center rounded-full border border-white/10 bg-black/40 px-4 text-sm font-medium text-[#c6cdd8] transition-colors hover:border-[#ff50c5]/60 hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
