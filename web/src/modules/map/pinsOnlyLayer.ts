// ─── pinsOnlyLayer.ts ─────────────────────────────────────────────────────
// The UNNAMED community-pin density layer: a SEPARATE clustered source +
// slate count bubbles plus tiny-dot circles at high zoom. It never merges
// with the named-pin cluster source — mixing them would corrupt named
// counts. No interactivity by design (no click handlers, no popups, no
// cursor changes) — 1,581 anonymous dots with popups saying "unknown" add
// zero value and invite accidental mobile taps.
//
// Styling is deliberately neutral slate: unnamed pins carry NO evidence
// claim, so they never use the Leak Transparency Engine palette.

import type * as maplibregl from "maplibre-gl";

export const DENSITY_SOURCE_ID = "gta6mapx-density";
export const DENSITY_LAYER_ID = "gta6-density-dots";
export const DENSITY_CLUSTER_ID = "gta6-density-clusters";
export const DENSITY_CLUSTER_COUNT_ID = "gta6-density-cluster-count";

const DENSITY_CLUSTER_MAX_ZOOM = 14;

/**
 * Adds (or updates) the density source + layers. Zoom-gated dots at
 * minzoom 10 — below that the clusters carry the density story.
 * Visibility toggles via setLayoutProperty only: instant, no data rebuild.
 */
export function addDensityLayer(
  map: maplibregl.Map,
  geojson: object,
  visible: boolean
): void {
  const source = map.getSource(DENSITY_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  if (!source) {
    map.addSource(DENSITY_SOURCE_ID, {
      type: "geojson",
      data: geojson as GeoJSON.FeatureCollection,
      cluster: true,
      clusterRadius: 50,
      clusterMaxZoom: DENSITY_CLUSTER_MAX_ZOOM,
    });
  } else {
    source.setData(geojson as GeoJSON.FeatureCollection);
  }

  // 1. Cluster bubbles — slate fill, white stroke, white count. Neutral by
  //    design: these pins are unnamed and carry no evidence status.
  if (!map.getLayer(DENSITY_CLUSTER_ID)) {
    map.addLayer({
      id: DENSITY_CLUSTER_ID,
      type: "circle",
      source: DENSITY_SOURCE_ID,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "rgba(71,85,105,0.92)",
        "circle-radius": ["step", ["get", "point_count"], 18, 10, 26, 50, 34],
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "rgba(255,255,255,0.7)",
      },
    });
  }

  // 2. Cluster counts — plain numbers, no ± prefix: there is no evidence
  //    rank to mix on unnamed pins.
  if (!map.getLayer(DENSITY_CLUSTER_COUNT_ID)) {
    map.addLayer({
      id: DENSITY_CLUSTER_COUNT_ID,
      type: "symbol",
      source: DENSITY_SOURCE_ID,
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["to-string", ["get", "point_count_abbreviated"]],
        "text-size": 13,
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: {
        "text-color": "#ffffff",
      },
    });
  }

  // 3. Unclustered dots — 3px at z10 → 5px at z15. Deliberately slate, NOT
  //    any certainty color (no evidence claim). Approximate positions render
  //    quieter; honesty is carried by the toggle label ("positions approximate").
  if (!map.getLayer(DENSITY_LAYER_ID)) {
    map.addLayer({
      id: DENSITY_LAYER_ID,
      type: "circle",
      source: DENSITY_SOURCE_ID,
      minzoom: 10,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3, 15, 5],
        "circle-color": "#64748b",
        "circle-opacity": ["case", ["boolean", ["get", "approx"], false], 0.25, 0.45],
      },
    });
  }

  setDensityVisible(map, visible);
  // NOTE: no event handlers are attached to these layers — enforced by
  // construction. Hover tooltip stays OFF until user testing asks (§2.1).
}

export function setDensityVisible(map: maplibregl.Map, visible: boolean): void {
  for (const id of [DENSITY_LAYER_ID, DENSITY_CLUSTER_ID, DENSITY_CLUSTER_COUNT_ID]) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    }
  }
}
