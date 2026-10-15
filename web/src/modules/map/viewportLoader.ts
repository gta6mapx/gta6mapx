// ─── viewportLoader.ts ────────────────────────────────────────────────────
// Progressive-loading contract. v1 = pass-through single fetches with
// priority ordering (named pins first, density lazily after idle) — at
// ~3k points viewport data paging is pure overhead (stale edge clusters,
// double-counting) for no measurable gain.
//
// PAGING CONTRACT (activates behind VIEWPORT_PAGING_ENABLED at 10k+ points):
//   1. loadPage(bounds, bufferPx) fetches a viewport page: features whose
//      geometry intersects bounds expanded by bufferPx (buffer keeps edge
//      clusters stable during small pans).
//   2. The orchestrator merges pages into one FeatureCollection and calls
//      source.setData(merged) — exactly one setData per committed viewport.
//   3. Pages are keyed by quantized bounds (tile-key, e.g. z/x/y at z12) so
//      cache hits avoid refetch on small pans; stale pages are evicted LRU.
//   4. Counters (§4.4) always report the FULL dataset totals, never the
//      loaded-page subset — "shown" means passing filters, not loaded pages.
// loadPage throws until the flag flips; the contract above is the spec.

import { ALL_EVIDENCE_STATUSES, type EvidenceStatus, type Pin } from "@/data/pins";

/** v1: pass-through. Flip to true (with the paging contract above) at 10k+ points. */
export const VIEWPORT_PAGING_ENABLED = false;

/**
 * Fetches the named-pin static artifact (highest priority — fetched first
 * after map load) and rebuilds Pin records. The artifact carries only
 * map-essential fields per pinAdapter's lean contract; description and
 * sourceUrl are not in the payload — full records live in the entities
 * module and are resolved by slug on selection.
 */
export async function loadNamedPins(): Promise<Pin[]> {
  const res = await fetch("/data/pins.geojson");
  if (!res.ok) {
    throw new Error(`[map] failed to load named pins: HTTP ${res.status}`);
  }
  const collection = (await res.json()) as GeoJSON.FeatureCollection<
    GeoJSON.Point,
    Record<string, unknown>
  >;
  return (collection.features ?? []).map((feature) => {
    const p = feature.properties ?? {};
    const coords = feature.geometry?.coordinates ?? [0, 0];
    const id = String(feature.id ?? p.id ?? "");
    const rawStatus = String(p.evidence ?? "disputed");
    const status: EvidenceStatus = (ALL_EVIDENCE_STATUSES as string[]).includes(rawStatus)
      ? (rawStatus as EvidenceStatus)
      : "disputed"; // unknown status → safest bucket, never a crash
    const tags = Array.isArray(p.tags)
      ? (p.tags as unknown[]).map(String).filter((t) => t.length > 0)
      : [];
    return {
      id,
      categorySlug: String(p.categorySlug ?? ""),
      name: String(p.name ?? id),
      slug: String(p.slug ?? id),
      lat: Number(coords[1]),
      lng: Number(coords[0]),
      evidence: {
        status,
        detail: String(p.evidence_detail ?? "Status migrated from pre-launch data"),
        ...(typeof p.sourceUrl === "string" && p.sourceUrl ? { sourceUrl: p.sourceUrl } : {}),
      },
      region: String(p.region ?? "Vice City"),
      tags,
      updatedAt: String(p.updatedAt ?? "2026-09-24"),
      description: "",
      // pinToFeature serializes needCoordVerification → properties.approx;
      // restore it so the ≈ badge survives the lean artifact round-trip.
      ...(p.approx === true ? { needCoordVerification: true as const } : {}),
    } satisfies Pin;
  });
}

/**
 * Fetches the unnamed density artifact. Lower priority — the caller fetches
 * this after map idle so named content is interactive first.
 */
export async function loadDensityGeoJSON(): Promise<object> {
  const res = await fetch("/data/pins-only.geojson");
  if (!res.ok) {
    throw new Error(`[map] failed to load density pins: HTTP ${res.status}`);
  }
  return (await res.json()) as object;
}

/** Paging stub — throws until VIEWPORT_PAGING_ENABLED (10k+ points). */
export async function loadPage(
  _bounds: { west: number; south: number; east: number; north: number },
  _bufferPx = 128
): Promise<never> {
  void _bounds;
  void _bufferPx;
  throw new Error(
    "[map] viewport paging disabled until 10k points (see viewportLoader.ts paging contract)"
  );
}
