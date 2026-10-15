// ─── searchIndex.ts ─────────────────────────────────────────────────────
// Full-dataset named-pin search index. Pins-only (unnamed) records are
// excluded by construction — they never enter the index. At ~3k entries a
// normalized-substring + prefix-ranked index is sufficient (no dependency,
// <50ms build).
//
// Search scope (spec §3.2): name, tags, category name, region —
// case-insensitive AND diacritic-insensitive. Filtering is SYNCHRONOUS
// (anti-bug R4: no async, no stale completions for ≤5k markers).

import { CATEGORIES, evidenceRank, type Pin } from "@/data/pins";

export interface BuiltIndex {
  pins: Pin[];
}

export function buildSearchIndex(pins: Pin[]): BuiltIndex {
  return { pins };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Lowercase, trim, strip diacritics — "café" matches "cafe". */
export function normalizeQuery(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function categoryName(slug: string): string {
  return CATEGORIES.find((c) => c.slug === slug)?.name ?? "";
}

/** All searchable text for a pin, normalized. */
function haystack(pin: Pin): string {
  return normalizeQuery(
    [pin.name, categoryName(pin.categorySlug), pin.region, ...pin.tags].join(" ")
  );
}

/**
 * Ranked search: exact prefix > word-boundary > substring, scored on the
 * pin name first, then on the full haystack. Ties broken by evidence rank
 * (strongest evidence first — trust-positive) then name length.
 * Capped at 8 results. Empty query → [].
 */
export function searchPins(idx: BuiltIndex, q: string): Pin[] {
  const needle = normalizeQuery(q);
  if (!needle) return [];

  const wordBoundary = new RegExp(`(^|[^a-z0-9])${escapeRegExp(needle)}`);

  const scored: { pin: Pin; score: number }[] = [];
  for (const pin of idx.pins) {
    const name = normalizeQuery(pin.name);
    let score: number;
    if (name.startsWith(needle)) {
      score = 0; // exact prefix on name
    } else if (wordBoundary.test(name)) {
      score = 1; // word-boundary on name
    } else if (name.includes(needle)) {
      score = 2; // substring on name
    } else if (haystack(pin).includes(needle)) {
      score = 3; // tags / category / region match
    } else {
      continue;
    }
    scored.push({ pin, score });
  }

  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    const rankDiff =
      evidenceRank(b.pin.evidence.status) - evidenceRank(a.pin.evidence.status);
    if (rankDiff !== 0) return rankDiff;
    return a.pin.name.length - b.pin.name.length;
  });

  return scored.slice(0, 8).map((s) => s.pin);
}
