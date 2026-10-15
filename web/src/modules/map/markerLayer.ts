// ─── markerLayer.ts ────────────────────────────────────────────────────────
// Canvas (WebGL) rendering for the clustered named-pin source — zero DOM
// nodes. Three layers: cluster circles, cluster counts, unclustered pins,
// plus a symbol layer for the ≈ approximate-coordinate badge. All evidence
// styling uses the design-token palette so pins and cluster rings share one
// legend. No data logic here — paint expressions only.

import type * as maplibregl from "maplibre-gl";
import { CATEGORIES } from "@/data/pins";
import { CLUSTER_SOURCE_ID } from "./clusterSource";

export const LAYER_CLUSTERS = "gta6-clusters";
export const LAYER_CLUSTER_COUNT = "gta6-cluster-count";
export const LAYER_PINS = "gta6-pins";
export const LAYER_PINS_APPROX = "gta6-pins-approx";

/** Cluster coloring mode — "evidence" is the default (trust-first). */
export type ClusterColorMode = "evidence" | "category";

// Design tokens — Leak Transparency Engine palette (shared with the legend
// and EvidenceBadge). Green/sky/amber/red are RESERVED for these four
// statuses and never used as brand chrome.
export const EVIDENCE_COLORS = {
  "rockstar-confirmed": "#4ade80",
  "trailer-confirmed": "#7dd3fc",
  "leak-reported": "#facc15",
  disputed: "#fca5a5",
} as const;

// Original category palette for the "By category" cluster mode.
export const CATEGORY_COLORS: Record<string, string> = {
  collectibles: "#8b5cf6",
  stores: "#fbbf24",
  missions: "#c084fc",
  vehicles: "#34d399",
  secrets: "#f472b6",
  "stunt-jumps": "#fb923c",
  landmarks: "#818cf8",
};

export const SELECTED_RING_COLOR = "#ff50c5"; // pink highlight ring
export const FOUND_RING_COLOR = "rgba(139,92,246,0.9)"; // purple tint
const DEFAULT_RING_COLOR = "rgba(255,255,255,0.85)";

const CLUSTER_FILL = "rgba(17,22,31,0.88)"; // glass-dark

const IS_SELECTED = ["boolean", ["feature-state", "selected"], false] as unknown as maplibregl.ExpressionSpecification;
const IS_FOUND = ["boolean", ["feature-state", "found"], false] as unknown as maplibregl.ExpressionSpecification;

function expr(value: unknown): maplibregl.ExpressionSpecification {
  return value as unknown as maplibregl.ExpressionSpecification;
}

function catProp(slug: string): string {
  return `cat_${slug.replace(/-/g, "_")}`;
}

/** Nested binary max over the per-category cluster counts. */
function maxCategoryCount(): unknown {
  const gets = CATEGORIES.map((c) => ["get", catProp(c.slug)]);
  return gets.reduceRight((acc, g) => (acc === null ? g : ["max", g, acc]), null as unknown);
}

function ringByMaxEvidence(): maplibregl.ExpressionSpecification {
  return [
    "case",
    [">=", ["get", "max_evidence"], 4],
    EVIDENCE_COLORS["rockstar-confirmed"],
    [">=", ["get", "max_evidence"], 3],
    EVIDENCE_COLORS["trailer-confirmed"],
    [">=", ["get", "max_evidence"], 2],
    EVIDENCE_COLORS["leak-reported"],
    EVIDENCE_COLORS["disputed"],
  ] as unknown as maplibregl.ExpressionSpecification;
}

function ringByDominantCategory(): maplibregl.ExpressionSpecification {
  const m = maxCategoryCount();
  const arms: unknown[] = ["case"];
  for (const c of CATEGORIES) {
    arms.push(["==", ["get", catProp(c.slug)], m], CATEGORY_COLORS[c.slug] ?? DEFAULT_RING_COLOR);
  }
  arms.push(DEFAULT_RING_COLOR);
  return arms as unknown as maplibregl.ExpressionSpecification;
}

function pinFillByEvidence(): maplibregl.ExpressionSpecification {
  return [
    "case",
    ["==", ["get", "evidence"], "rockstar-confirmed"],
    EVIDENCE_COLORS["rockstar-confirmed"],
    ["==", ["get", "evidence"], "trailer-confirmed"],
    EVIDENCE_COLORS["trailer-confirmed"],
    ["==", ["get", "evidence"], "leak-reported"],
    EVIDENCE_COLORS["leak-reported"],
    EVIDENCE_COLORS["disputed"],
  ] as unknown as maplibregl.ExpressionSpecification;
}

function pinFillByCategory(): maplibregl.ExpressionSpecification {
  const arms: unknown[] = ["case"];
  for (const c of CATEGORIES) {
    arms.push(["==", ["get", "categorySlug"], c.slug], CATEGORY_COLORS[c.slug] ?? DEFAULT_RING_COLOR);
  }
  arms.push(DEFAULT_RING_COLOR);
  return arms as unknown as maplibregl.ExpressionSpecification;
}

export function addMarkerLayers(
  map: maplibregl.Map,
  opts?: { clusterColorMode?: ClusterColorMode }
): void {
  removeMarkerLayers(map); // idempotent re-add
  if (!map.getSource(CLUSTER_SOURCE_ID)) {
    throw new Error(
      `[map] cluster source "${CLUSTER_SOURCE_ID}" missing — add the source before layers`
    );
  }
  const mode = opts?.clusterColorMode ?? "evidence";

  // 1. Cluster circles — big bold game-map bubbles; radius stepped by
  //    point_count, diameters ≤ 80px. Stroke ring colored by the cluster's
  //    HIGHEST evidence rank (trust rule), or by dominant category in
  //    category mode.
  map.addLayer({
    id: LAYER_CLUSTERS,
    type: "circle",
    source: CLUSTER_SOURCE_ID,
    filter: ["has", "point_count"],
    paint: {
      "circle-color": CLUSTER_FILL,
      "circle-radius": ["step", ["get", "point_count"], 20, 10, 30, 50, 40],
      "circle-stroke-width": 2.5,
      "circle-stroke-color": mode === "category" ? ringByDominantCategory() : ringByMaxEvidence(),
    },
  });

  // 2. Cluster counts — "±" prefix when the cluster mixes evidence ranks
  //    (min < max), so a confirmed ring on a mostly-disputed cluster stays
  //    honest. text-font is intentionally UNSET: digits render from the
  //    vector tiles' glyph range via MapLibre's default fontstack —
  //    no webfont fetch on the critical path.
  map.addLayer({
    id: LAYER_CLUSTER_COUNT,
    type: "symbol",
    source: CLUSTER_SOURCE_ID,
    filter: ["has", "point_count"],
    layout: {
      "text-field": [
        "concat",
        ["case", ["<", ["get", "min_evidence"], ["get", "max_evidence"]], "±", ""],
        ["to-string", ["get", "point_count_abbreviated"]],
      ],
      "text-size": 14,
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: {
      "text-color": "#ffffff",
      "text-halo-color": "rgba(10, 8, 30, 0.85)",
      "text-halo-width": 1.5,
    },
  });

  // 3. Unclustered pins — 10px evidence-colored circles with a 2px white
  //    ring. Selected (feature-state) → pink outer ring; found → dimmed
  //    fill + purple ring tint. No glow/blur — kept cheap on mobile GPUs.
  map.addLayer({
    id: LAYER_PINS,
    type: "circle",
    source: CLUSTER_SOURCE_ID,
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-radius": 10,
      "circle-color": mode === "category" ? pinFillByCategory() : pinFillByEvidence(),
      "circle-opacity": expr(["case", IS_FOUND, 0.35, 0.92]),
      "circle-stroke-width": expr(["case", IS_SELECTED, 4, 2]),
      "circle-stroke-color": expr([
        "case",
        IS_SELECTED,
        SELECTED_RING_COLOR,
        IS_FOUND,
        FOUND_RING_COLOR,
        DEFAULT_RING_COLOR,
      ]),
    },
  });

  // 4. Approximate-coordinate badge — "≈" above the pin, white, so
  //    approximate positions are never presented as precise. Text only
  //    (no emoji — banned on map pins by parent decision).
  map.addLayer({
    id: LAYER_PINS_APPROX,
    type: "symbol",
    source: CLUSTER_SOURCE_ID,
    filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "approx"], true]],
    layout: {
      "text-field": "≈",
      "text-size": 10,
      "text-offset": [0, -1.2],
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: {
      "text-color": "#ffffff",
    },
  });
}

/**
 * Switch the cluster/pin coloring mode live (no source rebuild).
 * "evidence" = trust-first (default); "category" = dominant category.
 */
export function setClusterColorMode(map: maplibregl.Map, mode: ClusterColorMode): void {
  if (map.getLayer(LAYER_CLUSTERS)) {
    map.setPaintProperty(
      LAYER_CLUSTERS,
      "circle-stroke-color",
      mode === "category" ? ringByDominantCategory() : ringByMaxEvidence()
    );
  }
  if (map.getLayer(LAYER_PINS)) {
    map.setPaintProperty(
      LAYER_PINS,
      "circle-color",
      mode === "category" ? pinFillByCategory() : pinFillByEvidence()
    );
  }
}

export function removeMarkerLayers(map: maplibregl.Map): void {
  for (const id of [LAYER_CLUSTERS, LAYER_CLUSTER_COUNT, LAYER_PINS, LAYER_PINS_APPROX]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
}

/**
 * Applies selected/found feature-state to every named pin feature on
 * LAYER_PINS. State is set on the SOURCE (it does not survive setData), so
 * the orchestrator must call this after every source rebuild and on every
 * selection/found toggle. Cluster features (numeric ids) are skipped.
 */
export function refreshPinState(
  map: maplibregl.Map,
  opts: { selectedId: string | null; foundIds: Set<string> }
): void {
  if (!map.getSource(CLUSTER_SOURCE_ID)) return;
  let features: ReturnType<maplibregl.Map["querySourceFeatures"]>;
  try {
    features = map.querySourceFeatures(CLUSTER_SOURCE_ID);
  } catch {
    return; // source mid-rebuild — caller retries after the data event
  }
  for (const feature of features) {
    if (typeof feature.id !== "string") continue; // clusters use numeric ids
    if (feature.properties && "point_count" in feature.properties) continue;
    const id = feature.id;
    try {
      map.setFeatureState(
        { source: CLUSTER_SOURCE_ID, id },
        { selected: id === opts.selectedId, found: opts.foundIds.has(id) }
      );
    } catch {
      // Feature vanished between query and set (filter race) — next
      // refreshPinState call corrects it.
    }
  }
}
