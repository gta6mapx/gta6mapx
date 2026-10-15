// ─── modules/map/tools/shared/glassPanel.tsx ───────────────────────────
// Shared glassmorphism panel shell for tool panels (Overlays / Display /
// Measure list). Desktop-anchored; mobile uses the map's existing
// MobileSheet pattern instead. Reduced-motion aware: no slide/flyout
// animation, instant appearance.

"use client";

import type { ReactNode } from "react";
import { useTools } from "./toolRuntime";

interface GlassPanelProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Tailwind width class override. */
  widthClass?: string;
  labelledBy?: string;
}

export default function GlassPanel({
  title,
  onClose,
  children,
  widthClass = "w-72",
  labelledBy,
}: GlassPanelProps) {
  const { strings } = useTools();
  return (
    <section
      aria-label={labelledBy ?? title}
      className={`glass-panel pointer-events-auto flex max-h-[70dvh] ${widthClass} flex-col rounded-xl p-3`}
    >
      <header className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-white">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={strings.close}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-white/15 text-sm text-white transition-colors hover:border-[#ff50c5]/60"
        >
          ✕
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </section>
  );
}
