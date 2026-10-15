"use client";

// ─── modules/map/components/drawers/MarkerListDrawer.tsx ─────────────────
// Floating "LOCATIONS" drawer: live search, category/evidence/found-mode
// filters, a tiny virtualized marker list, and a footer with progress +
// community-pins density toggle.
//
// Rendered by the map chrome (the coordinator wires it); it never touches
// GameMap internals — every input arrives via props and every change goes
// back out through callbacks. No backdrop on desktop so the map stays
// interactive; on mobile it becomes a bottom sheet.

import { useEffect, useMemo, useRef, useState } from "react";
import type { Pin } from "@/data/pins";
import { EVIDENCE_META } from "@/modules/entities/types";
import type { FoundMode, SortId } from "@/modules/discovery/reducer";
import { honestCoordString } from "../../gameCoords";
import ProgressMeter from "../ProgressMeter";

export type EvidenceFilterStatus =
  | "rockstar-confirmed"
  | "trailer-confirmed"
  | "leak-reported"
  | "disputed";

export interface DrawerEvidenceItem {
  status: EvidenceFilterStatus;
  label: string;
  active: boolean;
}

export interface DrawerCategory {
  slug: string;
  name: string;
  icon: string;
  count: number;
}

export interface MarkerListDrawerProps {
  open: boolean;
  onClose: () => void;
  query: string;
  onQuery: (q: string) => void;
  categories: DrawerCategory[];
  activeCats: string[];
  onToggleCategory: (slug: string) => void;
  onAllCats: () => void;
  onNoneCats: () => void;
  evidence: DrawerEvidenceItem[];
  onToggleEvidence: (s: EvidenceFilterStatus) => void;
  foundMode: FoundMode;
  onFoundMode: (m: FoundMode) => void;
  sort: SortId;
  onSort: (s: SortId) => void;
  pins: Pin[];
  totalNamed: number;
  shownCount: number;
  selectedId: string | null;
  onSelectPin: (pin: Pin) => void;
  onResetAll: () => void;
  hasActiveFilters: boolean;
  densityVisible: boolean;
  densityTotal: number;
  onToggleDensity: (v: boolean) => void;
  foundCount: number;
}

// ─── Original inline SVG icons ───────────────────────────────────────────

function IconSearch() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <circle cx="7" cy="7" r="4.6" />
      <path d="M10.8 10.8 14.5 14.5" />
    </svg>
  );
}

function IconX() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
    </svg>
  );
}

function IconMagnifier() {
  return (
    <svg
      aria-hidden="true"
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="17" cy="17" r="10" />
      <path d="M25 25l8.5 8.5" />
      <path d="M13 17a4 4 0 014-4" opacity="0.6" />
    </svg>
  );
}

/** Paper-plane "fly to" icon. */
function IconPlane() {
  return (
    <svg
      aria-hidden="true"
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.8 1.2 7.4 8.6" />
      <path d="M14.8 1.2 10.4 14.8 7.4 8.6 1.2 5.6z" />
    </svg>
  );
}

// ─── Option lists ────────────────────────────────────────────────────────

const SORT_OPTIONS: { id: SortId; label: string }[] = [
  { id: "name", label: "Name A–Z" },
  { id: "evidence", label: "Evidence strength" },
  { id: "updated", label: "Recently updated" },
  { id: "region", label: "Region" },
];

const FOUND_OPTIONS: { id: FoundMode; label: string }[] = [
  { id: "all", label: "All" },
  { id: "found", label: "Found" },
  { id: "not-found", label: "Not found" },
];

const ROW_H = 60;
const OVERSCAN = 4;

/**
 * MarkerListDrawer — the /map locations drawer.
 *
 * Slide-in is pure CSS (translate-x/opacity ~250ms, disabled under
 * prefers-reduced-motion); the panel stays mounted so the animation can
 * play both ways. Escape closes it.
 */
export default function MarkerListDrawer(props: MarkerListDrawerProps) {
  const {
    open,
    onClose,
    query,
    onQuery,
    categories,
    activeCats,
    onToggleCategory,
    onAllCats,
    onNoneCats,
    evidence,
    onToggleEvidence,
    foundMode,
    onFoundMode,
    sort,
    onSort,
    pins,
    totalNamed,
    shownCount,
    selectedId,
    onSelectPin,
    onResetAll,
    hasActiveFilters,
    densityVisible,
    densityTotal,
    onToggleDensity,
    foundCount,
  } = props;

  const listRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(400);

  // Escape closes the drawer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Reset the list scroll whenever the filter set changes.
  const filterSig = `${query}|${activeCats.join(",")}|${foundMode}|${sort}|${evidence
    .map((e) => (e.active ? "1" : "0"))
    .join("")}`;
  useEffect(() => {
    // The scroll event syncs scrollTop state via onScroll.
    const el = listRef.current;
    if (el) el.scrollTop = 0;
  }, [filterSig]);

  // Measure the list viewport for the virtualizer.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const measure = () => setViewH(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const catIcon = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) m.set(c.slug, c.icon);
    return m;
  }, [categories]);

  const activeFilterCount =
    (query.trim() ? 1 : 0) +
    (activeCats.length !== categories.length ? 1 : 0) +
    (evidence.some((e) => !e.active) ? 1 : 0) +
    (foundMode !== "all" ? 1 : 0) +
    (sort !== "name" ? 1 : 0);

  // ── virtualization window ──
  const totalH = pins.length * ROW_H;
  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const end = Math.min(
    pins.length,
    Math.ceil((scrollTop + viewH) / ROW_H) + OVERSCAN
  );
  const visible = pins.slice(start, end);

  const catSelectValue =
    activeCats.length === categories.length ? "all" : (activeCats[0] ?? "all");

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-label="Locations list"
      aria-hidden={!open}
      className={`absolute z-40 flex flex-col rounded-2xl border border-white/10 bg-[#0b0f16]/90 shadow-[0_16px_48px_rgba(0,0,0,0.6)] backdrop-blur-xl left-[72px] top-3 bottom-3 w-[340px] max-md:left-3 max-md:right-3 max-md:top-auto max-md:bottom-3 max-md:w-auto max-md:max-h-[72dvh] transition-[transform,opacity] duration-[250ms] ease-out motion-reduce:transition-none ${
        open
          ? "translate-x-0 opacity-100"
          : "pointer-events-none -translate-x-[110%] opacity-0"
      }`}
    >
      {/* ── header ── */}
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-white/10 px-4 pb-3 pt-4">
        <div className="min-w-0">
          <h2 className="font-display text-xl uppercase leading-none tracking-wide text-[#e8ecf1]">
            Locations
          </h2>
          <p className="mt-1.5 font-mono text-[11px] text-[#8b94a3]">
            {shownCount} of {totalNamed} markers
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close locations list"
          className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-full border border-white/10 text-[#8b94a3] transition-colors hover:border-[var(--accent-line)] hover:text-[#e8ecf1] motion-reduce:transition-none"
        >
          <IconX />
        </button>
      </div>

      {/* ── body ── */}
      <div className="flex min-h-0 flex-1 flex-col px-4 pt-3">
        {/* (a) live search */}
        <div className="relative shrink-0">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8b94a3]"
          >
            <IconSearch />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search markers…"
            aria-label="Search markers"
            className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 pl-9 pr-9 text-sm text-[#e8ecf1] placeholder:text-[#5b6474] focus:border-[var(--accent-line)] focus:outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => onQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[#8b94a3] hover:text-[#e8ecf1]"
            >
              <IconX />
            </button>
          ) : null}
        </div>

        {/* (b) category icon tabs */}
        <div className="mt-3 shrink-0">
          <div className="mb-1.5 flex items-center justify-between">
            <p
              id="drawer-cat-tabs-label"
              className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8b94a3]"
            >
              Categories
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onAllCats}
                className="text-[11px] font-semibold text-[#8b94a3] underline-offset-2 hover:text-[#e8ecf1] hover:underline"
              >
                All
              </button>
              <button
                type="button"
                onClick={onNoneCats}
                className="text-[11px] font-semibold text-[#8b94a3] underline-offset-2 hover:text-[#e8ecf1] hover:underline"
              >
                None
              </button>
            </div>
          </div>
          <div
            role="group"
            aria-labelledby="drawer-cat-tabs-label"
            className="flex flex-wrap gap-1.5"
          >
            {categories.map((c) => {
              const isOn = activeCats.includes(c.slug);
              return (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => onToggleCategory(c.slug)}
                  aria-pressed={isOn}
                  aria-label={`${c.name} — ${c.count} markers`}
                  title={`${c.name} (${c.count})`}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border text-lg transition-colors motion-reduce:transition-none ${
                    isOn
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                      : "border-white/10 bg-black/30 hover:border-white/25"
                  }`}
                >
                  <span aria-hidden="true">{c.icon}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* (c) category + sort selects */}
        <div className="mt-3 grid shrink-0 grid-cols-2 gap-2">
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8b94a3]">
              Category
            </span>
            <select
              value={catSelectValue}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "all") onAllCats();
                else {
                  onNoneCats();
                  onToggleCategory(v);
                }
              }}
              aria-label="Filter to one category"
              className="h-10 min-w-0 cursor-pointer rounded-xl border border-white/10 bg-black/40 px-2 text-xs font-medium text-[#e8ecf1] focus:border-[var(--accent-line)] focus:outline-none"
            >
              <option value="all" className="bg-[#0d1219]">
                All categories
              </option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug} className="bg-[#0d1219]">
                  {c.name} ({c.count})
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8b94a3]">
              Sort
            </span>
            <select
              value={sort}
              onChange={(e) => onSort(e.target.value as SortId)}
              aria-label="Sort markers"
              className="h-10 min-w-0 cursor-pointer rounded-xl border border-white/10 bg-black/40 px-2 text-xs font-medium text-[#e8ecf1] focus:border-[var(--accent-line)] focus:outline-none"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id} className="bg-[#0d1219]">
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* (d) evidence chips */}
        <div className="mt-3 shrink-0">
          <p
            id="drawer-evidence-label"
            className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#8b94a3]"
          >
            Evidence
          </p>
          <div
            role="group"
            aria-labelledby="drawer-evidence-label"
            className="flex flex-wrap gap-1.5"
          >
            {evidence.map((e) => (
              <button
                key={e.status}
                type="button"
                onClick={() => onToggleEvidence(e.status)}
                aria-pressed={e.active}
                title={EVIDENCE_META[e.status].blurb}
                className={`rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition-colors motion-reduce:transition-none ${
                  e.active
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[#ffd7e8]"
                    : "border-white/10 bg-black/30 text-[#8b94a3] hover:border-white/25 hover:text-[#e8ecf1]"
                }`}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>

        {/* (e) found-mode segmented */}
        <div className="mt-3 shrink-0">
          <div
            role="radiogroup"
            aria-label="Found filter"
            className="grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-black/40 p-1"
          >
            {FOUND_OPTIONS.map((o) => {
              const checked = foundMode === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => onFoundMode(o.id)}
                  className={`rounded-lg px-2 py-2 text-xs font-semibold transition-colors motion-reduce:transition-none ${
                    checked
                      ? "bg-[var(--accent)] text-white shadow-[0_0_12px_rgba(255,80,197,0.45)]"
                      : "text-[#8b94a3] hover:text-[#e8ecf1]"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* (f) filter status + reset */}
        <div className="mt-3 flex shrink-0 items-center justify-between gap-2">
          <p className="text-[11px] text-[#8b94a3]" aria-live="polite">
            {activeFilterCount === 0
              ? "No filters active"
              : `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} active`}
          </p>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={onResetAll}
              className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#e8ecf1] transition-colors hover:border-[var(--accent-line)] motion-reduce:transition-none"
            >
              Reset all
            </button>
          ) : null}
        </div>

        {/* (g) virtualized rows */}
        {pins.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
            <span aria-hidden="true" className="text-[#5b6474]">
              <IconMagnifier />
            </span>
            <p className="max-w-[220px] text-sm text-[#8b94a3]">
              No markers match these filters.
            </p>
            <button
              type="button"
              onClick={onResetAll}
              className="rounded-xl border border-[var(--accent-line)] bg-[var(--accent-soft)] px-4 py-2 text-xs font-semibold text-[#ffd7e8] transition-colors hover:bg-[var(--accent)] hover:text-white motion-reduce:transition-none"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <div
            ref={listRef}
            role="list"
            aria-label="Markers"
            onScroll={() => setScrollTop(listRef.current?.scrollTop ?? 0)}
            className="relative mt-2 min-h-[160px] flex-1 overflow-y-auto rounded-xl border border-white/10 bg-black/30"
          >
            <div style={{ height: totalH }} className="relative">
              {visible.map((pin, i) => {
                const idx = start + i;
                const meta = EVIDENCE_META[pin.evidence.status];
                const isSelected = selectedId === pin.id;
                return (
                  <div
                    key={pin.id}
                    role="listitem"
                    aria-current={isSelected ? true : undefined}
                    className="absolute inset-x-0"
                    style={{ top: idx * ROW_H, height: ROW_H }}
                  >
                    <div
                      className={`flex h-full items-center gap-2 border-b border-white/5 px-2.5 transition-colors motion-reduce:transition-none ${
                        isSelected
                          ? "bg-[var(--accent-soft)]"
                          : "hover:bg-white/5"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="w-7 shrink-0 text-center text-base"
                      >
                        {catIcon.get(pin.categorySlug) ?? "•"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold leading-tight text-[#e8ecf1]">
                          {pin.name}
                        </p>
                        <p className="truncate font-mono text-[10.5px] leading-tight text-[#8b94a3]">
                          {honestCoordString(pin.lat, pin.lng)}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.className}`}
                      >
                        {meta.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => onSelectPin(pin)}
                        aria-label={`Fly to ${pin.name}`}
                        title={`Fly to ${pin.name}`}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-[#8b94a3] transition-colors hover:border-[var(--accent)] hover:text-[#ffd7e8] motion-reduce:transition-none"
                      >
                        <IconPlane />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── (h) footer ── */}
      <div className="shrink-0 border-t border-white/10 px-4 py-3">
        <div className="[&>div]:max-w-none">
          <ProgressMeter found={foundCount} total={totalNamed} />
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={densityVisible}
          onClick={() => onToggleDensity(!densityVisible)}
          className="mt-2.5 flex min-h-[48px] w-full items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-left transition-colors hover:border-white/25 motion-reduce:transition-none"
        >
          <span>
            <span className="block text-[0.8125rem] font-semibold text-[#e8ecf1]">
              Community pins +{densityTotal}
            </span>
            <span className="mt-0.5 block text-[0.75rem] text-[#8b94a3]">
              positions approximate
            </span>
          </span>
          <span
            aria-hidden="true"
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors motion-reduce:transition-none ${
              densityVisible ? "bg-[var(--accent)]" : "bg-[#1a2230]"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all motion-reduce:transition-none ${
                densityVisible ? "left-[22px]" : "left-0.5"
              }`}
            />
          </span>
        </button>
      </div>
    </aside>
  );
}
