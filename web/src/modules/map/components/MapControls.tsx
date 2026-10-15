"use client";

import type { ClusterColorMode } from "../markerLayer";
import { discoveryStrings as S } from "@/modules/discovery/strings";

interface MapControlsProps {
  is3D: boolean;
  onToggle3D(): void;
  threeDDisabled: boolean;
  threeDReason?: string;
  onReset(): void;
  clusterMode: ClusterColorMode;
  onClusterMode(mode: ClusterColorMode): void;
}

/** Original reset-view glyph. */
function ResetGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <circle cx="10" cy="10" r="2" />
      <path d="M10 2.5v2.5M10 15v2.5M2.5 10H5M15 10h2.5" />
      <circle cx="10" cy="10" r="7" strokeDasharray="3 2" />
    </svg>
  );
}

/**
 * MapControls — 2D/3D segmented toggle + cluster color mode + reset view.
 * 44px minimum targets; compass is handled separately by the coordinator.
 */
export default function MapControls({
  is3D,
  onToggle3D,
  threeDDisabled,
  threeDReason,
  onReset,
  clusterMode,
  onClusterMode,
}: MapControlsProps) {
  const segBase =
    "flex h-11 min-w-[44px] items-center justify-center rounded-full px-4 text-xs font-bold uppercase tracking-wider transition-colors";
  const segActive =
    "bg-gradient-to-r from-[#ff50c5] to-[#a855f7] text-white shadow-[0_0_16px_rgba(255,80,197,0.4)]";
  const segInactive = "text-[#8b94a3] hover:text-[#e8ecf1]";

  return (
    <div className="pointer-events-auto flex items-center gap-2">
      <div
        role="group"
        aria-label="Map dimension"
        className="seg-control flex items-center gap-1 rounded-full border border-[#1f2632] bg-[#0d1219]/85 p-1 backdrop-blur-xl"
      >
        <button
          type="button"
          aria-pressed={!is3D}
          onClick={() => {
            if (is3D) onToggle3D();
          }}
          className={`${segBase} ${!is3D ? segActive : segInactive}`}
        >
          2D
        </button>
        <button
          type="button"
          aria-pressed={is3D}
          disabled={threeDDisabled}
          title={threeDDisabled ? threeDReason ?? "3D is unavailable right now" : "Switch to 3D"}
          onClick={() => {
            if (!is3D) onToggle3D();
          }}
          className={`${segBase} ${is3D ? segActive : segInactive} disabled:cursor-not-allowed disabled:opacity-40`}
        >
          3D
        </button>
      </div>

      <div
        role="group"
        aria-label={S.clusterModeLabel}
        title={S.clusterModeLabel}
        className="seg-control flex items-center gap-1 rounded-full border border-[#1f2632] bg-[#0d1219]/85 p-1 backdrop-blur-xl"
      >
        {(["evidence", "category"] as ClusterColorMode[]).map((mode) => {
          const isOn = clusterMode === mode;
          return (
            <button
              key={mode}
              type="button"
              aria-pressed={isOn}
              onClick={() => onClusterMode(mode)}
              title={
                mode === "evidence"
                  ? S.clusterModeEvidence
                  : S.clusterModeCategory
              }
              className={`${segBase} ${isOn ? segActive : segInactive}`}
            >
              {mode === "evidence" ? S.clusterModeEvidence : S.clusterModeCategory}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onReset}
        aria-label="Reset map view"
        title="Reset map view"
        className="btn-ghost flex h-11 w-11 items-center justify-center rounded-full border border-[#1f2632] bg-[#0d1219]/85 text-[#c3cad4] backdrop-blur-xl transition-colors hover:border-[rgba(255,80,197,0.6)] hover:text-white"
      >
        <ResetGlyph />
      </button>
    </div>
  );
}
