"use client";

// ─── GameMapView.tsx — game-mode 3D MapLibre map for "Find the Location" ───
// A CLEAN map: no entity pins, no search, no filters, no overlays — the
// challenge is knowledge, not UI.
//
// - Click/tap the map → map.unproject → a draggable neon preview pin drops.
// - Clicking elsewhere moves it; the pin is draggable; Esc clears it.
// - Round truth coordinates are NEVER rendered before lock: the truth pin
//   and guess→truth line only exist in result phase.
// - Each round opens at a neutral Leonida-wide overview (~45° pitch).
// - Pausing freezes the timer AND the map (all interactions disabled).
// - prefers-reduced-motion → all camera moves become instant cuts.

import { useEffect, useRef } from "react";
import { Map as MapLibreMap, Marker, type MapMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { isReducedMotion } from "@/modules/map/camera3d";
import { NEUTRAL_VIEW } from "../gameData";

const DARK_STYLE = "https://tiles.openfreemap.org/styles/dark";
const LINE_SOURCE = "game-guess-line";
const LINE_GLOW = "game-guess-line-glow";
const LINE_MAIN = "game-guess-line-main";

export interface GameResultPins {
  guess: [number, number] | null; // [lng, lat]
  truth: [number, number]; // [lng, lat]
}

interface Props {
  /** Increments every round — resets camera + clears pins. */
  roundKey: number;
  /** Current preview guess [lng, lat], or null. */
  guess: [number, number] | null;
  onPlace: (lngLat: [number, number]) => void;
  result: GameResultPins | null;
  paused: boolean;
  interactive: boolean; // false during result phase (no more placement)
  onLock: () => void;
  onClear: () => void;
  onHint: () => void;
  onMapError: () => void;
  /** Parent-held handle: placeAtCenter() drops the preview pin at the map center. */
  apiRef?: React.MutableRefObject<{ placeAtCenter: () => void } | null>;
}

function pinEl(kind: "preview" | "truth"): HTMLDivElement {
  const el = document.createElement("div");
  el.className = kind === "preview" ? "gg-pin gg-pin-preview" : "gg-pin gg-pin-truth";
  el.setAttribute("aria-hidden", "true");
  return el;
}

export default function GameMapView({
  roundKey,
  guess,
  onPlace,
  result,
  paused,
  interactive,
  onLock,
  onClear,
  onHint,
  onMapError,
  apiRef,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const previewRef = useRef<Marker | null>(null);
  const truthRef = useRef<Marker | null>(null);
  // Refs mirror props for event handlers (registered once).
  const guessRef = useRef(guess);
  const interactiveRef = useRef(interactive);
  const pausedRef = useRef(paused);
  const cbRef = useRef({ onPlace, onLock, onClear, onHint });
  // Keep refs in sync via effect (never write refs during render).
  useEffect(() => {
    guessRef.current = guess;
    interactiveRef.current = interactive;
    pausedRef.current = paused;
    cbRef.current = { onPlace, onLock, onClear, onHint };
  });

  // ══ Map init (once) ══
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container,
        style: DARK_STYLE,
        center: NEUTRAL_VIEW.center,
        zoom: NEUTRAL_VIEW.zoom,
        pitch: NEUTRAL_VIEW.pitch,
        bearing: 0,
        attributionControl: { compact: true },
        keyboard: false, // arrows are ours (nudge the pin), not map pan
        dragRotate: true,
        touchPitch: true,
      });
    } catch {
      onMapError();
      return;
    }
    mapRef.current = map;

    // Parent handle: place the preview pin at the map center ("Place pin").
    if (apiRef) {
      apiRef.current = {
        placeAtCenter: () => {
          if (pausedRef.current || !interactiveRef.current) return;
          const c = map.getCenter();
          cbRef.current.onPlace([c.lng, c.lat]);
        },
      };
    }

    // Click/tap empty map → place (or move) the preview pin.
    const onClick = (e: MapMouseEvent) => {
      if (pausedRef.current || !interactiveRef.current) return;
      cbRef.current.onPlace([e.lngLat.lng, e.lngLat.lat]);
    };
    map.on("click", onClick);

    map.on("load", () => {
      // Extruded buildings for the 3D read (guarded — cosmetic only).
      try {
        if (!map.getLayer("game-buildings-3d")) {
          map.addLayer({
            id: "game-buildings-3d",
            type: "fill-extrusion",
            source: "openmaptiles",
            "source-layer": "building",
            minzoom: 13.5,
            paint: {
              "fill-extrusion-color": "#1b2230",
              "fill-extrusion-height": ["get", "render_height"],
              "fill-extrusion-base": ["get", "render_min_height"],
              "fill-extrusion-opacity": 0.75,
            },
          });
        }
      } catch {
        /* buildings are decorative */
      }
    });

    return () => {
      map.off("click", onClick);
      map.remove();
      mapRef.current = null;
      previewRef.current = null;
      truthRef.current = null;
      if (apiRef) apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ══ Pause → freeze/unfreeze map interactions ══
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const freeze = paused;
    const controls = [
      map.dragPan,
      map.scrollZoom,
      map.boxZoom,
      map.dragRotate,
      map.touchZoomRotate,
      map.doubleClickZoom,
      map.touchPitch,
    ];
    for (const c of controls) {
      try {
        if (freeze) c.disable();
        else c.enable();
      } catch {
        /* handler may not exist on this build */
      }
    }
  }, [paused]);

  // ══ Round reset: neutral overview + clear pins ══
  useEffect(() => {
    const map = mapRef.current;
    if (!map || roundKey === 0) return;
    // Clear markers
    previewRef.current?.remove();
    previewRef.current = null;
    truthRef.current?.remove();
    truthRef.current = null;
    // Clear the guess→truth line
    for (const id of [LINE_MAIN, LINE_GLOW]) {
      try {
        if (map.getLayer(id)) map.removeLayer(id);
      } catch { /* ignore */ }
    }
    try {
      if (map.getSource(LINE_SOURCE)) map.removeSource(LINE_SOURCE);
    } catch { /* ignore */ }
    // Neutral Leonida-wide overview — instant cut under reduced motion.
    if (isReducedMotion()) {
      map.jumpTo({ center: NEUTRAL_VIEW.center, zoom: NEUTRAL_VIEW.zoom, pitch: NEUTRAL_VIEW.pitch, bearing: 0 });
    } else {
      map.flyTo({ center: NEUTRAL_VIEW.center, zoom: NEUTRAL_VIEW.zoom, pitch: NEUTRAL_VIEW.pitch, bearing: 0, duration: 1400 });
    }
  }, [roundKey]);

  // ══ Preview pin sync (draggable) ══
  useEffect(() => {
    const map = mapRef.current;
    if (!map || result) return; // result phase owns the pins
    if (!guess) {
      previewRef.current?.remove();
      previewRef.current = null;
      return;
    }
    if (previewRef.current) {
      previewRef.current.setLngLat(guess);
      return;
    }
    const marker = new Marker({ element: pinEl("preview"), draggable: true })
      .setLngLat(guess)
      .addTo(map);
    marker.on("dragend", () => {
      const ll = marker.getLngLat();
      cbRef.current.onPlace([ll.lng, ll.lat]);
    });
    previewRef.current = marker;
  }, [guess, result]);

  // ══ Result phase: truth pin + guess→truth line ══
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!result) {
      truthRef.current?.remove();
      truthRef.current = null;
      return;
    }
    // Truth pin with neon pulse (pulse disabled under reduced motion via CSS).
    truthRef.current?.remove();
    truthRef.current = new Marker({ element: pinEl("truth") })
      .setLngLat(result.truth)
      .addTo(map);
    // Neon line guess → truth (glow layer + bright core).
    const coords: [number, number][] = result.guess
      ? [result.guess, result.truth]
      : [result.truth, result.truth];
    try {
      if (!map.getSource(LINE_SOURCE)) {
        map.addSource(LINE_SOURCE, {
          type: "geojson",
          data: { type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: {} },
        });
        map.addLayer({
          id: LINE_GLOW,
          type: "line",
          source: LINE_SOURCE,
          paint: {
            "line-color": "#ff2d78",
            "line-width": 8,
            "line-opacity": 0.35,
            "line-blur": 4,
          },
        });
        map.addLayer({
          id: LINE_MAIN,
          type: "line",
          source: LINE_SOURCE,
          paint: {
            "line-color": "#22d3ee",
            "line-width": 2.5,
            "line-dasharray": [2, 2],
          },
        });
      }
    } catch {
      /* line is decorative — the overlay still explains the result */
    }
  }, [result]);

  // ══ Keyboard controls on the map wrapper ══
  const onKeyDown = (e: React.KeyboardEvent) => {
    const map = mapRef.current;
    if (!map || paused) return;
    const step = e.shiftKey ? 0.1 : 0.01;
    const g = guessRef.current;
    switch (e.key) {
      case " ": {
        e.preventDefault();
        if (!interactiveRef.current) return;
        const c = map.getCenter();
        cbRef.current.onPlace([c.lng, c.lat]);
        break;
      }
      case "ArrowUp":
      case "ArrowDown":
      case "ArrowLeft":
      case "ArrowRight": {
        e.preventDefault();
        if (!interactiveRef.current) return;
        const base = g ?? (() => { const c = map.getCenter(); return [c.lng, c.lat] as [number, number]; })();
        const next: [number, number] = [
          base[0] + (e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0),
          base[1] + (e.key === "ArrowUp" ? step : e.key === "ArrowDown" ? -step : 0),
        ];
        cbRef.current.onPlace(next);
        break;
      }
      case "Enter": {
        e.preventDefault();
        if (interactiveRef.current) cbRef.current.onLock();
        break;
      }
      case "Escape": {
        if (interactiveRef.current) cbRef.current.onClear();
        break;
      }
      case "h":
      case "H": {
        if (interactiveRef.current) cbRef.current.onHint();
        break;
      }
    }
  };

  return (
    <div className="relative h-full w-full">
      <style>{`
        .gg-pin { width: 26px; height: 26px; border-radius: 9999px; position: relative; cursor: grab; }
        .gg-pin-preview { background: radial-gradient(circle, #22d3ee 0%, rgba(34,211,238,0.25) 70%, transparent 100%); border: 2px solid #22d3ee; box-shadow: 0 0 18px rgba(34,211,238,0.8); }
        .gg-pin-preview::after { content: ""; position: absolute; inset: -8px; border-radius: 9999px; border: 1px solid rgba(34,211,238,0.5); animation: gg-ping 1.6s ease-out infinite; }
        .gg-pin-truth { background: radial-gradient(circle, #ff2d78 0%, rgba(255,45,120,0.25) 70%, transparent 100%); border: 2px solid #ff2d78; box-shadow: 0 0 22px rgba(255,45,120,0.9); }
        .gg-pin-truth::after { content: ""; position: absolute; inset: -10px; border-radius: 9999px; border: 2px solid rgba(255,45,120,0.6); animation: gg-ping 1.4s ease-out infinite; }
        @keyframes gg-ping { 0% { transform: scale(0.6); opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .gg-pin::after { animation: none; } }
      `}</style>
      <div
        ref={containerRef}
        role="application"
        aria-label="Leonida map — place your guess pin"
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="absolute inset-0 cursor-crosshair outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]"
      />
      <div className="map-grade pointer-events-none absolute inset-0" aria-hidden="true" />
      {paused && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/55 backdrop-blur-[2px]">
          <p className="font-mono text-sm tracking-widest text-white/80">PAUSED — map frozen</p>
        </div>
      )}
    </div>
  );
}
