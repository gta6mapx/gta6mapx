"use client";

// ─── modules/map/tools/display/DisplayTools.tsx ──────────────────────
// Main display-slice component. Mounted as a child of MapToolsHost by the
// coordinator. Responsibilities:
//   1. registerCapability("display") on mount (toolbar button stays disabled
//      until then),
//   2. mount/unmount the grid + heatmap layers as settings change,
//   3. wire the G/H/F tool events (via useDisplaySettings — mounted exactly
//      once here so a keypress toggles exactly once),
//   4. render the FOV chip and the Display panel when active.

import { useEffect, useState } from "react";
import type { Map as MapLibreMap, MapSourceDataEvent } from "maplibre-gl";
import { useTools } from "../shared/toolRuntime";
import { restackToolLayers } from "../shared/layerOrder";
import { CLUSTER_SOURCE_ID } from "../../clusterSource";
import { useDisplaySettings } from "./useDisplaySettings";
import { mountGridLayer, unmountGridLayer } from "./GridLayer";
import { mountHeatmapLayer, unmountHeatmapLayer } from "./HeatmapLayer";
import FovHud from "./FovHud";
import DisplaySettingsPanel from "./DisplaySettingsPanel";

const MAP_READY_POLL_MS = 250;
const MAP_READY_MAX_TRIES = 60; // ~15 s

export default function DisplayTools() {
  const runtime = useTools();
  const display = useDisplaySettings();
  const [map, setMap] = useState<MapLibreMap | null>(null);

  // The map is created asynchronously by GameMap; poll until the style is
  // loaded, then hold the instance for the layer effects below.
  useEffect(() => {
    const getMap = runtime.getMap;
    let alive = true;
    let tries = 0;
    const id = setInterval(() => {
      const m = getMap();
      if (m && m.isStyleLoaded()) {
        clearInterval(id);
        if (alive) setMap(m);
      } else if (++tries >= MAP_READY_MAX_TRIES) {
        clearInterval(id);
      }
    }, MAP_READY_POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [runtime]);

  // Capability registration unlocks the toolbar Display button.
  useEffect(() => {
    runtime.registerCapability("display");
  }, [runtime]);

  const { getMap } = runtime;

  // ── Grid layer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!map) return;
    if (display.grid.visible) mountGridLayer(map);
    else unmountGridLayer(map);
  }, [map, display.grid.visible]);

  // ── Heatmap layer ────────────────────────────────────────────────────
  // The pin source may mount after us; if it's absent, retry once it lands.
  useEffect(() => {
    if (!map) return;
    if (!display.heatmap.visible) {
      unmountHeatmapLayer(map);
      return;
    }
    if (mountHeatmapLayer(map)) return;
    const onSourceData = (e: MapSourceDataEvent) => {
      if (e.sourceId === CLUSTER_SOURCE_ID && mountHeatmapLayer(map)) {
        map.off("sourcedata", onSourceData);
      }
    };
    map.on("sourcedata", onSourceData);
    return () => {
      map.off("sourcedata", onSourceData);
      unmountHeatmapLayer(map);
    };
  }, [map, display.heatmap.visible]);

  // ── Base-style switches rebuild all layers ───────────────────────────
  // Re-mount visible tool layers after a style switch and re-establish the
  // canonical bottom→top order (spec §1.2, layerOrder restack fallback).
  useEffect(() => {
    if (!map) return;
    const onStyle = () => {
      if (display.grid.visible) mountGridLayer(map);
      if (display.heatmap.visible) mountHeatmapLayer(map);
      restackToolLayers(map);
    };
    map.on("styledata", onStyle);
    restackToolLayers(map);
    return () => {
      map.off("styledata", onStyle);
    };
  }, [map, display.grid.visible, display.heatmap.visible]);

  return (
    <>
      <FovHud getMap={getMap} visible={display.fovHud.visible} />
      {runtime.activePanel === "display" && (
        <DisplaySettingsPanel display={display} />
      )}
    </>
  );
}
