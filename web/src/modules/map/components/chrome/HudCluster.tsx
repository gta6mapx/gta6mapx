// ─── modules/map/components/chrome/HudCluster.tsx ──────────────────────
// Bottom-left cluster: go-to-position button + coordinate console + the
// orbit/tilt hint. CoordHud keeps its own absolute placement (it anchors to
// the map container), so it is rendered as a sibling of the positioned row
// rather than a child. All code below is original (CHROME TEAM, Sep 2026).

"use client";

import CoordHud from "../CoordHud";

interface HudClusterProps {
  getMap: () => import("maplibre-gl").Map | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  hidden: boolean;
  onOpenGoTo: () => void;
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <circle cx="9" cy="9" r="5.5" />
      <path d="M13.2 13.2 17 17" />
    </svg>
  );
}

export default function HudCluster({
  getMap,
  collapsed,
  onToggleCollapsed,
  hidden,
  onOpenGoTo,
}: HudClusterProps) {
  if (hidden) return null;

  return (
    <>
      <CoordHud
        getMap={getMap}
        collapsed={collapsed}
        onToggleCollapsed={onToggleCollapsed}
        hidden={hidden}
      />
      <div className="pointer-events-auto absolute bottom-3 left-3 z-30 flex items-center gap-2 md:fixed md:bottom-6 md:left-5">
        <button
          type="button"
          onClick={onOpenGoTo}
          aria-label="Go to position"
          title="Go to position"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/60 text-[#c6cdd8] shadow-[0_8px_32px_rgba(0,0,0,0.55)] backdrop-blur-md transition-colors hover:border-[#ff50c5]/60 hover:text-[#ff50c5] hover:shadow-[0_0_14px_rgba(255,80,197,0.35)]"
        >
          <SearchIcon />
        </button>
        <p className="hidden font-mono text-[10px] tracking-wide text-white/40 lg:block">
          Ctrl-drag to orbit &middot; right-drag to tilt
        </p>
      </div>
    </>
  );
}
