// ─── modules/engagement/library/filtering.ts ───────────────────────────────
// Intel Library: search, filter, sort over dossier hits.
// Pure functions — no DOM, no Next.js. Safe to import from Node scripts.

import { EVIDENCE_ORDER, type Dossier, type DossierKind } from "./library";
import type { EvidenceStatus } from "../../entities/types";

/** Lowercase + strip diacritics so "ubermacht" matches "Übermacht". */
export function normalizeText(s: string): string {
  let out = "";
  for (const ch of s.normalize("NFD")) {
    const cp = ch.codePointAt(0) ?? 0;
    // Combining Diacritical Marks block U+0300-U+036F
    if (cp < 0x300 || cp > 0x36f) out += ch;
  }
  return out.toLowerCase();
}

export interface SearchHit {
  dossier: Dossier;
  matchedName: boolean;
  matchedTags: string[];
}

/**
 * Substring search over name + tags, case- and diacritic-insensitive.
 * Empty query returns everything with no matches flagged.
 */
export function searchDossiers(
  dossiers: Dossier[],
  query: string
): SearchHit[] {
  const q = normalizeText(query.trim());
  if (!q) {
    return dossiers.map((dossier) => ({
      dossier,
      matchedName: false,
      matchedTags: [],
    }));
  }
  const hits: SearchHit[] = [];
  for (const dossier of dossiers) {
    const matchedName = normalizeText(dossier.name).includes(q);
    const matchedTags = dossier.tags.filter((t) =>
      normalizeText(t).includes(q)
    );
    if (matchedName || matchedTags.length > 0) {
      hits.push({ dossier, matchedName, matchedTags });
    }
  }
  return hits;
}

export interface FacetFilter {
  region: string;
  manufacturer: string;
  vclass: string;
  wclass: string;
  role: string;
}

export interface DossierFilter {
  evidence: EvidenceStatus[];
  facets: FacetFilter;
}

export const EMPTY_FACETS: FacetFilter = {
  region: "",
  manufacturer: "",
  vclass: "",
  wclass: "",
  role: "",
};

/**
 * Apply evidence-status + facet + kind filters.
 * Facets are conjunctive: a facet value only matches dossiers carrying it,
 * so e.g. region="Vice City" excludes vehicles (they have no region).
 */
export function filterDossiers(
  hits: SearchHit[],
  filter: DossierFilter,
  kind: DossierKind | "all"
): SearchHit[] {
  const f = filter.facets;
  return hits.filter((h) => {
    const d = h.dossier;
    if (kind !== "all" && d.kind !== kind) return false;
    if (!filter.evidence.includes(d.evidence.status)) return false;
    if (f.region && d.facets.region !== f.region) return false;
    if (f.manufacturer && d.facets.manufacturer !== f.manufacturer)
      return false;
    if (f.vclass && d.facets.vclass !== f.vclass) return false;
    if (f.wclass && d.facets.wclass !== f.wclass) return false;
    if (f.role && d.facets.role !== f.role) return false;
    return true;
  });
}

export type SortKey = "evidence" | "name-asc" | "name-desc";

function compareNames(a: SearchHit, b: SearchHit): number {
  const an = normalizeText(a.dossier.name);
  const bn = normalizeText(b.dossier.name);
  return an < bn ? -1 : an > bn ? 1 : 0;
}

/** Default sort is evidence strength (spec §2.3); name asc breaks ties. */
export function sortHits(hits: SearchHit[], sort: SortKey): SearchHit[] {
  const arr = [...hits];
  if (sort === "name-asc") {
    arr.sort(compareNames);
  } else if (sort === "name-desc") {
    arr.sort((a, b) => compareNames(b, a));
  } else {
    arr.sort(
      (a, b) =>
        EVIDENCE_ORDER.indexOf(a.dossier.evidence.status) -
          EVIDENCE_ORDER.indexOf(b.dossier.evidence.status) ||
        compareNames(a, b)
    );
  }
  return arr;
}

/** Per-kind counts of a hit list (kind filter ignored) — drives tab badges. */
export function countByKind(
  hits: SearchHit[]
): Record<DossierKind, number> {
  const counts: Record<DossierKind, number> = {
    vehicle: 0,
    location: 0,
    weapon: 0,
    character: 0,
  };
  for (const h of hits) counts[h.dossier.kind] += 1;
  return counts;
}
