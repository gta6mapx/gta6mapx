"use client";

import { useState } from "react";
import { discoveryStrings as S } from "@/modules/discovery/strings";
import type { TagCount } from "@/modules/discovery/selectors";

interface TagChipsProps {
  tags: TagCount[];
  active: string[];
  onToggle(tag: string): void;
}

/**
 * TagChips — collapsible tag group from the controlled vocabulary (spec
 * §3.3). Shows only tags present in the current filtered set, most
 * frequent first, capped at ~20. Collapsed by default to keep the panel
 * compact.
 */
export default function TagChips({ tags, active, onToggle }: TagChipsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1"
      >
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8b94a3]">
          {S.tagFilterCollapsed(tags.length)}
        </span>
        <svg
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          className={`h-3 w-3 text-[#8b94a3] transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path d="m2 7.5 4-4 4 4" />
        </svg>
      </button>

      {open && (
        tags.length === 0 ? (
          <p className="px-1 text-xs text-[#5b6472]">
            No tags in the current filter set.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={S.tagFilterLabel}>
            {tags.map(({ tag, count }) => {
              const isOn = active.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onToggle(tag)}
                  aria-pressed={isOn}
                  title={`${count} location${count === 1 ? "" : "s"}`}
                  className={
                    isOn
                      ? "rounded-full bg-gradient-to-r from-[#ff50c5] to-[#a855f7] px-2.5 py-1 text-xs font-semibold text-white shadow-[0_0_12px_rgba(255,80,197,0.35)]"
                      : "rounded-full border border-[#1f2632] bg-[#0a0e14]/80 px-2.5 py-1 text-xs font-medium text-[#8b94a3] transition-colors hover:border-[rgba(255,80,197,0.4)] hover:text-[#e8ecf1]"
                  }
                >
                  #{tag} <span className="font-mono text-[10px] opacity-75">{count}</span>
                </button>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
