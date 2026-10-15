// ─── modules/map/tools/measure/MeasureLayers.tsx ────────────────────
// MapLibre sources + layers for the measure slice (spec §3.3/§3.4).
// One GeoJSON source (`measure-src`); layers land in the "measurements"
// family via addToolLayer — above drawings, below markers (spec §1.2).
//
// All labels recompute from raw vertices in the CURRENT units on every
// render, so the shared unit toggle re-renders every label live.
// text-font is intentionally unset (same as cluster counts): digits render
// from the style's glyph range via MapLibre's default fontstack.

"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type {
  ExpressionSpecification,
  GeoJSONSource,
  LayerSpecification,
  Map as MapLibreMap,
} from "maplibre-gl";
import { useTools } from "../shared/toolRuntime";
import { addToolLayer, removeToolLayer } from "../shared/layerOrder";
import { useMeasureStore } from "./store";
import { formatArea, formatDistance, formatMeasurement } from "./format";
import {
  haversineDistance,
  polylineLength,
  segmentMidpoint,
  sphericalCentroid,
  sphericalPolygonArea,
} from "./geodesic";
import {
  colorForKind,
  selectedColorForKind,
  type Measurement,
  type MeasureKind,
  type MeasureVertex,
  type Units,
} from "./types";

export const MEASURE_SOURCE_ID = "measure-src";
export const MEASURE_CHIP_HIT_LAYER_ID = "measure-chip-hit";

/**
 * Layers hit-tested for select/copy. Chip hit-targets first (they sit on
 * top), then geometry. The sketch line is included harmlessly — it only
 * exists while a tool is active, when this list is unused.
 */
export const MEASURE_HIT_LAYER_IDS = [
  MEASURE_CHIP_HIT_LAYER_ID,
  "measure-line",
  "measure-area-fill",
  "measure-sketch",
];

type FeatureRole =
  | "result-line"
  | "result-fill"
  | "sketch-line"
  | "sketch-dash"
  | "vertex"
  | "midpoint"
  | "chip"
  | "cursor";

interface MeasureFeatureProps {
  measureId?: string;
  kind: MeasureKind;
  role: FeatureRole;
  label?: string;
  color: string;
  colorSelected: string;
  selected?: boolean;
}

const selectedColor = (): ExpressionSpecification => [
  "case",
  ["boolean", ["get", "selected"], false],
  ["get", "colorSelected"],
  ["get", "color"],
];

const MEASURE_LAYERS: LayerSpecification[] = [
  {
    id: "measure-glow",
    type: "line",
    source: MEASURE_SOURCE_ID,
    filter: ["==", ["get", "role"], "result-line"],
    paint: {
      "line-color": selectedColor(),
      "line-width": 9,
      "line-blur": 5,
      "line-opacity": 0.22,
    },
  },
  {
    id: "measure-area-fill",
    type: "fill",
    source: MEASURE_SOURCE_ID,
    filter: ["==", ["get", "role"], "result-fill"],
    paint: {
      "fill-color": ["get", "color"],
      "fill-opacity": 0.2, // spec §3.4: ~20% translucent fill
    },
  },
  {
    id: "measure-line",
    type: "line",
    source: MEASURE_SOURCE_ID,
    filter: ["==", ["get", "role"], "result-line"],
    paint: {
      "line-color": selectedColor(),
      "line-width": [
        "case",
        ["boolean", ["get", "selected"], false],
        5,
        3,
      ],
    },
  },
  {
    id: "measure-sketch",
    type: "line",
    source: MEASURE_SOURCE_ID,
    filter: ["in", ["get", "role"], ["literal", ["sketch-line", "sketch-dash"]]],
    paint: {
      "line-color": ["get", "color"],
      "line-width": 2.5,
      "line-dasharray": [3, 2],
      "line-opacity": 0.95,
    },
  },
  {
    id: "measure-vertices",
    type: "circle",
    source: MEASURE_SOURCE_ID,
    filter: ["==", ["get", "role"], "vertex"],
    paint: {
      // 12 px radius = 24 px touch target (spec §1.5)
      "circle-radius": 12,
      "circle-color": ["get", "color"],
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff",
    },
  },
  {
    id: "measure-midpoints",
    type: "symbol",
    source: MEASURE_SOURCE_ID,
    filter: ["==", ["get", "role"], "midpoint"],
    layout: {
      "text-field": ["get", "label"],
      "text-size": 11,
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: {
      "text-color": "#e8edf5",
      "text-halo-color": "#05070c",
      "text-halo-width": 2,
    },
  },
  {
    id: "measure-chips",
    type: "symbol",
    source: MEASURE_SOURCE_ID,
    filter: ["==", ["get", "role"], "chip"],
    layout: {
      "text-field": ["get", "label"],
      "text-size": 13,
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: {
      "text-color": selectedColor(),
      "text-halo-color": "#05070c",
      "text-halo-width": 2.5,
    },
  },
  {
    id: "measure-chip-ring",
    type: "circle",
    source: MEASURE_SOURCE_ID,
    filter: [
      "all",
      ["==", ["get", "role"], "chip"],
      ["boolean", ["get", "selected"], false],
    ],
    paint: {
      "circle-radius": 22,
      "circle-color": "rgba(0,0,0,0)",
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-opacity": 0.9,
    },
  },
  {
    id: MEASURE_CHIP_HIT_LAYER_ID,
    type: "circle",
    source: MEASURE_SOURCE_ID,
    filter: ["==", ["get", "role"], "chip"],
    paint: {
      // Invisible 32 px hit target (≥24 px) for chip select/copy.
      "circle-radius": 16,
      "circle-color": "#ffffff",
      "circle-opacity": 0,
    },
  },
  {
    id: "measure-cursor",
    type: "symbol",
    source: MEASURE_SOURCE_ID,
    filter: ["==", ["get", "role"], "cursor"],
    layout: {
      "text-field": ["get", "label"],
      "text-size": 12,
      "text-allow-overlap": true,
      "text-ignore-placement": true,
      "text-offset": [0, -1.2],
    },
    paint: {
      "text-color": ["get", "color"],
      "text-halo-color": "#05070c",
      "text-halo-width": 2,
    },
  },
];

// ─── GeoJSON builders ───────────────────────────────────────────────────

function feat(
  geometry: Geometry,
  props: MeasureFeatureProps
): Feature<Geometry, MeasureFeatureProps> {
  return { type: "Feature", geometry, properties: props };
}

function baseProps(
  kind: MeasureKind,
  role: FeatureRole,
  extra?: Partial<MeasureFeatureProps>
): MeasureFeatureProps {
  return {
    kind,
    role,
    color: colorForKind(kind),
    colorSelected: selectedColorForKind(kind),
    ...extra,
  };
}

function pointFeature(
  at: MeasureVertex,
  props: MeasureFeatureProps
): Feature<Geometry, MeasureFeatureProps> {
  return feat({ type: "Point", coordinates: [at[0], at[1]] }, props);
}

function buildSourceData(
  sketchTool: MeasureKind | null,
  sketchVertices: MeasureVertex[],
  sketchCursor: MeasureVertex | null,
  measurements: Measurement[],
  selectedId: string | null,
  units: Units
): FeatureCollection<Geometry, MeasureFeatureProps> {
  const features: Feature<Geometry, MeasureFeatureProps>[] = [];

  // ── Finished measurements ──────────────────────────────────────────
  for (const m of measurements) {
    const selected = m.id === selectedId;
    const chipLabel = formatMeasurement(m, units);
    if (m.kind === "distance") {
      features.push(
        feat(
          { type: "LineString", coordinates: m.vertices.map((v) => [v[0], v[1]]) },
          baseProps(m.kind, "result-line", { measureId: m.id, selected })
        )
      );
      for (let i = 1; i < m.vertices.length; i++) {
        const a = m.vertices[i - 1];
        const b = m.vertices[i];
        features.push(
          pointFeature(
            segmentMidpoint(a, b),
            baseProps(m.kind, "midpoint", {
              measureId: m.id,
              label: formatDistance(haversineDistance(a, b), units),
            })
          )
        );
      }
      const last = m.vertices[m.vertices.length - 1];
      features.push(
        pointFeature(
          last,
          baseProps(m.kind, "chip", {
            measureId: m.id,
            label: chipLabel,
            selected,
          })
        )
      );
    } else {
      const ring = [...m.vertices, m.vertices[0]].map(
        (v) => [v[0], v[1]] as [number, number]
      );
      features.push(
        feat(
          { type: "Polygon", coordinates: [ring] },
          baseProps(m.kind, "result-fill", { measureId: m.id, selected })
        )
      );
      features.push(
        feat(
          { type: "LineString", coordinates: ring },
          baseProps(m.kind, "result-line", { measureId: m.id, selected })
        )
      );
      const anchor = sphericalCentroid(m.vertices) ?? m.vertices[0];
      features.push(
        pointFeature(
          anchor,
          baseProps(m.kind, "chip", {
            measureId: m.id,
            label: chipLabel,
            selected,
          })
        )
      );
    }
  }

  // ── In-progress sketch ─────────────────────────────────────────────
  if (sketchTool && sketchVertices.length > 0) {
    const kind = sketchTool;
    for (const v of sketchVertices) {
      features.push(pointFeature(v, baseProps(kind, "vertex")));
    }
    if (sketchVertices.length >= 2) {
      features.push(
        feat(
          {
            type: "LineString",
            coordinates: sketchVertices.map((v) => [v[0], v[1]]),
          },
          baseProps(kind, "sketch-line")
        )
      );
    }
    if (kind === "distance") {
      for (let i = 1; i < sketchVertices.length; i++) {
        const a = sketchVertices[i - 1];
        const b = sketchVertices[i];
        features.push(
          pointFeature(
            segmentMidpoint(a, b),
            baseProps(kind, "midpoint", {
              label: formatDistance(haversineDistance(a, b), units),
            })
          )
        );
      }
      if (sketchCursor) {
        const last = sketchVertices[sketchVertices.length - 1];
        features.push(
          feat(
            {
              type: "LineString",
              coordinates: [
                [last[0], last[1]],
                [sketchCursor[0], sketchCursor[1]],
              ],
            },
            baseProps(kind, "sketch-dash")
          )
        );
        const running =
          polylineLength(sketchVertices) +
          haversineDistance(last, sketchCursor);
        features.push(
          pointFeature(
            sketchCursor,
            baseProps(kind, "cursor", {
              label: formatDistance(running, units),
            })
          )
        );
      }
    } else {
      // Area: dashed rubber-band auto-close preview back to the first vertex.
      if (sketchCursor && sketchVertices.length >= 1) {
        const first = sketchVertices[0];
        features.push(
          feat(
            {
              type: "LineString",
              coordinates: [
                [sketchCursor[0], sketchCursor[1]],
                [first[0], first[1]],
              ],
            },
            baseProps(kind, "sketch-dash")
          )
        );
        if (sketchVertices.length >= 2) {
          const live = sphericalPolygonArea([...sketchVertices, sketchCursor]);
          features.push(
            pointFeature(
              sketchCursor,
              baseProps(kind, "cursor", { label: formatArea(live, units) })
            )
          );
        }
      }
    }
  }

  return { type: "FeatureCollection", features };
}

// ─── Component (side-effect only) ───────────────────────────────────────

export default function MeasureLayers() {
  const { getMap, units } = useTools();
  const { state } = useMeasureStore();

  const data = useMemo(
    () =>
      buildSourceData(
        state.sketchTool,
        state.sketchVertices,
        state.sketchCursor,
        state.measurements,
        state.selectedId,
        units
      ),
    [
      state.sketchTool,
      state.sketchVertices,
      state.sketchCursor,
      state.measurements,
      state.selectedId,
      units,
    ]
  );
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  });

  useEffect(() => {
    let map: MapLibreMap | null = null;
    let cleanup: (() => void) | undefined;

    const ensure = () => {
      if (!map) return;
      if (!map.getSource(MEASURE_SOURCE_ID)) {
        map.addSource(MEASURE_SOURCE_ID, {
          type: "geojson",
          data: dataRef.current,
        });
      }
      for (const layer of MEASURE_LAYERS) {
        addToolLayer(map, "measurements", layer);
      }
      const src = map.getSource(MEASURE_SOURCE_ID) as
        | GeoJSONSource
        | undefined;
      src?.setData(dataRef.current);
    };

    // The map is created in GameMap's effect — after this slice mounts —
    // so poll until getMap() resolves. Cheap (100 ms) and self-clearing.
    const timer = window.setInterval(() => {
      const m = getMap();
      if (!m) return;
      window.clearInterval(timer);
      map = m;
      ensure();
      m.on("style.load", ensure); // base-layer switches rebuild all layers
      cleanup = () => {
        m.off("style.load", ensure);
        for (const layer of MEASURE_LAYERS) {
          removeToolLayer(m, "measurements", layer.id);
        }
        if (m.getSource(MEASURE_SOURCE_ID)) m.removeSource(MEASURE_SOURCE_ID);
      };
    }, 100);

    return () => {
      window.clearInterval(timer);
      cleanup?.();
    };
  }, [getMap]);

  // Push rebuilt data (sketch moves, new results, selection, unit toggle).
  useEffect(() => {
    const m = getMap();
    const src = m?.getSource(MEASURE_SOURCE_ID) as GeoJSONSource | undefined;
    src?.setData(data);
  }, [data, getMap]);

  return null;
}
