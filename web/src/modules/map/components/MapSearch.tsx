"use client";

import { useId, useRef, useState } from "react";
import type { Pin } from "@/data/pins";
import { CATEGORIES } from "@/data/pins";
import { EVIDENCE_META } from "@/modules/entities/types";
import { discoveryStrings as S } from "@/modules/discovery/strings";

interface MapSearchProps {
  query: string;
  onQuery(q: string): void;
  results: Pin[];
  /** "N of M" context for the footer line. */
  resultScope: { shown: number; total: number };
  loading: boolean;
  /** Human-readable active-filter note for the empty state (R5), or null. */
  activeFilterNote: string | null;
  onSelect(pin: Pin): void;
  /** Atomic reset: clears query, filters, sort, selection (R2). */
  onResetAll(): void;
}

/** Original magnifier glyph. */
function SearchGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-4 w-4 shrink-0 text-[#8b94a3]" aria-hidden="true">
      <circle cx="9" cy="9" r="5.5" />
      <path d="m13.5 13.5 3.5 3.5" />
    </svg>
  );
}

function categoryMeta(slug: string): { name: string; icon: string } {
  const c = CATEGORIES.find((x) => x.slug === slug);
  return { name: c?.name ?? slug, icon: c?.icon ?? "📍" };
}

/**
 * MapSearch — glass search input with a keyboard-navigable results dropdown.
 * R5: never claims "no results" while loading; the empty state names the
 * query and the active filters and offers one-tap reset.
 */
export default function MapSearch({
  query,
  onQuery,
  results,
  resultScope,
  loading,
  activeFilterNote,
  onSelect,
  onResetAll,
}: MapSearchProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmed = query.trim();
  const showDropdown = open && trimmed.length > 0;
  // Clamp the keyboard highlight instead of resetting it in an effect:
  // results arrive debounced, and a stale index must never highlight
  // the wrong row (R4).
  const highlightIdx = highlight >= results.length ? -1 : highlight;

  const commitSelect = (pin: Pin) => {
    onSelect(pin);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" && results.length > 0) {
      e.preventDefault();
      setHighlight((h) => (h + 1) % results.length);
    } else if (e.key === "ArrowUp" && results.length > 0) {
      e.preventDefault();
      setHighlight((h) => (h - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      if (highlightIdx >= 0 && results[highlightIdx]) {
        e.preventDefault();
        commitSelect(results[highlightIdx]);
      }
    } else if (e.key === "Escape") {
      // R2: Esc clears the query AND closes the dropdown atomically.
      onQuery("");
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const emptyMessage = activeFilterNote
    ? S.noResultsWithFilters(trimmed, activeFilterNote)
    : S.noResults(trimmed);

  return (
    <div className="relative">
      <div className="glass-panel flex h-10 items-center gap-2 rounded-xl px-3 transition-shadow focus-within:border-[rgba(139,92,246,0.6)] focus-within:shadow-[0_0_0_3px_rgba(139,92,246,0.15)]">
        <SearchGlyph />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            onQuery(e.target.value);
            setHighlight(-1);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
          placeholder={S.searchPlaceholder}
          aria-label={S.searchLabel}
          aria-expanded={showDropdown}
          aria-controls={listId}
          aria-activedescendant={highlightIdx >= 0 ? `${listId}-opt-${highlightIdx}` : undefined}
          role="combobox"
          aria-autocomplete="list"
          className="min-w-0 flex-1 bg-transparent text-sm text-[#e8ecf1] outline-none placeholder:text-[#8b94a3] [&::-webkit-search-cancel-button]:hidden"
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={() => onQuery("")}
            aria-label={S.clearSearch}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-lg leading-none text-[#8b94a3] transition-colors hover:bg-white/5 hover:text-white"
          >
            ×
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          id={listId}
          role="listbox"
          aria-label={S.searchResultsLabel}
          className="glass-panel absolute inset-x-0 top-full z-40 mt-2 max-h-[320px] overflow-y-auto p-1.5"
        >
          {loading ? (
            <p className="px-3 py-4 text-sm text-[#8b94a3]">Locations still loading…</p>
          ) : results.length === 0 ? (
            <div className="px-3 py-4">
              <p className="text-sm text-[#c3cad4]">{emptyMessage}</p>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onResetAll();
                  setOpen(false);
                }}
                className="mt-2 text-xs font-semibold text-[#8b5cf6] underline-offset-2 hover:underline"
              >
                {S.clearSearchAndFilters}
              </button>
            </div>
          ) : (
            <>
              <ul className="flex flex-col gap-0.5">
                {results.map((pin, i) => {
                  const meta = EVIDENCE_META[pin.evidence.status];
                  const cat = categoryMeta(pin.categorySlug);
                  const isHi = i === highlightIdx;
                  return (
                    <li
                      key={pin.id}
                      id={`${listId}-opt-${i}`}
                      role="option"
                      aria-selected={isHi}
                    >
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => setHighlight(i)}
                        onClick={() => commitSelect(pin)}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                          isHi ? "bg-white/10" : "hover:bg-white/5"
                        }`}
                      >
                        <span className="text-base leading-none" aria-hidden="true">
                          {cat.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-[#e8ecf1]">
                            {pin.name}
                          </span>
                          <span className="block truncate text-[11px] text-[#8b94a3]">
                            {cat.name} · {pin.region}
                          </span>
                        </span>
                        <span
                          className={`badge ${meta.className} shrink-0`}
                          title={meta.blurb}
                        >
                          {meta.label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="border-t border-white/10 px-2.5 py-2 text-xs text-[#8b94a3]">
                {S.resultsCount(resultScope.shown, resultScope.total)}
              </p>
            </>
          )}
        </div>
      )}
      {/* Plain-language count for screen readers */}
      <span className="sr-only" aria-live="polite">
        {loading
          ? "Locations still loading."
          : `${results.length} matching locations.`}
      </span>
    </div>
  );
}
