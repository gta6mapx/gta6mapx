// ─── modules/map/tools/overlays/overlayTypes.ts ───────────────────────
// Registry entry types (spec §4.1). Framework-agnostic: no React, no
// MapLibre imports — the registry and renderer both build on these.

/** Overlay flavor. "reference" is reserved for openly-licensed comparison
 *  art; the real-Florida base style already covers the OSM reference, so
 *  nothing is registered as "reference" in v1 (see tileVersionOverlays.ts). */
export type OverlayKind = "tile-version" | "user-import" | "reference";

export interface ControlPointPair {
  /** Map corner in [lng, lat] (WGS84, ground plane — spec §1.6). */
  map: [number, number];
  /** Image corner in [x, y] pixels, measured in the *downscaled* image. */
  img: [number, number];
}

export interface UserImportMeta {
  /** Exactly 3 pairs (3-corner affine — spec §4.2c). */
  controlPoints: [ControlPointPair, ControlPointPair, ControlPointPair];
  /** SHA-256 hex of the original file bytes (never the file itself). */
  fileHash: string;
  fileName: string;
  /** Downscaled image dimensions in px (the space control points live in). */
  width: number;
  height: number;
}

export interface TileVersionMeta {
  /** Raster tiles URL template, e.g. https://…/{z}/{x}/{y}.png */
  tileUrlTemplate: string;
  attribution: string;
  minzoom?: number;
  maxzoom?: number;
  tileSize?: number;
}

export type OverlayMeta = TileVersionMeta | UserImportMeta | null;

export interface OverlayEntry {
  /** e.g. "leonida-v1", "user-import-<hash8>". Never duplicated. */
  id: string;
  name: string;
  kind: OverlayKind;
  visible: boolean;
  /** 0–100, maps to raster-opacity = opacity / 100. */
  opacity: number;
  /** Registry position; 0 = bottom of the overlays stack. */
  order: number;
  meta: OverlayMeta;
}

/** Prefix for every MapLibre id this slice owns — safe to sweep. */
export const OVERLAY_ID_PREFIX = "gta6mapx-ovl";

export function overlaySourceId(id: string): string {
  return `${OVERLAY_ID_PREFIX}-src-${id}`;
}

export function overlayLayerId(id: string): string {
  return `${OVERLAY_ID_PREFIX}-${id}`;
}

export const DEFAULT_OVERLAY_OPACITY = 70;
export const MAX_OVERLAYS = 25;

export function isUserImportMeta(meta: OverlayMeta): meta is UserImportMeta {
  return (
    meta !== null &&
    "controlPoints" in meta &&
    Array.isArray((meta as UserImportMeta).controlPoints) &&
    typeof (meta as UserImportMeta).fileHash === "string"
  );
}

export function isTileVersionMeta(meta: OverlayMeta): meta is TileVersionMeta {
  return (
    meta !== null &&
    "tileUrlTemplate" in meta &&
    typeof (meta as TileVersionMeta).tileUrlTemplate === "string"
  );
}

export function clampOpacity(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_OVERLAY_OPACITY;
  return Math.min(100, Math.max(0, Math.round(value)));
}
