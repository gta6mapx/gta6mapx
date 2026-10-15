"use client";

import { useEffect, useState } from "react";
import {
  fitFootnote,
  formatGameXY,
  formatLatLng,
  honestCoordString,
  mapToGame,
} from "../gameCoords";

interface CoordHudProps {
  getMap: () => import("maplibre-gl").Map | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  hidden: boolean;
}

const MONO = "var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace";

/** Copy text with a legacy fallback for non-secure contexts. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * CoordHud — bottom-left terminal-style coordinate console.
 * Live readout follows the map CENTER (crosshair ⌖), rAF-throttled.
 * All coordinate text goes through gameCoords (the precision gate) —
 * this component never formats a coordinate itself.
 */
export default function CoordHud({
  getMap,
  collapsed,
  onToggleCollapsed,
  hidden,
}: CoordHudProps) {
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [copied, setCopied] = useState(false);

  // Own subscription: poll until the map exists, then rAF-throttled move listener.
  useEffect(() => {
    let map: import("maplibre-gl").Map | null = null;
    let raf = 0;
    let scheduled = false;
    let disposed = false;

    const read = () => {
      if (!map || disposed) return;
      const c = map.getCenter();
      setCenter({ lat: c.lat, lng: c.lng });
    };

    const onMove = () => {
      if (scheduled) return;
      scheduled = true;
      raf = requestAnimationFrame(() => {
        scheduled = false;
        read();
      });
    };

    const attach = (m: import("maplibre-gl").Map) => {
      map = m;
      m.on("move", onMove);
      read();
    };

    const cleanup = () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (map) map.off("move", onMove);
    };

    const existing = getMap();
    if (existing) {
      attach(existing);
      return cleanup;
    }
    const poll = window.setInterval(() => {
      const m = getMap();
      if (m) {
        window.clearInterval(poll);
        if (!disposed) attach(m);
      }
    }, 250);

    return () => {
      window.clearInterval(poll);
      cleanup();
    };
  }, [getMap]);

  const handleCopy = async () => {
    if (!center) return;
    const ok = await copyText(honestCoordString(center.lat, center.lng));
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  };

  if (hidden) return null;

  const line1 = center
    ? (() => {
        const { x, y } = mapToGame(center.lat, center.lng);
        // Precision stays in gameCoords; we only add labels/separators.
        const [gx, gy] = formatGameXY(x, y).split(", ");
        return `GX ${gx} · GY ${gy}`;
      })()
    : "GX — · GY —";
  const line2 = center ? formatLatLng(center.lat, center.lng) : "≈ —, —";
  const line3 = `≈ approximate — ${fitFootnote()}`;

  const shell =
    "pointer-events-auto rounded-md border border-purple-500/30 bg-black/75 text-purple-300 shadow-[0_2px_12px_rgba(0,0,0,0.5)] backdrop-blur-sm";

  if (collapsed) {
    return (
      <div className={`absolute bottom-14 left-3 z-20 ${shell}`}>
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label="Expand coordinate readout"
          title="Expand coordinate readout"
          className="flex min-h-[32px] min-w-[44px] items-center justify-center gap-1 px-2 text-[11px]"
          style={{ fontFamily: MONO }}
        >
          <span aria-hidden="true">⌖</span>
          <span aria-hidden="true">▸</span>
        </button>
      </div>
    );
  }

  const actionBtn =
    "flex min-h-[28px] min-w-[28px] items-center justify-center rounded px-1 text-purple-400/80 transition-colors hover:bg-purple-500/10 hover:text-purple-200";

  return (
    <div
      className={`absolute bottom-14 left-3 z-20 max-w-[calc(100vw-1.5rem)] ${shell}`}
      style={{ fontFamily: MONO }}
    >
      {/* Compact single line on small screens: game coords only. */}
      <div className="flex items-center gap-2 px-2 py-1.5 sm:hidden">
        <span aria-hidden="true" className="text-purple-400/80" title="Readout follows map center">
          ⌖
        </span>
        <div aria-live="polite" className="text-[11px] whitespace-nowrap">
          {line1}
        </div>
        <button type="button" onClick={handleCopy} aria-label="Copy coordinates" title="Copy coordinates" className={actionBtn}>
          {copied ? <span className="text-[10px]">copied</span> : <span aria-hidden="true">⧉</span>}
        </button>
        <button type="button" onClick={onToggleCollapsed} aria-label="Collapse coordinate readout" title="Collapse" className={actionBtn}>
          <span aria-hidden="true">▾</span>
        </button>
      </div>

      {/* Full console on ≥640px. */}
      <div className="hidden px-3 py-2 sm:block">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-[10px] tracking-widest text-purple-400/70 uppercase">
            <span aria-hidden="true" title="Readout follows map center">⌖</span>
            <span>coords</span>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={handleCopy} aria-label="Copy coordinates" title="Copy honest coordinate string" className={actionBtn}>
              {copied ? (
                <span className="text-[10px]">copied</span>
              ) : (
                <span aria-hidden="true" className="text-[12px]">⧉</span>
              )}
            </button>
            <button type="button" onClick={onToggleCollapsed} aria-label="Collapse coordinate readout" title="Collapse" className={actionBtn}>
              <span aria-hidden="true">▾</span>
            </button>
          </div>
        </div>
        <div aria-live="polite" className="mt-1 space-y-0.5 text-[11px] leading-relaxed">
          <div className="whitespace-nowrap">{line1}</div>
          <div className="whitespace-nowrap text-purple-200/90">{line2}</div>
          <div className="whitespace-nowrap text-[10px] text-amber-300/80">{line3}</div>
        </div>
      </div>
    </div>
  );
}
