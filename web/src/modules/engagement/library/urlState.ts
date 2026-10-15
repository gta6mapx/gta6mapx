// ─── modules/engagement/library/urlState.ts ─────────────────────────────────
// Intel Library: deep-link state <-> URLSearchParams (spec §2.5).
// Pure functions — no DOM, no Next.js. Safe to import from Node scripts.

import type { EvidenceStatus } from "../../entities/types";
import {
  EVIDENCE_ORDER,
  type DossierKind,
  type LibraryFacets,
} from "./library";
import { EMPTY_FACETS, type FacetFilter, type SortKey } from "./filtering";

export type KindFilter = DossierKind | "all";

export interface LibraryState {
  q: string;
  kind: KindFilter;
  evidence: EvidenceStatus[];
  facets: FacetFilter;
  sort: SortKey;
}

export function defaultLibraryState(): LibraryState {
  return {
    q: "",
    kind: "all",
    evidence: [...EVIDENCE_ORDER],
    facets: { ...EMPTY_FACETS },
    sort: "evidence",
  };
}

const KIND_PARAM_TO_FILTER: Record<string, KindFilter> = {
  all: "all",
  vehicles: "vehicle",
  locations: "location",
  weapons: "weapon",
  characters: "character",
};
const KIND_FILTER_TO_PARAM: Record<KindFilter, string> = {
  all: "all",
  vehicle: "vehicles",
  location: "locations",
  weapon: "weapons",
  character: "characters",
};
const SORT_VALUES: readonly string[] = ["evidence", "name-asc", "name-desc"];

function cleanFacet(
  value: string | null,
  allowed: readonly string[]
): string {
  if (!value) return "";
  const v = value.trim();
  return allowed.includes(v) ? v : "";
}

/**
 * Parse filter state from URL params. Invalid values are ignored
 * (never throw, never produce an invalid state).
 */
export function parseLibraryParams(
  params: URLSearchParams,
  facets: LibraryFacets
): LibraryState {
  const state = defaultLibraryState();

  const q = params.get("q");
  if (q) state.q = q.slice(0, 200);

  const kind = params.get("kind");
  if (kind && kind.trim() in KIND_PARAM_TO_FILTER)
    state.kind = KIND_PARAM_TO_FILTER[kind.trim()];

  const evidence = params.get("evidence");
  if (evidence !== null) {
    const raw = evidence.trim();
    if (raw === "") {
      // Explicit empty selection: all statuses off.
      state.evidence = [];
    } else {
      const valid = [
        ...new Set(
          raw
            .split(",")
            .map((s) => s.trim())
            .filter((s): s is EvidenceStatus =>
              (EVIDENCE_ORDER as readonly string[]).includes(s)
            )
        ),
      ];
      if (valid.length > 0) state.evidence = valid;
    }
  }

  state.facets = {
    region: cleanFacet(params.get("region"), facets.regions),
    manufacturer: cleanFacet(params.get("manufacturer"), facets.manufacturers),
    vclass: cleanFacet(params.get("vclass"), facets.vclasses),
    wclass: cleanFacet(params.get("wclass"), facets.wclasses),
    role: cleanFacet(params.get("role"), facets.roles),
  };

  const sort = params.get("sort");
  if (sort && SORT_VALUES.includes(sort)) state.sort = sort as SortKey;

  return state;
}

/** Serialize state to params, omitting anything at its default value. */
export function libraryStateToParams(state: LibraryState): URLSearchParams {
  const p = new URLSearchParams();
  const q = state.q.trim();
  if (q) p.set("q", q);
  if (state.kind !== "all") p.set("kind", KIND_FILTER_TO_PARAM[state.kind]);
  const ev = EVIDENCE_ORDER.filter((s) => state.evidence.includes(s));
  if (ev.length !== EVIDENCE_ORDER.length) p.set("evidence", ev.join(","));
  if (state.facets.region) p.set("region", state.facets.region);
  if (state.facets.manufacturer)
    p.set("manufacturer", state.facets.manufacturer);
  if (state.facets.vclass) p.set("vclass", state.facets.vclass);
  if (state.facets.wclass) p.set("wclass", state.facets.wclass);
  if (state.facets.role) p.set("role", state.facets.role);
  if (state.sort !== "evidence") p.set("sort", state.sort);
  return p;
}

/** Order-insensitive comparison of two query strings. */
export function searchParamsEqual(a: string, b: string): boolean {
  const ea = [...new URLSearchParams(a).entries()].sort();
  const eb = [...new URLSearchParams(b).entries()].sort();
  return (
    ea.length === eb.length &&
    ea.every(([k, v], i) => k === eb[i][0] && v === eb[i][1])
  );
}

/**
 * When the kind tab changes, drop facet values that belong to other kinds
 * so a hidden facet can never silently zero out the results.
 */
export function facetsForKind(
  facets: FacetFilter,
  kind: KindFilter
): FacetFilter {
  return {
    region: kind === "all" || kind === "location" ? facets.region : "",
    manufacturer:
      kind === "all" || kind === "vehicle" ? facets.manufacturer : "",
    vclass: kind === "all" || kind === "vehicle" ? facets.vclass : "",
    wclass: kind === "all" || kind === "weapon" ? facets.wclass : "",
    role: kind === "all" || kind === "character" ? facets.role : "",
  };
}

/** Non-default filter selections (drives the mobile "Filters (n)" badge). */
export function countActiveFilters(state: LibraryState): number {
  let n = 0;
  if (state.q.trim()) n += 1;
  if (state.evidence.length !== EVIDENCE_ORDER.length) n += 1;
  if (state.facets.region) n += 1;
  if (state.facets.manufacturer) n += 1;
  if (state.facets.vclass) n += 1;
  if (state.facets.wclass) n += 1;
  if (state.facets.role) n += 1;
  if (state.sort !== "evidence") n += 1;
  return n;
}
