// ─── modules/map/tools/measure/interactions.ts ───────────────────────
// Map event wiring for the measure slice (spec §3.2, locked gestures).
//
// Desktop: click places a vertex (via map.unproject — camera-independent);
//   double-click / Enter / click-last-vertex (≤10 px) finishes;
//   right-click (contextmenu) undoes ONE SKETCH VERTEX (never finished
//   measurements); Esc cancels (owned by ToolsProvider → onCancel discards
//   the sketch). Finishing with too few vertices keeps the sketch open with
//   a hint toast; commit returns the tool to idle (spec §1.1).
//
// Touch: tap-to-place; the on-screen Done button finishes — double-tap is
//   NOT a finish gesture (dblclick after a touch pointerdown is ignored).
//   Single-finger drag still pans (vertices on tap only — MapLibre's click
//   doesn't fire after a drag); pinch/two-finger pan keep working.
//
// Selection (no tool active): click chip/geometry → select; click empty map
// → deselect. Gated to navigate/select mode so this never fights another
// tool's click handling.

"use client";

import { useCallback, useEffect, useRef } from "react";
import type { MapMouseEvent } from "maplibre-gl";
import { useTools } from "../shared/toolRuntime";
import { useMeasureStore } from "./store";
import {
  MEASURE_CHIP_HIT_LAYER_ID,
  MEASURE_HIT_LAYER_IDS,
} from "./MeasureLayers";
import {
  minVerticesFor,
  toolToMeasureKind,
  type Measurement,
  type MeasureVertex,
} from "./types";
import { measureStrings } from "./sliceStrings";
import { formatMeasurement } from "./format";

function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || typeof (el as HTMLElement).tagName !== "string") return false;
  const tag = (el as HTMLElement).tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    (el as HTMLElement).isContentEditable
  );
}

/**
 * Clipboard write with a fallback for non-secure contexts (plain http /
 * file://), where navigator.clipboard is unavailable.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export interface MeasureInteractionApi {
  /** Active measure kind, or null when no measure tool is armed. */
  kind: "distance" | "area" | null;
  /** Finish the sketch (validates vertex count; commit → idle). */
  finish: () => void;
  /** Discard the sketch and exit the tool. */
  cancelSketch: () => void;
}

export function useMeasureInteractions(): MeasureInteractionApi {
  const { getMap, activeTool, activateTool, units, toast, isMinimalTier } =
    useTools();
  const { state, actions } = useMeasureStore();

  const kind = toolToMeasureKind(activeTool ?? "");
  const disabled = isMinimalTier();

  // Latest-value refs so map listeners stay wired once per tool session.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });
  const actionsRef = useRef(actions);
  useEffect(() => {
    actionsRef.current = actions;
  });
  const rtRef = useRef({ activateTool, units, toast, getMap });
  useEffect(() => {
    rtRef.current = { activateTool, units, toast, getMap };
  });
  const pointerTypeRef = useRef<string>("mouse");

  const finish = useCallback(() => {
    const s = stateRef.current;
    const rt = rtRef.current;
    if (!s.sketchTool) return;
    const need = minVerticesFor(s.sketchTool);
    if (s.sketchVertices.length < need) {
      rt.toast(measureStrings.minVertices(s.sketchTool));
      return; // keep the sketch open — the user can keep clicking
    }
    const m: Measurement = {
      id: crypto.randomUUID(),
      kind: s.sketchTool,
      vertices: s.sketchVertices.map(
        (v) => [v[0], v[1]] as MeasureVertex
      ),
      unit: rt.units, // creation-time snapshot, display context only
      createdAt: new Date().toISOString(),
    };
    actionsRef.current.commit(m);
    rt.activateTool(null); // commit → idle (spec §1.1)
  }, []);
  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  });

  const cancelSketch = useCallback(() => {
    actionsRef.current.cancelSketch();
    rtRef.current.activateTool(null);
  }, []);

  // Start a fresh sketch whenever a measure tool arms.
  useEffect(() => {
    if (!kind || disabled) return;
    actions.startSketch(kind);
  }, [kind, disabled, actions]);

  // Sketch gesture wiring (active tool only).
  useEffect(() => {
    if (!kind || disabled) return;
    const map = getMap();
    if (!map) return;
    const canvas = map.getCanvas();

    const onPointerDown = (e: PointerEvent) => {
      pointerTypeRef.current = e.pointerType || "mouse";
    };

    const onClick = (e: MapMouseEvent) => {
      const s = stateRef.current;
      if (!s.sketchTool) return;
      const m = rtRef.current.getMap();
      if (!m) return;
      // Explicit unproject — camera-independent in 2D and 3D (spec §1.6).
      const ll = m.unproject(e.point);
      const v: MeasureVertex = [ll.lng, ll.lat];
      // Click-last-vertex finishes (desktop primary alongside dblclick).
      const verts = s.sketchVertices;
      const last = verts[verts.length - 1];
      if (last) {
        const p = m.project([last[0], last[1]]);
        if (Math.hypot(p.x - e.point.x, p.y - e.point.y) <= 10) {
          finishRef.current();
          return;
        }
      }
      actionsRef.current.addVertex(v);
    };

    const onDblClick = () => {
      // Double-tap is NOT a finish gesture on touch (spec §3.2).
      if (pointerTypeRef.current === "touch") return;
      finishRef.current();
    };

    const onContextMenu = (e: MapMouseEvent) => {
      const s = stateRef.current;
      if (!s.sketchTool || s.sketchVertices.length === 0) return;
      e.preventDefault(); // only while a sketch is in progress
      actionsRef.current.popVertex();
    };

    let raf = 0;
    const onMouseMove = (e: MapMouseEvent) => {
      cancelAnimationFrame(raf);
      const pt = e.point;
      raf = requestAnimationFrame(() => {
        const m = rtRef.current.getMap();
        if (!m) return;
        const ll = m.unproject(pt);
        actionsRef.current.setCursor([ll.lng, ll.lat]);
      });
    };
    const onMouseLeave = () => {
      cancelAnimationFrame(raf);
      actionsRef.current.setCursor(null);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      if (isTypingTarget(e.target)) return;
      if (
        document.querySelector('[role="dialog"][data-tools-modal="true"]')
      ) {
        return;
      }
      e.preventDefault();
      finishRef.current();
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("mouseleave", onMouseLeave);
    map.on("click", onClick);
    map.on("dblclick", onDblClick);
    map.on("contextmenu", onContextMenu);
    map.on("mousemove", onMouseMove);
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      map.off("click", onClick);
      map.off("dblclick", onDblClick);
      map.off("contextmenu", onContextMenu);
      map.off("mousemove", onMouseMove);
      window.removeEventListener("keydown", onKey);
    };
  }, [kind, disabled, getMap]);

  // Selection: chip/geometry → select (+copy on chip); empty map → deselect.
  // Runs ONLY in navigate/select mode — never while any tool owns the map.
  useEffect(() => {
    if (kind || disabled) return;
    if (activeTool !== null && activeTool !== "select") return;
    const map = getMap();
    if (!map) return;

    const onClick = async (e: MapMouseEvent) => {
      const m = rtRef.current.getMap();
      if (!m) return;
      const feats = m.queryRenderedFeatures(e.point, {
        layers: MEASURE_HIT_LAYER_IDS,
      });
      const hit = feats.find(
        (f) => f.properties && typeof f.properties.measureId === "string"
      );
      if (!hit?.properties) {
        actionsRef.current.select(null);
        return;
      }
      const id = hit.properties.measureId as string;
      actionsRef.current.select(id);
      // Chip tap copies the displayed total; geometry tap selects only.
      if (hit.layer.id === MEASURE_CHIP_HIT_LAYER_ID) {
        const s = stateRef.current;
        const mm = s.measurements.find((x) => x.id === id);
        if (mm) {
          const text = formatMeasurement(mm, rtRef.current.units);
          const ok = await copyTextToClipboard(text);
          rtRef.current.toast(
            ok ? measureStrings.copied : measureStrings.copyFailed
          );
        }
      }
    };

    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  }, [kind, disabled, activeTool, getMap]);

  return { kind, finish, cancelSketch };
}
