// ─── modules/discovery/selectors.ts ────────────────────────────────────────
// Pure derivations from DiscoveryState. Every UI surface (results list,
// dropdown, empty state, counters, tabs) reads through these — R1.
//
// Filter semantics (stated in the panel footnote): OR within a dimension
// (any selected category / evidence status / tag), AND across dimensions
// (category ∧ evidence ∧ tags ∧ found-state ∧ search).

import {
  CATEGORIES,
  evidenceRank,
  type EvidenceStatus,
  type Pin,
} from "@/data/pins";
import { buildSearchIndex, searchPins } from "@/modules/map/searchIndex";
import { EVIDENCE_META } from "@/modules/entities/types";
import { discoveryStrings } from "./strings";
import type { DiscoveryState, FoundMode, SortId } from "./reducer";

/** Pins passing every filter dimension EXCEPT the search query. */
export function selectBasePins(
  pins: Pin[],
  state: DiscoveryState,
  foundIds: Set<string>
): Pin[] {
  const cats = new Set(state.activeCats);
  const ev = new Set<EvidenceStatus>(state.evidenceOn);
  const tags = new Set(state.activeTags);
  return pins.filter((p) => {
    if (!cats.has(p.categorySlug)) return false;
    if (!ev.has(p.evidence.status)) return false;
    if (tags.size > 0 && !p.tags.some((t) => tags.has(t))) return false;
    if (state.foundMode === "found" && !foundIds.has(p.id)) return false;
    if (state.foundMode === "not-found" && foundIds.has(p.id)) return false;
    return true;
  });
}

/** Search runs over the FILTERED set — never over a hidden parallel array. */
export function selectSearchResults(basePins: Pin[], query: string): Pin[] {
  if (query.trim() === "") return [];
  return searchPins(buildSearchIndex(basePins), query);
}

const sortFns: Record<SortId, (a: Pin, b: Pin) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  evidence: (a, b) =>
    evidenceRank(b.evidence.status) - evidenceRank(a.evidence.status) ||
    a.name.localeCompare(b.name),
  updated: (a, b) =>
    b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name),
  region: (a, b) =>
    a.region.localeCompare(b.region) || a.name.localeCompare(b.name),
};

export function selectSortedPins(pins: Pin[], sort: SortId): Pin[] {
  return [...pins].sort(sortFns[sort]);
}

export interface FacetedCount {
  slug: string;
  name: string;
  icon: string;
  count: number;
}

/**
 * R3 — faceted counts. A tab's number counts pins matching ALL other
 * filter dimensions (search ignored — tabs navigate, the search box
 * navigates). Answers "how many would I get if I tapped this?"
 */
export function selectFacetedCounts(
  pins: Pin[],
  state: DiscoveryState,
  foundIds: Set<string>
): FacetedCount[] {
  const ev = new Set<EvidenceStatus>(state.evidenceOn);
  const tags = new Set(state.activeTags);
  const passesOther = (p: Pin): boolean => {
    if (!ev.has(p.evidence.status)) return false;
    if (tags.size > 0 && !p.tags.some((t) => tags.has(t))) return false;
    if (state.foundMode === "found" && !foundIds.has(p.id)) return false;
    if (state.foundMode === "not-found" && foundIds.has(p.id)) return false;
    return true;
  };
  return CATEGORIES.map((c) => ({
    slug: c.slug,
    name: c.name,
    icon: c.icon,
    count: pins.filter((p) => p.categorySlug === c.slug && passesOther(p)).length,
  }));
}

export interface TagCount {
  tag: string;
  count: number;
}

/** Tags present in the current filtered set, most frequent first (cap 20). */
export function selectVisibleTags(basePins: Pin[], cap = 20): TagCount[] {
  const freq = new Map<string, number>();
  for (const p of basePins) {
    for (const t of p.tags) freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  return [...freq.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, cap);
}

/** R3 — every counter is labeled and unambiguous. */
export function selectSummary(total: number, shown: number): string {
  return discoveryStrings.resultsCount(shown, total);
}

/** Human-readable names of the active filter dimensions (R5 empty states). */
export function describeActiveFilters(
  state: DiscoveryState,
  allCats: string[]
): string[] {
  const parts: string[] = [];
  if (state.activeCats.length !== allCats.length) {
    const names = state.activeCats
      .map((s) => CATEGORIES.find((c) => c.slug === s)?.name ?? s)
      .join(", ");
    parts.push(names ? `categories (${names})` : "no categories selected");
  }
  if (state.evidenceOn.length !== 4) {
    parts.push(
      state.evidenceOn.length === 0
        ? "no evidence types selected"
        : `evidence (${state.evidenceOn.map((s) => EVIDENCE_META[s].label).join(", ")})`
    );
  }
  if (state.activeTags.length > 0) parts.push(`tags (${state.activeTags.join(", ")})`);
  if (state.foundMode !== "all")
    parts.push(state.foundMode === "found" ? "found only" : "not-found only");
  return parts;
}

export function hasActiveFilters(
  state: DiscoveryState,
  allCats: string[]
): boolean {
  return (
    state.query.trim() !== "" ||
    describeActiveFilters(state, allCats).length > 0 ||
    state.selectedId !== null
  );
}

/** R7 — deep-link lookup accepts a pin id OR slug; unknown → undefined. */
export function findPin(
  pins: Pin[],
  idOrSlug: string | null | undefined
): Pin | undefined {
  if (!idOrSlug) return undefined;
  const needle = idOrSlug.trim();
  if (!needle) return undefined;
  return pins.find((p) => p.id === needle || p.slug === needle);
}

/** R5 — honest empty state: names the query and the active filters. */
export function emptyStateMessage(
  state: DiscoveryState,
  allCats: string[]
): string {
  const filters = describeActiveFilters(state, allCats);
  const filterText = filters.length > 0 ? filters.join("; ") : "";
  const q = state.query.trim();
  if (q && filterText) return discoveryStrings.noResultsWithFilters(q, filterText);
  if (q) return discoveryStrings.noResults(q);
  if (filterText) return discoveryStrings.noResultsNoQuery(filterText);
  return "No locations to show.";
}

export type { FoundMode, SortId };
