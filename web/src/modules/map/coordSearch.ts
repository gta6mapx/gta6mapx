// ─── map/coordSearch.ts ────────────────────────────────────────────────────
// Pure "Go to position" input handling (spec §3.8). Accepts "lat, lng" in
// the current map frame. Invalid input → a named error, never a flight to
// a nonsense location. Pure TypeScript: no React, no maplibre —
// unit-testable (R7).

import { discoveryStrings as S } from "@/modules/discovery/strings";

export type CoordSearchOutcome =
  | { ok: true; lat: number; lng: number }
  | { ok: false; error: string };

/**
 * Parse "lat, lng" (comma, space, or semicolon separated). Range-checked:
 * latitude −90…90, longitude −180…180.
 */
export function parseGoToPosition(raw: string): CoordSearchOutcome {
  const parts = raw
    .trim()
    .split(/[,;\s]+/)
    .filter((p) => p.length > 0);
  if (parts.length !== 2) return { ok: false, error: S.goToPositionErrorFormat };
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, error: S.goToPositionErrorFormat };
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { ok: false, error: S.goToPositionErrorRange };
  }
  return { ok: true, lat, lng };
}
