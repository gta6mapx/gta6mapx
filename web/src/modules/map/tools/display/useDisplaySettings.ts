"use client";

// ─── modules/map/tools/display/useDisplaySettings.ts ───────────────────
// React binding for the display settings store. The store is the single
// source of truth (shared across hook instances); this hook exposes state +
// updaters and subscribes to the G/H/F tool events once per mount.

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { onToolEvent } from "../shared/toolRuntime";
import {
  getDisplaySettings,
  subscribeDisplaySettings,
  setGridVisible,
  setFovHudVisible,
  setHeatmapVisible,
  toggleGrid,
  toggleFovHud,
  toggleHeatmap,
  setMarkerColor,
  resetMarkerColors,
  resetDisplayToDefaults,
} from "./displaySettingsStore";
import type { DisplaySettingsSnapshot } from "./displaySettingsTypes";

export interface DisplaySettingsApi extends DisplaySettingsSnapshot {
  setGridVisible: (v: boolean) => void;
  setFovHudVisible: (v: boolean) => void;
  setHeatmapVisible: (v: boolean) => void;
  toggleGrid: () => void;
  toggleFovHud: () => void;
  toggleHeatmap: () => void;
  setMarkerColor: (categoryId: string, color: string) => void;
  resetMarkerColors: () => void;
  resetDisplayToDefaults: () => void;
}

export function useDisplaySettings(): DisplaySettingsApi {
  const snapshot = useSyncExternalStore(
    subscribeDisplaySettings,
    getDisplaySettings,
    getDisplaySettings
  );

  // G/H/F keyboard shortcuts dispatch tool events — one subscription per
  // hook mount. DisplayTools mounts this hook exactly once, so a keypress
  // toggles exactly once.
  useEffect(() => {
    const offGrid = onToolEvent("gta6mapx:tools:toggle-grid", toggleGrid);
    const offHeat = onToolEvent("gta6mapx:tools:toggle-heatmap", toggleHeatmap);
    const offFov = onToolEvent("gta6mapx:tools:toggle-fov", toggleFovHud);
    return () => {
      offGrid();
      offHeat();
      offFov();
    };
  }, []);

  return useMemo<DisplaySettingsApi>(
    () => ({
      ...snapshot,
      setGridVisible,
      setFovHudVisible,
      setHeatmapVisible,
      toggleGrid,
      toggleFovHud,
      toggleHeatmap,
      setMarkerColor,
      resetMarkerColors,
      resetDisplayToDefaults,
    }),
    [snapshot]
  );
}
