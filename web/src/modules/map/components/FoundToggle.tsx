"use client";

import { discoveryStrings as S } from "@/modules/discovery/strings";
import type { FoundMode } from "@/modules/discovery/reducer";

interface FoundToggleProps {
  value: FoundMode;
  onChange(mode: FoundMode): void;
}

const OPTIONS: { id: FoundMode; label: string }[] = [
  { id: "all", label: S.foundAll },
  { id: "found", label: S.foundOnly },
  { id: "not-found", label: S.foundNotYet },
];

/** FoundToggle — All / Found / Not found segmented control (spec §3.3). */
export default function FoundToggle({ value, onChange }: FoundToggleProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8b94a3]">
        {S.foundFilterLabel}
      </p>
      <div
        role="group"
        aria-label={S.foundFilterLabel}
        className="flex items-center gap-1 rounded-full border border-[#1f2632] bg-[#0d1219]/85 p-1"
      >
        {OPTIONS.map((opt) => {
          const isOn = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              aria-pressed={isOn}
              className={
                isOn
                  ? "h-9 flex-1 rounded-full bg-gradient-to-r from-[#ff50c5] to-[#a855f7] px-3 text-xs font-bold text-white shadow-[0_0_12px_rgba(255,80,197,0.35)]"
                  : "h-9 flex-1 rounded-full px-3 text-xs font-semibold text-[#8b94a3] transition-colors hover:text-[#e8ecf1]"
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
