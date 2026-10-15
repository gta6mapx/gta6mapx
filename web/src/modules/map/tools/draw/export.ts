// ─── modules/map/tools/draw/export.ts ───────────────────────────────────
// PNG render-once capture, GeoJSON export, GeoJSON import (spec §2.8).
// Pure helpers where possible; map-dependent PNG capture takes the map.

import type { Map as MapLibreMap } from "maplibre-gl";
import type { DrawFeature, DrawStyle } from "./types";
import { validateImportFeature } from "./geometry";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local-time stamp: YYYYMMDD-HHmm (PNG) / YYYYMMDD (GeoJSON). */
function stamp(d: Date, withTime: boolean): string {
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  return withTime ? `${date}-${pad(d.getHours())}${pad(d.getMinutes())}` : date;
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after the click has been dispatched.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── PNG (render-once, spec §2.8) ─────────────────────────────────────────
// The map is created WITHOUT preserveDrawingBuffer (permanent GPU/
// compositor cost for a rare action). Instead: arm a one-shot "render"
// listener, force a repaint, and capture the canvas synchronously inside
// the handler — the drawing buffer is still valid at that point.
// Captures the WebGL canvas only (map + drawings), not DOM HUD.
// Documented fallback: if render-once ever returns blank on a platform,
// flip preserveDrawingBuffer: true behind a flag at map creation.

export function exportDrawingsPng(map: MapLibreMap): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    // Safety net: never hang the caller.
    const timeout = setTimeout(() => done(false), 5000);
    map.once("render", () => {
      clearTimeout(timeout);
      try {
        const canvas = map.getCanvas();
        canvas.toBlob((blob) => {
          if (blob) {
            download(
              blob,
              `gta6mapx-drawings-${stamp(new Date(), true)}.png`
            );
            done(true);
          } else {
            done(false);
          }
        }, "image/png");
      } catch {
        done(false);
      }
    });
    try {
      map.triggerRepaint();
    } catch {
      clearTimeout(timeout);
      done(false);
    }
  });
}

// ─── GeoJSON export ──────────────────────────────────────────────────────

/** Export shape: properties.draw = { kind, style, createdAt } (round-trips). */
export function buildExportCollection(
  features: DrawFeature[]
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: features.map((f) => ({
      type: "Feature",
      geometry: f.geometry,
      properties: {
        draw: {
          kind: f.kind,
          style: f.style,
          createdAt: f.createdAt,
        },
      },
    })),
  };
}

export function exportDrawingsGeoJson(features: DrawFeature[]): boolean {
  try {
    const blob = new Blob(
      [JSON.stringify(buildExportCollection(features), null, 2)],
      { type: "application/geo+json" }
    );
    download(blob, `gta6mapx-drawings-${stamp(new Date(), false)}.geojson`);
    return true;
  } catch {
    return false;
  }
}

// ─── GeoJSON import ──────────────────────────────────────────────────────

export interface ImportResult {
  /** Valid features, capped (fresh ids + createdAt: now). */
  features: DrawFeature[];
  /** How many raw features were skipped as invalid. */
  skipped: number;
  /** Per-file human-readable error lines (cap display at 5). */
  errors: string[];
  /** True when the cap truncated the import. */
  capped: boolean;
  /** True when the 200-drawing store limit blocks the import entirely. */
  blocked: boolean;
  /** True when the file itself isn't a FeatureCollection (nothing to report). */
  invalid: boolean;
}

const MAX_IMPORT_PER_FILE = 200;
const MAX_DRAWINGS = 200;

export async function importDrawingsFromFile(
  file: File,
  currentCount: number,
  defaultStyle: DrawStyle
): Promise<ImportResult> {
  const empty: ImportResult = {
    features: [],
    skipped: 0,
    errors: [],
    capped: false,
    blocked: false,
    invalid: false,
  };
  if (currentCount >= MAX_DRAWINGS) {
    return { ...empty, blocked: true };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return { ...empty, invalid: true };
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as { type?: string }).type !== "FeatureCollection" ||
    !Array.isArray((parsed as { features?: unknown }).features)
  ) {
    return { ...empty, invalid: true };
  }
  const rawFeatures = (parsed as { features: unknown[] }).features;
  const room = MAX_DRAWINGS - currentCount;
  const cap = Math.min(MAX_IMPORT_PER_FILE, room);
  const errors: string[] = [];
  const features: DrawFeature[] = [];
  let skipped = 0;
  let capped = false;
  for (let i = 0; i < rawFeatures.length; i++) {
    if (features.length >= cap) {
      capped = true;
      break;
    }
    const v = validateImportFeature(rawFeatures[i], defaultStyle);
    if (v.ok && v.feature) {
      features.push(v.feature);
    } else {
      skipped++;
      if (errors.length < 5) {
        errors.push(`Feature ${i + 1}: ${v.errors.join(" ")}`);
      }
    }
  }
  // Features beyond the cap count as skipped-by-cap, not as errors.
  if (capped) skipped += rawFeatures.length - (features.length + skipped);
  return { features, skipped, errors, capped, blocked: false, invalid: false };
}
