// ─── modules/map/components/chrome/BaseStyleSegment.tsx ───────────────
// Bottom-center 2-segment base-map control: Leonida (game map) ↔ Real Florida.
// Radiogroup semantics with arrow-key navigation, disabled while a style
// switch is in flight, polite live-region announcements. Original styling
// (dark glass pill, pink active segment with a quick color crossfade).
// All code below is original (CHROME TEAM, Sep 2026).

"use client";

import type { BaseStyleId } from "../../styleManager";

interface BaseStyleSegmentProps {
  value: BaseStyleId;
  switching: boolean;
  onChange: (id: BaseStyleId) => void;
}

const OPTIONS: Array<{ id: BaseStyleId; label: string; hint: string }> = [
  { id: "leonida-dark", label: "Leonida", hint: "Game map — dark preview" },
  { id: "real-florida", label: "Real Florida", hint: "Real-world cartography" },
];

export default function BaseStyleSegment({
  value,
  switching,
  onChange,
}: BaseStyleSegmentProps) {
  const activeLabel = OPTIONS.find((o) => o.id === value)?.label ?? value;
  // Derived during render (no effect): the live region only announces when
  // the text actually changes — i.e. when a switch starts or lands.
  const announcement = switching
    ? "Switching base map…"
    : `Base map: ${activeLabel}`;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const idx = OPTIONS.findIndex((o) => o.id === value);
    const next =
      e.key === "ArrowRight"
        ? OPTIONS[(idx + 1) % OPTIONS.length]
        : OPTIONS[(idx - 1 + OPTIONS.length) % OPTIONS.length];
    if (!switching && next.id !== value) onChange(next.id);
  };

  return (
    <div className="pointer-events-auto absolute bottom-3 left-1/2 z-30 -translate-x-1/2 md:fixed md:bottom-6">
      <div
        role="radiogroup"
        aria-label="Base map style"
        onKeyDown={onKeyDown}
        className="flex items-center gap-1 rounded-full border border-white/10 bg-black/60 p-1 shadow-[0_8px_32px_rgba(0,0,0,0.55)] backdrop-blur-md"
      >
        {OPTIONS.map((opt) => {
          const active = opt.id === value;
          const disabled = switching || active;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${opt.label} — ${opt.hint}`}
              title={opt.hint}
              disabled={disabled}
              aria-busy={switching && !active ? true : undefined}
              onClick={() => onChange(opt.id)}
              className={`inline-flex h-11 min-w-[44px] items-center justify-center gap-2 rounded-full border px-3 text-xs font-semibold tracking-wide uppercase transition-colors duration-200 sm:px-4 sm:text-sm ${
                active
                  ? "border-[#ff50c5]/70 bg-[#ff50c5]/20 text-white shadow-[0_0_16px_rgba(255,80,197,0.45)]"
                  : "border-transparent text-[#8b94a3] hover:bg-white/5 hover:text-white"
              } ${disabled && !active ? "cursor-wait opacity-60" : ""}`}
            >
              <span>{opt.label}</span>
              {switching && !active && (
                <span aria-hidden="true" className="opacity-60">
                  …
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div aria-live="polite" role="status" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}
