// ─── modules/map/tools/MapToolsHost.tsx ───────────────────────────────
// Self-contained mount point for the whole tools layer. GameMap renders this
// inside the map viewport and does nothing else — all tool UI, panels,
// locks and keyboard handling live in here.
//
// Slices (draw / measure / overlays / display) are passed as `children` and
// self-register their capability + render their own layers, interactions
// and panels against the ToolRuntime contract.

"use client";

import { useEffect, useState, type ReactNode, type MutableRefObject } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { CapabilityTier } from "../deviceCaps";
import {
  ToolsProvider,
  useTools,
  type Units,
} from "./shared/toolRuntime";
import { applyToolLocks } from "./shared/mapInteractionLocks";
import MobileToolFab from "./components/toolbar/MobileToolFab";
import MobileToolSheet from "./components/toolbar/MobileToolSheet";
import CompareTools, { type CompareStyleHooks } from "./compare/CompareTools";
import { SharedAnnotationsLoader } from "./share/ShareAnnotations";

export interface ToolControl {
  exitTool: () => void;
  shouldSuppress: () => boolean;
}

interface MapToolsHostProps {
  getMap: () => MapLibreMap | null;
  getTier: () => CapabilityTier;
  toast: (msg: string) => void;
  units: Units;
  onUnitsChange: (u: Units) => void;
  /** 2D/3D view controls — removed (flat 2D map); kept optional for compat. */
  set2D?: () => void;
  set3D?: () => void;
  /** GameMap reads exitTool/shouldSuppress for pin/cluster click guards. */
  toolControlRef: MutableRefObject<ToolControl | null>;
  /**
   * Compare-mode style hooks (GameMap-owned StyleManager). Optional so the
   * host stays testable; GameMap always provides them.
   */
  switchBaseStyle?: CompareStyleHooks["switchBaseStyle"];
  getBaseStyleId?: CompareStyleHooks["getBaseStyleId"];
  /** Slice UIs + panels (draw / measure / overlays / display). */
  children?: ReactNode;
}

export default function MapToolsHost({
  getMap,
  getTier,
  toast,
  units,
  onUnitsChange,
  set2D,
  set3D,
  toolControlRef,
  switchBaseStyle,
  getBaseStyleId,
  children,
}: MapToolsHostProps) {
  const compareHooks =
    switchBaseStyle && getBaseStyleId
      ? { switchBaseStyle, getBaseStyleId }
      : undefined;
  return (
    <ToolsProvider
      getMap={getMap}
      getTier={getTier}
      toast={toast}
      units={units}
      onUnitsChange={onUnitsChange}
      set2D={set2D}
      set3D={set3D}
    >
      <HostBridge toolControlRef={toolControlRef} />
      <CompareTools hooks={compareHooks} />
      <HostChrome />
      {children}
      <SharedAnnotationsLoader />
    </ToolsProvider>
  );
}

/** Wires runtime → GameMap guards and per-tool interaction locks. */
function HostBridge({
  toolControlRef,
}: {
  toolControlRef: MutableRefObject<ToolControl | null>;
}) {
  const { getMap, activeTool, activateTool, shouldSuppress } = useTools();

  useEffect(() => {
    toolControlRef.current = {
      exitTool: () => activateTool(null),
      shouldSuppress,
    };
    return () => {
      toolControlRef.current = null;
    };
  }, [toolControlRef, activateTool, shouldSuppress]);

  // Apply / restore map interaction locks + crosshair cursor per tool.
  useEffect(() => {
    const map = getMap();
    if (!map) return;
    const restore = applyToolLocks(map, activeTool);
    return restore;
  }, [getMap, activeTool]);

  return null;
}

/** Toolbar + mobile FAB/sheet + minimal-tier notice. */
function HostChrome() {
  const { strings, isMinimalTier } = useTools();
  const [sheetOpen, setSheetOpen] = useState(false);
  const minimal = isMinimalTier();

  return (
    <>
      {minimal && (
        <p className="pointer-events-none absolute bottom-16 left-1/2 z-20 hidden w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-lg border border-white/10 bg-black/70 px-3 py-1.5 text-center font-mono text-[11px] text-[#8b94a3] backdrop-blur md:block">
          {strings.minimalTierNote}
        </p>
      )}
      <div className="absolute bottom-24 right-3 z-20 md:hidden">
        <MobileToolFab onOpen={() => setSheetOpen(true)} />
      </div>
      {sheetOpen && (
        <div className="md:hidden">
          <MobileToolSheet onClose={() => setSheetOpen(false)} />
        </div>
      )}
    </>
  );
}
