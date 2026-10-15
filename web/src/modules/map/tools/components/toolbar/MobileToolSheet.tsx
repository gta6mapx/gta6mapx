// ─── modules/map/tools/components/toolbar/MobileToolSheet.tsx ────────
// Mobile bottom-sheet tool menu (spec §6.2): ≥48px rows for every tool +
// panels, draw-mode toggle at the top. Reuses the map's existing
// MobileSheet drag-to-dismiss pattern.

"use client";

import { useTools, type ToolKind } from "../../shared/toolRuntime";
import { useShareAnnotations } from "../../share/ShareAnnotations";
import MobileSheet from "../../../components/MobileSheet";

const ROWS: Array<{
  id: ToolKind | "overlays" | "display";
  icon: string;
  key: string;
  needs: "draw" | "measure" | "overlays" | "display";
}> = [
  { id: "pen", icon: "✏️", key: "toolPen", needs: "draw" },
  { id: "line", icon: "📏", key: "toolLine", needs: "draw" },
  { id: "rect", icon: "▭", key: "toolRect", needs: "draw" },
  { id: "circle", icon: "◯", key: "toolCircle", needs: "draw" },
  { id: "measure-distance", icon: "📐", key: "toolMeasureDistance", needs: "measure" },
  { id: "measure-area", icon: "⬒", key: "toolMeasureArea", needs: "measure" },
  { id: "overlays", icon: "🗺️", key: "toolOverlays", needs: "overlays" },
  { id: "display", icon: "🎛️", key: "toolDisplay", needs: "display" },
];

export default function MobileToolSheet({ onClose }: { onClose: () => void }) {
  const {
    strings,
    activeTool,
    activateTool,
    togglePanel,
    capabilities,
    isMinimalTier,
    touchDrawMode,
    setTouchDrawMode,
    compareActive,
    setCompareActive,
  } = useTools();
  const { copyLink } = useShareAnnotations();
  const minimal = isMinimalTier();
  const labelFor = (key: string): string =>
    (strings as unknown as Record<string, string>)[key] ?? key;
  const rowClass = (isActive: boolean, ready: boolean) =>
    [
      "flex min-h-12 w-full items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm transition-colors",
      isActive
        ? "border-[#ff50c5] bg-[#ff50c5]/20 text-white"
        : "border-white/10 bg-white/[0.03] text-[#c6cdd8]",
      ready ? "" : "opacity-40",
    ].join(" ");

  return (
    <MobileSheet onClose={onClose}>
      <div className="px-1 pb-2">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-white">
          {strings.toolbarLabel}
        </h2>
        {capabilities.draw && !minimal && (
          <button
            type="button"
            role="switch"
            aria-checked={touchDrawMode}
            onClick={() => setTouchDrawMode(!touchDrawMode)}
            className="mb-3 flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-left"
          >
            <span>
              <span className="block text-sm font-semibold text-white">
                {strings.touchDrawMode}
              </span>
              <span className="block text-xs text-[#8b94a3]">
                {strings.touchDrawModeHint}
              </span>
            </span>
            <span
              aria-hidden="true"
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                touchDrawMode ? "bg-[#ff50c5]" : "bg-white/15"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                  touchDrawMode ? "left-[22px]" : "left-0.5"
                }`}
              />
            </span>
          </button>
        )}
        <ul className="space-y-1">
          {ROWS.map((row) => {
            const ready = capabilities[row.needs] && !minimal;
            const isActive =
              row.id === "overlays" || row.id === "display"
                ? false
                : activeTool === row.id;
            return (
              <li key={row.id}>
                <button
                  type="button"
                  disabled={!ready}
                  onClick={() => {
                    if (row.id === "overlays" || row.id === "display") {
                      togglePanel(row.id);
                    } else {
                      activateTool(
                        activeTool === row.id ? null : (row.id as ToolKind)
                      );
                    }
                    onClose();
                  }}
                  className={rowClass(isActive, ready)}
                >
                  <span aria-hidden="true" className="text-xl">
                    {row.icon}
                  </span>
                  <span className="font-medium">{labelFor(row.key)}</span>
                </button>
              </li>
            );
          })}
          {/* Compare + Share: modes, not tools — they live outside ROWS. */}
          <li>
            <button
              type="button"
              onClick={() => {
                setCompareActive(!compareActive);
                onClose();
              }}
              className={rowClass(compareActive, true)}
            >
              <span aria-hidden="true" className="text-xl">
                ◐
              </span>
              <span className="font-medium">{strings.toolCompare}</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => {
                void copyLink().then(() => onClose());
              }}
              className={rowClass(false, true)}
            >
              <span aria-hidden="true" className="text-xl">
                🔗
              </span>
              <span className="font-medium">{strings.shareAnnotations}</span>
            </button>
          </li>
        </ul>
      </div>
    </MobileSheet>
  );
}
