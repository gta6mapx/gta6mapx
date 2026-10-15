// ─── modules/map/tools/shared/mapInteractionLocks.ts ─────────────────────
// Per-tool map-interaction rules (spec §1.4). Slices call applyToolLocks
// when their tool activates and run the returned restore fn on deactivate.
// Also owns the crosshair cursor while any tool is active.

import type { Map as MapLibreMap } from "maplibre-gl";
import type { ActiveTool } from "./toolRuntime";

/**
 * Apply interaction locks for a tool. Returns a restore function that
 * re-enables exactly what was disabled. Safe to call with null/"select"
 * (no locks, cursor reset).
 */
export function applyToolLocks(
  map: MapLibreMap,
  tool: ActiveTool
): () => void {
  const canvas = map.getCanvas();
  const disabled: Array<() => void> = [];

  const disable = (
    off: () => void,
    on: () => void
  ) => {
    off();
    disabled.push(on);
  };

  switch (tool) {
    case "pen":
      // Click-drag draws; dragPan would fight the stroke. Right-drag rotate
      // stays on as the escape hatch.
      if (map.dragPan.isEnabled()) {
        disable(() => map.dragPan.disable(), () => map.dragPan.enable());
      }
      break;
    case "rect":
      // Shift-drag is the rect gesture — boxZoom must not steal it.
      if (map.boxZoom.isEnabled()) {
        disable(() => map.boxZoom.disable(), () => map.boxZoom.enable());
      }
      break;
    case "measure-distance":
    case "measure-area":
      // Double-click commits the sketch.
      if (map.doubleClickZoom.isEnabled()) {
        disable(
          () => map.doubleClickZoom.disable(),
          () => map.doubleClickZoom.enable()
        );
      }
      break;
    default:
      break;
  }

  if (tool !== null && tool !== "select") {
    canvas.style.cursor = "crosshair";
  }

  return () => {
    for (const restore of disabled) restore();
    canvas.style.cursor = "";
  };
}

/**
 * Gesture-scoped dragPan lock for pen strokes on desktop: pointerdown on the
 * map disables dragPan for the stroke, pointerup restores it. (On touch the
 * pen tool keeps dragPan off for the whole tool session — see applyToolLocks.)
 */
export function lockDragPanForGesture(map: MapLibreMap): () => void {
  const wasEnabled = map.dragPan.isEnabled();
  if (wasEnabled) map.dragPan.disable();
  return () => {
    if (wasEnabled) map.dragPan.enable();
  };
}
