// ─── modules/map/tools/draw/layers.ts ───────────────────────────────────
// Rendering for the drawing toolkit (spec §2.3):
//   - `drawings-src`: single GeoJSON source, one FeatureCollection, stable
//     string ids (top-level feature `id` so setFeatureState works).
//   - `draw-fill` (fill, closed kinds), `draw-line` (line, all kinds),
//     `draw-selection` (white dashed overlay for the selected feature),
//     `draw-vertex` (circle dots for selected line vertices — visual only
//     in v1; source `draw-vertex-src` also carries live preview vertices).
//   - `draw-preview-src`: ephemeral preview source (never persisted, never
//     in history) + `draw-preview-fill` / `draw-preview-line` layers.
//
// Selection highlight uses feature-state + data-driven paint (no duplicate
// features). All layers register through the shared layerOrder helpers so
// they always land below marker layers (spec §1.2). line-pitch-alignment
// stays at the MapLibre default (viewport) per spec §1.6 — annotation
// strokes keep constant screen thickness in 2D and 3D.

import type {
  Map as MapLibreMap,
  GeoJSONSource,
  LayerSpecification,
  ExpressionSpecification,
} from "maplibre-gl";
import type { DrawFeature, PreviewSketch } from "./types";
import { styleToProperties, SELECTION_HIGHLIGHT } from "./palette";
import {
  addToolLayer,
  removeToolLayer,
  restackToolLayers,
} from "../shared/layerOrder";
import type { LngLat } from "./geometry";

export const DRAWINGS_SOURCE_ID = "drawings-src";
export const DRAWINGS_FILL_LAYER = "draw-fill";
export const DRAWINGS_LINE_LAYER = "draw-line";
export const DRAWINGS_SELECTION_LAYER = "draw-selection";
export const DRAWINGS_VERTEX_LAYER = "draw-vertex";
export const DRAWINGS_VERTEX_SOURCE = "draw-vertex-src";
export const PREVIEW_SOURCE_ID = "draw-preview-src";
export const PREVIEW_FILL_LAYER = "draw-preview-fill";
export const PREVIEW_LINE_LAYER = "draw-preview-line";

const FAMILY = "drawings" as const;

const SELECTED_EXPR: ExpressionSpecification = [
  "boolean",
  ["feature-state", "selected"],
  false,
];

function featureCollection(
  features: DrawFeature[]
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: features.map((f) => ({
      type: "Feature",
      id: f.id,
      geometry: f.geometry,
      properties: styleToProperties(f.style, f.kind),
    })),
  };
}

function previewCollection(
  sketch: PreviewSketch
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: sketch.geometry,
        properties: styleToProperties(sketch.style, sketch.kind),
      },
    ],
  };
}

function committedLayerSpecs(): LayerSpecification[] {
  return [
    {
      id: DRAWINGS_FILL_LAYER,
      type: "fill",
      source: DRAWINGS_SOURCE_ID,
      filter: ["all", ["==", ["get", "closed"], true], ["==", ["get", "filled"], true]],
      paint: {
        "fill-color": ["case", SELECTED_EXPR, SELECTION_HIGHLIGHT, ["get", "color"]],
        "fill-opacity": ["case", SELECTED_EXPR, 0.4, ["get", "fillOpacity"]],
      },
    },
    {
      id: DRAWINGS_LINE_LAYER,
      type: "line",
      source: DRAWINGS_SOURCE_ID,
      paint: {
        "line-color": ["case", SELECTED_EXPR, SELECTION_HIGHLIGHT, ["get", "color"]],
        "line-width": ["get", "thickness"],
        "line-opacity": ["get", "opacity"],
        "line-blur": 0.4,
      },
    },
    {
      // Dashed-white selection overlay (spec §2.3). Zero opacity unless
      // the feature-state flag is set — no duplicate features needed.
      id: DRAWINGS_SELECTION_LAYER,
      type: "line",
      source: DRAWINGS_SOURCE_ID,
      paint: {
        "line-color": "#FFFFFF",
        "line-width": ["+", ["get", "thickness"], 5],
        "line-opacity": ["case", SELECTED_EXPR, 0.9, 0],
        "line-dasharray": [2.5, 2],
      },
    },
    {
      // Vertex dots: line-kind only, shown for the selected feature and
      // for the live line preview. Visual only in v1 (no vertex editing).
      id: DRAWINGS_VERTEX_LAYER,
      type: "circle",
      source: DRAWINGS_VERTEX_SOURCE,
      paint: {
        "circle-radius": 8,
        "circle-color": "#FFFFFF",
        "circle-stroke-width": 2,
        "circle-stroke-color": "#FF2E88",
        "circle-opacity": 0.95,
      },
    },
  ];
}

function previewLayerSpecs(): LayerSpecification[] {
  return [
    {
      id: PREVIEW_FILL_LAYER,
      type: "fill",
      source: PREVIEW_SOURCE_ID,
      filter: ["all", ["==", ["get", "closed"], true], ["==", ["get", "filled"], true]],
      paint: {
        "fill-color": ["get", "color"],
        "fill-opacity": ["get", "fillOpacity"],
      },
    },
    {
      id: PREVIEW_LINE_LAYER,
      type: "line",
      source: PREVIEW_SOURCE_ID,
      paint: {
        "line-color": ["get", "color"],
        "line-width": ["get", "thickness"],
        "line-opacity": ["get", "opacity"],
        "line-blur": 0.4,
      },
    },
  ];
}

function ensureSource(map: MapLibreMap, id: string): void {
  if (map.getSource(id)) return;
  map.addSource(id, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
}

export interface DrawingLayers {
  /** Replace committed source data (O(n) over ≤200 small features). */
  sync(features: DrawFeature[]): void;
  /** Apply feature-state selection highlight. */
  setSelected(id: string | null): void;
  /** Ephemeral preview (null clears). Never persisted, never in history. */
  setPreview(sketch: PreviewSketch | null): void;
  /** Vertex dots for selected line features / live line sketch. */
  setVertexDots(points: LngLat[]): void;
  destroy(): void;
}

/**
 * Mount drawing sources + layers (idempotent — safe to call after every
 * base-style switch; sources are re-added when setStyle wiped them).
 */
export function mountDrawingLayers(map: MapLibreMap): DrawingLayers {
  ensureSource(map, DRAWINGS_SOURCE_ID);
  ensureSource(map, PREVIEW_SOURCE_ID);
  ensureSource(map, DRAWINGS_VERTEX_SOURCE);

  // Committed layers first, preview layers on top, vertex dots topmost.
  for (const spec of committedLayerSpecs()) addToolLayer(map, FAMILY, spec);
  for (const spec of previewLayerSpecs()) addToolLayer(map, FAMILY, spec);
  restackToolLayers(map);

  let selectedId: string | null = null;
  let destroyed = false;

  const setFeatureSelected = (id: string, selected: boolean) => {
    if (destroyed) return;
    try {
      map.setFeatureState({ source: DRAWINGS_SOURCE_ID, id }, { selected });
    } catch {
      // Feature may not exist yet (style switch mid-flight) — sync()
      // re-applies selection once data lands.
    }
  };

  return {
    sync(features: DrawFeature[]) {
      if (destroyed) return;
      const src = map.getSource(DRAWINGS_SOURCE_ID) as
        | GeoJSONSource
        | undefined;
      if (!src) return;
      src.setData(featureCollection(features));
      if (selectedId) setFeatureSelected(selectedId, true);
    },

    setSelected(id: string | null) {
      if (destroyed) return;
      if (selectedId && selectedId !== id) setFeatureSelected(selectedId, false);
      selectedId = id;
      if (id) setFeatureSelected(id, true);
    },

    setPreview(sketch: PreviewSketch | null) {
      if (destroyed) return;
      const src = map.getSource(PREVIEW_SOURCE_ID) as
        | GeoJSONSource
        | undefined;
      if (!src) return;
      src.setData(
        sketch
          ? previewCollection(sketch)
          : { type: "FeatureCollection", features: [] }
      );
    },

    setVertexDots(points: LngLat[]) {
      if (destroyed) return;
      const src = map.getSource(DRAWINGS_VERTEX_SOURCE) as
        | GeoJSONSource
        | undefined;
      if (!src) return;
      src.setData({
        type: "FeatureCollection",
        features: points.map((p) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [p[0], p[1]] },
          properties: {},
        })),
      });
    },

    destroy() {
      destroyed = true;
      if (selectedId) {
        try {
          map.setFeatureState(
            { source: DRAWINGS_SOURCE_ID, id: selectedId },
            { selected: false }
          );
        } catch {
          /* source already gone */
        }
      }
      for (const id of [
        DRAWINGS_FILL_LAYER,
        DRAWINGS_LINE_LAYER,
        DRAWINGS_SELECTION_LAYER,
        DRAWINGS_VERTEX_LAYER,
        PREVIEW_FILL_LAYER,
        PREVIEW_LINE_LAYER,
      ]) {
        removeToolLayer(map, FAMILY, id);
      }
      for (const src of [
        DRAWINGS_SOURCE_ID,
        PREVIEW_SOURCE_ID,
        DRAWINGS_VERTEX_SOURCE,
      ]) {
        if (map.getSource(src)) {
          try {
            map.removeSource(src);
          } catch {
            /* already removed */
          }
        }
      }
    },
  };
}

/** Layer ids used for hit-testing drawings (spec §2.4: 8 px tolerance). */
export const DRAW_HIT_LAYER_IDS = [
  DRAWINGS_FILL_LAYER,
  DRAWINGS_LINE_LAYER,
] as const;
