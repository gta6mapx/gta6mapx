// ─── modules/map/tools/overlays/userImageOverlay.ts ──────────────────
// User-imported image overlay (spec §4.2c): the user provides the art, we
// provide the tool. Client-local only — files are never uploaded anywhere.
//
// Pipeline: validate (MIME + 10 MB) → SHA-256 of the original file bytes →
// downscale to ≤2048 px longest edge → 3 map clicks + 3 image-corner clicks
// → solve the 3-corner affine → MapLibre image-source coordinates.

import type { ControlPointPair } from "./overlayTypes";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_IMAGE_EDGE = 2048; // px, longest edge after downscale
export const ACCEPTED_IMAGE_MIMES = ["image/png", "image/jpeg"] as const;

export type FileValidationError = "too-big" | "bad-type";

/** null = valid. Safety rails per spec §4.2c. */
export function validateImageFile(file: File): FileValidationError | null {
  if (
    file.type !== ACCEPTED_IMAGE_MIMES[0] &&
    file.type !== ACCEPTED_IMAGE_MIMES[1]
  ) {
    return "bad-type";
  }
  if (file.size > MAX_IMAGE_BYTES) return "too-big";
  return null;
}

/** SHA-256 hex of raw file bytes (used to match re-selected files). */
export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface DownscaledImage {
  /** Object URL of the downscaled file (rendered locally, never uploaded). */
  objectUrl: string;
  /** Downscaled dimensions in px — the space control points live in. */
  width: number;
  height: number;
  downscaled: boolean;
}

/**
 * Decode + downscale to ≤2048 px longest edge via canvas. Throws when the
 * image can't be decoded or canvas 2D is unavailable.
 */
export async function loadAndDownscaleImage(
  file: File
): Promise<DownscaledImage> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(
      1,
      MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height)
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas-2d-unavailable");
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("image-encode-failed"))),
        file.type === ACCEPTED_IMAGE_MIMES[0] ? "image/png" : "image/jpeg",
        0.92
      );
    });
    return {
      objectUrl: URL.createObjectURL(blob),
      width,
      height,
      downscaled: scale < 1,
    };
  } finally {
    bitmap.close();
  }
}

export function revokeImageUrl(objectUrl: string): void {
  try {
    URL.revokeObjectURL(objectUrl);
  } catch {
    /* already revoked — harmless */
  }
}

// ─── 3-corner affine math (pure, no DOM) ────────────────────────────────
// We need the affine map A: image-px → map lng/lat satisfying
//   map_i = M · img_i + t   for i = 1..3
// with M = [[a, b], [c, d]], t = (tx, ty). Three point pairs determine the
// 6 unknowns exactly. The 4th image corner then completes the MapLibre
// image-source quad (topLeft, topRight, bottomRight, bottomLeft).

export type Vec2 = [number, number];

export interface Affine2D {
  a: number;
  b: number;
  tx: number;
  c: number;
  d: number;
  ty: number;
}

/**
 * Solve the exact affine mapping image-px → map lng/lat from 3 control
 * pairs. Throws "degenerate-control-points" when the image points are
 * collinear (det ≈ 0) — e.g. the user clicked 3 points on one line.
 */
export function solveAffine(
  pairs: [ControlPointPair, ControlPointPair, ControlPointPair]
): Affine2D {
  const [p1, p2, p3] = pairs;
  const qx1 = p2.img[0] - p1.img[0];
  const qy1 = p2.img[1] - p1.img[1];
  const qx2 = p3.img[0] - p1.img[0];
  const qy2 = p3.img[1] - p1.img[1];
  const det = qx1 * qy2 - qx2 * qy1;
  if (Math.abs(det) < 1e-9) throw new Error("degenerate-control-points");

  // Inverse of the image-space basis matrix [[qx1, qx2], [qy1, qy2]],
  // applied to the map-space deltas.
  const inv11 = qy2 / det;
  const inv12 = -qx2 / det;
  const inv21 = -qy1 / det;
  const inv22 = qx1 / det;

  const mx1 = p2.map[0] - p1.map[0];
  const my1 = p2.map[1] - p1.map[1];
  const mx2 = p3.map[0] - p1.map[0];
  const my2 = p3.map[1] - p1.map[1];

  const a = mx1 * inv11 + mx2 * inv21;
  const b = mx1 * inv12 + mx2 * inv22;
  const c = my1 * inv11 + my2 * inv21;
  const d = my1 * inv12 + my2 * inv22;
  const tx = p1.map[0] - (a * p1.img[0] + b * p1.img[1]);
  const ty = p1.map[1] - (c * p1.img[0] + d * p1.img[1]);
  return { a, b, tx, c, d, ty };
}

export function applyAffine(t: Affine2D, x: number, y: number): Vec2 {
  return [t.a * x + t.b * y + t.tx, t.c * x + t.d * y + t.ty];
}

/**
 * Image rectangle corners (width × height px) → MapLibre image-source
 * coordinates in order [topLeft, topRight, bottomRight, bottomLeft],
 * where topLeft = image pixel (0,0). The 4th corner is computed by affine
 * completion — no extra click needed.
 */
export function imageCornersToLngLat(
  pairs: [ControlPointPair, ControlPointPair, ControlPointPair],
  width: number,
  height: number
): [Vec2, Vec2, Vec2, Vec2] {
  const t = solveAffine(pairs);
  return [
    applyAffine(t, 0, 0),
    applyAffine(t, width, 0),
    applyAffine(t, width, height),
    applyAffine(t, 0, height),
  ];
}

// ─── Placement state machine (steps 1–6) ───────────────────────────────
// Steps 1–3: click points on the map. Steps 4–6: click the matching corners
// on the image preview. Order is enforced — map points must complete before
// image corners can be collected.

export type PlacementStep = 1 | 2 | 3 | 4 | 5 | 6;

export interface PlacementState {
  /** Object URL of the downscaled image (preview + final render). */
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  fileHash: string;
  fileName: string;
  /** Set when re-placing an existing entry (hash mismatch re-select). */
  targetEntryId: string | null;
  mapPoints: Vec2[];
  imagePoints: Vec2[];
}

export function createPlacementState(args: {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  fileHash: string;
  fileName: string;
  targetEntryId?: string | null;
}): PlacementState {
  return {
    imageUrl: args.imageUrl,
    imageWidth: args.imageWidth,
    imageHeight: args.imageHeight,
    fileHash: args.fileHash,
    fileName: args.fileName,
    targetEntryId: args.targetEntryId ?? null,
    mapPoints: [],
    imagePoints: [],
  };
}

/** Current step, or null once all 6 points are collected. */
export function placementStep(p: PlacementState): PlacementStep | null {
  if (p.mapPoints.length < 3)
    return (p.mapPoints.length + 1) as PlacementStep;
  if (p.imagePoints.length < 3)
    return (p.imagePoints.length + 4) as PlacementStep;
  return null;
}

export function isPlacementComplete(p: PlacementState): boolean {
  return placementStep(p) === null;
}

/** Add a map click (steps 1–3). Returns false when not in the map phase. */
export function addPlacementMapPoint(
  p: PlacementState,
  point: Vec2
): PlacementState {
  if (p.mapPoints.length >= 3) return p;
  return { ...p, mapPoints: [...p.mapPoints, point] };
}

/** Add an image-corner click (steps 4–6). Returns false when not in the
 *  image phase. */
export function addPlacementImagePoint(
  p: PlacementState,
  point: Vec2
): PlacementState | null {
  if (p.mapPoints.length < 3 || p.imagePoints.length >= 3) return null;
  return { ...p, imagePoints: [...p.imagePoints, point] };
}

export function placementControlPoints(
  p: PlacementState
): [ControlPointPair, ControlPointPair, ControlPointPair] | null {
  if (!isPlacementComplete(p)) return null;
  return [0, 1, 2].map((i) => ({
    map: p.mapPoints[i],
    img: p.imagePoints[i],
  })) as [ControlPointPair, ControlPointPair, ControlPointPair];
}

/** Strip the extension for a readable default entry name. */
export function defaultEntryName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  const dot = base.lastIndexOf(".");
  const name = (dot > 0 ? base.slice(0, dot) : base).trim();
  return name.length > 0 ? name : "Imported image";
}
