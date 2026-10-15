"use client";

// ─── modules/map/tools/display/FovHud.tsx ─────────────────────────────
// Camera readout chip: zoom (1dp) · pitch (°) · bearing (°).
// Updates on moveend + throttled move (≤4 Hz). Informational only —
// aria-live="off" so screen readers aren't spammed, with a title tooltip.
//
// PLACEMENT (documented): `bottom-8 left-1/2 -translate-x-1/2` — bottom
// center, raised. The corners are all taken: EvidenceLegend bottom-left
// (desktop) / mobile Filters FAB bottom-left, CoordHud bottom-right,
// BaseLayerSwitch top-left, MapControls top-right, search/countdown +
// toasts top-center, and a decorative hint sits at bottom-center bottom-3
// on lg. bottom-8 clears that hint on every form factor.

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";

const MOVE_THROTTLE_MS = 250; // ≤4 Hz per spec §5.2

interface FovReadout {
  zoom: number;
  pitch: number;
  bearing: number;
}

interface FovHudProps {
  getMap: () => MapLibreMap | null;
  visible: boolean;
}

export default function FovHud({ getMap, visible }: FovHudProps) {
  const [readout, setReadout] = useState<FovReadout>({
    zoom: 0,
    pitch: 0,
    bearing: 0,
  });
  const lastUpdate = useRef(0);

  useEffect(() => {
    if (!visible) return;
    const map = getMap();
    if (!map) return;

    const read = (): FovReadout => ({
      zoom: map.getZoom(),
      pitch: map.getPitch(),
      bearing: map.getBearing(),
    });
    /* eslint-disable react-hooks/set-state-in-effect -- syncing external
       map state into React on (re)mount; subsequent updates come from
       map event callbacks, same pattern as GameMap.tsx map-sync effects. */
    setReadout(read());
    /* eslint-enable react-hooks/set-state-in-effect */
    lastUpdate.current = Date.now();

    const onMoveEnd = () => {
      lastUpdate.current = Date.now();
      setReadout(read());
    };
    const onMove = () => {
      const now = Date.now();
      if (now - lastUpdate.current < MOVE_THROTTLE_MS) return;
      lastUpdate.current = now;
      setReadout(read());
    };
    map.on("move", onMove);
    map.on("moveend", onMoveEnd);
    return () => {
      map.off("move", onMove);
      map.off("moveend", onMoveEnd);
    };
  }, [getMap, visible]);

  if (!visible) return null;

  const bearing = Math.round(readout.bearing);
  const text = `Z ${readout.zoom.toFixed(1)} · P ${Math.round(readout.pitch)}° · B ${bearing}°`;

  return (
    <div
      aria-live="off"
      title="Camera readout: zoom · pitch · bearing (updates as you move)"
      className="glass-panel pointer-events-none absolute bottom-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg px-3 py-1.5 font-mono text-[11px] tabular-nums text-[#c7d0dd]"
    >
      {text}
    </div>
  );
}
