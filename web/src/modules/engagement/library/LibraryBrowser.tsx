"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { EVIDENCE_META, type EvidenceStatus } from "../../entities/types";
import {
  buildDossierIndex,
  buildFacets,
  EVIDENCE_ORDER,
  KIND_ORDER,
  KIND_PLURAL,
  type DossierKind,
  type LibraryFacets,
} from "./library";
import {
  countByKind,
  filterDossiers,
  searchDossiers,
  sortHits,
  type FacetFilter,
  type SortKey,
} from "./filtering";
import {
  countActiveFilters,
  defaultLibraryState,
  facetsForKind,
  libraryStateToParams,
  searchParamsEqual,
  type KindFilter,
  type LibraryState,
} from "./urlState";
import DossierCard from "./DossierCard";
import styles from "./library.module.css";

/**
 * LibraryBrowser — the interactive Intel Library (§2 of the engagement spec).
 * Tabs + search + evidence/facet filters + sort, all deep-linkable via URL.
 * Server-renders the default view (SEO-friendly); URL params apply on mount.
 */

const TABS: { id: KindFilter; label: string }[] = [
  { id: "all", label: "All" },
  ...KIND_ORDER.map((k) => ({ id: k as KindFilter, label: KIND_PLURAL[k] })),
];

const FACET_FIELDS: {
  key: keyof FacetFilter;
  label: string;
  allLabel: string;
  optionKey: keyof LibraryFacets;
  kinds: KindFilter[];
}[] = [
  { key: "region", label: "Region", allLabel: "All regions", optionKey: "regions", kinds: ["all", "location"] },
  { key: "manufacturer", label: "Manufacturer", allLabel: "All manufacturers", optionKey: "manufacturers", kinds: ["all", "vehicle"] },
  { key: "vclass", label: "Vehicle class", allLabel: "All classes", optionKey: "vclasses", kinds: ["all", "vehicle"] },
  { key: "wclass", label: "Weapon class", allLabel: "All classes", optionKey: "wclasses", kinds: ["all", "weapon"] },
  { key: "role", label: "Role", allLabel: "All roles", optionKey: "roles", kinds: ["all", "character"] },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "evidence", label: "Evidence strength" },
  { value: "name-asc", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
];

const inputClass =
  "w-full rounded-lg border border-[#1f2632] bg-[#0a0e14] px-3 py-2.5 text-sm text-[#e8ecf1] placeholder:text-[#5b6472] focus:border-[#22d3ee]";
const labelClass =
  "mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-[#8b94a3]";

/* ── Filter panel (shared by desktop sidebar + mobile drawer) ── */
function FilterPanel({
  idPrefix,
  kind,
  evidence,
  facets,
  facetValues,
  onToggleEvidence,
  onSetFacet,
  onClearAll,
}: {
  idPrefix: string;
  kind: KindFilter;
  evidence: EvidenceStatus[];
  facets: FacetFilter;
  facetValues: LibraryFacets;
  onToggleEvidence: (s: EvidenceStatus) => void;
  onSetFacet: (key: keyof FacetFilter, value: string) => void;
  onClearAll: () => void;
}) {
  return (
    <div className="space-y-6">
      <fieldset>
        <legend className={labelClass}>Evidence status</legend>
        <div className="space-y-2">
          {EVIDENCE_ORDER.map((st) => (
            <label
              key={st}
              className="flex cursor-pointer items-center gap-2.5 text-sm"
            >
              <input
                type="checkbox"
                checked={evidence.includes(st)}
                onChange={() => onToggleEvidence(st)}
                className="h-4 w-4 shrink-0 accent-[#ff2d78]"
              />
              <span className={`badge ${EVIDENCE_META[st].className}`}>
                {EVIDENCE_META[st].label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {FACET_FIELDS.filter((f) => f.kinds.includes(kind)).map((f) => (
        <div key={f.key}>
          <label
            htmlFor={`${idPrefix}-facet-${f.key}`}
            className={labelClass}
          >
            {f.label}
          </label>
          <select
            id={`${idPrefix}-facet-${f.key}`}
            value={facets[f.key]}
            onChange={(e) => onSetFacet(f.key, e.target.value)}
            className={inputClass}
          >
            <option value="">{f.allLabel}</option>
            {facetValues[f.optionKey].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      ))}

      <button
        type="button"
        onClick={onClearAll}
        className="btn-ghost w-full"
      >
        Clear all filters
      </button>
    </div>
  );
}

/* ── Focus trap for the mobile filters drawer ── */
function useDrawerTrap(open: boolean, onClose: () => void) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const root = rootRef.current;
    const prev = document.activeElement as HTMLElement | null;
    const items = () =>
      root
        ? Array.from(
            root.querySelectorAll<HTMLElement>(
              'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
            )
          )
        : [];
    items()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const list = items();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [open, onClose]);
  return rootRef;
}

/* ── Main browser ── */
export default function LibraryBrowser({
  initialState,
}: {
  /** Filter state resolved from the URL by the server (deep links). */
  initialState: LibraryState;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const facets = useMemo<LibraryFacets>(() => buildFacets(), []);
  const dossiers = useMemo(() => buildDossierIndex(), []);

  const [state, setState] = useState<LibraryState>(initialState);
  const [query, setQuery] = useState(initialState.q);

  // Adopt a new server-provided state on client-side navigation to a
  // different /library URL (render-time adjustment — the recommended
  // derived-state pattern, not an effect).
  const initialKey = libraryStateToParams(initialState).toString();
  const [adoptedKey, setAdoptedKey] = useState(initialKey);
  if (initialKey !== adoptedKey) {
    setAdoptedKey(initialKey);
    setState(initialState);
    setQuery(initialState.q);
  }

  // Debounce the search input (~150ms) before it drives filtering.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setState((s) => (s.q === query ? s : { ...s, q: query }));
    }, 150);
    return () => window.clearTimeout(t);
  }, [query]);

  // Sync state to the URL via replace (no history spam). Skipped when the
  // URL already carries an equivalent query (e.g. right after a deep link).
  useEffect(() => {
    const qs = libraryStateToParams(state).toString();
    if (typeof window !== "undefined") {
      const current = window.location.search.replace(/^\?/, "");
      if (searchParamsEqual(qs, current)) return;
    }
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [state, pathname, router]);

  const hits = useMemo(
    () => searchDossiers(dossiers, state.q),
    [dossiers, state.q]
  );
  const kindAgnostic = useMemo(
    () =>
      filterDossiers(
        hits,
        { evidence: state.evidence, facets: state.facets },
        "all"
      ),
    [hits, state.evidence, state.facets]
  );
  const tabCounts = useMemo(() => countByKind(kindAgnostic), [kindAgnostic]);
  const results = useMemo(
    () =>
      sortHits(
        filterDossiers(
          hits,
          { evidence: state.evidence, facets: state.facets },
          state.kind
        ),
        state.sort
      ),
    [hits, state.evidence, state.facets, state.kind, state.sort]
  );

  const activeFilterCount = countActiveFilters(state);
  const showMatch = state.q.trim().length > 0;

  const selectKind = useCallback(
    (kind: KindFilter) =>
      setState((s) => ({ ...s, kind, facets: facetsForKind(s.facets, kind) })),
    []
  );
  const toggleEvidence = useCallback(
    (st: EvidenceStatus) =>
      setState((s) => ({
        ...s,
        evidence: s.evidence.includes(st)
          ? s.evidence.filter((e) => e !== st)
          : [...s.evidence, st],
      })),
    []
  );
  const setFacet = useCallback(
    (key: keyof FacetFilter, value: string) =>
      setState((s) => ({ ...s, facets: { ...s.facets, [key]: value } })),
    []
  );
  const setSort = useCallback(
    (sort: SortKey) => setState((s) => ({ ...s, sort })),
    []
  );
  const clearAll = useCallback(() => {
    setQuery("");
    setState(defaultLibraryState());
  }, []);

  /* Tabs: roving tabindex + arrow-key navigation */
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const onTabKeyDown = (e: ReactKeyboardEvent, index: number) => {
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    if (next !== null) {
      e.preventDefault();
      selectKind(TABS[next].id);
      tabRefs.current[next]?.focus();
    }
  };

  /* Mobile filters drawer */
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), [setDrawerOpen]);
  const drawerRef = useDrawerTrap(drawerOpen, closeDrawer);

  const panelProps = {
    kind: state.kind,
    evidence: state.evidence,
    facets: state.facets,
    facetValues: facets,
    onToggleEvidence: toggleEvidence,
    onSetFacet: setFacet,
    onClearAll: clearAll,
  };

  return (
    <div>
      {/* Header block */}
      <header className="mx-auto w-full max-w-7xl px-4 pt-10 pb-2 sm:pt-14">
        <p className="font-display mb-3 text-xs tracking-[0.34em] text-cyan-200/80">
          INTEL ARCHIVE
        </p>
        <h1 className="font-display text-4xl tracking-wide sm:text-5xl">
          Intel <span className="vice-neon-title">Library</span>
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[#8b94a3]">
          Every entry is labeled by how we know it. We show no leaked
          footage, no trailer rips — just verified, honest intel.
        </p>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4">
        {/* Category tabs */}
        <div
          role="tablist"
          aria-label="Dossier categories"
          className="mt-6 flex flex-wrap gap-1 border-b border-[#1f2632]"
        >
          {TABS.map((t, i) => {
            const active = state.kind === t.id;
            const count =
              t.id === "all"
                ? kindAgnostic.length
                : tabCounts[t.id as DossierKind];
            return (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`library-tab-${t.id}`}
                aria-selected={active}
                aria-controls="library-grid"
                tabIndex={active ? 0 : -1}
                onClick={() => selectKind(t.id)}
                onKeyDown={(e) => onTabKeyDown(e, i)}
                className={`relative px-3 py-2.5 text-sm font-semibold transition-colors ${
                  active
                    ? "text-white"
                    : "text-[#8b94a3] hover:text-white"
                }`}
              >
                {t.label}
                <span className="ml-1.5 rounded-full bg-white/5 px-2 py-0.5 text-xs font-normal">
                  {count}
                </span>
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-2 -bottom-px h-0.5 bg-[#ff2d78] shadow-[0_0_8px_#ff2d78]"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Search + sort toolbar */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="library-search" className={labelClass}>
              Search dossiers
            </label>
            <input
              id="library-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search names and tags…"
              autoComplete="off"
              className={inputClass}
            />
          </div>
          <div className="sm:w-56">
            <label htmlFor="library-sort" className={labelClass}>
              Sort by
            </label>
            <select
              id="library-sort"
              value={state.sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className={inputClass}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p
          aria-live="polite"
          aria-atomic="true"
          className="mt-3 font-mono text-xs tracking-wide text-[#8b94a3]"
        >
          {results.length} of {dossiers.length} dossiers
        </p>

        {/* Filters + grid */}
        <div className="mt-4 lg:grid lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-8">
          <aside aria-label="Library filters" className="hidden lg:block">
            <div className="sticky top-4 rounded-2xl border border-[#1f2632] bg-[#11161f] p-5">
              <FilterPanel idPrefix="d" {...panelProps} />
            </div>
          </aside>

          <section aria-label="Dossier results">
            {results.length === 0 ? (
              <div className={styles.empty}>
                <p className="max-w-sm text-[15px] leading-relaxed">
                  No dossiers match. Check spelling, or clear filters.
                </p>
                <button
                  type="button"
                  onClick={clearAll}
                  className="btn-neon"
                >
                  Clear all
                </button>
              </div>
            ) : (
              <div
                id="library-grid"
                role="tabpanel"
                aria-labelledby={`library-tab-${state.kind}`}
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              >
                {results.map((hit) => (
                  <DossierCard
                    key={`${hit.dossier.kind}-${hit.dossier.slug}`}
                    hit={hit}
                    showMatch={showMatch}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Footer honesty line */}
      <footer className="mx-auto w-full max-w-7xl px-4 pt-10 pb-16">
        <p className="border-t border-[#1f2632] pt-6 text-center text-sm text-[#8b94a3]">
          Leak-reported and disputed entries are included for transparency —
          never as fact.
        </p>
      </footer>

      {/* Mobile: floating Filters toggle + drawer */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-expanded={drawerOpen}
        aria-controls="library-filters-drawer"
        className="btn-neon fab-mobile-lg fixed right-5 bottom-5 z-40 lg:hidden"
      >
        Filters
        {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
      </button>
      {drawerOpen && (
        <div
          ref={drawerRef}
          id="library-filters-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Library filters"
          className="fixed inset-0 z-50 lg:hidden"
        >
          <div
            aria-hidden="true"
            onClick={closeDrawer}
            className="absolute inset-0 bg-black/70"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-[#1f2632] bg-[#11161f] p-5 pb-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg tracking-wide">Filters</h2>
              <button
                type="button"
                onClick={closeDrawer}
                className="btn-ghost"
              >
                Close
              </button>
            </div>
            <FilterPanel idPrefix="m" {...panelProps} />
          </div>
        </div>
      )}
    </div>
  );
}
