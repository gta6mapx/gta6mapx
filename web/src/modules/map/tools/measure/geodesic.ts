// ─── modules/map/tools/measure/geodesic.ts ──────────────────────────
// Pure geodesic math (no MapLibre imports). Written originally for this
// project — no Turf, no vendored code.
//
// Distance: haversine on WGS84 lng/lat, R = 6,371,008.8 m.
//
// Area: SPHERICAL EXCESS via the Chamberlain–Duquette line-integral
// formula — the exact area on a sphere, not planar shoelace (which would
// under-measure large polygons and misbehave on a curved surface).
//
// Accuracy note: WGS84 is an ellipsoid, not a sphere. Treating it as a
// sphere of radius 6,371,008.8 m introduces up to ~0.3% error versus a
// true ellipsoidal calculation. Fine for game-map scale; every result in
// the UI is labeled planimetric/approximate anyway (spec §3.6, §1.6).

import type { MeasureVertex } from "./types";

/** Mean Earth radius, meters (WGS84). */
export const EARTH_RADIUS_M = 6_371_008.8;

const DEG_TO_RAD = Math.PI / 180;

/**
 * Great-circle distance between two [lng, lat] points in meters.
 * Original ~10-line haversine implementation.
 */
export function haversineDistance(
  a: MeasureVertex,
  b: MeasureVertex
): number {
  const lat1 = a[1] * DEG_TO_RAD;
  const lat2 = b[1] * DEG_TO_RAD;
  const dLat = (b[1] - a[1]) * DEG_TO_RAD;
  const dLng = (b[0] - a[0]) * DEG_TO_RAD;
  const sinHalfLat = Math.sin(dLat / 2);
  const sinHalfLng = Math.sin(dLng / 2);
  const h =
    sinHalfLat * sinHalfLat +
    Math.cos(lat1) * Math.cos(lat2) * sinHalfLng * sinHalfLng;
  // Clamp guards the asin domain against float overshoot on antipodal pairs.
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Total geodesic length of a polyline in meters. */
export function polylineLength(vertices: MeasureVertex[]): number {
  let total = 0;
  for (let i = 1; i < vertices.length; i++) {
    total += haversineDistance(vertices[i - 1], vertices[i]);
  }
  return total;
}

/**
 * Polygon area in m² by spherical excess. The ring is implicitly closed
 * (last vertex connects back to the first); absolute value so winding
 * order never flips the sign.
 */
export function sphericalPolygonArea(vertices: MeasureVertex[]): number {
  const n = vertices.length;
  if (n < 3) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const [lng1, lat1] = vertices[i];
    const [lng2, lat2] = vertices[(i + 1) % n];
    const dLng = (lng2 - lng1) * DEG_TO_RAD;
    sum += dLng * (2 + Math.sin(lat1 * DEG_TO_RAD) + Math.sin(lat2 * DEG_TO_RAD));
  }
  return (Math.abs(sum) * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2;
}

/**
 * Spherical centroid: mean of the vertices as 3D unit vectors, projected
 * back to lng/lat. Robust near the antimeridian and poles, unlike a naive
 * lng/lat average. Adequate at game-map scale.
 */
export function sphericalCentroid(
  vertices: MeasureVertex[]
): MeasureVertex | null {
  if (vertices.length === 0) return null;
  let x = 0;
  let y = 0;
  let z = 0;
  for (const [lng, lat] of vertices) {
    const la = lat * DEG_TO_RAD;
    const lo = lng * DEG_TO_RAD;
    x += Math.cos(la) * Math.cos(lo);
    y += Math.cos(la) * Math.sin(lo);
    z += Math.sin(la);
  }
  const len = Math.hypot(x, y, z);
  if (len === 0) return null;
  return [
    Math.atan2(y / len, x / len) / DEG_TO_RAD,
    Math.asin(z / len) / DEG_TO_RAD,
  ];
}

/** Plain arithmetic midpoint of two vertices — adequate for label anchors. */
export function segmentMidpoint(a: MeasureVertex, b: MeasureVertex): MeasureVertex {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}
