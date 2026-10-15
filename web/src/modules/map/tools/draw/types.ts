// ─── modules/map/tools/draw/types.ts ────────────────────────────────────
// Drawing toolkit key interfaces (spec §2.11). Pure types — no MapLibre,
// no React.

/** v1 draw tool kinds (subset of the shared ToolKind). */
export type DrawToolKind = "pen" | "line" | "rect" | "circle";

export const DRAW_TOOL_KINDS: readonly DrawToolKind[] = [
  "pen",
  "line",
  "rect",
  "circle",
];

/** Closed kinds are fillable; open kinds are stroke-only. */
export function isClosedKind(kind: DrawToolKind): boolean {
  return kind === "rect" || kind === "circle";
}

export interface DrawStyle {
  color: string; // hex
  thickness: number; // 1..12 px
  opacity: number; // 0..100
  fill: boolean; // closed shapes only
  fillOpacity: number; // 0..100
}

/** Semantic circle definition — lets the 64-gon re-generate exactly. */
export interface CircleMeta {
  center: [number, number]; // [lng, lat]
  radiusMeters: number;
}

export interface DrawFeature {
  id: string; // crypto.randomUUID()
  kind: DrawToolKind;
  geometry: GeoJSON.LineString | GeoJSON.Polygon;
  style: DrawStyle;
  meta?: CircleMeta; // circles only
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface DrawingsDoc {
  version: 1;
  savedAt: string; // ISO 8601
  features: DrawFeature[];
}

/** One undo/redo snapshot: full feature array before a committed mutation. */
export interface HistoryEntry {
  features: DrawFeature[];
  label: string;
  at: string; // ISO 8601
}

/** Ephemeral preview sketch — never persisted, never in history. */
export interface PreviewSketch {
  kind: DrawToolKind;
  geometry: GeoJSON.LineString | GeoJSON.Polygon;
  style: DrawStyle;
  /** Committed line vertices (for the vertex-dot layer), if any. */
  vertices?: Array<[number, number]>;
}
