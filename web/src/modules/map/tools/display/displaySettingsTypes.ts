// ─── modules/map/tools/display/displaySettingsTypes.ts ────────────────
// Types for the display slice. These mirror the fields this slice owns in
// the shared map settings store (modules/map/settings.ts) — the real
// persistence lives there; this file just names the slice's view of it.

export interface GridDisplaySettings {
  visible: boolean;
}

export interface FovHudDisplaySettings {
  visible: boolean;
}

export interface HeatmapDisplaySettings {
  visible: boolean;
}

/**
 * Per-category color overrides for USER-AUTHORED annotations only
 * (drawings, measurements, user pins). Entity pins/clusters are
 * evidence-colored by design (see MarkerColors.ts) and never appear here.
 */
export type UserAnnotationMarkerColors = Record<string, string>;

/** The display slice's view of settings — defaults are all opt-in-off. */
export interface DisplaySettingsSnapshot {
  grid: GridDisplaySettings;
  fovHud: FovHudDisplaySettings;
  heatmap: HeatmapDisplaySettings;
  markerColors: UserAnnotationMarkerColors;
}

export const DISPLAY_DEFAULTS: DisplaySettingsSnapshot = {
  grid: { visible: false },
  fovHud: { visible: false },
  heatmap: { visible: false },
  markerColors: {},
};
