"use client";

import { ALL_EVIDENCE_STATUSES, type EvidenceStatus } from "@/data/pins";
import { EVIDENCE_META } from "@/modules/entities/types";
import { EVIDENCE_COLORS } from "../markerLayer";
import { discoveryStrings as S } from "@/modules/discovery/strings";

interface EvidenceChipsProps {
  active: EvidenceStatus[];
  onToggle(status: EvidenceStatus): void;
  onAll(): void;
  onNone(): void;
}

/**
 * EvidenceChips — the 4-chip Evidence filter (spec §2.1). Provenance is a
 * filter dimension, never a category tab. Multi-select, default all-on.
 * Colors come from the shared evidence palette — never brand chrome.
 */
export default function EvidenceChips({ active, onToggle, onAll, onNone }: EvidenceChipsProps) {
  return (
    <div role="group" aria-label={S.evidenceFilterLabel} className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8b94a3]">
          {S.evidenceFilterLabel}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onAll}
            className="text-[11px] font-semibold text-[#8b94a3] underline-offset-2 hover:text-[#e8ecf1] hover:underline"
          >
            {S.all}
          </button>
          <button
            type="button"
            onClick={onNone}
            className="text-[11px] font-semibold text-[#8b94a3] underline-offset-2 hover:text-[#e8ecf1] hover:underline"
          >
            {S.none}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ALL_EVIDENCE_STATUSES.map((status) => {
          const isOn = active.includes(status);
          const meta = EVIDENCE_META[status];
          const color = EVIDENCE_COLORS[status];
          return (
            <button
              key={status}
              type="button"
              onClick={() => onToggle(status)}
              aria-pressed={isOn}
              title={meta.blurb}
              className={
                isOn
                  ? "flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold text-white transition-all"
                  : "flex items-center gap-1.5 rounded-full border border-[#1f2632] bg-[#0a0e14]/80 px-2.5 py-1.5 text-xs font-medium text-[#8b94a3] transition-colors hover:border-white/25 hover:text-[#e8ecf1]"
              }
              style={
                isOn
                  ? { borderColor: `${color}66`, backgroundColor: `${color}1f` }
                  : undefined
              }
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
                aria-hidden="true"
              />
              {meta.label}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] leading-snug text-[#5b6472]">{S.filterFootnote}</p>
    </div>
  );
}
