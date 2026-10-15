"use client";

import { ALL_EVIDENCE_STATUSES } from "@/data/pins";
import { EVIDENCE_META } from "@/modules/entities/types";
import { EVIDENCE_COLORS } from "../markerLayer";

/** Original check glyph for the "found" row. */
function CheckGlyph() {
  return (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="h-2.5 w-2.5 text-[#8b5cf6]" aria-hidden="true">
      <path d="M2 6.5 4.8 9 10 3" />
    </svg>
  );
}

interface EvidenceLegendProps {
  collapsed: boolean;
  onToggle(): void;
}

/**
 * EvidenceLegend — floating glass chip explaining the Leak Transparency
 * Engine. The four formal statuses (never informal tags). Visible on first
 * visit (parent controls `collapsed`), collapsible after.
 */
export default function EvidenceLegend({ collapsed, onToggle }: EvidenceLegendProps) {
  return (
    <section
      aria-label="Evidence legend"
      className="glass-panel pointer-events-auto w-[230px] p-2.5"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-1.5 py-1"
      >
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8b94a3]">
          Evidence
        </span>
        <svg
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          className={`h-3 w-3 text-[#8b94a3] transition-transform ${collapsed ? "" : "rotate-180"}`}
          aria-hidden="true"
        >
          <path d="m2 7.5 4-4 4 4" />
        </svg>
      </button>

      {!collapsed && (
        <ul className="mt-1 flex flex-col gap-1.5 border-t border-white/10 px-1.5 pt-2">
          {ALL_EVIDENCE_STATUSES.map((status) => {
            const meta = EVIDENCE_META[status];
            const color = EVIDENCE_COLORS[status];
            return (
              <li key={status} className="flex items-center gap-2" title={meta.blurb}>
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#e8ecf1]">{meta.label}</p>
                  <p className="truncate text-[11px] text-[#8b94a3]">{meta.blurb}</p>
                </div>
              </li>
            );
          })}
          <li className="flex items-center gap-2">
            <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-[#8b5cf6]/60 bg-[rgba(139,92,246,0.12)]">
              <CheckGlyph />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#e8ecf1]">Marked found</p>
              <p className="truncate text-[11px] text-[#8b94a3]">You have marked this pin found</p>
            </div>
          </li>
        </ul>
      )}
    </section>
  );
}
