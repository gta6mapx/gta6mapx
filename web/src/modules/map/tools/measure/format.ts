// ─── modules/map/tools/measure/format.ts ────────────────────────────
// Pure unit formatting, EXACTLY per spec §3.5:
//
//   Metric    | <1000 m → `850 m` (int)        | ≥1000 m → `1.24 km` (2dp)
//             | <1,000,000 m² → `45,200 m²`    | ≥ → `1.24 km²` (2dp)
//   Imperial  | <1 mi → `2,789 ft` (int)       | ≥1 mi → `1.24 mi` (2dp)
//             | <1 mi² → `486,000 ft²`         | ≥ → `2.31 mi²` (2dp)
//
// Rounding is half-up, separators are en-US. Copy text mirrors the chip
// exactly — both go through these same functions.

import type { Units } from "./types";
import { polylineLength, sphericalPolygonArea } from "./geodesic";
import type { Measurement } from "./types";

const M_PER_MI = 1609.344;
const FT_PER_M = 1 / 0.3048;
/** ft² per mi² (spec §3.5). */
const FT2_PER_MI2 = 27_878_400;

/** Half-up rounding to an integer. */
function roundInt(x: number): number {
  return Math.sign(x) * Math.round(Math.abs(x) + Number.EPSILON);
}

/** Half-up rounding to 2 decimal places. */
function round2(x: number): number {
  return Math.sign(x) * (Math.round(Math.abs(x) * 100 + Number.EPSILON) / 100);
}

function intPart(n: number): string {
  return roundInt(n).toLocaleString("en-US");
}

function twoDp(n: number): string {
  return round2(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format a distance in meters for display. */
export function formatDistance(meters: number, units: Units): string {
  if (units === "metric") {
    return meters < 1000 ? `${intPart(meters)} m` : `${twoDp(meters / 1000)} km`;
  }
  const feet = meters * FT_PER_M;
  const miles = meters / M_PER_MI;
  return miles < 1 ? `${intPart(feet)} ft` : `${twoDp(miles)} mi`;
}

/** Format an area in m² for display. */
export function formatArea(sqMeters: number, units: Units): string {
  if (units === "metric") {
    return sqMeters < 1_000_000
      ? `${intPart(sqMeters)} m²`
      : `${twoDp(sqMeters / 1_000_000)} km²`;
  }
  const sqFeet = sqMeters * FT_PER_M * FT_PER_M;
  return sqFeet < FT2_PER_MI2
    ? `${intPart(sqFeet)} ft²`
    : `${twoDp(sqFeet / FT2_PER_MI2)} mi²`;
}

/**
 * The chip/copy text for a finished measurement: total recomputed from raw
 * vertices in the requested units. Identical string feeds the map chip,
 * the panel row, and the clipboard.
 */
export function formatMeasurement(
  m: Pick<Measurement, "kind" | "vertices">,
  units: Units
): string {
  return m.kind === "distance"
    ? formatDistance(polylineLength(m.vertices), units)
    : formatArea(sphericalPolygonArea(m.vertices), units);
}
