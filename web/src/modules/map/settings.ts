/**
 * settings.ts — legacy map-settings interface, now an adapter.
 *
 * The unified engagement store (`modules/engagement/settings/store.ts`,
 * key `gta6mapx:settings:v1`) is the single source of truth. This module
 * keeps the historical `MapSettings` shape (fields, `loadSettings`,
 * `saveSettings`, `DEFAULT_SETTINGS`) so existing map code paths
 * (GameMap, camera3d, styleManager, tools display store) keep working —
 * every read/write is translated to/from the unified store, never to a
 * second localStorage key.
 *
 * The legacy `gta6mapx:map-settings` key is migrated once by the unified
 * store and then deleted; it is never read or written here.
 */

import type { BaseStyleId } from "./styleManager";
import type { ClusterColorMode } from "./markerLayer";
import type { SortId } from "@/modules/discovery/reducer";
import {
  getSettings,
  resetSettingsForTests as resetUnifiedSettingsForTests,
  setSettings as setSiteSettings,
  type SettingsPatch,
  type SiteSettings,
} from "@/modules/engagement/settings/store";

export type ThemeId = "vice" | "midnight" | "neon";

export interface MapSettings {
  v: 1;
  mode3d: boolean;
  pitchMax: number;
  baseLayer: BaseStyleId;
  bearingSnap: boolean;
  theme: ThemeId;
  densityVisible: boolean;
  clustering: boolean;
  units: "metric" | "imperial";
  coordHudCollapsed: boolean;
  frameLegendDismissed: boolean;
  /** Discovery prefs (spec §3.5/§3.6) — persisted, unlike the competitor. */
  sort: SortId;
  clusterColorMode: ClusterColorMode;
  /**
   * Display tools (T4): graticule / camera HUD / heatmap visibility plus
   * per-category color overrides for USER-AUTHORED annotations only
   * (drawings, measurements, user pins). Entity pins/clusters are
   * evidence-colored by design — those are never stored here.
   *
   * These live in the unified settings store now (`grid`, `fovHud`
   * top-level; `heatmap`/`markerColors` under the `map` extras slice).
   */
  grid: { visible: boolean };
  fovHud: { visible: boolean };
  heatmap: { visible: boolean };
  markerColors: Record<string, string>;
}

/** The unified settings key — the legacy `gta6mapx:map-settings` key is gone. */
export const SETTINGS_KEY = "gta6mapx:settings:v1";
const SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS: MapSettings = {
  v: 1,
  mode3d: true,
  pitchMax: 58,
  baseLayer: "leonida-dark",
  bearingSnap: true,
  theme: "vice",
  densityVisible: true,
  clustering: true,
  units: "metric",
  coordHudCollapsed: false,
  frameLegendDismissed: false,
  sort: "name",
  clusterColorMode: "evidence",
  grid: { visible: false },
  fovHud: { visible: false },
  heatmap: { visible: false },
  markerColors: {},
};

// ─── Theme id translation (legacy ↔ unified) ─────────────────────────────

const THEME_TO_UNIFIED: Record<ThemeId, SiteSettings["theme"]> = {
  vice: "neon-mirage",
  midnight: "midnight-outrun",
  neon: "sunset-boulevard",
};

const THEME_FROM_UNIFIED: Record<SiteSettings["theme"], ThemeId> = {
  "neon-mirage": "vice",
  "midnight-outrun": "midnight",
  "sunset-boulevard": "neon",
};

// ─── Read ────────────────────────────────────────────────────────────────

/**
 * Read settings. Built from the unified store, so unknown/corrupt payloads
 * and schema versions are already handled there — this always returns a
 * complete, valid MapSettings (never throws).
 */
export function loadSettings(): MapSettings {
  const s = getSettings();
  return {
    v: SCHEMA_VERSION,
    mode3d: s.buildings3d,
    pitchMax: s.map.pitchMax,
    baseLayer: s.map.baseLayer,
    bearingSnap: s.map.bearingSnap,
    theme: THEME_FROM_UNIFIED[s.theme] ?? "vice",
    densityVisible: s.map.densityVisible,
    clustering: s.clustering,
    units: s.units === "miles" ? "imperial" : "metric",
    coordHudCollapsed: s.map.coordHudCollapsed,
    frameLegendDismissed: s.map.frameLegendDismissed,
    sort: s.map.sort,
    clusterColorMode: s.map.clusterColorMode,
    grid: { visible: s.grid },
    fovHud: { visible: s.fovHud },
    heatmap: { visible: s.map.heatmap },
    markerColors: { ...s.map.markerColors },
  };
}

// ─── Write ───────────────────────────────────────────────────────────────

/**
 * Persist a settings patch through the unified store. Applies instantly
 * in-memory; the store debounces the localStorage write (≤300 ms).
 * Unknown/bad values are dropped, never persisted.
 */
export function saveSettings(patch: Partial<MapSettings>): void {
  const next: SettingsPatch = {};
  const map: NonNullable<SettingsPatch["map"]> = {};

  if (patch.theme !== undefined && patch.theme in THEME_TO_UNIFIED) {
    next.theme = THEME_TO_UNIFIED[patch.theme];
  }
  if (patch.units === "metric") next.units = "km";
  else if (patch.units === "imperial") next.units = "miles";
  if (typeof patch.mode3d === "boolean") next.buildings3d = patch.mode3d;
  if (typeof patch.clustering === "boolean") next.clustering = patch.clustering;
  if (
    patch.grid &&
    typeof patch.grid === "object" &&
    typeof patch.grid.visible === "boolean"
  ) {
    next.grid = patch.grid.visible;
  }
  if (
    patch.fovHud &&
    typeof patch.fovHud === "object" &&
    typeof patch.fovHud.visible === "boolean"
  ) {
    next.fovHud = patch.fovHud.visible;
  }
  if (patch.baseLayer === "leonida-dark" || patch.baseLayer === "real-florida") {
    map.baseLayer = patch.baseLayer;
  }
  if (typeof patch.pitchMax === "number" && Number.isFinite(patch.pitchMax)) {
    map.pitchMax = Math.min(Math.max(patch.pitchMax, 0), 58);
  }
  if (typeof patch.bearingSnap === "boolean") map.bearingSnap = patch.bearingSnap;
  if (typeof patch.densityVisible === "boolean")
    map.densityVisible = patch.densityVisible;
  if (
    patch.sort === "name" ||
    patch.sort === "evidence" ||
    patch.sort === "updated" ||
    patch.sort === "region"
  ) {
    map.sort = patch.sort;
  }
  if (patch.clusterColorMode === "evidence" || patch.clusterColorMode === "category") {
    map.clusterColorMode = patch.clusterColorMode;
  }
  if (typeof patch.coordHudCollapsed === "boolean")
    map.coordHudCollapsed = patch.coordHudCollapsed;
  if (typeof patch.frameLegendDismissed === "boolean")
    map.frameLegendDismissed = patch.frameLegendDismissed;
  if (
    patch.heatmap &&
    typeof patch.heatmap === "object" &&
    typeof patch.heatmap.visible === "boolean"
  ) {
    map.heatmap = patch.heatmap.visible;
  }
  if (patch.markerColors && typeof patch.markerColors === "object") {
    const mc: Record<string, string> = {};
    for (const [k, v] of Object.entries(patch.markerColors)) {
      if (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v)) {
        mc[k] = v.toUpperCase();
      }
    }
    map.markerColors = mc;
  }

  if (Object.keys(map).length > 0) next.map = map;
  if (Object.keys(next).length === 0) return;
  setSiteSettings(next);
}

/** Test/SSR escape hatch: clear any in-memory state (no-op in the browser). */
export function resetSettingsForTests(): void {
  resetUnifiedSettingsForTests();
}
