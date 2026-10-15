// ─── modules/map/tools/display/HeatmapLayer.ts ────────────────────────
// Certainty-weighted heatmap over the entity pin source. Rendered UNDER the
// markers via the "heatmap" tool family (layerOrder), so pins stay
// clickable — the heatmap never covers markers.
//
// Weighting follows the 4-status evidence engine (spec §5.3's 3-tier table
// is outdated — the map migrated to four statuses):
//   rockstar-confirmed 1.0 · trailer-confirmed 0.8 · leak-reported 0.6 ·
//   disputed 0.3. Uniform weighting would let rumor pins masquerade as
//   confirmed density — misleading, so the weight is data-driven from the
//   feature's evidence property (clusters carry max_evidence rank 1..4).

import type { Map as MapLibreMap } from "maplibre-gl";
import { CLUSTER_SOURCE_ID } from "../../clusterSource";
import { addToolLayer, removeToolLayer } from "../shared/layerOrder";

export const HEATMAP_LAYER_ID = "gta6mapx-tool-heatmap";

/** Evidence rank (1..4, see data/pins EVIDENCE_RANK) → weight. */
const weightByRank = [
  "case",
  [">=", ["get", "max_evidence"], 4],
  1.0,
  [">=", ["get", "max_evidence"], 3],
  0.8,
  [">=", ["get", "max_evidence"], 2],
  0.6,
  0.3,
] as const;

/** Evidence status string → weight; missing status falls back to 0.6. */
const weightByStatus = [
  "case",
  ["==", ["get", "evidence"], "rockstar-confirmed"],
  1.0,
  ["==", ["get", "evidence"], "trailer-confirmed"],
  0.8,
  ["==", ["get", "evidence"], "leak-reported"],
  0.6,
  ["==", ["get", "evidence"], "disputed"],
  0.3,
  0.6,
] as const;

/**
 * Cluster features (zoomed out) expose max_evidence (rank 1..4);
 * unclustered pins expose evidence (status string). Both paths land on the
 * same 1.0 / 0.8 / 0.6 / 0.3 scale.
 */
const heatmapWeight = [
  "case",
  ["has", "max_evidence"],
  [...weightByRank],
  [...weightByStatus],
];

/**
 * Mount the heatmap. Returns false when the pin source isn't on the map
 * yet — the caller retries once the source lands.
 */
export function mountHeatmapLayer(map: MapLibreMap): boolean {
  if (!map.getSource(CLUSTER_SOURCE_ID)) return false;

  addToolLayer(map, "heatmap", {
    id: HEATMAP_LAYER_ID,
    type: "heatmap",
    source: CLUSTER_SOURCE_ID,
    paint: {
      // Data-driven certainty weight — see module header.
      "heatmap-weight": heatmapWeight as never,
      "heatmap-intensity": 1,
      "heatmap-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        0,
        18,
        9,
        30,
        14,
        36,
      ],
      "heatmap-opacity": 0.7,
      // Neon ramp: transparent → purple → pink → hot orange.
      "heatmap-color": [
        "interpolate",
        ["linear"],
        ["heatmap-density"],
        0,
        "rgba(0, 0, 0, 0)",
        0.2,
        "#A855F7",
        0.45,
        "#FF2E88",
        0.7,
        "#FF7A18",
        1,
        "#FFB300",
      ],
    },
  });
  return true;
}

export function unmountHeatmapLayer(map: MapLibreMap): void {
  removeToolLayer(map, "heatmap", HEATMAP_LAYER_ID);
}
