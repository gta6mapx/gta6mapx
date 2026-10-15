// ─── modules/map/tools/components/toolbar/ToolButton.tsx ─────────────
// One toolbar icon button: tooltip with name + shortcut hint, neon-pink
// active ring, disabled state with "not ready" tooltip. ≥44px touch target.

"use client";

import type { ReactNode } from "react";
import { useTools } from "../../shared/toolRuntime";

interface ToolButtonProps {
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}

export default function ToolButton({
  label,
  shortcut,
  active,
  disabled,
  onClick,
  children,
}: ToolButtonProps) {
  const { strings } = useTools();
  const title = disabled
    ? strings.toolNotReady
    : shortcut
      ? strings.shortcutWith(label, shortcut)
      : label;
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={[
        "flex h-11 w-11 items-center justify-center rounded-lg border text-lg transition-colors",
        active
          ? "border-[#ff50c5] bg-[#ff50c5]/20 text-white shadow-[0_0_12px_rgba(255,80,197,0.45)]"
          : "border-white/10 bg-black/60 text-[#c6cdd8] hover:border-[#ff50c5]/50 hover:text-white",
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
