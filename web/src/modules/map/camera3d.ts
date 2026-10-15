/**
 * camera3d.ts — 3D camera behavior for the GTA6mapx map.
 *
 * Owns:
 *  - the zoom-driven pitch curve (§1.1 of the camera slice spec),
 *  - the MAX_PITCH hard cap,
 *  - the 2D/3D toggle animation (pitch-only, 900 ms),
 *  - the zoomend drift-back toward the curve,
 *  - the internal `is3D` view-mode state,
 *  - reduced-motion branching (all moves become instant),
 *  - bearing helpers (north-up snap),
 *  - the programmatic-flight counter consumed by deepLink's URL sync.
 *
 * All code here is original. No competitor code or assets are referenced.
 */

import type { Map as MLMap } from "maplibre-gl";
import { loadSettings } from "./settings";

/** Hard pitch cap everywhere: toggle, flyTo, gesture restore, deep-link parse. */
export const MAX_PITCH = 58;

/**
 * Zoom-driven pitch target (§1.1):
 *   < 11        → 0°
 *   11 → 13.5   → 0° → 45° linear
 *   13.5 → 15   → 45° → 58°
 *   ≥ 15        → 58° (MAX_PITCH)
 */
export function pitchForZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 0;
  if (zoom < 11) return 0;
  if (zoom >= 15) return MAX_PITCH;
  if (zoom <= 13.5) return ((zoom - 11) / 2.5) * 45;
  return 45 + ((zoom - 13.5) / 1.5) * (MAX_PITCH - 45);
}

/** True when the user prefers reduced motion — all camera moves become instant. */
export function isReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

// ─── Internal view-mode + tilt state ─────────────────────────────────────────

let is3DState = true;
/** Current 2D/3D view mode. Source of truth lives here (persisted via settings). */
export function getIs3D(): boolean {
  return is3DState;
}

let userTilt = false;
/** Cleared on every programmatic camera reset; set by genuine user tilt gestures. */
function clearUserTilt(): void {
  userTilt = false;
}

// ─── Programmatic-flight tracking (consumed by deepLink.installUrlSync) ─────

let flyingCount = 0;
/** True while a programmatic camera flight (flyTo/easeTo) is in progress. */
export function isFlying(): boolean {
  return flyingCount > 0;
}
/** Marks the start of a programmatic flight; call the returned function to end it. */
function beginFlight(): () => void {
  flyingCount += 1;
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    flyingCount = Math.max(0, flyingCount - 1);
  };
}

/** Pitch ceiling from persisted prefs (a future slider may lower it below 58). */
function pitchCeiling(): number {
  try {
    const { pitchMax } = loadSettings();
    if (Number.isFinite(pitchMax)) return Math.min(Math.max(pitchMax, 0), MAX_PITCH);
  } catch {
    /* fall through to the hard cap */
  }
  return MAX_PITCH;
}

/** Ease just the pitch toward `target`, or snap instantly under reduced motion. */
function pitchTo(map: MLMap, target: number, durationMs: number): void {
  const pitch = Math.min(Math.max(target, 0), MAX_PITCH);
  if (isReducedMotion()) {
    map.setPitch(pitch);
    return;
  }
  map.easeTo({ pitch, duration: durationMs });
}

/**
 * Apply the pitch curve for the map's current zoom.
 * Used on init and deep-link restore (animate=false) and as a general
 * "return to curve" helper (animate=true).
 */
export function applyPitchCurve(map: MLMap, animate: boolean): void {
  const target = Math.min(pitchForZoom(map.getZoom()), pitchCeiling());
  if (!animate || isReducedMotion()) {
    map.setPitch(target);
    return;
  }
  pitchTo(map, target, 600);
}

/**
 * 2D/3D toggle. Pitch-only: center, zoom and bearing are preserved, and a
 * selected pin stays selected (the detail panel is untouched).
 * 900 ms pitch sweep, or instant under reduced motion.
 */
export function set3D(map: MLMap, on: boolean, opts?: { pitchMax?: number }): void {
  clearUserTilt();
  is3DState = on;
  const ceiling = Math.min(opts?.pitchMax ?? pitchCeiling(), MAX_PITCH);
  const target = on ? ceiling : 0;
  if (isReducedMotion()) {
    map.setPitch(target);
    return;
  }
  map.easeTo({ pitch: target, duration: 900 });
}

/**
 * Fly the camera to a pin: 1200 ms flyTo (pitch per the curve at the target
 * zoom), or jumpTo under reduced motion. Bearing is preserved.
 * Default zoom = max(current zoom, 15) so pins land at street-level perspective.
 */
export function flyToPin(map: MLMap, lng: number, lat: number, zoom?: number): void {
  clearUserTilt();
  const targetZoom = zoom ?? Math.max(map.getZoom(), 15);
  const targetPitch = Math.min(pitchForZoom(targetZoom), pitchCeiling());
  is3DState = targetPitch > 0;
  if (isReducedMotion()) {
    map.jumpTo({ center: [lng, lat], zoom: targetZoom, pitch: targetPitch });
    return;
  }
  const endFlight = beginFlight();
  const done = () => endFlight();
  // moveend fires when the fly completes; the timeout is a safety net.
  map.once("moveend", done);
  window.setTimeout(done, 2000);
  map.flyTo({ center: [lng, lat], zoom: targetZoom, pitch: targetPitch, duration: 1200 });
}

/**
 * Reset the camera: center + zoom + pitch per the 2D/3D mode, bearing → 0.
 * Instant under reduced motion.
 */
export function resetCamera(map: MLMap, center: [number, number], zoom: number, is3D: boolean): void {
  clearUserTilt();
  is3DState = is3D;
  const pitch = is3D ? Math.min(pitchForZoom(zoom), pitchCeiling()) : 0;
  if (isReducedMotion()) {
    map.jumpTo({ center, zoom, pitch, bearing: 0 });
    return;
  }
  map.easeTo({ center, zoom, pitch, bearing: 0, duration: 900 });
}

/** Compass snap: ease bearing back to north-up over 600 ms (instant if reduced motion). */
export function snapNorth(map: MLMap): void {
  if (isReducedMotion()) {
    map.setBearing(0);
    return;
  }
  map.easeTo({ bearing: 0, duration: 600 });
}

/**
 * Drift-back: after a manual zoom, ease pitch toward the curve's target over
 * 600 ms — but only if the gap exceeds 10°, and never while the user has
 * deliberately tilted (userTilt suppresses until the next programmatic move).
 *
 * User tilt is detected via `pitchstart` with a real DOM `originalEvent`
 * (programmatic easeTo/flyTo fire pitchstart with `originalEvent === undefined`).
 */
export function installDriftBack(map: MLMap): () => void {
  const onPitchStart = (e: { originalEvent?: unknown }) => {
    if (e && e.originalEvent) userTilt = true;
  };
  const onZoomEnd = () => {
    if (userTilt || isFlying()) return;
    const zoom = map.getZoom();
    const target = Math.min(pitchForZoom(zoom), pitchCeiling());
    const gap = Math.abs(map.getPitch() - target);
    if (gap > 10) pitchTo(map, target, 600);
  };
  // MapLibre's typed handler expects MapMovementEvent; the shape we read is a
  // subset, so we bridge through the library's own handler type.
  type PitchHandler = Parameters<MLMap["on"]>[1];
  map.on("pitchstart", onPitchStart as PitchHandler);
  map.on("zoomend", onZoomEnd);
  return () => {
    map.off("pitchstart", onPitchStart as PitchHandler);
    map.off("zoomend", onZoomEnd);
  };
}
