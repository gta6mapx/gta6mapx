// ─── modules/map/tools/components/toolbar/MobileToolFab.tsx ─────────
// Mobile: single 56px FAB bottom-right (spec §6.2) → bottom-sheet tool menu.
// Sits above the bottom-sheet area, below the filters FAB (which is
// bottom-left) and clear of the coord HUD (bottom-right).

"use client";

import { useTools } from "../../shared/toolRuntime";

export default function MobileToolFab({ onOpen }: { onOpen: () => void }) {
  const { strings, activeTool } = useTools();
  const active = activeTool !== null;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={strings.toolbarLabel}
      title={strings.toolbarLabel}
      className={[
        "pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl shadow-lg transition-colors md:hidden",
        active
          ? "bg-[#ff50c5] text-white shadow-[0_0_18px_rgba(255,80,197,0.6)]"
          : "bg-gradient-to-br from-[#ff50c5] to-[#a855f7] text-white",
      ].join(" ")}
    >
      <span aria-hidden="true">🧰</span>
    </button>
  );
}
