// ─── clusterSource.ts ─────────────────────────────────────────────────────
// Owns the clustered GeoJSON source for NAMED pins: source config, cluster
// parameters, and the clusterProperties aggregations that keep evidence
// (the #1 trust requirement) visible through clustering. The ONLY module
// that touches this source's data — filters/selection rebuild via
// buildEntityGeoJSON + source.setData().

import type * as maplibregl from "maplibre-gl";
import { CATEGORIES, type Pin } from "@/data/pins";
import { pinToFeature, type PinFeatureProps } from "./pinAdapter";

export const CLUSTER_SOURCE_ID = "gta6mapx-entities";
export const CLUSTER_MAX_ZOOM = 14;

type Expr = [unknown, unknown];

/** Per-category cluster counts — powers the "By category" cluster color mode. */
function categoryClusterProps(): Record<string, Expr> {
  const out: Record<string, Expr> = {};
  for (const c of CATEGORIES) {
    out[`cat_${c.slug.replace(/-/g, "_")}`] = [
      "+",
      ["case", ["==", ["get", "categorySlug"], c.slug], 1, 0],
    ] as unknown as Expr;
  }
  return out;
}

// Cluster parameters per spec §1.2: 50px radius balances tap targets with
// decluttering; below z14 pins uncluster into individual markers.
export function clusterSourceSpec(): maplibregl.GeoJSONSourceSpecification {
  return {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
    cluster: true,
    clusterRadius: 50,
    clusterMaxZoom: CLUSTER_MAX_ZOOM,
    clusterProperties: {
      // Evidence-aware aggregation: the cluster's stroke ring is colored by
      // the HIGHEST evidence rank inside it, so a disputed-only cluster can
      // never render a confirmed ring. min_evidence powers the mixed "±"
      // treatment in the count label.
      max_evidence: ["max", ["get", "evidence_rank"]] as Expr,
      min_evidence: ["min", ["get", "evidence_rank"]] as Expr,
      // Found aggregation: a cluster where found_count == point_count
      // renders dimmed ("all found here"). is_found is a boolean leaf prop;
      // to-number coerces true→1, false→0.
      found_count: ["+", ["to-number", ["get", "is_found"]]] as Expr,
      ...categoryClusterProps(),
    },
  };
}

export function buildEntityGeoJSON(
  pins: Pin[],
  opts: { selectedId?: string | null; foundIds: Set<string> }
): GeoJSON.FeatureCollection<GeoJSON.Point, PinFeatureProps> {
  return {
    type: "FeatureCollection",
    features: pins.map((pin) => pinToFeature(pin, opts)),
  };
}
