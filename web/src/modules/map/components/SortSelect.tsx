"use client";

import { discoveryStrings as S } from "@/modules/discovery/strings";
import type { SortId } from "@/modules/discovery/reducer";

interface SortSelectProps {
  value: SortId;
  onChange(sort: SortId): void;
}

const OPTIONS: { id: SortId; label: string }[] = [
  { id: "name", label: S.sortName },
  { id: "evidence", label: S.sortEvidence },
  { id: "updated", label: S.sortUpdated },
  { id: "region", label: S.sortRegion },
];

/**
 * SortSelect — applies to the results list. Selection persists to
 * localStorage via the parent (their "settings not saved" gap, fixed).
 */
export default function SortSelect({ value, onChange }: SortSelectProps) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8b94a3]">
        {S.sortLabel}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortId)}
        aria-label={S.sortLabel}
        className="h-9 min-w-0 flex-1 cursor-pointer rounded-lg border border-[#1f2632] bg-[#0d1219] px-2.5 text-xs font-medium text-[#e8ecf1] transition-colors hover:border-[rgba(255,80,197,0.4)] focus:border-[#8b5cf6] focus:outline-none"
      >
        {OPTIONS.map((opt) => (
          <option key={opt.id} value={opt.id} className="bg-[#0d1219]">
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
