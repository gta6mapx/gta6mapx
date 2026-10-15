// ─── modules/map/tools/share/shareCodec.ts ─────────────────────────────
// Pure encode/decode for the "#a=<payload>" shared-annotations fragment.
// DOM-free: safe to import in Node acceptance tests.
//
// Payload design (compact, URL-safe):
//  - ShareDoc JSON → UTF-8 bytes → base64url (no padding).
//  - Coordinates rounded to 4 decimals (~11 m, the same anti-false-precision
//    rule deepLink uses) — shared positions are approximate by construction.
//  - The IMAGE FILE is never encoded: user-import overlays carry only their
//    3 control-point pairs + file hash, so a recipient with the same file
//    re-selects it and the placement restores (hash match).
//  - Cap: ~150 drawings+measurements total (newest win); overlays are few
//    (registry cap 25) and always included whole.

import type { DrawFeature, DrawToolKind } from "../draw/types";
import type { Measurement, MeasureKind } from "../measure/types";
import type {
  ControlPointPair,
  OverlayEntry,
} from "../overlays/overlayTypes";

export const MAX_SHARED_ITEMS = 150;

/** 4-dp rounding — matches deepLink's anti-false-precision rule. */
function r4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}
function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

type Coord = [number, number];

// ─── Wire shapes (compact keys; documented here) ────────────────────────

export interface SharedDrawStyle {
  /** color hex */ c: string;
  /** thickness px */ t: number;
  /** opacity 0-100 */ o: number;
  /** fill */ f: boolean;
  /** fillOpacity 0-100 */ fo: number;
}

export interface SharedDrawItem {
  kind: DrawToolKind;
  /** rounded geometry */ g: GeoJSON.LineString | GeoJSON.Polygon;
  s: SharedDrawStyle;
  /** circle meta: center + radius, rounded */ m?: { c: Coord; r: number };
  /** createdAt, epoch seconds */ t: number;
}

export interface SharedMeasureItem {
  kind: MeasureKind;
  /** rounded [lng,lat] vertices */ v: Coord[];
  u: "metric" | "imperial";
  /** createdAt, epoch seconds */ t: number;
}

export type SharedOverlayItem =
  | {
      k: "user-import";
      name: string;
      vis: boolean;
      op: number;
      /** 3 control-point pairs, rounded */ cp: [
        ControlPointPair,
        ControlPointPair,
        ControlPointPair,
      ];
      /** sha-256 hex of the original file (placement restore only) */ fh: string;
      fn: string;
      w: number;
      h: number;
    }
  | { k: "tile-version"; id: string; vis: boolean; op: number };

export interface ShareDoc {
  v: 1;
  /** newest first */ d: SharedDrawItem[];
  /** newest first */ m: SharedMeasureItem[];
  o: SharedOverlayItem[];
}

// ─── Build ───────────────────────────────────────────────────────────────

function epochSec(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.floor(t / 1000) : 0;
}

function toSharedDraw(f: DrawFeature): SharedDrawItem {
  const g = f.geometry;
  const rounded =
    g.type === "LineString"
      ? {
          type: "LineString" as const,
          coordinates: g.coordinates.map((p) => [r4(p[0]), r4(p[1])] as Coord),
        }
      : {
          type: "Polygon" as const,
          coordinates: g.coordinates.map((ring) =>
            ring.map((p) => [r4(p[0]), r4(p[1])] as Coord)
          ),
        };
  const item: SharedDrawItem = {
    kind: f.kind,
    g: rounded,
    s: {
      c: f.style.color,
      t: f.style.thickness,
      o: f.style.opacity,
      f: f.style.fill,
      fo: f.style.fillOpacity,
    },
    t: epochSec(f.createdAt),
  };
  if (f.meta) {
    item.m = { c: [r4(f.meta.center[0]), r4(f.meta.center[1])], r: r1(f.meta.radiusMeters) };
  }
  return item;
}

function toSharedMeasure(m: Measurement): SharedMeasureItem {
  return {
    kind: m.kind,
    v: m.vertices.map((p) => [r4(p[0]), r4(p[1])] as Coord),
    u: m.unit,
    t: epochSec(m.createdAt),
  };
}

function toSharedOverlay(e: OverlayEntry): SharedOverlayItem | null {
  const op = Math.min(100, Math.max(0, Math.round(e.opacity)));
  const meta = e.meta;
  if (meta && "controlPoints" in meta && Array.isArray((meta as { controlPoints?: unknown }).controlPoints)) {
    const um = meta as {
      controlPoints: [ControlPointPair, ControlPointPair, ControlPointPair];
      fileHash: string;
      fileName: string;
      width: number;
      height: number;
    };
    const cp = um.controlPoints.map((p) => ({
      map: [r4(p.map[0]), r4(p.map[1])] as Coord,
      img: [r1(p.img[0]), r1(p.img[1])] as Coord,
    })) as [ControlPointPair, ControlPointPair, ControlPointPair];
    return {
      k: "user-import",
      name: e.name.slice(0, 80),
      vis: e.visible,
      op,
      cp,
      fh: typeof um.fileHash === "string" ? um.fileHash.slice(0, 64) : "",
      fn: typeof um.fileName === "string" ? um.fileName.slice(0, 120) : "",
      w: um.width,
      h: um.height,
    };
  }
  if (meta && "tileUrlTemplate" in meta) {
    return { k: "tile-version", id: e.id, vis: e.visible, op };
  }
  return null;
}

/**
 * Build the share doc from live slice state. Drawings + measurements are
 * merged newest-first and capped at MAX_SHARED_ITEMS (oldest dropped);
 * overlays are always included whole. Returns the truncation count so the
 * UI can be honest about it.
 */
export function buildShareDoc(
  drawings: DrawFeature[],
  measurements: Measurement[],
  overlays: OverlayEntry[]
): { doc: ShareDoc; truncated: number } {
  const d = drawings.map(toSharedDraw).sort((a, b) => b.t - a.t);
  const m = measurements.map(toSharedMeasure).sort((a, b) => b.t - a.t);
  // Merge newest-first across both kinds for a fair cap.
  const merged: Array<{ t: number; kind: "d" | "m"; idx: number }> = [
    ...d.map((it, idx) => ({ t: it.t, kind: "d" as const, idx })),
    ...m.map((it, idx) => ({ t: it.t, kind: "m" as const, idx })),
  ].sort((a, b) => b.t - a.t);
  const kept = merged.slice(0, MAX_SHARED_ITEMS);
  const keepD = new Set(kept.filter((k) => k.kind === "d").map((k) => k.idx));
  const keepM = new Set(kept.filter((k) => k.kind === "m").map((k) => k.idx));
  const doc: ShareDoc = {
    v: 1,
    d: d.filter((_, i) => keepD.has(i)),
    m: m.filter((_, i) => keepM.has(i)),
    o: overlays.map(toSharedOverlay).filter((o): o is SharedOverlayItem => o !== null),
  };
  return { doc, truncated: merged.length - kept.length };
}

/** True when there is anything worth sharing. */
export function isShareDocEmpty(doc: ShareDoc): boolean {
  return doc.d.length === 0 && doc.m.length === 0 && doc.o.length === 0;
}

// ─── base64url ───────────────────────────────────────────────────────────

export function b64urlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeSharePayload(doc: ShareDoc): string {
  return b64urlEncode(JSON.stringify(doc));
}

// ─── Decode + validate (never throws; null = ignore the link) ───────────

function isCoord(p: unknown): p is Coord {
  return (
    Array.isArray(p) &&
    p.length === 2 &&
    p.every((n) => typeof n === "number" && Number.isFinite(n)) &&
    Math.abs((p as number[])[0]) <= 180 &&
    Math.abs((p as number[])[1]) <= 90
  );
}

const DRAW_KINDS = new Set(["pen", "line", "rect", "circle"]);

function isSharedDrawItem(v: unknown): v is SharedDrawItem {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  if (!DRAW_KINDS.has(o.kind as string)) return false;
  const g = o.g as { type?: unknown; coordinates?: unknown } | undefined;
  if (!g || (g.type !== "LineString" && g.type !== "Polygon")) return false;
  if (!Array.isArray(g.coordinates) || g.coordinates.length === 0) return false;
  const flat: unknown[] =
    g.type === "LineString"
      ? (g.coordinates as unknown[])
      : (g.coordinates as unknown[][]).flat();
  if (flat.length < 2 || !flat.every(isCoord)) return false;
  const s = o.s as Record<string, unknown> | undefined;
  if (
    !s ||
    typeof s.c !== "string" ||
    !/^#[0-9a-fA-F]{6}$/.test(s.c) ||
    typeof s.t !== "number" ||
    typeof s.o !== "number" ||
    typeof s.f !== "boolean" ||
    typeof s.fo !== "number"
  ) {
    return false;
  }
  if (o.m !== undefined) {
    const meta = o.m as { c?: unknown; r?: unknown };
    if (!isCoord(meta.c) || typeof meta.r !== "number" || !(meta.r > 0)) return false;
  }
  return typeof o.t === "number" && Number.isFinite(o.t);
}

function isSharedMeasureItem(v: unknown): v is SharedMeasureItem {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    (o.kind === "distance" || o.kind === "area") &&
    Array.isArray(o.v) &&
    (o.v as unknown[]).length >= 2 &&
    (o.v as unknown[]).every(isCoord) &&
    (o.u === "metric" || o.u === "imperial") &&
    typeof o.t === "number" &&
    Number.isFinite(o.t)
  );
}

function isControlPointPair(v: unknown): v is ControlPointPair {
  if (typeof v !== "object" || v === null) return false;
  const o = v as { map?: unknown; img?: unknown };
  return (
    Array.isArray(o.map) &&
    o.map.length === 2 &&
    (o.map as unknown[]).every((n) => typeof n === "number" && Number.isFinite(n)) &&
    Math.abs((o.map as number[])[0]) <= 180 &&
    Math.abs((o.map as number[])[1]) <= 90 &&
    Array.isArray(o.img) &&
    o.img.length === 2 &&
    (o.img as unknown[]).every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

function isSharedOverlayItem(v: unknown): v is SharedOverlayItem {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  if (o.k === "user-import") {
    return (
      typeof o.name === "string" &&
      typeof o.vis === "boolean" &&
      typeof o.op === "number" &&
      Array.isArray(o.cp) &&
      (o.cp as unknown[]).length === 3 &&
      (o.cp as unknown[]).every(isControlPointPair) &&
      typeof o.fh === "string" &&
      typeof o.fn === "string" &&
      typeof o.w === "number" &&
      o.w > 0 &&
      typeof o.h === "number" &&
      o.h > 0
    );
  }
  if (o.k === "tile-version") {
    return (
      typeof o.id === "string" &&
      o.id.length > 0 &&
      typeof o.vis === "boolean" &&
      typeof o.op === "number"
    );
  }
  return false;
}

/**
 * Decode a "#a=" payload. Returns the validated doc, or null when the
 * payload is missing/malformed — the caller toasts and ignores it.
 */
export function decodeSharePayload(raw: string): ShareDoc | null {
  try {
    if (!raw || raw.length > 200_000) return null;
    if (!/^[A-Za-z0-9\-_]+$/.test(raw)) return null;
    const doc = JSON.parse(b64urlDecode(raw)) as Partial<ShareDoc>;
    if (!doc || doc.v !== 1) return null;
    if (
      !Array.isArray(doc.d) ||
      !Array.isArray(doc.m) ||
      !Array.isArray(doc.o) ||
      doc.d.length + doc.m.length + doc.o.length > MAX_SHARED_ITEMS + 25 ||
      !doc.d.every(isSharedDrawItem) ||
      !doc.m.every(isSharedMeasureItem) ||
      !doc.o.every(isSharedOverlayItem)
    ) {
      return null;
    }
    return doc as ShareDoc;
  } catch {
    return null;
  }
}
