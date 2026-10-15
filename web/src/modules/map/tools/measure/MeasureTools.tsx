// ─── modules/map/tools/measure/MeasureTools.tsx ─────────────────────
// Main measure-slice component (mounted by the coordinator as a child of
// <MapToolsHost>). Owns, in order:
//
//   1. capability registration ("measure" — toolbar buttons stay disabled
//      until this fires),
//   2. per-tool lifecycle (useToolMode ×2; onCancel discards the sketch —
//      finished measurements STAY visible across tool exit),
//   3. cross-slice edit events (undo/redo over finished-measurement
//      mutations; delete-selected),
//   4. map layers + gesture wiring,
//   5. floating Done / Undo-point / Cancel chips during a sketch,
//   6. the measurements panel (visible when a measure tool is active OR
//      finished measurements exist).
//
// Note: the panel does NOT claim the runtime's one-panel-at-a-time slot —
// it is tool-adjacent UI that auto-shows/hides with tool + data state.

"use client";

import { useEffect, useRef, useState } from "react";
import { onToolEvent, useTools } from "../shared/toolRuntime";
import { useToolMode } from "../components/toolbar/useToolMode";
import { useIsMobile } from "../shared/mobile";
import { registerMeasureShareHandlers } from "../share/shareBridge";
import { MeasureProvider, useMeasureStore } from "./store";
import { useMeasureInteractions } from "./interactions";
import MeasureLayers from "./MeasureLayers";
import MeasurePanel from "./MeasurePanel";
import { measureStrings } from "./sliceStrings";
import { minVerticesFor } from "./types";

export default function MeasureTools() {
  return (
    <MeasureProvider>
      <MeasureSlice />
    </MeasureProvider>
  );
}

function SketchChips({
  onDone,
  onUndoPoint,
  onCancel,
  canFinish,
  canUndoPoint,
}: {
  onDone: () => void;
  onUndoPoint: () => void;
  onCancel: () => void;
  canFinish: boolean;
  canUndoPoint: boolean;
}) {
  const isMobile = useIsMobile();
  return (
    <div className="pointer-events-auto absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-1.5">
      <p className="rounded-md border border-white/10 bg-black/70 px-2.5 py-1 font-mono text-[11px] text-[#c7cfdb] backdrop-blur">
        {isMobile ? measureStrings.finishMobile : measureStrings.finishHint}
      </p>
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/70 p-1.5 backdrop-blur-xl">
        <button
          type="button"
          onClick={onDone}
          disabled={!canFinish}
          className="flex min-h-[44px] items-center gap-1.5 rounded-lg bg-[#ff50c5]/25 px-4 text-sm font-bold text-white transition-colors hover:bg-[#ff50c5]/40 disabled:opacity-40"
        >
          <span aria-hidden="true">✓</span> {measureStrings.done}
        </button>
        <button
          type="button"
          onClick={onUndoPoint}
          disabled={!canUndoPoint}
          aria-label={measureStrings.undoVertex}
          title={measureStrings.undoVertex}
          className="flex min-h-[44px] items-center rounded-lg border border-white/10 px-3.5 text-sm text-[#c7cfdb] transition-colors hover:border-white/40 hover:text-white disabled:opacity-40"
        >
          <span aria-hidden="true">↩</span>
          <span className="ml-1.5 hidden sm:inline">{measureStrings.undoVertex}</span>
        </button>
        <button
          type="button"
          onClick={onCancel}
          aria-label={measureStrings.cancel}
          title={measureStrings.cancel}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-white/10 text-sm text-[#c7cfdb] transition-colors hover:border-red-500/60 hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function MeasureSlice() {
  const { registerCapability, isMinimalTier } = useTools();
  const { state, actions } = useMeasureStore();
  const isMobile = useIsMobile();
  const minimal = isMinimalTier();

  // 1. Capability — toolbar Measure buttons enable once this fires.
  useEffect(() => {
    registerCapability("measure");
  }, [registerCapability]);

  // 1b. Share-annotations bridge. Restored measurements get fresh ids;
  // committed oldest→newest so the newest-first order survives.
  const actionsRef = useRef(actions);
  const stateRef = useRef(state);
  useEffect(() => {
    actionsRef.current = actions;
    stateRef.current = state;
  });
  useEffect(() => {
    return registerMeasureShareHandlers({
      snapshot: () => stateRef.current.measurements,
      restore: (items) => {
        const now = new Date().toISOString();
        let n = 0;
        for (const it of [...items].reverse()) {
          actionsRef.current.commit({
            id: crypto.randomUUID(),
            kind: it.kind,
            vertices: it.v,
            unit: it.u,
            createdAt: now,
          });
          n += 1;
        }
        return n;
      },
    });
  }, []);

  // 2. Lifecycle: ANY deactivation discards the in-progress sketch
  //    (Esc, re-click, other tool, marker select). Finished measurements
  //    are untouched — they persist across tool exit AND reload.
  useToolMode("measure-distance", () => actions.cancelSketch());
  useToolMode("measure-area", () => actions.cancelSketch());

  // 3. Cross-slice edit events (spec §6.4). Undo/redo walk the
  //    finished-measurement mutation stack; delete-selected removes the
  //    selected measurement. (Sketch-vertex undo is right-click / the
  //    mobile Undo chip — never the stack.)
  useEffect(
    () => onToolEvent("gta6mapx:tools:undo", () => actions.undo()),
    [actions]
  );
  useEffect(
    () => onToolEvent("gta6mapx:tools:redo", () => actions.redo()),
    [actions]
  );
  useEffect(
    () =>
      onToolEvent("gta6mapx:tools:delete-selected", () =>
        actions.deleteSelected()
      ),
    [actions]
  );

  // 4. Layers + gesture wiring.
  const { kind, finish, cancelSketch } = useMeasureInteractions();

  // Best-effort beforeunload warning only while a sketch is in progress
  // (spec §1.1).
  const sketching = state.sketchTool !== null;
  const vertexCount = state.sketchVertices.length;
  useEffect(() => {
    if (!sketching || vertexCount === 0) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [sketching, vertexCount]);

  // 5+6. Panel visibility: tool active OR measurements exist. While a tool
  // is active the panel always shows (a dismiss only sticks in navigate
  // mode). On mobile the sheet hides while a sketch is in progress so the
  // Done bar stays reachable; it returns when the tool exits.
  const [dismissed, setDismissed] = useState(false);
  const showPanel =
    !minimal &&
    (kind !== null || !dismissed) &&
    (kind !== null || state.measurements.length > 0) &&
    !(isMobile && sketching);
  const showReopen =
    !minimal &&
    dismissed &&
    kind === null &&
    state.measurements.length > 0;

  const canFinish =
    state.sketchTool !== null &&
    vertexCount >= minVerticesFor(state.sketchTool);

  return (
    <>
      <MeasureLayers />

      {kind !== null && sketching && !minimal && (
        <SketchChips
          onDone={finish}
          onUndoPoint={() => actions.popVertex()}
          onCancel={cancelSketch}
          canFinish={canFinish}
          canUndoPoint={vertexCount > 0}
        />
      )}

      {showPanel && !isMobile && (
        <div className="pointer-events-none absolute left-16 top-[64px] z-20 hidden md:block">
          <MeasurePanel onClose={() => setDismissed(true)} />
        </div>
      )}
      {showPanel && isMobile && (
        <MeasurePanel onClose={() => setDismissed(true)} />
      )}

      {showReopen && (
        <button
          type="button"
          onClick={() => setDismissed(false)}
          aria-label={`${measureStrings.panelTitle} (${state.measurements.length})`}
          className="pointer-events-auto absolute left-16 top-[64px] z-20 hidden min-h-[44px] items-center gap-2 rounded-xl border border-white/10 bg-black/60 px-3 font-mono text-xs text-white backdrop-blur-xl transition-colors hover:border-[#ff50c5]/60 md:flex"
        >
          <span aria-hidden="true">📐</span>
          {measureStrings.panelReopen(state.measurements.length)}
        </button>
      )}
      {showReopen && isMobile && (
        <button
          type="button"
          onClick={() => setDismissed(false)}
          aria-label={`${measureStrings.panelTitle} (${state.measurements.length})`}
          className="pointer-events-auto absolute bottom-24 left-3 z-20 flex min-h-[44px] items-center gap-2 rounded-xl border border-white/10 bg-black/60 px-3 font-mono text-xs text-white backdrop-blur-xl md:hidden"
        >
          <span aria-hidden="true">📐</span>
          {measureStrings.panelReopen(state.measurements.length)}
        </button>
      )}

    </>
  );
}
