// ─── modules/discovery/reducer.ts ──────────────────────────────────────────
// R1 — SINGLE SOURCE OF TRUTH. Search query, filters, sort, and selection
// live in ONE reducer. The results list, dropdown, empty state, and every
// counter derive from the same state via selectors.ts. No parallel
// "selected" state, no second filter copy in the orchestrator.
//
// Pure TypeScript: no React, no DOM — fully unit-testable.

import type { EvidenceStatus } from "@/data/pins";
import { ALL_EVIDENCE_STATUSES } from "@/data/pins";

export type FoundMode = "all" | "found" | "not-found";
export type SortId = "name" | "evidence" | "updated" | "region";

export interface DiscoveryState {
  query: string;
  activeCats: string[];
  evidenceOn: EvidenceStatus[];
  activeTags: string[];
  foundMode: FoundMode;
  sort: SortId;
  selectedId: string | null;
}

export function initialDiscoveryState(allCats: string[]): DiscoveryState {
  return {
    query: "",
    activeCats: [...allCats],
    evidenceOn: [...ALL_EVIDENCE_STATUSES],
    activeTags: [],
    foundMode: "all",
    sort: "name",
    selectedId: null,
  };
}

export type DiscoveryAction =
  | { type: "SET_QUERY"; query: string }
  | { type: "TOGGLE_CATEGORY"; slug: string }
  | { type: "SET_ALL_CATEGORIES"; slugs: string[] }
  | { type: "SET_NO_CATEGORIES" }
  | { type: "TOGGLE_EVIDENCE"; status: EvidenceStatus }
  | { type: "SET_ALL_EVIDENCE" }
  | { type: "SET_NO_EVIDENCE" }
  | { type: "TOGGLE_TAG"; tag: string }
  | { type: "SET_FOUND_MODE"; mode: FoundMode }
  | { type: "SET_SORT"; sort: SortId }
  | { type: "SELECT_PIN"; id: string }
  | { type: "DESELECT_PIN" }
  /** R2 — atomic: one action resets query, filters, sort, AND selection. */
  | { type: "RESET_ALL"; allCats: string[] };

function toggleInList<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((i) => i !== item) : [...list, item];
}

export function discoveryReducer(
  state: DiscoveryState,
  action: DiscoveryAction
): DiscoveryState {
  switch (action.type) {
    case "SET_QUERY":
      return { ...state, query: action.query };
    case "TOGGLE_CATEGORY":
      return { ...state, activeCats: toggleInList(state.activeCats, action.slug) };
    case "SET_ALL_CATEGORIES":
      return { ...state, activeCats: [...action.slugs] };
    case "SET_NO_CATEGORIES":
      return { ...state, activeCats: [] };
    case "TOGGLE_EVIDENCE":
      return { ...state, evidenceOn: toggleInList(state.evidenceOn, action.status) };
    case "SET_ALL_EVIDENCE":
      return { ...state, evidenceOn: [...ALL_EVIDENCE_STATUSES] };
    case "SET_NO_EVIDENCE":
      return { ...state, evidenceOn: [] };
    case "TOGGLE_TAG":
      return { ...state, activeTags: toggleInList(state.activeTags, action.tag) };
    case "SET_FOUND_MODE":
      return { ...state, foundMode: action.mode };
    case "SET_SORT":
      return { ...state, sort: action.sort };
    case "SELECT_PIN":
      return { ...state, selectedId: action.id };
    case "DESELECT_PIN":
      return { ...state, selectedId: null };
    case "RESET_ALL":
      return { ...initialDiscoveryState(action.allCats) };
    default:
      return state;
  }
}
