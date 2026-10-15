// ─── pinAdapter.ts ─────────────────────────────────────────────────────────
// Single place where the Pin data model meets the map: converts Pin records
// into lean GeoJSON features for the clustered source. Features carry ONLY
// map-essential properties (no description/sourceUrl text) to keep the
// GeoJSON small and the cluster index fast.

import type { Pin, EvidenceStatus } from "@/data/pins";
import { evidenceRank } from "@/data/pins";

export interface PinFeatureProps {
  id: string;
  slug: string;
  name: string;
  categorySlug: string;
  /** Leak Transparency Engine status — exactly one of the four. */
  evidence: EvidenceStatus;
  /** Trust-critical rank: higher = stronger evidence. */
  evidence_rank: 1 | 2 | 3 | 4;
  approx: boolean;
  is_selected: boolean;
  is_found: boolean;
}

export function pinToFeature(
  pin: Pin,
  opts?: { selectedId?: string | null; foundIds?: Set<string> }
): GeoJSON.Feature<GeoJSON.Point, PinFeatureProps> {
  return {
    type: "Feature",
    // Top-level id (string) enables map.setFeatureState({ source, id }, …)
    // on the unclustered pin layer without a promoteId config.
    id: pin.id,
    geometry: {
      type: "Point",
      coordinates: [pin.lng, pin.lat],
    },
    properties: {
      id: pin.id,
      slug: pin.slug,
      name: pin.name,
      categorySlug: pin.categorySlug,
      evidence: pin.evidence.status,
      evidence_rank: evidenceRank(pin.evidence.status),
      // Approximate-grade coordinates (e.g. LOOCV RMSE ~5.4 km records) get
      // the distinct ≈ treatment in markerLayer. Staging sets
      // needCoordVerification on far-region records.
      approx: (pin as { needCoordVerification?: boolean }).needCoordVerification ?? false,
      is_selected: opts?.selectedId === pin.id,
      is_found: opts?.foundIds?.has(pin.id) ?? false,
    },
  };
}
