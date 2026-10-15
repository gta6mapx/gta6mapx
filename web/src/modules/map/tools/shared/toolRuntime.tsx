// ─── modules/map/tools/shared/toolRuntime.tsx ───────────────────────────
// The contract every tool slice codes against.
//
// ToolsProvider owns: the active-tool lifecycle (session-only, never
// persisted), the one-panel-at-a-time rule, shared units, capability
// registration, and the cross-slice event bus for keyboard shortcuts.
// Slices get the map via getMap() and self-wire their layers/interactions,
// activating when runtime.activeTool matches their kind.

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { CapabilityTier } from "../../deviceCaps";
import { toolsStrings, type ToolsStrings } from "../strings";

export type DrawToolKind = "pen" | "line" | "rect" | "circle";
export type MeasureToolKind = "measure-distance" | "measure-area";
export type ToolKind = DrawToolKind | MeasureToolKind;
/** null = navigate mode (default). "select" = explicit selection mode. */
export type ActiveTool = "select" | ToolKind | null;
export type PanelId = "overlays" | "display" | "measure" | null;
export type Units = "metric" | "imperial";

export interface ToolCapabilities {
  draw: boolean;
  measure: boolean;
  overlays: boolean;
  display: boolean;
}

const CAPABILITY_DEFAULTS: ToolCapabilities = {
  draw: false,
  measure: false,
  overlays: false,
  display: false,
};

export interface ToolRuntime {
  getMap: () => MapLibreMap | null;
  /** Reduced-graphics tier — tools degrade (no drawing, read-only panels). */
  isMinimalTier: () => boolean;
  activeTool: ActiveTool;
  isToolActive: (kind: ToolKind) => boolean;
  anyToolActive: boolean;
  /**
   * Lifecycle (spec §1.1): activating a tool cancels the previous one —
   * slices discard in-progress sketches in an effect on activeTool change.
   * Re-clicking the active tool exits to navigate. Never persisted.
   */
  activateTool: (tool: ActiveTool) => void;
  /** GameMap pin/cluster guards call this: true while a tool owns the map. */
  shouldSuppress: () => boolean;
  toast: (msg: string) => void;
  strings: ToolsStrings;
  /** One panel at a time (spec §1.1); panels never cancel tools. */
  activePanel: PanelId;
  setActivePanel: (p: PanelId) => void;
  togglePanel: (p: Exclude<PanelId, null>) => void;
  /** Single shared units setting (reads the existing map settings store). */
  units: Units;
  setUnits: (u: Units) => void;
  capabilities: ToolCapabilities;
  registerCapability: (key: keyof ToolCapabilities) => void;
  /** Touch draw mode (spec §2.10): one finger draws, two fingers pan/zoom. */
  touchDrawMode: boolean;
  setTouchDrawMode: (on: boolean) => void;
  /**
   * Swipe comparison mode (two base styles side by side). Independent of
   * activeTool: turning compare on exits any tool/panel; activating any
   * tool exits compare. Session-only, never persisted.
   */
  compareActive: boolean;
  setCompareActive: (on: boolean) => void;
}

const ToolRuntimeContext = createContext<ToolRuntime | null>(null);

export function useTools(): ToolRuntime {
  const rt = useContext(ToolRuntimeContext);
  if (!rt) throw new Error("useTools() must be used inside <ToolsProvider>");
  return rt;
}

// ─── Cross-slice event bus ────────────────────────────────────────────────
// Keyboard shortcuts dispatch these; slices subscribe. Keeps the toolbar
// decoupled from slice internals.

export type ToolEventName =
  | "gta6mapx:tools:undo"
  | "gta6mapx:tools:redo"
  | "gta6mapx:tools:delete-selected"
  | "gta6mapx:tools:toggle-grid"
  | "gta6mapx:tools:toggle-heatmap"
  | "gta6mapx:tools:toggle-fov";

export function emitToolEvent(name: ToolEventName): void {
  window.dispatchEvent(new CustomEvent(name));
}

export function onToolEvent(
  name: ToolEventName,
  handler: () => void
): () => void {
  const wrapped = () => handler();
  window.addEventListener(name, wrapped);
  return () => window.removeEventListener(name, wrapped);
}

// ─── Provider ─────────────────────────────────────────────────────────────

interface ToolsProviderProps {
  getMap: () => MapLibreMap | null;
  getTier: () => CapabilityTier;
  toast: (msg: string) => void;
  /** Controlled units — single source of truth lives in GameMap's settings. */
  units: Units;
  onUnitsChange: (u: Units) => void;
  children: ReactNode;
  /** GameMap 2D/3D controls, for the 2/3 shortcuts. */
  set2D?: () => void;
  set3D?: () => void;
}

export function ToolsProvider({
  getMap,
  getTier,
  toast,
  units,
  onUnitsChange,
  set2D,
  set3D,
  children,
}: ToolsProviderProps) {
  const [activeTool, setActiveTool] = useState<ActiveTool>(null);
  const [activePanel, setActivePanel] = useState<PanelId>(null);
  const [capabilities, setCapabilities] = useState<ToolCapabilities>(
    CAPABILITY_DEFAULTS
  );
  const [touchDrawMode, setTouchDrawMode] = useState(false);
  const [compareActive, setCompareActiveState] = useState(false);
  const activeToolRef = useRef<ActiveTool>(null);
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);
  const compareActiveRef = useRef(false);
  useEffect(() => {
    compareActiveRef.current = compareActive;
  }, [compareActive]);

  const setCompareActive = useCallback(
    (on: boolean) => {
      if (on && getTier() === "minimal") {
        toast(toolsStrings.compareMinimalTier);
        return;
      }
      setCompareActiveState(on);
      if (on) {
        // One mode at a time: compare exits tools, panels, touch-draw.
        setActiveTool(null);
        setTouchDrawMode(false);
        setActivePanel(null);
      }
    },
    [getTier, toast]
  );

  const activateTool = useCallback((tool: ActiveTool) => {
    // Activating any tool exits compare mode (one mode at a time).
    if (tool !== null) setCompareActiveState(false);
    setActiveTool((prev) => {
      if (tool !== null && prev === tool) return null; // re-click exits
      return tool;
    });
    // Touch draw mode only makes sense while a draw tool is armed.
    if (tool === null || tool === "select") setTouchDrawMode(false);
  }, []);

  const isToolActive = useCallback(
    (kind: ToolKind) => activeTool === kind,
    [activeTool]
  );

  const shouldSuppress = useCallback(
    () => activeToolRef.current !== null && activeToolRef.current !== "select",
    []
  );

  const togglePanel = useCallback((p: Exclude<PanelId, null>) => {
    setActivePanel((prev) => (prev === p ? null : p));
  }, []);

  const setUnits = useCallback(
    (u: Units) => {
      onUnitsChange(u);
    },
    [onUnitsChange]
  );

  const registerCapability = useCallback((key: keyof ToolCapabilities) => {
    setCapabilities((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  }, []);

  // Esc: cancel tool first, then compare, then close panel (spec: Esc
  // always returns to idle).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      ) {
        return;
      }
      if (compareActiveRef.current) {
        setCompareActiveState(false);
        e.stopPropagation();
      } else if (activeToolRef.current !== null) {
        setActiveTool(null);
        setTouchDrawMode(false);
        e.stopPropagation();
      } else {
        setActivePanel((prev) => (prev === null ? prev : null));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value = useMemo<ToolRuntime>(
    () => ({
      getMap,
      isMinimalTier: () => getTier() === "minimal",
      activeTool,
      isToolActive,
      anyToolActive: activeTool !== null,
      activateTool,
      shouldSuppress,
      toast,
      strings: toolsStrings,
      activePanel,
      setActivePanel,
      togglePanel,
      units,
      setUnits,
      capabilities,
      registerCapability,
      touchDrawMode,
      setTouchDrawMode,
      compareActive,
      setCompareActive,
    }),
    [
      getMap,
      getTier,
      toast,
      activeTool,
      isToolActive,
      activateTool,
      shouldSuppress,
      activePanel,
      togglePanel,
      units,
      setUnits,
      capabilities,
      registerCapability,
      touchDrawMode,
      compareActive,
      setCompareActive,
    ]
  );

  // Expose 2D/3D + panel control to the keyboard-shortcut hook via context.
  return (
    <ToolRuntimeContext.Provider value={value}>
      <ToolShortcutBridge set2D={set2D} set3D={set3D} />
      {children}
    </ToolRuntimeContext.Provider>
  );
}

/** Internal: keeps 2D/3D callbacks reachable for the shortcut hook. */
const bridgeRef: {
  current: { set2D?: () => void; set3D?: () => void };
} = { current: {} };

function ToolShortcutBridge({
  set2D,
  set3D,
}: {
  set2D?: () => void;
  set3D?: () => void;
}) {
  bridgeRef.current = { set2D, set3D };
  return null;
}

export function getToolViewControls(): {
  set2D?: () => void;
  set3D?: () => void;
} {
  return bridgeRef.current;
}
