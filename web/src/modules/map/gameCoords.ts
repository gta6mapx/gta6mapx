/**
 * gameCoords.ts — the single coordinate-truth module for GTA6mapx.
 *
 * All conversions between the game-world frame (GX/GY units) and the map
 * frame (lat/lng), plus the anti-false-precision display policy.
 *
 * NO other UI module may format coordinates directly — every coordinate
 * surface (HUD, search, deep links, detail panel, entity pages) must go
 * through this module's format and parse helpers.
 *
 * The transform is a versioned data artifact (data/transform.vN.json),
 * fitted clean-room from staging data. A Phase C re-fit bumps the JSON
 * only — zero consumer code changes — and the precision ladder below
 * auto-tightens displays when rmseKm drops.
 *
 * Pure TypeScript: no React, no maplibre imports.
 */

import transformData from "./data/transform.v1.json";

/** Shape of the versioned transform artifact. */
interface TransformArtifact {
  version: string;
  model: string;
  forward: { a: number; b: number; c: number; d: number; e: number; f: number };
  inverse: {
    ia: number;
    ib: number;
    ic: number;
    id: number;
    ie: number;
    if: number;
  };
  rmseKm: number;
  maxHeldOutErrorKm: number;
  fittedAgainst: string;
  datasetCommit: string;
  controlPointCount: number;
  controlPoints: string[];
  generatedAt: string;
}

const T = transformData as TransformArtifact;

/** Validated game-unit zone for the v1 fit (extrapolating outside is allowed but labeled). */
export const GAME_WORLD_BOUNDS = {
  xMin: -3582.025,
  xMax: 2706.725,
  yMin: -1384.7,
  yMax: 3168.1,
} as const;

/** Proper minus sign (U+2212) — used in DISPLAY strings only, never in URLs. */
const MINUS = "\u2212";

export interface MapPoint {
  lat: number;
  lng: number;
  quality: "verified" | "approximate";
}

/**
 * Precision ladder, keyed off the transform's RMSE so a better fit (v2+)
 * automatically tightens every display surface.
 *
 * v1 (rmse 5.413 km) → lat/lng at 2 decimals, game X/Y at nearest 100,
 * always ~-prefixed. The competitor-style `X: -3407.500` format is banned.
 */
interface PrecisionTier {
  latDecimals: number;
  gameStep: number;
  tilde: boolean;
}

function precisionTier(): PrecisionTier {
  const rmse = T.rmseKm;
  if (rmse < 0.1) return { latDecimals: 4, gameStep: 1, tilde: false };
  if (rmse < 1) return { latDecimals: 3, gameStep: 10, tilde: true };
  // 1–5 km and > 5 km (v1): 2 decimals / nearest 100 / always ~
  return { latDecimals: 2, gameStep: 100, tilde: true };
}

/** Forward affine: game (x, y) → map (lat, lng). */
export function gameToMap(
  x: number,
  y: number,
  needCoordVerification = false,
): MapPoint {
  const { a, b, c, d, e, f } = T.forward;
  const lat = a * x + b * y + c;
  const lng = d * x + e * y + f;
  const outsideBounds =
    x < GAME_WORLD_BOUNDS.xMin ||
    x > GAME_WORLD_BOUNDS.xMax ||
    y < GAME_WORLD_BOUNDS.yMin ||
    y > GAME_WORLD_BOUNDS.yMax;
  return {
    lat,
    lng,
    quality: needCoordVerification || outsideBounds ? "approximate" : "verified",
  };
}

/** Inverse (precomputed coefficients): map (lat, lng) → game (x, y). */
export function mapToGame(lat: number, lng: number): { x: number; y: number } {
  const { ia, ib, ic, id, ie, if: fi } = T.inverse;
  return {
    x: ia * lat + ib * lng + ic,
    y: id * lat + ie * lng + fi,
  };
}

/** Transform metadata for HUD footnotes and diagnostics. */
export function getTransformInfo(): {
  version: string;
  rmseKm: number;
  maxErrKm: number;
} {
  return {
    version: T.version,
    rmseKm: T.rmseKm,
    maxErrKm: T.maxHeldOutErrorKm,
  };
}

/** Round to the ladder's game-unit step, normalizing -0 → 0. */
function roundGameStep(v: number, step: number): number {
  const rounded = Math.round(v / step) * step;
  return rounded === 0 ? 0 : rounded;
}

/** Signed integer string using U+2212 for negatives (display only). */
function signedInt(v: number): string {
  return v < 0 ? MINUS + String(Math.abs(v)) : String(v);
}

/** Game-unit value with the ladder's ~ prefix (display only). */
function gameValue(v: number, tier: PrecisionTier): string {
  const body = signedInt(roundGameStep(v, tier.gameStep));
  return tier.tilde ? `~${body}` : body;
}

/** Decimal lat/lng value with U+2212 for negatives (display only). */
function signedDecimal(v: number, decimals: number): string {
  const threshold = 0.5 * Math.pow(10, -decimals);
  if (Math.abs(v) < threshold) return (0).toFixed(decimals);
  const neg = v < 0;
  return (neg ? MINUS : "") + Math.abs(v).toFixed(decimals);
}

/** ASCII decimal (for lat/lng display where the example uses hyphens). */
function plainDecimal(v: number, decimals: number): string {
  const threshold = 0.5 * Math.pow(10, -decimals);
  const norm = Math.abs(v) < threshold ? 0 : v;
  return norm.toFixed(decimals);
}

/**
 * Map-frame lat/lng for DISPLAY. v1: "≈25.76, -80.19".
 * Never use for URLs — use formatShareLatLng instead.
 */
export function formatLatLng(lat: number, lng: number): string {
  const tier = precisionTier();
  return `≈${plainDecimal(lat, tier.latDecimals)}, ${plainDecimal(
    lng,
    tier.latDecimals,
  )}`;
}

/**
 * Game-frame X/Y for DISPLAY. v1: "~−3400, ~−2800".
 * Always ~-prefixed and never with decimals at v1 accuracy.
 */
export function formatGameXY(x: number, y: number): string {
  const tier = precisionTier();
  return `${gameValue(x, tier)}, ${gameValue(y, tier)}`;
}

/**
 * Map-frame lat/lng for SHARE URLs only. "25.7617,-80.1918".
 * ASCII hyphens (URL-safe), no precision prefix, never displayed as a
 * precision claim. Stable across transform re-fits by design.
 */
export function formatShareLatLng(lat: number, lng: number): string {
  return `${plainDecimal(lat, 4)},${plainDecimal(lng, 4)}`;
}

/** HUD footnote — derived from the artifact so it stays honest after re-fits. */
export function fitFootnote(): string {
  const info = getTransformInfo();
  const err =
    info.rmseKm >= 1 ? `±${Math.round(info.rmseKm)} km` : `±${info.rmseKm.toFixed(1)} km`;
  return `Map fit ${info.version} · ${err}`;
}

/**
 * Honest single-line coordinate string for copy buttons, e.g.
 * "~GX −3400, ~GY −2800 (≈25.76, −80.19)".
 */
export function honestCoordString(lat: number, lng: number): string {
  const { x, y } = mapToGame(lat, lng);
  const tier = precisionTier();
  const gx = signedInt(roundGameStep(x, tier.gameStep));
  const gy = signedInt(roundGameStep(y, tier.gameStep));
  const ll = `${signedDecimal(lat, tier.latDecimals)}, ${signedDecimal(
    lng,
    tier.latDecimals,
  )}`;
  return `~GX ${gx}, ~GY ${gy} (≈${ll})`;
}

const NUM = "-?\\d+(?:\\.\\d+)?";

interface ParsedInput {
  lat: number;
  lng: number;
  kind: "latlng" | "gamexy";
}

function inLatLngRange(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/** Game-XY acceptance zone: validated bounds widened by 50% margin. Out → null. */
function inGameRange(x: number, y: number): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const xMargin = 0.5 * (GAME_WORLD_BOUNDS.xMax - GAME_WORLD_BOUNDS.xMin);
  const yMargin = 0.5 * (GAME_WORLD_BOUNDS.yMax - GAME_WORLD_BOUNDS.yMin);
  return (
    x >= GAME_WORLD_BOUNDS.xMin - xMargin &&
    x <= GAME_WORLD_BOUNDS.xMax + xMargin &&
    y >= GAME_WORLD_BOUNDS.yMin - yMargin &&
    y <= GAME_WORLD_BOUNDS.yMax + yMargin
  );
}

/**
 * Parse a coordinate search input. Accepts:
 * - map frame: "25.76, -80.19", "25.76 -80.19", "lat:25.76 lng:-80.19"
 * - game frame: "-3400, -2800", "x:-3400 y:-2800" (converted via gameToMap,
 *   range-checked against bounds ±50%; out → null)
 * Bare single numbers return null — never guess.
 * Ambiguous pairs valid as lat/lng are read as lat/lng (game frame needs
 * the x:/y: labels or clearly out-of-lat/lng-range values).
 */
export function parseCoordinateInput(raw: string): ParsedInput | null {
  const input = raw.trim();
  if (!input) return null;

  const latLngLabeled = new RegExp(
    `^lat\\s*[:=]\\s*(${NUM})\\s*(?:,|\\s)\\s*lng\\s*[:=]\\s*(${NUM})$`,
    "i",
  ).exec(input);
  if (latLngLabeled) {
    const lat = Number(latLngLabeled[1]);
    const lng = Number(latLngLabeled[2]);
    if (inLatLngRange(lat, lng)) return { lat, lng, kind: "latlng" };
    return null;
  }

  const gameLabeled = new RegExp(
    `^x\\s*[:=]\\s*(${NUM})\\s*(?:,|\\s)\\s*y\\s*[:=]\\s*(${NUM})$`,
    "i",
  ).exec(input);
  if (gameLabeled) {
    const x = Number(gameLabeled[1]);
    const y = Number(gameLabeled[2]);
    if (!inGameRange(x, y)) return null;
    const { lat, lng } = gameToMap(x, y);
    return { lat, lng, kind: "gamexy" };
  }

  const parts = input.split(/[,\s]+/).filter(Boolean);
  if (parts.length !== 2) return null; // bare single number → null, never guess
  const first = Number(parts[0]);
  const second = Number(parts[1]);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;

  if (inLatLngRange(first, second)) return { lat: first, lng: second, kind: "latlng" };
  if (inGameRange(first, second)) {
    const { lat, lng } = gameToMap(first, second);
    return { lat, lng, kind: "gamexy" };
  }
  return null;
}
