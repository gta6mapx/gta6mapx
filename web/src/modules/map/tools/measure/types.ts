// ─── modules/map/tools/measure/types.ts ─────────────────────────────
// Measurement domain types (spec §3.11). Raw vertices are the source of
// truth — computed totals are NEVER stored, so unit toggles and math fixes
// apply retroactively on every render.

import type { Units } from "../shared/toolRuntime";

export type { Units };

export type MeasureKind = "distance" | "area";

/** [lng, lat] — GeoJSON order, WGS84 degrees. */
export type MeasureVertex = [lng: number, lat: number];

export interface Measurement {
  id: string;
  kind: MeasureKind;
  /** Raw lng/lat — source of truth. Totals recompute from these on load. */
  vertices: MeasureVertex[];
  /** Units at creation time — display context only. */
  unit: Units;
  /** ISO 8601. */
  createdAt: string;
}

export interface SketchState {
  tool: MeasureKind | null;
  vertices: MeasureVertex[];
  cursor: MeasureVertex | null;
  selectedId: string | null;
}

export interface MeasurementsDoc {
  version: 1;
  savedAt: string;
  measurements: Measurement[];
}

export interface MeasureHistoryEntry {
  measurements: Measurement[];
  label: string;
  at: string;
}

/** Map a runtime tool id to its measure kind (null = not a measure tool). */
export function toolToMeasureKind(tool: string): MeasureKind | null {
  if (tool === "measure-distance") return "distance";
  if (tool === "measure-area") return "area";
  return null;
}

export function minVerticesFor(kind: MeasureKind): number {
  return kind === "distance" ? 2 : 3;
}

/** Neon pink = distance, sunset orange = area (spec §9, confirmed colors). */
export const MEASURE_DISTANCE_COLOR = "#FF2E88";
export const MEASURE_AREA_COLOR = "#FF7A18";
/** Brighter variants for the selected state. */
export const MEASURE_DISTANCE_SELECTED = "#ff7fb0";
export const MEASURE_AREA_SELECTED = "#ffa04d";

export function colorForKind(kind: MeasureKind): string {
  return kind === "distance" ? MEASURE_DISTANCE_COLOR : MEASURE_AREA_COLOR;
}

export function selectedColorForKind(kind: MeasureKind): string {
  return kind === "distance"
    ? MEASURE_DISTANCE_SELECTED
    : MEASURE_AREA_SELECTED;
}

/** Newest 50 measurements are kept; older ones drop silently (spec §3.8). */
export const MAX_MEASUREMENTS = 50;

export const MEASURE_STORAGE_KEY = "gta6mapx.measurements.v1";
