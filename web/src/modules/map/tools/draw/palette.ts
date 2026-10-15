// ─── modules/map/tools/draw/palette.ts ──────────────────────────────────
// Neon drawing palette (spec §1.7): 8 swatches, default style, recent
// colors (last 6, persisted), and style → MapLibre paint converters.

import type { DrawStyle } from "./types";

export interface Swatch {
  name: string;
  hex: string;
}

/** 8 locked neon swatches (spec §1.7). */
export const NEON_SWATCHES: readonly Swatch[] = [
  { name: "Neon Pink", hex: "#FF2E88" },
  { name: "Sunset Orange", hex: "#FF7A18" },
  { name: "Electric Cyan", hex: "#22D3EE" },
  { name: "Miami Teal", hex: "#00F5D4" },
  { name: "Purple Haze", hex: "#A855F7" },
  { name: "Laser Lemon", hex: "#FACC15" },
  { name: "Ghost White", hex: "#F8FAFC" },
  { name: "Void Black", hex: "#0B0B10" },
];

/** Default style for new drawings (spec §2.2). */
export const DEFAULT_DRAW_STYLE: DrawStyle = {
  color: "#FF2E88",
  thickness: 3,
  opacity: 90,
  fill: true,
  fillOpacity: 20,
};

/** Selection highlight color (data-driven `case` branch). */
export const SELECTION_HIGHLIGHT = "#FFFFFF";

const RECENT_KEY = "gta6mapx.draw.recent-colors.v1";
const RECENT_MAX = 6;

function isHexColor(v: unknown): v is string {
  return (
    typeof v === "string" && /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(v)
  );
}

function normalizeHex(hex: string): string {
  return hex.toUpperCase();
}

/** Load persisted recent colors (last 6, most-recent first). Client-only. */
export function loadRecentColors(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isHexColor)
      .map(normalizeHex)
      .slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

/**
 * Push a color to the front of the recent list (dedupe, cap 6, persist).
 * Returns the new list.
 */
export function pushRecentColor(hex: string): string[] {
  if (!isHexColor(hex)) return loadRecentColors();
  const next = [
    normalizeHex(hex),
    ...loadRecentColors().filter(
      (c) => c !== normalizeHex(hex)
    ),
  ].slice(0, RECENT_MAX);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Quota or privacy mode — recent colors are a nicety, not critical.
  }
  return next;
}

// ─── Style → paint converters ────────────────────────────────────────────
// Features flatten style into GeoJSON properties (see layers.ts); these
// converters build the data-driven paint expressions from a DrawStyle for
// the ephemeral preview source (which shares the same property shape).

/** Clamp a 0–100 slider value and express as 0–1 for paint-opacity. */
function opacity01(v: number): number {
  return Math.min(100, Math.max(0, v)) / 100;
}

export function styleToLinePaint(style: DrawStyle): Record<string, unknown> {
  return {
    "line-color": style.color,
    "line-width": Math.min(12, Math.max(1, Math.round(style.thickness))),
    "line-opacity": opacity01(style.opacity),
  };
}

export function styleToFillPaint(style: DrawStyle): Record<string, unknown> {
  return {
    "fill-color": style.color,
    // Fill opacity is its own slider (spec §2.2); the master opacity
    // slider governs the stroke.
    "fill-opacity": opacity01(style.fillOpacity),
  };
}

/**
 * Flatten a DrawStyle into GeoJSON feature properties for data-driven
 * paint on the committed `drawings-src` source.
 */
export function styleToProperties(
  style: DrawStyle,
  kind: "pen" | "line" | "rect" | "circle"
): Record<string, string | number | boolean> {
  const closed = kind === "rect" || kind === "circle";
  return {
    kind,
    closed,
    color: style.color,
    thickness: Math.min(12, Math.max(1, Math.round(style.thickness))),
    opacity: opacity01(style.opacity),
    filled: closed && style.fill,
    fillOpacity: opacity01(style.fillOpacity),
  };
}
