// ─── modules/map/tools/compare/CompareTools.tsx ────────────────────────
// Swipe comparison of the two base styles (spec §4.4 — built-in comparisons
// are limited to our own openly-licensed base styles; never Rockstar art).
//
// When active, a second MapLibre instance renders the right-hand style in an
// absolutely-positioned container clipped by the draggable divider; the
// primary map keeps the left-hand style. Cameras stay synced both ways with
// a feedback guard. On exit the second instance is destroyed and the primary
// map is restored exactly (style + layer visibility).
//
// Honesty rules (documented, by design):
//  - Annotation/tool layers (drawings, measurements, overlays) are HIDDEN on
//    the primary map while comparing and are NOT rendered on the compare
//    instance either — neither side shows annotations, so the comparison is
//    purely base-map vs base-map. Previous visibility is recorded per layer
//    and restored on exit.
//  - The real-Florida frame legend is GameMap-owned; compare never touches
//    its dismiss state and never adds a second legend (the compare instance
//    renders the bare base style only).
//  - The compare instance is attributionControl:false, but the OSM credit
//    stays visible as tiny text under the right-hand label.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Map as MapLibreMap } from "maplibre-gl";
import { useTools } from "../shared/toolRuntime";
import { toolFamilyLayerIds, type ToolFamily } from "../shared/layerOrder";
import { baseStyleSpecFor, type BaseStyleId } from "../../styleManager";
import { ensureLeonidaBase } from "../../leonidaBase";
import {
  clampDividerPct,
  COMPARE_DIVIDER_MAX,
  COMPARE_DIVIDER_MIN,
  COMPARE_STYLE_LABELS,
  DEFAULT_COMPARE_LEFT,
  DEFAULT_COMPARE_RIGHT,
  resolveStylePair,
  type StylePair,
} from "./compareState";

export interface CompareStyleHooks {
  /** GameMap's base-style switch (toasts on failure, never throws). */
  switchBaseStyle: (id: BaseStyleId) => Promise<void>;
  getBaseStyleId: () => BaseStyleId;
}

/** Annotation families hidden on the primary map while comparing. */
const HIDDEN_FAMILIES: ToolFamily[] = ["overlays", "drawings", "measurements"];

const STYLE_IDS: BaseStyleId[] = ["leonida-dark", "real-florida"];

export default function CompareTools({ hooks }: { hooks?: CompareStyleHooks }) {
  const {
    getMap,
    toast,
    strings,
    compareActive,
    setCompareActive,
  } = useTools();

  // In-memory only (spec: divider position need not persist).
  const [dividerPct, setDividerPct] = useState(50);
  const [pair, setPair] = useState<StylePair>({
    left: DEFAULT_COMPARE_LEFT,
    right: DEFAULT_COMPARE_RIGHT,
  });
  const [switching, setSwitching] = useState(false);

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const compareContainerRef = useRef<HTMLDivElement | null>(null);
  const compareMapRef = useRef<MapLibreMap | null>(null);
  const draggingRef = useRef(false);
  const pairRef = useRef(pair);
  const hooksRef = useRef(hooks);
  // Mirror into refs in an effect (never during render — react-hooks/refs).
  // Declared before the mount effect so the mount always reads fresh values.
  useEffect(() => {
    pairRef.current = pair;
    hooksRef.current = hooks;
  });

  // ── Mount effect: second instance + camera sync + layer hiding. ─────────
  // Also enforces the left-hand style on the primary map (async); the
  // chips reconcile to the real primary style if the switch fails.
  // The illustrated Leonida base needs its artwork layer explicitly on the
  // bare compare instance (no registrars there).
  const mountRightBase = useCallback((m: MapLibreMap, id: BaseStyleId) => {
    if (id !== "leonida-dark") return;
    const add = () => {
      try {
        ensureLeonidaBase(m);
      } catch {
        /* compare base is decorative; never break the tool */
      }
    };
    if (m.isStyleLoaded()) add();
    else m.once("styledata", add);
  }, []);
  useEffect(() => {
    if (!compareActive) return;
    const primary = getMap();
    const h = hooksRef.current;
    if (!primary || !h || !compareContainerRef.current) {
      setCompareActive(false);
      return;
    }
    const prevStyle = h.getBaseStyleId();

    // Hide annotation layers on the primary map (record exact visibility).
    // Only the first sighting is recorded, so a style rebuild mid-compare
    // (setStyle destroys + re-creates layers) never corrupts the pre-compare
    // record. Re-run after any style switch because rebuildOverlays()
    // re-adds layers at their default (visible) state.
    const hidden = new Map<string, "visible" | "none" | undefined>();
    const hidePass = () => {
      for (const family of HIDDEN_FAMILIES) {
        for (const id of toolFamilyLayerIds(family)) {
          if (!primary.getLayer(id)) continue;
          try {
            if (!hidden.has(id)) {
              hidden.set(
                id,
                primary.getLayoutProperty(id, "visibility") as
                  | "visible"
                  | "none"
                  | undefined
              );
            }
            primary.setLayoutProperty(id, "visibility", "none");
          } catch {
            /* best effort */
          }
        }
      }
    };
    hidePass();

    // Enforce the left-hand style on the primary map (best effort), then
    // hide again — the switch's rebuildOverlays() runs after our first pass.
    void (async () => {
      if (h.getBaseStyleId() !== pairRef.current.left) {
        await h.switchBaseStyle(pairRef.current.left).catch(() => {});
      }
      hidePass();
    })();

    // Second instance: right-hand style only, camera copied from primary.
    // No registrars, no camera behaviors, no pin layers — bare base style.
    // The illustrated Leonida base needs its artwork layer explicitly.
    let compare: MapLibreMap | null = null;
    try {
      compare = new MapLibreMap({
        container: compareContainerRef.current,
        style: baseStyleSpecFor(pairRef.current.right),
        center: primary.getCenter(),
        zoom: primary.getZoom(),
        pitch: primary.getPitch(),
        bearing: primary.getBearing(),
        attributionControl: false,
        fadeDuration: 0,
      });
      mountRightBase(compare, pairRef.current.right);
    } catch {
      toast(strings.compareFailed);
      for (const [id, vis] of hidden) {
        try {
          if (primary.getLayer(id))
            primary.setLayoutProperty(id, "visibility", vis ?? "visible");
        } catch {
          /* best effort */
        }
      }
      setCompareActive(false);
      return;
    }
    compareMapRef.current = compare;

    // Two-way camera sync with a feedback guard. jumpTo fires "move"
    // synchronously on the target, so the flag covers the echo. The
    // primary's own camera behaviors (pitch drift-back etc.) keep running —
    // the compare instance simply follows, never fights.
    let syncing = false;
    const copyCamera = (target: MapLibreMap, source: MapLibreMap) => {
      if (syncing) return;
      syncing = true;
      try {
        target.jumpTo({
          center: source.getCenter(),
          zoom: source.getZoom(),
          pitch: source.getPitch(),
          bearing: source.getBearing(),
        });
      } finally {
        syncing = false;
      }
    };
    const onPrimaryMove = () => {
      if (compareMapRef.current) copyCamera(compareMapRef.current, primary);
    };
    const onCompareMove = () => {
      if (compareMapRef.current) copyCamera(primary, compareMapRef.current);
    };
    primary.on("move", onPrimaryMove);
    compare.on("move", onCompareMove);

    // If the user switches the base style outside compare (the top-left
    // switch stays usable), the left chip must follow reality — and the
    // style's rebuildOverlays() re-shows annotation layers, so hide again.
    const reconcile = window.setInterval(() => {
      const actual = hooksRef.current?.getBaseStyleId();
      if (!actual) return;
      hidePass();
      setPair((prev) => {
        if (actual === prev.left) return prev;
        return actual === prev.right
          ? { left: prev.right, right: prev.left }
          : { left: actual, right: prev.right };
      });
    }, 1000);

    return () => {
      window.clearInterval(reconcile);
      primary.off("move", onPrimaryMove);
      const cmp = compareMapRef.current;
      if (cmp) {
        cmp.off("move", onCompareMove);
        try {
          cmp.remove();
        } catch {
          /* already gone */
        }
      }
      compareMapRef.current = null;
      for (const [id, vis] of hidden) {
        try {
          if (primary.getLayer(id))
            primary.setLayoutProperty(id, "visibility", vis ?? "visible");
        } catch {
          /* layer died with a style switch — best effort */
        }
      }
      // Restore the primary style the user had before comparing.
      if (hooksRef.current && hooksRef.current.getBaseStyleId() !== prevStyle) {
        void hooksRef.current.switchBaseStyle(prevStyle).catch(() => {});
      }
    };
    // compareActive is the only trigger; pair/style changes are handled by
    // dedicated handlers below, not by tearing down the second instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareActive]);

  // ── Style-chip handlers ────────────────────────────────────────────────
  const changeSide = useCallback(
    async (side: "left" | "right", next: BaseStyleId) => {
      const h = hooksRef.current;
      if (!h || switching) return;
      const resolved = resolveStylePair(pairRef.current.left, pairRef.current.right, side, next);
      const prevPair = pairRef.current;
      setPair(resolved);
      if (side === "left" && compareActive) {
        setSwitching(true);
        try {
          await h.switchBaseStyle(resolved.left);
        } finally {
          setSwitching(false);
        }
        // Reconcile on failure (GameMap toasts; we fix the chips).
        const actual = h.getBaseStyleId();
        if (actual !== resolved.left) {
          setPair(
            actual === resolved.right
              ? { left: resolved.right, right: prevPair.left }
              : { left: actual, right: resolved.right }
          );
        }
      } else if (side === "right" && compareActive && compareMapRef.current) {
        try {
          const m = compareMapRef.current;
          m.setStyle(baseStyleSpecFor(resolved.right));
          mountRightBase(m, resolved.right);
        } catch {
          toast(strings.compareFailed);
          setPair(prevPair);
        }
      }
    },
    [compareActive, switching, toast, strings.compareFailed, mountRightBase]
  );

  // ── Divider drag (pointer capture) + keyboard ──────────────────────────
  const pctFromClientX = useCallback((clientX: number) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    return clampDividerPct(((clientX - rect.left) / rect.width) * 100);
  }, []);

  const onDividerKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setDividerPct((p) => clampDividerPct(p - step));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setDividerPct((p) => clampDividerPct(p + step));
    } else if (e.key === "Home") {
      e.preventDefault();
      setDividerPct(COMPARE_DIVIDER_MIN);
    } else if (e.key === "End") {
      e.preventDefault();
      setDividerPct(COMPARE_DIVIDER_MAX);
    }
  };

  // Toolbar / mobile sheet toggle compare through the runtime; the mount
  // effect above does the async left-style enforcement.

  if (!compareActive) return null;

  const leftLabel = COMPARE_STYLE_LABELS[pair.left];
  const rightLabel = COMPARE_STYLE_LABELS[pair.right];

  return (
    <>
      {/* Second instance: below all chrome (z-5), above the primary canvas.
          clip-path restricts both painting AND hit-testing to the right of
          the divider, so the left side stays fully interactive. */}
      <div className="pointer-events-none absolute inset-0 z-[5]">
        <div
          ref={compareContainerRef}
          className="pointer-events-auto absolute inset-0"
          style={{ clipPath: `inset(0 0 0 ${dividerPct}%)` }}
          aria-hidden="true"
        />
      </div>

      {/* Divider + labels + style chips: above chrome, pointer-transparent
          except for the interactive controls themselves. */}
      <div ref={overlayRef} className="pointer-events-none absolute inset-0 z-[15]">
        {/* Divider */}
        <div
          className="absolute inset-y-0"
          style={{ left: `${dividerPct}%` }}
          aria-hidden="false"
        >
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={strings.compareDividerLabel}
            aria-valuemin={COMPARE_DIVIDER_MIN}
            aria-valuemax={COMPARE_DIVIDER_MAX}
            aria-valuenow={dividerPct}
            tabIndex={0}
            onKeyDown={onDividerKeyDown}
            onPointerDown={(e) => {
              draggingRef.current = true;
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!draggingRef.current) return;
              const pct = pctFromClientX(e.clientX);
              if (pct !== null) setDividerPct(pct);
            }}
            onPointerUp={() => {
              draggingRef.current = false;
            }}
            onPointerCancel={() => {
              draggingRef.current = false;
            }}
            className="pointer-events-auto absolute inset-y-0 w-12 -translate-x-1/2 cursor-ew-resize touch-none outline-none focus-visible:ring-2 focus-visible:ring-[#ff50c5]"
            style={{ touchAction: "none" }}
          >
            <div
              aria-hidden="true"
              className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-[#ff50c5] shadow-[0_0_12px_rgba(255,80,197,0.8)]"
            />
            <div
              aria-hidden="true"
              className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#ff50c5]/60 bg-black/80 text-sm text-white backdrop-blur"
            >
              ⟷
            </div>
          </div>
        </div>

        {/* Side labels */}
        <div className="absolute left-3 top-3 rounded-lg border border-white/10 bg-black/70 px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-white backdrop-blur">
          {leftLabel}
        </div>
        <div className="absolute right-3 top-14 flex flex-col items-end gap-1 md:top-3">
          <div className="rounded-lg border border-white/10 bg-black/70 px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-white backdrop-blur">
            {rightLabel}
          </div>
          <p className="max-w-[180px] text-right font-mono text-[9px] text-[#8b94a3]">
            {strings.compareAttribution}
          </p>
        </div>

        {/* Style-selector chips */}
        <div className="pointer-events-auto absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-white/10 bg-black/70 px-3 py-2 backdrop-blur-xl">
          {(["left", "right"] as const).map((side) => (
            <div key={side} className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#8b94a3]">
                {side === "left" ? strings.compareSideLeft : strings.compareSideRight}
              </span>
              {STYLE_IDS.map((id) => {
                const selected = pair[side] === id;
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={switching}
                    onClick={() => void changeSide(side, id)}
                    aria-pressed={selected}
                    className={`rounded-md px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide transition-colors disabled:opacity-50 ${
                      selected
                        ? "bg-[#ff50c5]/25 text-white ring-1 ring-[#ff50c5]"
                        : "bg-white/5 text-[#8b94a3] hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {COMPARE_STYLE_LABELS[id]}
                  </button>
                );
              })}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setCompareActive(false)}
            className="rounded-md bg-white/5 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-[#8b94a3] transition-colors hover:bg-white/10 hover:text-white"
          >
            {strings.compareExit}
          </button>
        </div>

        {/* Honesty note */}
        <p className="absolute bottom-3 left-1/2 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-lg border border-white/10 bg-black/70 px-3 py-1.5 text-center font-mono text-[10px] text-[#8b94a3] backdrop-blur">
          {strings.compareAnnotationsHidden}
        </p>
      </div>
    </>
  );
}
