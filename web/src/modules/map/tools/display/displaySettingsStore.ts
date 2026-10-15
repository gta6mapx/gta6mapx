// ─── modules/map/tools/display/displaySettingsStore.ts ────────────────
// Single source of truth for display-slice state.
//
// Thin wrapper over the real persistence (modules/map/settings.ts, itself an
// adapter over the unified engagement settings store
// `gta6mapx:settings:v1`): loadSettings/saveSettings own the storage key,
// debouncing, and private-mode fallback. This module adds a tiny in-memory
// mirror + listener set so every hook instance sees the same state
// (settings are written once, read everywhere).

import {
  loadSettings,
  saveSettings,
  type MapSettings,
} from "../../settings";
import { DISPLAY_DEFAULTS, type DisplaySettingsSnapshot } from "./displaySettingsTypes";

type Listener = () => void;
const listeners = new Set<Listener>();

let mirror: DisplaySettingsSnapshot | null = null;

function readFromStore(): DisplaySettingsSnapshot {
  const s: MapSettings = loadSettings();
  return {
    grid: { visible: s.grid.visible },
    fovHud: { visible: s.fovHud.visible },
    heatmap: { visible: s.heatmap.visible },
    markerColors: { ...s.markerColors },
  };
}

export function getDisplaySettings(): DisplaySettingsSnapshot {
  if (!mirror) mirror = readFromStore();
  return mirror;
}

export function subscribeDisplaySettings(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function toPatch(next: DisplaySettingsSnapshot): Partial<MapSettings> {
  return {
    grid: { visible: next.grid.visible },
    fovHud: { visible: next.fovHud.visible },
    heatmap: { visible: next.heatmap.visible },
    markerColors: { ...next.markerColors },
  };
}

function commit(next: DisplaySettingsSnapshot): void {
  mirror = next;
  saveSettings(toPatch(next));
  listeners.forEach((fn) => fn());
}

// ─── Actions ───────────────────────────────────────────────────────────────

export function setGridVisible(visible: boolean): void {
  const cur = getDisplaySettings();
  if (cur.grid.visible === visible) return;
  commit({ ...cur, grid: { visible } });
}

export function setFovHudVisible(visible: boolean): void {
  const cur = getDisplaySettings();
  if (cur.fovHud.visible === visible) return;
  commit({ ...cur, fovHud: { visible } });
}

export function setHeatmapVisible(visible: boolean): void {
  const cur = getDisplaySettings();
  if (cur.heatmap.visible === visible) return;
  commit({ ...cur, heatmap: { visible } });
}

export function toggleGrid(): void {
  setGridVisible(!getDisplaySettings().grid.visible);
}

export function toggleFovHud(): void {
  setFovHudVisible(!getDisplaySettings().fovHud.visible);
}

export function toggleHeatmap(): void {
  setHeatmapVisible(!getDisplaySettings().heatmap.visible);
}

export function setMarkerColor(categoryId: string, color: string): void {
  const cur = getDisplaySettings();
  if (cur.markerColors[categoryId] === color) return;
  commit({ ...cur, markerColors: { ...cur.markerColors, [categoryId]: color } });
}

export function resetMarkerColors(): void {
  const cur = getDisplaySettings();
  if (Object.keys(cur.markerColors).length === 0) return;
  commit({ ...cur, markerColors: {} });
}

export function resetDisplayToDefaults(): void {
  commit({
    grid: { ...DISPLAY_DEFAULTS.grid },
    fovHud: { ...DISPLAY_DEFAULTS.fovHud },
    heatmap: { ...DISPLAY_DEFAULTS.heatmap },
    markerColors: {},
  });
}

/** Test escape hatch: drop the mirror so the next read hits the store. */
export function resetDisplayStoreForTests(): void {
  mirror = null;
}
