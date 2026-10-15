/**
 * deepLink.ts — canonical URL camera schema for /map.
 *
 * Owns:
 *  - parsing/validating `?lat=&lng=&zoom=&pitch=&bearing=&pin=&style=` (plus
 *    the `?gx=&gy=` game-coordinate alias),
 *  - building share URLs with the fidelity + anti-false-precision rules,
 *  - debounced `moveend` → `history.replaceState` sync (never pushState),
 *  - per-pin `document.title` / meta-description updates.
 *
 * `?forcemap=none` (QA hook) is intentionally NOT handled here — it belongs to
 * deviceCaps.qaTierOverride(), and buildShareUrl never emits it, so share
 * links always strip it.
 *
 * gameCoords (gameToMap, formatShareLatLng) is owned by another worker; the
 * assumed contracts are documented at the import site below.
 */

import type { Map as MLMap } from "maplibre-gl";
import { pitchForZoom, isFlying } from "./camera3d";
// ─── gameCoords contract (owned by another worker) ──────────────────────────
// gameToMap(x, y) → { lat: number; lng: number; quality: "verified"|"approximate" }
// formatShareLatLng(lat, lng) → "25.7617,-80.1918" (4-dp, ~11 m, URL-safe)
import { gameToMap, formatShareLatLng } from "./gameCoords";
import { MAX_PITCH } from "./camera3d";

export interface CameraState {
  lat: number;
  lng: number;
  zoom: number;
  pitch?: number;
  bearing?: number;
  pinSlug?: string;
  style?: string;
}

const DEFAULT_ZOOM = 11;
/** Default (non-Florida) base style id — style is omitted from share URLs when it matches. */
const DEFAULT_STYLE = "leonida-dark";
/** Styles we accept in ?style=. Unknown ids are ignored, never applied. */
const KNOWN_STYLES = new Set(["leonida-dark", "real-florida"]);

// ─── Parsing ─────────────────────────────────────────────────────────────────

function numParam(q: URLSearchParams, key: string): number | null {
  const raw = q.get(key);
  if (raw === null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

/**
 * Parse a /map query string into camera state.
 *  - lat/lng required for camera links (clamped); NaN or missing → null (ignore link).
 *  - `?gx=&gy=` accepted as an alias, converted through the game transform.
 *  - Bare `?pin=<slug>` (no camera params) parses to { pinSlug } only.
 *  - zoom/pitch/bearing: malformed values are ignored individually → defaults;
 *    out-of-range values are clamped. pitch defaults to the curve target.
 *  - Unknown params are ignored. Never throws, never blanks the map.
 */
export function parseDeepLink(search: string): Partial<CameraState> | null {
  let q: URLSearchParams;
  try {
    q = new URLSearchParams(search);
  } catch {
    return null;
  }

  const out: Partial<CameraState> = {};

  const pin = q.get("pin");
  if (pin !== null && pin.trim() !== "") out.pinSlug = pin.trim().slice(0, 160);

  const style = q.get("style");
  if (style !== null && KNOWN_STYLES.has(style)) out.style = style;

  const hasGx = q.has("gx");
  const hasGy = q.has("gy");
  const hasLat = q.has("lat");
  const hasLng = q.has("lng");

  if (!hasGx && !hasGy && !hasLat && !hasLng) {
    // No camera params at all: only valid as a bare pin link.
    return out.pinSlug ? out : null;
  }

  let lat: number;
  let lng: number;
  if (hasGx || hasGy) {
    const gx = numParam(q, "gx");
    const gy = numParam(q, "gy");
    if (gx === null || gy === null) return null; // malformed pair → ignore link
    const p = gameToMap(gx, gy);
    if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return null;
    lat = clamp(p.lat, -90, 90);
    lng = clamp(p.lng, -180, 180);
  } else {
    const la = numParam(q, "lat");
    const ln = numParam(q, "lng");
    if (la === null || ln === null) return null; // NaN or missing → ignore link
    lat = clamp(la, -90, 90);
    lng = clamp(ln, -180, 180);
  }

  const zr = numParam(q, "zoom");
  const zoom = zr === null ? DEFAULT_ZOOM : clamp(Math.round(zr), 0, 22);

  const pr = numParam(q, "pitch");
  const pitch = pr === null ? Math.round(pitchForZoom(zoom)) : clamp(Math.round(pr), 0, MAX_PITCH);

  const br = numParam(q, "bearing");
  const bearing = br === null ? 0 : clamp(Math.round(br), -180, 180);

  out.lat = lat;
  out.lng = lng;
  out.zoom = zoom;
  out.pitch = pitch;
  out.bearing = bearing;
  return out;
}

// ─── Share URL building ──────────────────────────────────────────────────────

/**
 * Build the canonical share URL.
 *  - lat/lng → 4 decimals (anti-false-precision: ~11 m, never "exact").
 *  - pitch omitted when it equals the curve target within ±1° (derivable).
 *  - bearing omitted when |bearing| ≤ 2°.
 *  - pin selected → pin-first URL: ?pin=<slug>&lat=…&lng=…&zoom=…
 *  - style included only when it differs from the default.
 *  - `forcemap` and any other QA params are NEVER emitted.
 */
export function buildShareUrl(state: CameraState, origin: string, basePath = "/map"): string {
  const [latStr, lngStr] = formatShareLatLng(state.lat, state.lng).split(",");
  const zoom = clamp(Math.round(state.zoom), 0, 22);
  const params = new URLSearchParams();

  if (state.pinSlug) params.set("pin", state.pinSlug);
  params.set("lat", latStr);
  params.set("lng", lngStr);
  params.set("zoom", String(zoom));

  if (state.pitch !== undefined && Math.abs(state.pitch - pitchForZoom(zoom)) > 1) {
    params.set("pitch", String(clamp(Math.round(state.pitch), 0, MAX_PITCH)));
  }

  const bearing = state.bearing ?? 0;
  if (Math.abs(bearing) > 2) {
    params.set("bearing", String(clamp(Math.round(bearing), -180, 180)));
  }

  if (state.style && state.style !== DEFAULT_STYLE && KNOWN_STYLES.has(state.style)) {
    params.set("style", state.style);
  }

  const cleanOrigin = origin.replace(/\/+$/, "");
  return `${cleanOrigin}${basePath}?${params.toString()}`;
}

// ─── moveend → replaceState sync ─────────────────────────────────────────────

/**
 * Keep the URL in sync with the camera: on `moveend`, debounce 400 ms, then
 * `history.replaceState` (never pushState — panning must not spam history).
 * Skips the write when the query string is identical, and pauses while a
 * programmatic flight is in flight (writes once on settle instead).
 *
 * Pass an optional isFlyingRef to override the default flight detection
 * (camera3d.isFlying) — useful when the orchestrator tracks flights itself.
 */
export function installUrlSync(
  map: MLMap,
  getState: () => CameraState,
  isFlyingRef?: { current: boolean }
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flying = () => (isFlyingRef ? isFlyingRef.current : isFlying());

  const onMoveEnd = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (flying()) return;
      if (typeof window === "undefined") return;
      const next = buildShareUrl(getState(), window.location.origin, window.location.pathname);
      const nextQuery = next.slice(next.indexOf("?"));
      if (nextQuery !== window.location.search) {
        window.history.replaceState(null, "", next);
      }
    }, 400);
  };

  map.on("moveend", onMoveEnd);
  return () => {
    if (timer) clearTimeout(timer);
    map.off("moveend", onMoveEnd);
  };
}

// ─── Per-pin document title / meta ───────────────────────────────────────────

let capturedDefaultTitle: string | null = null;

/**
 * On pin select: `document.title = "{Pin name} — GTA 6 Interactive Map | gta6mapx.com"`
 * and the meta description becomes the pin's short description (~150 chars),
 * so shared per-pin URLs unfurl sensibly. Canonical/JSON-LD stay on the SSG pages.
 */
export function setPinMeta(name: string, description?: string): void {
  if (typeof document === "undefined") return;
  if (capturedDefaultTitle === null) capturedDefaultTitle = document.title;
  document.title = `${name} — GTA 6 Interactive Map | gta6mapx.com`;
  if (description) {
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", description.slice(0, 150));
  }
}

/** On deselect: restore the title captured before the first pin select. */
export function clearPinMeta(): void {
  if (typeof document === "undefined") return;
  if (capturedDefaultTitle !== null) document.title = capturedDefaultTitle;
}
