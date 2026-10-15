// ─── modules/map/tools/overlays/OverlaysTools.tsx ─────────────────────
// Overlays slice entry point. Render this inside <MapToolsHost> (it needs
// useTools()). It:
//  - registers the "overlays" capability (toolbar Overlays button),
//  - reconciles registry → MapLibre layers, incl. after base-style
//    switches (sources die with the style — "styledata" re-runs),
//  - renders the Overlays panel (GlassPanel desktop / MobileSheet mobile)
//    when runtime.activePanel === "overlays",
//  - runs the 3-point placement mode (steps 1–6).
//
// Placement + pins: while placing, a map click that hits a pin/cluster
// layer is IGNORED for placement (the pin selects normally); only clicks
// on empty map advance the step. This keeps the existing GameMap pin
// handlers untouched.

"use client";

import { useEffect, useRef } from "react";
import type { MapMouseEvent } from "maplibre-gl";
import { useTools } from "../shared/toolRuntime";
import { useIsMobile } from "../shared/mobile";
import GlassPanel from "../shared/glassPanel";
import MobileSheet from "../../components/MobileSheet";
import {
  LAYER_CLUSTERS,
  LAYER_CLUSTER_COUNT,
  LAYER_PINS,
  LAYER_PINS_APPROX,
} from "../../markerLayer";
import { reconcileOverlays } from "./overlayRenderer";
import { overlayStrings as s } from "./sliceStrings";
import { useOverlays, type OverlaysApi } from "./useOverlays";
import { registerOverlayShareHandlers } from "../share/shareBridge";
import OverlaysPanel from "./OverlaysPanel";

const PIN_LAYER_IDS = [
  LAYER_CLUSTERS,
  LAYER_CLUSTER_COUNT,
  LAYER_PINS,
  LAYER_PINS_APPROX,
];

export default function OverlaysTools() {
  const {
    getMap,
    isMinimalTier,
    activePanel,
    setActivePanel,
    registerCapability,
    toast,
  } = useTools();
  const isMobile = useIsMobile();
  const api = useOverlays(toast);
  const minimal = isMinimalTier();

  // Share-annotations bridge (ref-mirrored: the api identity changes as
  // entries change, but the registry it fronts is stable).
  const apiRef = useRef(api);
  useEffect(() => {
    apiRef.current = api;
  });
  useEffect(() => {
    return registerOverlayShareHandlers({
      snapshot: () => apiRef.current.entries,
      restore: (items) => apiRef.current.applySharedOverlays(items),
    });
  }, []);

  // Capability: until this runs, the toolbar Overlays button stays disabled.
  useEffect(() => {
    if (!minimal) registerCapability("overlays");
  }, [minimal, registerCapability]);

  // Registry → MapLibre reconciliation. Re-runs after base-style switches
  // (all sources/layers die with the style) via "styledata".
  useEffect(() => {
    if (minimal) return;
    const map = getMap();
    if (!map) return;
    const reconcile = () => {
      try {
        reconcileOverlays(map, api.entries, api.attachments);
      } catch (err) {
        console.warn("[overlays] reconcile failed:", err);
      }
    };
    reconcile();
    map.on("styledata", reconcile);
    return () => {
      map.off("styledata", reconcile);
    };
  }, [getMap, minimal, api.entries, api.attachments]);

  const placingOnMap =
    !!api.placement && (api.placementStep ?? 7) <= 3;

  // Steps 1–3: capture map clicks. Pin hits are ignored for placement
  // (the pin handler still selects normally).
  useEffect(() => {
    if (minimal || !placingOnMap) return;
    const map = getMap();
    if (!map) return;
    const canvas = map.getCanvas();
    const prevCursor = canvas.style.cursor;
    canvas.style.cursor = "crosshair";
    const onClick = (e: MapMouseEvent) => {
      const layers = PIN_LAYER_IDS.filter((id) => map.getLayer(id));
      let hitPin = false;
      if (layers.length > 0) {
        try {
          hitPin = map.queryRenderedFeatures(e.point, { layers }).length > 0;
        } catch {
          hitPin = false;
        }
      }
      if (hitPin) return;
      api.addMapPoint([e.lngLat.lng, e.lngLat.lat]);
    };
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
      canvas.style.cursor = prevCursor;
    };
  }, [getMap, minimal, placingOnMap, api]);

  // Esc cancels placement. document-level so stopPropagation beats the
  // toolRuntime window listener (which would otherwise close the panel).
  const placementActive = !!api.placement;
  useEffect(() => {
    if (!placementActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      api.cancelPlacement();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [placementActive, api]);

  // Minimal tier: overlays stay hidden and the toolbar button disabled.
  if (minimal) return null;

  const panelOpen = activePanel === "overlays";
  const step = api.placementStep;

  return (
    <>
      {panelOpen && !isMobile && (
        <div className="absolute left-[68px] top-[64px] z-20">
          <GlassPanel
            title={s.panelTitle}
            onClose={() => setActivePanel(null)}
            widthClass="w-80"
          >
            <OverlaysPanel api={api} />
          </GlassPanel>
        </div>
      )}

      {panelOpen && isMobile && (
        <MobileSheet onClose={() => setActivePanel(null)}>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-white">
            {s.panelTitle}
          </h2>
          <OverlaysPanel api={api} />
        </MobileSheet>
      )}

      {api.placement && step !== null && step <= 3 && (
        <div className="pointer-events-auto absolute left-1/2 top-16 z-20 w-max max-w-[calc(100%-2rem)] -translate-x-1/2">
          <div className="glass-panel flex items-center gap-3 rounded-xl px-3 py-2">
            <div>
              <p className="text-sm font-semibold text-white">
                {s.overlayPlaceStep(step)}
              </p>
              <p className="font-mono text-[11px] text-[#8b94a3]">
                {s.overlayPlaceHint}
              </p>
            </div>
            <button
              type="button"
              onClick={() => api.cancelPlacement()}
              className="flex min-h-[44px] items-center rounded-md border border-white/15 px-3 text-sm text-white transition-colors hover:border-[#ff50c5]/60"
            >
              {s.overlayPlaceCancel}
            </button>
          </div>
        </div>
      )}

      {api.placement && step !== null && step > 3 && (
        <ImageCornerPicker api={api} />
      )}
    </>
  );
}

/** Steps 4–6: full-screen modal — click the 3 matching corners on the image. */
function ImageCornerPicker({ api }: { api: OverlaysApi }) {
  const p = api.placement;
  const imgRef = useRef<HTMLImageElement>(null);
  if (!p) return null;
  const step = api.placementStep ?? 4;

  const onImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = ((e.clientX - rect.left) / rect.width) * p.imageWidth;
    const y = ((e.clientY - rect.top) / rect.height) * p.imageHeight;
    api.addImagePoint([x, y]);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={s.overlayPlaceImageTitle}
      className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/85 p-4"
    >
      <div className="w-full max-w-2xl text-center">
        <p className="text-sm font-semibold text-white">
          {s.overlayPlaceStep(step)}
        </p>
        <p className="font-mono text-[11px] text-[#8b94a3]">
          {s.overlayPlaceImageTitle}
        </p>
      </div>
      <div className="relative max-h-[70dvh] w-full max-w-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={p.imageUrl}
          alt={s.overlayPlaceImageTitle}
          onClick={onImageClick}
          className="max-h-[70dvh] w-full cursor-crosshair touch-manipulation rounded-lg border border-white/20 object-contain select-none"
          draggable={false}
        />
        {p.imagePoints.map((pt, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="pointer-events-none absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#ff50c5] bg-black/70 font-mono text-[11px] font-bold text-white"
            style={{
              left: `${(pt[0] / p.imageWidth) * 100}%`,
              top: `${(pt[1] / p.imageHeight) * 100}%`,
            }}
          >
            {i + 4}
          </span>
        ))}
      </div>
      <button
        type="button"
        onClick={() => api.cancelPlacement()}
        className="flex min-h-[44px] items-center rounded-lg border border-white/15 px-4 text-sm text-white transition-colors hover:border-[#ff50c5]/60"
      >
        {s.overlayPlaceCancel}
      </button>
    </div>
  );
}
