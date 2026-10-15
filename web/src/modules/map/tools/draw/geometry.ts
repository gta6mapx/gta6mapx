// ─── modules/map/tools/draw/geometry.ts ─────────────────────────────────
// PURE geometry for the drawing toolkit. No MapLibre imports, no DOM —
// every function is unit-testable. All coordinates are [lng, lat] in
// degrees (EPSG:4326); meters are converted at the given latitude.

import type {
  CircleMeta,
  DrawFeature,
  DrawStyle,
  DrawToolKind,
} from "./types";

export type LngLat = [number, number];

const EARTH_R = 6_371_008.8; // WGS84 mean radius, meters
const MAX_VERTICES_PER_STROKE = 2000;
export const CIRCLE_SEGMENTS = 64;

// ─── Meter / degree conversions ──────────────────────────────────────────

function toRad(d: number): number {
  return (d * Math.PI) / 180;
}

function toDeg(r: number): number {
  return (r * 180) / Math.PI;
}

/** Haversine distance in meters (written originally, ~10 lines). */
export function distanceMeters(a: LngLat, b: LngLat): number {
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Destination point from `from`, traveling `meters` along `bearingRad`.
 * Spherical-earth formula — ~0.3% vs ellipsoid, fine for game-map scale.
 */
export function destinationPoint(
  from: LngLat,
  meters: number,
  bearingRad: number
): LngLat {
  const lat1 = toRad(from[1]);
  const lng1 = toRad(from[0]);
  const d = meters / EARTH_R;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) +
      Math.cos(lat1) * Math.sin(d) * Math.cos(bearingRad)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );
  return [toDeg(lng2), toDeg(lat2)];
}

// ─── Shape builders ──────────────────────────────────────────────────────

/** Rectangle polygon from two opposite corners (closed ring). */
export function buildRectPolygon(a: LngLat, b: LngLat): GeoJSON.Polygon {
  const ring: LngLat[] = [
    [a[0], a[1]],
    [b[0], a[1]],
    [b[0], b[1]],
    [a[0], b[1]],
    [a[0], a[1]],
  ];
  return { type: "Polygon", coordinates: [ring] };
}

/**
 * Circle as a 64-vertex polygon approximation + semantic meta
 * { center, radiusMeters } so the shape re-generates exactly (spec §2.3).
 */
export function buildCirclePolygon(
  center: LngLat,
  radiusMeters: number
): { polygon: GeoJSON.Polygon; meta: CircleMeta } {
  const ring: LngLat[] = [];
  for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
    const bearing = (i / CIRCLE_SEGMENTS) * 2 * Math.PI;
    ring.push(destinationPoint(center, radiusMeters, bearing));
  }
  ring.push(ring[0]);
  return {
    polygon: { type: "Polygon", coordinates: [ring] },
    meta: { center: [center[0], center[1]], radiusMeters },
  };
}

/** Re-generate a circle polygon from stored meta (exact). */
export function rebuildCircleFromMeta(meta: CircleMeta): GeoJSON.Polygon {
  return buildCirclePolygon(meta.center, meta.radiusMeters).polygon;
}

// ─── Freehand simplification pipeline ────────────────────────────────────
// radial pre-filter (<2 px apart dropped) → Douglas–Peucker (2 px tolerance
// in degrees) → hard cap 2000 vertices, doubling tolerance until under cap.
// pxToDegrees comes from the caller via map.unproject deltas (camera-
// independent ground-plane math, spec §1.6).

function sqDistDeg(a: LngLat, b: LngLat): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

/** Drop points closer than minDistDeg to the last kept point. */
export function radialPrefilter(
  points: LngLat[],
  minDistDeg: number
): LngLat[] {
  if (points.length === 0) return [];
  const minSq = minDistDeg * minDistDeg;
  const kept: LngLat[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    if (sqDistDeg(points[i], kept[kept.length - 1]) >= minSq) {
      kept.push(points[i]);
    }
  }
  // Never drop the final point — it defines the stroke's end.
  const last = points[points.length - 1];
  if (kept[kept.length - 1] !== last) kept.push(last);
  return kept;
}

function perpSqDistDeg(p: LngLat, a: LngLat, b: LngLat): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return sqDistDeg(p, a);
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq
    )
  );
  const cx = a[0] + t * dx;
  const cy = a[1] + t * dy;
  const ex = p[0] - cx;
  const ey = p[1] - cy;
  return ex * ex + ey * ey;
}

/** Douglas–Peucker polyline simplification, tolerance in degrees. */
export function douglasPeucker(
  points: LngLat[],
  toleranceDeg: number
): LngLat[] {
  const n = points.length;
  if (n <= 2) return points.slice();
  const tolSq = toleranceDeg * toleranceDeg;
  const keep = new Array<boolean>(n).fill(false);
  keep[0] = true;
  keep[n - 1] = true;
  const stack: Array<[number, number]> = [[0, n - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop() as [number, number];
    let maxSq = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const d = perpSqDistDeg(points[i], points[first], points[last]);
      if (d > maxSq) {
        maxSq = d;
        index = i;
      }
    }
    if (index !== -1 && maxSq > tolSq) {
      keep[index] = true;
      stack.push([first, index]);
      stack.push([index, last]);
    }
  }
  const out: LngLat[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(points[i]);
  return out;
}

/**
 * Full freehand pipeline (spec §2.9). `pxToDegrees` converts the 2 px
 * screen tolerances into degrees at the stroke location.
 */
export function simplifyStroke(
  points: LngLat[],
  pxToDegrees: number,
  maxVertices: number = MAX_VERTICES_PER_STROKE
): LngLat[] {
  if (points.length <= 2) return points.slice();
  let simplified = radialPrefilter(points, 2 * pxToDegrees);
  let tolerance = 2 * pxToDegrees;
  simplified = douglasPeucker(simplified, tolerance);
  // Doubling tolerance until under the hard cap (spec §2.9).
  let guard = 0;
  while (simplified.length > maxVertices && guard < 12) {
    tolerance *= 2;
    simplified = douglasPeucker(simplified, tolerance);
    guard++;
  }
  return simplified.slice(0, maxVertices);
}

/** Count distinct vertices (dedupe consecutive duplicates). */
export function distinctVertexCount(points: LngLat[]): number {
  let count = 0;
  let prev: LngLat | null = null;
  for (const p of points) {
    if (!prev || prev[0] !== p[0] || prev[1] !== p[1]) count++;
    prev = p;
  }
  return count;
}

// ─── Feature transform (drag-to-move, spec §2.4) ─────────────────────────

/** Translate a feature by a lng/lat delta (whole-feature move, no topology risk). */
export function translateFeature(
  feature: DrawFeature,
  dLng: number,
  dLat: number
): DrawFeature {
  const shift = (ring: LngLat[]): LngLat[] =>
    ring.map(([lng, lat]) => [lng + dLng, lat + dLat]);
  const geometry: GeoJSON.LineString | GeoJSON.Polygon =
    feature.geometry.type === "Polygon"
      ? {
          type: "Polygon",
          coordinates: (feature.geometry.coordinates as LngLat[][]).map(
            shift
          ),
        }
      : {
          type: "LineString",
          coordinates: shift(feature.geometry.coordinates as LngLat[]),
        };
  const moved: DrawFeature = {
    ...feature,
    geometry,
    updatedAt: new Date().toISOString(),
  };
  if (feature.kind === "circle" && feature.meta) {
    moved.meta = {
      center: [feature.meta.center[0] + dLng, feature.meta.center[1] + dLat],
      radiusMeters: feature.meta.radiusMeters,
    };
  }
  return moved;
}

// ─── Validators ─────────────────────────────────────────────────────────

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isValidPosition(p: unknown): p is LngLat {
  return (
    Array.isArray(p) &&
    p.length >= 2 &&
    isFiniteNumber(p[0]) &&
    isFiniteNumber(p[1]) &&
    p[0] >= -180 &&
    p[0] <= 180 &&
    p[1] >= -90 &&
    p[1] <= 90
  );
}

function isValidStyle(s: unknown): s is DrawStyle {
  if (typeof s !== "object" || s === null) return false;
  const st = s as Record<string, unknown>;
  return (
    typeof st.color === "string" &&
    /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(st.color) &&
    isFiniteNumber(st.thickness) &&
    st.thickness >= 1 &&
    st.thickness <= 12 &&
    isFiniteNumber(st.opacity) &&
    st.opacity >= 0 &&
    st.opacity <= 100 &&
    typeof st.fill === "boolean" &&
    isFiniteNumber(st.fillOpacity) &&
    st.fillOpacity >= 0 &&
    st.fillOpacity <= 100
  );
}

// ─── Import validation ───────────────────────────────────────────────────

/** Shape validation for persisted / restored features. */
export function isValidDrawFeature(f: unknown): f is DrawFeature {
  if (typeof f !== "object" || f === null) return false;
  const feat = f as Record<string, unknown>;
  if (typeof feat.id !== "string" || feat.id.length === 0) return false;
  const kind = feat.kind as DrawToolKind;
  if (!["pen", "line", "rect", "circle"].includes(kind)) return false;
  const g = feat.geometry as GeoJSON.LineString | GeoJSON.Polygon | undefined;
  if (!g || (g.type !== "LineString" && g.type !== "Polygon")) return false;
  const coords = g.coordinates as unknown;
  if (!Array.isArray(coords)) return false;
  if (g.type === "LineString") {
    if (
      coords.length < 2 ||
      !(coords as unknown[]).every(isValidPosition)
    )
      return false;
  } else {
    const rings = coords as unknown[];
    if (rings.length === 0) return false;
    for (const ring of rings) {
      if (!Array.isArray(ring) || ring.length < 4) return false;
      if (!(ring as unknown[]).every(isValidPosition)) return false;
    }
  }
  // Geometry type must match kind: pen/line = LineString, rect/circle = Polygon.
  const wantPolygon = kind === "rect" || kind === "circle";
  if ((g.type === "Polygon") !== wantPolygon) return false;
  if (!isValidStyle(feat.style)) return false;
  if (
    typeof feat.createdAt !== "string" ||
    typeof feat.updatedAt !== "string"
  )
    return false;
  if (kind === "circle" && feat.meta !== undefined) {
    const m = feat.meta as Record<string, unknown>;
    if (!isValidPosition(m.center)) return false;
    if (!isFiniteNumber(m.radiusMeters) || m.radiusMeters <= 0)
      return false;
  }
  return true;
}

export interface ImportValidation {
  ok: boolean;
  errors: string[];
  feature?: DrawFeature;
}

function newId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `draw-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

/**
 * Validate one imported GeoJSON feature (spec §2.8): LineString or Polygon
 * with finite in-bounds coords. Auto-closes unclosed polygon rings and
 * assigns a fresh id + createdAt. Pen/line → "line" kind, rect/circle →
 * "rect" kind (circles re-import as rect-kind polygons; meta is dropped).
 */
export function validateImportFeature(
  raw: unknown,
  defaultStyle: DrawStyle
): ImportValidation {
  const errors: string[] = [];
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, errors: ["Not an object."] };
  }
  const f = raw as Record<string, unknown>;
  if (f.type !== "Feature") {
    return { ok: false, errors: ["Not a GeoJSON Feature."] };
  }
  const g = f.geometry as { type?: string; coordinates?: unknown } | null;
  if (!g || (g.type !== "LineString" && g.type !== "Polygon")) {
    return {
      ok: false,
      errors: ["Geometry must be LineString or Polygon."],
    };
  }
  const coords = g.coordinates as unknown[];
  if (!Array.isArray(coords) || coords.length === 0) {
    return { ok: false, errors: ["Empty coordinates."] };
  }
  const now = new Date().toISOString();
  if (g.type === "LineString") {
    if (coords.length < 2 || !coords.every(isValidPosition)) {
      return {
        ok: false,
        errors: ["LineString needs ≥2 finite in-bounds positions."],
      };
    }
    const feature: DrawFeature = {
      id: newId(),
      kind: "line",
      geometry: {
        type: "LineString",
        coordinates: (coords as LngLat[]).map((p) => [p[0], p[1]]),
      },
      style: { ...defaultStyle },
      createdAt: now,
      updatedAt: now,
    };
    return { ok: true, errors, feature };
  }
  // Polygon: validate rings, auto-close unclosed ones.
  const rings: LngLat[][] = [];
  for (const ring of coords) {
    if (!Array.isArray(ring) || ring.length < 3) {
      errors.push("Polygon ring needs ≥3 positions.");
      return { ok: false, errors };
    }
    if (!(ring as unknown[]).every(isValidPosition)) {
      errors.push("Polygon has non-finite or out-of-bounds positions.");
      return { ok: false, errors };
    }
    const clean = (ring as LngLat[]).map(
      (p): LngLat => [p[0], p[1]]
    );
    const first = clean[0];
    const last = clean[clean.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) clean.push([...first] as LngLat);
    rings.push(clean);
  }
  const feature: DrawFeature = {
    id: newId(),
    kind: "rect",
    geometry: { type: "Polygon", coordinates: rings },
    style: { ...defaultStyle },
    createdAt: now,
    updatedAt: now,
  };
  return { ok: true, errors, feature };
}
