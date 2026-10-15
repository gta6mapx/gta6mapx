// ─── modules/map/tools/draw/DrawTools.tsx ───────────────────────────────
// Drawing toolkit slice root (spec §2). Registers the "draw" capability,
// mounts layers + pointer interactions, and renders the floating style UI
// (desktop glass panel / mobile bottom sheet), the mobile draw-mode
// banner, line-tool ✓/✗ buttons, undo/redo, clear-all, export/import.
//
// Minimal tier: drawing is disabled entirely — the component renders
// nothing and never registers the capability (silent degradation).

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTools, onToolEvent } from "../shared/toolRuntime";
import { useToolMode } from "../components/toolbar/useToolMode";
import { useIsMobile } from "../shared/mobile";
import GlassPanel from "../shared/glassPanel";
import MobileSheet from "../../components/MobileSheet";
import { restackToolLayers } from "../shared/layerOrder";
import {
  createDrawStore,
  useDrawStore,
  MAX_DRAWINGS,
  type DrawStore,
} from "./store";
import {
  mountDrawingLayers,
  type DrawingLayers,
} from "./layers";
import {
  DrawInteractions,
  type InteractionTool,
} from "./interactions";
import {
  NEON_SWATCHES,
  DEFAULT_DRAW_STYLE,
  loadRecentColors,
  pushRecentColor,
} from "./palette";
import {
  exportDrawingsPng,
  exportDrawingsGeoJson,
  importDrawingsFromFile,
} from "./export";
import {
  ConfirmClearDialog,
  ImportReportDialog,
  type ImportReport,
} from "./DrawDialogs";
import { drawStrings as S } from "./sliceStrings";
import { isClosedKind, type DrawFeature, type DrawStyle, type DrawToolKind } from "./types";
import { registerDrawShareHandlers } from "../share/shareBridge";
import { toolsStrings } from "../strings";

const TOOL_LABELS: Record<DrawToolKind, string> = {
  pen: "Pen",
  line: "Line",
  rect: "Rectangle",
  circle: "Circle",
};

function isDrawToolKind(t: string | null): t is DrawToolKind {
  return t === "pen" || t === "line" || t === "rect" || t === "circle";
}

function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || typeof el.tagName !== "string") return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable
  );
}

export default function DrawTools() {
  const { isMinimalTier, registerCapability } = useTools();
  const minimal = isMinimalTier();
  useEffect(() => {
    if (!minimal) registerCapability("draw");
  }, [minimal, registerCapability]);
  if (minimal) return null;
  return <DrawToolsInner />;
}

function DrawToolsInner() {
  const {
    getMap,
    activeTool,
    activateTool,
    toast,
    touchDrawMode,
  } = useTools();
  const isMobile = useIsMobile();

  const store: DrawStore = useMemo(() => createDrawStore(), []);
  const state = useDrawStore(store);
  const layersRef = useRef<DrawingLayers | null>(null);
  const interactionsRef = useRef<DrawInteractions | null>(null);
  const touchDrawModeRef = useRef(touchDrawMode);
  const activeToolRef = useRef(activeTool);
  useEffect(() => {
    activeToolRef.current = activeTool;
  });

  // Recent colors load lazily (client-only tree — GameMap is ssr:false,
  // same pattern as useFound).
  const [recentColors, setRecentColors] = useState<string[]>(() =>
    loadRecentColors()
  );
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // useToolMode bindings (spec §1.1): onCancel discards the in-progress
  // sketch for ANY deactivation reason — never commits silently.
  const cancelSketch = useCallback(
    () => interactionsRef.current?.cancelSketch(),
    []
  );
  const penMode = useToolMode("pen", cancelSketch);
  const lineMode = useToolMode("line", cancelSketch);
  const rectMode = useToolMode("rect", cancelSketch);
  const circleMode = useToolMode("circle", cancelSketch);
  const toolActive: Record<DrawToolKind, boolean> = {
    pen: penMode.active,
    line: lineMode.active,
    rect: rectMode.active,
    circle: circleMode.active,
  };
  const activeDrawTool: DrawToolKind | null = isDrawToolKind(activeTool)
    ? activeTool
    : null;

  // ─── Persistence restore ─────────────────────────────────────────────
  useEffect(() => {
    store.load({
      onCorrupt: () => toast(S.drawingsCorrupt),
      onQuota: () => toast(S.quotaWarning),
    });
  }, [store, toast]);

  // ─── Share-annotations bridge ────────────────────────────────────────
  // Lets the share UI snapshot/restore drawings without prop-drilling.
  // Restored drawings get fresh ids + now timestamps, appended in one
  // undoable commit; anything past the 200-drawing cap is dropped with an
  // honest toast.
  useEffect(() => {
    return registerDrawShareHandlers({
      snapshot: () => store.getState().features,
      restore: (items) => {
        const now = new Date().toISOString();
        const features: DrawFeature[] = items.map((it) => ({
          id: crypto.randomUUID(),
          kind: it.kind,
          geometry: it.g,
          style: {
            color: it.s.c,
            thickness: it.s.t,
            opacity: it.s.o,
            fill: it.s.f,
            fillOpacity: it.s.fo,
          },
          ...(it.m
            ? { meta: { center: it.m.c, radiusMeters: it.m.r } }
            : {}),
          createdAt: now,
          updatedAt: now,
        }));
        const room = Math.max(0, MAX_DRAWINGS - store.getState().features.length);
        const fitting = features.slice(0, room);
        if (fitting.length === 0) {
          if (features.length > 0) toast(toolsStrings.shareDrawingsFull);
          return 0;
        }
        const ok = store.commit("load shared drawings", (list) => [
          ...list,
          ...fitting,
        ]);
        if (!ok) {
          toast(toolsStrings.shareDrawingsFull);
          return 0;
        }
        if (fitting.length < features.length) toast(toolsStrings.shareDrawingsFull);
        return fitting.length;
      },
    });
  }, [store, toast]);

  // ─── Layers + interactions mount (survives base-style switches) ──────
  // Mount-once per map instance: GameMap passes getMap as an inline arrow
  // (new identity every render), so this effect deliberately has NO deps —
  // it polls for map availability instead of re-running per render.
  // (Re-running would destroy layers/interactions and discard sketches.)
  const getMapRef = useRef(getMap);
  useEffect(() => {
    getMapRef.current = getMap;
  });
  useEffect(() => {
    let map: ReturnType<typeof getMap> = null;
    let layers: DrawingLayers | null = null;
    let interactions: DrawInteractions | null = null;
    let cancelled = false;
    let bootTimer: ReturnType<typeof setTimeout> | null = null;

    const interactionToolFor = (
      t: typeof activeToolRef.current
    ): InteractionTool =>
      isDrawToolKind(t) ? t : t === null || t === "select" ? t : "suspended";

    const mountFor = (m: NonNullable<typeof map>) => {
      layers = mountDrawingLayers(m);
      layersRef.current = layers;
      interactions = new DrawInteractions(m, {
        store,
        toast,
        activateTool,
        getDefaultStyle: () => store.getState().defaultStyle,
        isTouchDrawMode: () => touchDrawModeRef.current,
        getLayers: () => layersRef.current,
      });
      interactionsRef.current = interactions;
      interactions.setTool(interactionToolFor(activeToolRef.current));
      layers.sync(store.getState().features);
      layers.setSelected(store.getState().selectedId);
      restackToolLayers(m);
    };

    // setStyle wipes sources/layers (styleManager.rebuildOverlays only
    // re-runs ITS registrars) — re-add ours idempotently. Interactions
    // survive: they listen on the canvas + map instance, not the style.
    const onStyleData = () => {
      if (cancelled || !map || !map.isStyleLoaded()) return;
      layers = mountDrawingLayers(map);
      layersRef.current = layers;
      layers.sync(store.getState().features);
      layers.setSelected(store.getState().selectedId);
      restackToolLayers(map);
    };

    const boot = () => {
      if (cancelled) return;
      const m = getMapRef.current();
      if (m && m.isStyleLoaded()) {
        map = m;
        mountFor(m);
        m.on("styledata", onStyleData);
      } else {
        bootTimer = setTimeout(boot, 150);
      }
    };
    boot();

    return () => {
      cancelled = true;
      if (bootTimer) clearTimeout(bootTimer);
      if (map) map.off("styledata", onStyleData);
      interactions?.destroy();
      interactionsRef.current = null;
      layers?.destroy();
      layersRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Store → layers sync ─────────────────────────────────────────────
  useEffect(() => {
    layersRef.current?.sync(state.features);
  }, [state.features]);

  useEffect(() => {
    layersRef.current?.setSelected(state.selectedId);
    interactionsRef.current?.refreshVertexDots();
  }, [state.selectedId]);

  // ─── Tool → interactions routing ─────────────────────────────────────
  useEffect(() => {
    const t: InteractionTool = isDrawToolKind(activeTool)
      ? activeTool
      : activeTool === null || activeTool === "select"
        ? activeTool
        : "suspended";
    interactionsRef.current?.setTool(t);
  }, [activeTool]);

  // ─── Touch draw mode → session locks ─────────────────────────────────
  useEffect(() => {
    touchDrawModeRef.current = touchDrawMode;
    interactionsRef.current?.refreshTouchLock();
  }, [touchDrawMode]);

  // ─── Cross-slice edit events (keyboard shortcuts) ────────────────────
  useEffect(() => {
    const offs = [
      onToolEvent("gta6mapx:tools:undo", () => {
        const label = interactionsRef.current?.undo();
        if (label) toast(S.restoredUndo(label));
      }),
      onToolEvent("gta6mapx:tools:redo", () => {
        const label = interactionsRef.current?.redo();
        if (label) toast(S.restoredRedo(label));
      }),
      onToolEvent("gta6mapx:tools:delete-selected", () => {
        interactionsRef.current?.deleteSelected();
      }),
    ];
    return () => {
      for (const off of offs) off();
    };
  }, [toast]);

  // ─── Chrome bridge (CHROME TEAM, Sep 2026) ────────────────────────────
  // Lets the LeftRail chrome reflect real undo/redo availability and reuse
  // this slice's own clear-all confirm dialog instead of forking it.
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("gta6mapx:draw-stack", {
        detail: { canUndo: state.canUndo, canRedo: state.canRedo },
      })
    );
  }, [state.canUndo, state.canRedo]);

  useEffect(() => {
    const onRequestClearAll = () => {
      if (store.getState().features.length > 0) setShowClearConfirm(true);
    };
    window.addEventListener(
      "gta6mapx:draw:request-clear-all",
      onRequestClearAll
    );
    return () =>
      window.removeEventListener(
        "gta6mapx:draw:request-clear-all",
        onRequestClearAll
      );
  }, [store]);

  // ─── Esc deselects in navigate mode ───────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (isTypingTarget(e.target)) return;
      if (
        document.querySelector('[role="dialog"][data-tools-modal="true"]')
      )
        return;
      const t = activeToolRef.current;
      if ((t === null || t === "select") && store.getState().selectedId) {
        store.setSelected(null);
        layersRef.current?.setSelected(null);
        layersRef.current?.setVertexDots([]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store]);

  // ─── Actions ─────────────────────────────────────────────────────────

  const closePanel = useCallback(() => {
    if (isDrawToolKind(activeToolRef.current)) activateTool(null);
    else {
      store.setSelected(null);
      layersRef.current?.setSelected(null);
      layersRef.current?.setVertexDots([]);
    }
  }, [activateTool, store]);

  const applyStyle = useCallback(
    (patch: Partial<DrawStyle>) => {
      const { selectedId, defaultStyle } = store.getState();
      if (selectedId) {
        store.restyleSelection(patch);
      } else {
        const next: DrawStyle = {
          ...defaultStyle,
          ...patch,
          thickness: Math.min(
            12,
            Math.max(1, Math.round(patch.thickness ?? defaultStyle.thickness))
          ),
          opacity: Math.min(
            100,
            Math.max(0, Math.round(patch.opacity ?? defaultStyle.opacity))
          ),
          fillOpacity: Math.min(
            100,
            Math.max(0, Math.round(patch.fillOpacity ?? defaultStyle.fillOpacity))
          ),
        };
        store.setDefaultStyle(next);
      }
      if (patch.color) setRecentColors(pushRecentColor(patch.color));
    },
    [store]
  );

  const doExportPng = useCallback(async () => {
    const map = getMap();
    if (!map) return;
    const ok = await exportDrawingsPng(map);
    toast(ok ? S.pngExported : S.pngFailed);
  }, [getMap, toast]);

  const doExportGeoJson = useCallback(() => {
    const ok = exportDrawingsGeoJson(store.getState().features);
    toast(ok ? S.geojsonExported : S.geojsonFailed);
  }, [store, toast]);

  const onImportFile = useCallback(
    async (file: File) => {
      const { features, defaultStyle } = store.getState();
      const result = await importDrawingsFromFile(
        file,
        features.length,
        defaultStyle
      );
      if (result.blocked) {
        toast(S.importLimitBlocked(MAX_DRAWINGS));
        return;
      }
      if (result.invalid) {
        toast(S.importBadFile);
        return;
      }
      if (result.features.length === 0 && result.skipped === 0) {
        toast(S.importEmpty);
        return;
      }
      if (result.features.length > 0) {
        const ok = store.commit("import drawings", (list) => [
          ...list,
          ...result.features,
        ]);
        if (!ok) {
          toast(S.drawingLimit(MAX_DRAWINGS));
          return;
        }
      }
      setImportReport({
        ok: result.features.length,
        skipped: result.skipped,
        errors: result.errors,
        capped: result.capped,
      });
    },
    [store, toast]
  );

  const confirmClear = useCallback(() => {
    const n = store.getState().features.length;
    store.clearAll();
    setShowClearConfirm(false);
    toast(S.clearedDrawings(n));
  }, [store, toast]);

  // ─── Render ──────────────────────────────────────────────────────────

  const showPanel = activeDrawTool !== null || state.selectedId !== null;
  const selectedFeature = state.features.find(
    (f) => f.id === state.selectedId
  );
  const closedContext =
    (activeDrawTool !== null && isClosedKind(activeDrawTool)) ||
    (selectedFeature !== undefined && isClosedKind(selectedFeature.kind));
  const style = state.defaultStyle;

  const styleUi = (
    <div className="flex flex-col gap-4">
      {activeDrawTool && (
        <p className="font-mono text-[11px] text-[#8b94a3]">
          {S.toolActiveHint(TOOL_LABELS[activeDrawTool])}
        </p>
      )}
      {!activeDrawTool && state.selectedId && (
        <p className="font-mono text-[11px] text-[#8b94a3]">{S.selectHint}</p>
      )}

      {/* Color */}
      <section aria-label={S.drawingColor}>
        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/70">
          {S.drawingColor}
        </h3>
        <div className="grid grid-cols-4 gap-2">
          {NEON_SWATCHES.map((sw) => (
            <button
              key={sw.hex}
              type="button"
              title={sw.name}
              aria-label={sw.name}
              aria-pressed={style.color.toUpperCase() === sw.hex}
              onClick={() => applyStyle({ color: sw.hex })}
              style={{ backgroundColor: sw.hex }}
              className={`h-11 rounded-lg border-2 transition-transform ${
                style.color.toUpperCase() === sw.hex
                  ? "border-white scale-105"
                  : "border-white/20 hover:border-white/60"
              }`}
            />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <label
            htmlFor="draw-custom-color"
            className="font-mono text-[11px] text-[#8b94a3]"
          >
            {S.customColor}
          </label>
          <input
            id="draw-custom-color"
            type="color"
            value={style.color}
            onChange={(e) => applyStyle({ color: e.target.value })}
            className="h-11 w-16 cursor-pointer rounded-lg border border-white/20 bg-transparent"
          />
        </div>
        {recentColors.length > 0 && (
          <div className="mt-2">
            <p className="mb-1 font-mono text-[11px] text-[#8b94a3]">
              {S.recentColors}
            </p>
            <div className="flex gap-2">
              {recentColors.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  title={hex}
                  aria-label={`Recent color ${hex}`}
                  onClick={() => applyStyle({ color: hex })}
                  style={{ backgroundColor: hex }}
                  className={`h-11 flex-1 rounded-lg border-2 ${
                    style.color.toUpperCase() === hex
                      ? "border-white"
                      : "border-white/20 hover:border-white/60"
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Thickness */}
      <section aria-label={S.drawingThickness}>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-white/70">
            {S.drawingThickness}
          </h3>
          <span className="font-mono text-xs text-white">{style.thickness}px</span>
        </div>
        <input
          type="range"
          min={1}
          max={12}
          step={1}
          value={style.thickness}
          onChange={(e) => applyStyle({ thickness: Number(e.target.value) })}
          className="flex h-11 w-full cursor-pointer items-center accent-[#ff2d78]"
          aria-valuetext={`${style.thickness} pixels`}
        />
      </section>

      {/* Opacity */}
      <section aria-label={S.drawingOpacity}>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-white/70">
            {S.drawingOpacity}
          </h3>
          <span className="font-mono text-xs text-white">{style.opacity}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={style.opacity}
          onChange={(e) => applyStyle({ opacity: Number(e.target.value) })}
          className="flex h-11 w-full cursor-pointer items-center accent-[#ff2d78]"
          aria-valuetext={`${style.opacity} percent`}
        />
      </section>

      {/* Fill (closed shapes only) */}
      {closedContext && (
        <section aria-label={S.drawingFill}>
          <button
            type="button"
            role="switch"
            aria-checked={style.fill}
            onClick={() => applyStyle({ fill: !style.fill })}
            className="flex h-11 w-full items-center justify-between rounded-lg border border-white/15 px-3 transition-colors hover:border-white/40"
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/70">
              {S.drawingFill}
            </span>
            <span
              aria-hidden="true"
              className={`relative h-6 w-11 rounded-full transition-colors ${
                style.fill ? "bg-[#ff2d78]" : "bg-white/15"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                  style.fill ? "left-[22px]" : "left-0.5"
                }`}
              />
            </span>
          </button>
          {style.fill && (
            <>
              <div className="mb-1 mt-2 flex items-center justify-between">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-white/70">
                  {S.drawingFillOpacity}
                </h3>
                <span className="font-mono text-xs text-white">
                  {style.fillOpacity}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={style.fillOpacity}
                onChange={(e) =>
                  applyStyle({ fillOpacity: Number(e.target.value) })
                }
                className="flex h-11 w-full cursor-pointer items-center accent-[#ff2d78]"
                aria-valuetext={`${style.fillOpacity} percent`}
              />
            </>
          )}
        </section>
      )}

      <p className="font-mono text-[11px] text-[#8b94a3]">
        {state.selectedId ? S.appliesToSelection : S.appliesToNew}
      </p>

      {/* Undo / redo */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            const label = interactionsRef.current?.undo();
            if (label) toast(S.restoredUndo(label));
          }}
          disabled={!state.canUndo}
          title={state.undoLabel ? S.undoLabel(state.undoLabel) : S.nothingToUndo}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-white/15 text-sm font-medium text-white transition-colors hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span aria-hidden="true">↩</span> {S.undo}
        </button>
        <button
          type="button"
          onClick={() => {
            const label = interactionsRef.current?.redo();
            if (label) toast(S.restoredRedo(label));
          }}
          disabled={!state.canRedo}
          title={state.redoLabel ? S.redoLabel(state.redoLabel) : S.nothingToRedo}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-white/15 text-sm font-medium text-white transition-colors hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span aria-hidden="true">↪</span> {S.redo}
        </button>
      </div>

      {/* Clear / export / import */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setShowClearConfirm(true)}
          disabled={state.features.length === 0}
          className="flex h-11 items-center justify-center rounded-lg border border-white/15 text-sm font-medium text-white transition-colors hover:border-[#ff2d78]/60 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {S.clearAll}
        </button>
        <button
          type="button"
          onClick={doExportPng}
          disabled={state.features.length === 0}
          className="flex h-11 items-center justify-center rounded-lg border border-white/15 text-sm font-medium text-white transition-colors hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {S.exportPng}
        </button>
        <button
          type="button"
          onClick={doExportGeoJson}
          disabled={state.features.length === 0}
          className="flex h-11 items-center justify-center rounded-lg border border-white/15 text-sm font-medium text-white transition-colors hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {S.exportGeoJson}
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex h-11 items-center justify-center rounded-lg border border-white/15 text-sm font-medium text-white transition-colors hover:border-white/40"
        >
          {S.importGeoJson}
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".geojson,.json,application/geo+json,application/json"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void onImportFile(file);
        }}
      />
      {state.features.length === 0 && !activeDrawTool && (
        <p className="font-mono text-[11px] text-[#8b94a3]">{S.noDrawings}</p>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop floating style panel — right of the vertical toolbar */}
      {showPanel && !isMobile && (
        <div className="absolute left-[68px] top-[64px] z-20">
          <GlassPanel title={S.panelTitle} onClose={closePanel} widthClass="w-80">
            {styleUi}
          </GlassPanel>
        </div>
      )}

      {/* Mobile: style panel as bottom sheet */}
      {showPanel && isMobile && (
        <MobileSheet onClose={closePanel}>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-white">
            {S.panelTitle}
            {activeDrawTool ? ` — ${TOOL_LABELS[activeDrawTool]}` : ""}
          </h2>
          {styleUi}
        </MobileSheet>
      )}

      {/* Mobile draw-mode banner (spec §2.10): active tool + Done */}
      {isMobile && touchDrawMode && activeDrawTool && (
        <div className="pointer-events-auto absolute left-1/2 top-3 z-20 flex w-max max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-xl border border-[#ff2d78]/40 bg-black/70 py-1.5 pl-4 pr-1.5 backdrop-blur-xl">
          <span className="font-mono text-xs text-white">
            {S.drawModeBanner(TOOL_LABELS[activeDrawTool])}
          </span>
          <button
            type="button"
            onClick={() => activateTool(null)}
            className="flex h-11 items-center rounded-lg bg-[#ff2d78] px-4 text-sm font-bold text-white"
          >
            {S.done}
          </button>
        </div>
      )}

      {/* Line tool on-screen ✓/✗ (touch double-tap fallback, spec §2.1) */}
      {isMobile && touchDrawMode && toolActive.line && (
        <div className="absolute bottom-28 right-3 z-20 flex flex-col gap-2">
          <button
            type="button"
            aria-label={S.finishLine}
            title={S.finishLine}
            onClick={() => interactionsRef.current?.finishLine()}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-[#22d3ee]/50 bg-[#22d3ee]/15 text-xl text-[#7ee7f7] backdrop-blur"
          >
            ✓
          </button>
          <button
            type="button"
            aria-label={S.cancelLine}
            title={S.cancelLine}
            onClick={() => interactionsRef.current?.cancelSketch()}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/60 text-xl text-white backdrop-blur"
          >
            ✗
          </button>
        </div>
      )}

      {/* Dialogs */}
      {showClearConfirm && (
        <ConfirmClearDialog
          count={state.features.length}
          onCancel={() => setShowClearConfirm(false)}
          onConfirm={confirmClear}
        />
      )}
      {importReport && (
        <ImportReportDialog
          report={importReport}
          limit={MAX_DRAWINGS}
          onClose={() => setImportReport(null)}
        />
      )}
    </>
  );
}

// Re-export for the coordinator's convenience; DEFAULT_DRAW_STYLE kept
// importable without reaching into palette.ts.
export { DEFAULT_DRAW_STYLE };
