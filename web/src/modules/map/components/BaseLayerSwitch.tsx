"use client";

/**
 * BaseLayerSwitch.tsx — Leonida Dark ↔ Real Florida base-map toggle.
 *
 * Segmented radiogroup, icon + text (never emoji-only), 44 px touch targets,
 * disabled while a style switch is in flight, polite live-region announcements.
 * Visual styling comes from worker A's `.seg-control` / `.btn-ghost` classes;
 * layout/sizing utilities below are plain Tailwind so the control is usable
 * before (and independent of) that CSS.
 */

import type { BaseStyleId } from "../styleManager";

interface BaseLayerSwitchProps {
  value: BaseStyleId;
  switching: boolean;
  onChange(id: BaseStyleId): void;
}

const OPTIONS: Array<{ id: BaseStyleId; label: string; hint: string }> = [
  { id: "leonida-dark", label: "Leonida", hint: "Dark preview map" },
  { id: "real-florida", label: "Florida", hint: "Real-world cartography" },
];

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 13.5A8.5 8.5 0 0 1 10.5 4 8.5 8.5 0 1 0 20 13.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

const ICONS: Record<BaseStyleId, () => React.ReactElement> = {
  "leonida-dark": MoonIcon,
  "real-florida": SunIcon,
};

export default function BaseLayerSwitch({ value, switching, onChange }: BaseLayerSwitchProps) {
  const activeLabel = OPTIONS.find((o) => o.id === value)?.label ?? value;
  // Derived during render (no effect): aria-live announces only when the text
  // actually changes — i.e. when a switch starts or a new style lands.
  const announcement = switching ? "Switching base map…" : `Base map: ${activeLabel}`;

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
    <div className="flex flex-col gap-1">
      <div
        role="radiogroup"
        aria-label="Base map style"
        className="seg-control inline-flex items-stretch gap-1 rounded-full p-1"
        onKeyDown={onKeyDown}
      >
        {OPTIONS.map((opt) => {
          const active = opt.id === value;
          const disabled = switching || active;
          const Icon = ICONS[opt.id];
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${opt.label} — ${opt.hint}`}
              title={opt.hint}
              disabled={disabled}
              onClick={() => onChange(opt.id)}
              className="btn-ghost inline-flex min-h-[44px] min-w-[44px] flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium"
              aria-busy={switching && !active ? true : undefined}
            >
              <Icon />
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
      {/* Polite announcements for screen readers; visually hidden. */}
      <div aria-live="polite" role="status" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}
