"use client";

import { discoveryStrings as S } from "@/modules/discovery/strings";

interface CategoryInfo {
  slug: string;
  name: string;
  icon: string;
  count: number;
}

interface CategoryPillsProps {
  categories: CategoryInfo[];
  active: string[];
  onToggle(slug: string): void;
  onAll(): void;
  onNone(): void;
}

/**
 * CategoryPills — category filters with FACETED live counts (spec §3.4).
 * Each pill's count answers "how many would I get if I tapped this?" —
 * markers matching all OTHER active filters. R3: counts are labeled via
 * the tooltip; active pills never use green (reserved for evidence).
 */
export default function CategoryPills({
  categories,
  active,
  onToggle,
  onAll,
  onNone,
}: CategoryPillsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by category">
      {categories.map((cat) => {
        const isActive = active.includes(cat.slug);
        return (
          <button
            key={cat.slug}
            type="button"
            onClick={() => onToggle(cat.slug)}
            aria-pressed={isActive}
            title={`${cat.count} ${cat.name} locations — ${S.tabCountTooltip}`}
            className={
              isActive
                ? "flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#ff50c5] to-[#a855f7] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_0_16px_rgba(255,80,197,0.4)] transition-transform hover:scale-[1.03] active:scale-[0.98]"
                : "flex items-center gap-1.5 rounded-full border border-[#1f2632] bg-[#0a0e14]/80 px-3 py-1.5 text-xs font-medium text-[#8b94a3] transition-colors hover:border-[rgba(255,80,197,0.4)] hover:text-[#e8ecf1]"
            }
          >
            <span aria-hidden="true">{cat.icon}</span>
            <span>{cat.name}</span>
            <span className="font-mono text-[10px] opacity-80">{cat.count}</span>
          </button>
        );
      })}

      {/* Quick actions */}
      <span className="mx-0.5 h-5 w-px bg-white/10" aria-hidden="true" />
      <button
        type="button"
        onClick={onAll}
        className="rounded-full px-2.5 py-1.5 text-xs font-semibold text-[#8b5cf6] underline-offset-2 transition-colors hover:bg-[rgba(139,92,246,0.08)] hover:underline"
      >
        {S.all}
      </button>
      <button
        type="button"
        onClick={onNone}
        className="rounded-full px-2.5 py-1.5 text-xs font-semibold text-[#8b94a3] underline-offset-2 transition-colors hover:bg-white/5 hover:text-white hover:underline"
      >
        {S.none}
      </button>
    </div>
  );
}
