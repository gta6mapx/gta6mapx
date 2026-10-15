// ─── modules/map/tools/components/toolbar/DrawFlyout.tsx ────────────
// Draw group flyout: pen / polyline / rectangle / circle. Opens on hover or
// focus, closes on Escape or selection. Reduced-motion aware.

"use client";

import { useEffect, useRef, useState } from "react";
import { useTools, type DrawToolKind } from "../../shared/toolRuntime";
import ToolButton from "./ToolButton";

const DRAW_TOOLS: Array<{
  kind: DrawToolKind;
  key: string;
  icon: string;
}> = [
  { kind: "pen", key: "P", icon: "✏️" },
  { kind: "line", key: "L", icon: "📏" },
  { kind: "rect", key: "R", icon: "▭" },
  { kind: "circle", key: "C", icon: "◯" },
];

export default function DrawFlyout() {
  const { strings, activeTool, activateTool, capabilities, isMinimalTier } =
    useTools();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const ready = capabilities.draw && !isMinimalTier();
  const activeDraw: DrawToolKind | null =
    activeTool === "pen" ||
    activeTool === "line" ||
    activeTool === "rect" ||
    activeTool === "circle"
      ? activeTool
      : null;

  const nameFor = (kind: DrawToolKind): string =>
    kind === "pen"
      ? strings.toolPen
      : kind === "line"
        ? strings.toolLine
        : kind === "rect"
          ? strings.toolRect
          : strings.toolCircle;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDocClick);
    return () => window.removeEventListener("pointerdown", onDocClick);
  }, [open ]);

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={() => ready && setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <ToolButton
        label={strings.toolDraw}
        active={activeDraw !== null}
        disabled={!ready}
        onClick={() => {
          if (!ready) return;
          // Click toggles: arm pen, or exit if a draw tool is active.
          if (activeDraw) activateTool(null);
          else activateTool("pen");
        }}
      >
        <span aria-hidden="true">✏️</span>
      </ToolButton>
      {open && ready && (
        <div
          role="menu"
          aria-label={strings.toolDraw}
          className="glass-panel absolute left-12 top-0 z-30 flex flex-col gap-1 rounded-xl p-2"
        >
          {DRAW_TOOLS.map(({ kind, key, icon }) => (
            <button
              key={kind}
              type="button"
              role="menuitem"
              title={strings.shortcutWith(nameFor(kind), key)}
              onClick={() => {
                activateTool(kind);
                setOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
              }}
              className={[
                "flex h-11 min-w-11 items-center gap-2 rounded-lg border px-2 text-left text-sm transition-colors",
                activeDraw === kind
                  ? "border-[#ff50c5] bg-[#ff50c5]/20 text-white"
                  : "border-white/10 bg-black/60 text-[#c6cdd8] hover:border-[#ff50c5]/50 hover:text-white",
              ].join(" ")}
            >
              <span aria-hidden="true" className="text-lg">
                {icon}
              </span>
              <span className="pr-1 font-medium">{nameFor(kind)}</span>
              <kbd className="ml-auto font-mono text-[10px] text-[#8b94a3]">
                {key}
              </kbd>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
