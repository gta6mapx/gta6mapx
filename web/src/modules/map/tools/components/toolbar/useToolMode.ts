// ─── modules/map/tools/components/toolbar/useToolMode.ts ────────────────
// Per-slice lifecycle binding (spec §1.1). The state machine itself lives
// in ToolsProvider; slices use this to arm/disarm their tool and react to
// cancellation (in-progress sketches are discarded by the slice on `active`
// flipping false — nothing is silently committed).

"use client";

import { useCallback, useEffect, useRef } from "react";
import { useTools, type ActiveTool, type ToolKind } from "../../shared/toolRuntime";

export interface ToolModeBinding {
  /** True while this slice's tool is the active one. */
  active: boolean;
  /** Arm this tool (cancels any other active tool first). */
  activate: () => void;
  /** Return to navigate mode, discarding in-progress work. */
  cancel: () => void;
}

/**
 * @param kind this slice's tool kind
 * @param onCancel optional cleanup when the tool is cancelled/deactivated
 *   (discard sketch, remove preview layers, restore locks)
 */
export function useToolMode(
  kind: ToolKind | "select",
  onCancel?: () => void
): ToolModeBinding {
  const { activeTool, activateTool } = useTools();
  const active = activeTool === kind;

  const cancel = useCallback(() => {
    activateTool(null);
  }, [activateTool]);

  const activate = useCallback(() => {
    activateTool(kind as ActiveTool);
  }, [activateTool, kind]);

  // Run slice cleanup whenever the tool deactivates for any reason
  // (Esc, re-click, another tool armed, marker selected).
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);
  const prevActiveRef = useRef(active);
  useEffect(() => {
    if (prevActiveRef.current && !active) onCancelRef.current?.();
    prevActiveRef.current = active;
  }, [active]);

  return { active, activate, cancel };
}
