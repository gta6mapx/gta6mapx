"use client";

// ─── GameMap.tsx — orchestration only ────────────────────────────────────────
// Owns React state + layout. All map logic lives in single-responsibility
// modules: camera3d, deepLink, styleManager, tileFallback, deviceCaps,
// settings, gameCoords, clusterSource, markerLayer, pinsOnlyLayer,
// clusterInteraction, viewportLoader, mapCounters, perf. Discovery state
// lives in modules/discovery (reducer + selectors); the unified search
// (modules/map/searchIndex) is consumed through the discovery selectors.
//
// UI chrome (redesign): floating header pill, left/right icon rails, marker
// list drawer, marker popup + detail modal — all original components under
// components/chrome, components/drawers, components/popup.

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Map as MapLibreMap, type GeoJSONSource, type MapMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { CATEGORIES, PINS, ALL_EVIDENCE_STATUSES, type EvidenceStatus, type Pin } from "@/data/pins";
import { useFound } from "@/modules/progress/useFound";
import {
  discoveryReducer,
  initialDiscoveryState,
  type FoundMode,
  type SortId,
} from "@/modules/discovery/reducer";
import {
  emptyStateMessage,
  findPin,
  hasActiveFilters,
  selectBasePins,
  selectFacetedCounts,
  selectSearchResults,
  selectSortedPins,
  selectSummary,
} from "@/modules/discovery/selectors";
import { discoveryStrings as S } from "@/modules/discovery/strings";
import { EVIDENCE_META } from "@/modules/entities/types";

import {
  clusterSourceSpec, buildEntityGeoJSON, CLUSTER_SOURCE_ID,
} from "./clusterSource";
import {
  addMarkerLayers, removeMarkerLayers, refreshPinState, setClusterColorMode,
  LAYER_PINS, LAYER_PINS_APPROX, LAYER_CLUSTERS, type ClusterColorMode,
} from "./markerLayer";
import { addDensityLayer, setDensityVisible as setDensityLayerVisible, DENSITY_CLUSTER_ID, DENSITY_SOURCE_ID } from "./pinsOnlyLayer";
import { wireClusterInteraction } from "./clusterInteraction";
import { loadNamedPins, loadDensityGeoJSON } from "./viewportLoader";
import { computeCounters } from "./mapCounters";
import { mark, measure, assertBudgets } from "./perf";
import {
  isReducedMotion, resetCamera, snapNorth,
  installDriftBack,
} from "./camera3d";
import {
  parseDeepLink, buildShareUrl, installUrlSync, setPinMeta, clearPinMeta,
} from "./deepLink";
import { StyleManager, type BaseStyleId, type OverlayRegistrar } from "./styleManager";
import {
  ensureLeonidaBase,
  leonidaBaseCenter,
  LEONIDA_BASE_SOURCE_ID,
} from "./leonidaBase";
import {
  installTileFallback,
  getTileAttributionOverride,
  resetTileStages,
} from "./tileFallback";
import {
  detectTier, qaTierOverride, pixelRatioCap, watchFrameDrops,
  type CapabilityTier,
} from "./deviceCaps";
import { loadSettings, saveSettings } from "./settings";
import { honestCoordString } from "./gameCoords";

// New chrome (redesign phase)
import MapHeaderPill from "./components/chrome/MapHeaderPill";
import SimpleMap from "./components/SimpleMap";
import LeftRail from "./components/chrome/LeftRail";
import RightRail from "./components/chrome/RightRail";
import AboutModal from "./components/chrome/AboutModal";
import HudCluster from "./components/chrome/HudCluster";
import BaseStyleSegment from "./components/chrome/BaseStyleSegment";
import { mountSearchedMarker } from "./components/chrome/SearchedMarker";
import MarkerListDrawer from "./components/drawers/MarkerListDrawer";
import MarkerPopup from "./components/popup/MarkerPopup";
import MarkerDetailModal from "./components/popup/MarkerDetailModal";

import CityJump, { type CityDef } from "./components/CityJump";
import GoToPosition from "./components/GoToPosition";
import Toast from "./components/Toast";
import MapToolsHost, { type ToolControl } from "./tools/MapToolsHost";
import DrawTools from "./tools/draw/DrawTools";
import MeasureTools from "./tools/measure/MeasureTools";
import OverlaysTools from "./tools/overlays/OverlaysTools";
import DisplayTools from "./tools/display/DisplayTools";
import MobileSheet from "./components/MobileSheet";
import SplashLoader from "./components/SplashLoader";
import GameFrameLegend from "./components/GameFrameLegend";
import { SettingsDrawer } from "./components/SettingsDrawer";
import {
  setSettings as setSiteSettings,
  useSiteSettings,
} from "@/modules/engagement/settings/store";

const DEFAULT_CENTER: [number, number] = leonidaBaseCenter(); // illustrated Leonida quad center
const DEFAULT_ZOOM = 10.5;
const SPLASH_TIMEOUT_MS = 12000;

type TierState = CapabilityTier;

/** Delays a value so fast-typing never hammers synchronous work per keystroke (R4). */
function useDebouncedValue<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function GameMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const styleManagerRef = useRef<StyleManager | null>(null);
  const flyingRef = useRef(false);
  const tierRef = useRef<TierState>("full");
  const discoveryRef = useRef(initialDiscoveryState(CATEGORIES.map((c) => c.slug)));
  const foundRef = useRef<Set<string>>(new Set());
  const entityDataRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const densityDataRef = useRef<object | null>(null);
  const clusteringRef = useRef(true);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const foundRebuildTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks which unified-store values are already applied to the live map,
  // so store-driven effects don't re-apply (or loop with) explicit callers.
  const appliedClusteringRef = useRef<boolean | null>(null);
  const appliedDensityRef = useRef<boolean | null>(null);
  // Map-tools layer (Phase 4): GameMap only holds the control ref; all tool
  // state lives in MapToolsHost.
  const toolControlRef = useRef<ToolControl | null>(null);
  // Removable "searched position" marker from coordinate search.
  const searchedCleanupRef = useRef<(() => void) | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  // Renderer choice: the plain-canvas 2D map is the DEFAULT — it works on
  // every device (no WebGL needed) and shows every pin, like the reference
  // site's 2D map. The WebGL map is opt-in via ?map=3d or the "3D" button.
  const [renderer, setRenderer] = useState<"2d" | "3d">(() =>
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("map") === "3d"
      ? "3d"
      : "2d",
  );
  const [dataReady, setDataReady] = useState(false);
  // R1: one reducer is the source of truth for query, filters, sort,
  // selection, rendered pins, counters, and empty state.
  const ALL_CATS = useMemo(() => CATEGORIES.map((c) => c.slug), []);
  const [discovery, dispatch] = useReducer(discoveryReducer, ALL_CATS, initialDiscoveryState);
  const selected: Pin | null = useMemo(
    () =>
      discovery.selectedId
        ? (findPin(PINS, discovery.selectedId) ?? null)
        : null,
    [discovery.selectedId]
  );
  const [copied, setCopied] = useState(false);
  const [baseStyle, setBaseStyle] = useState<BaseStyleId>("leonida-dark");
  const [switching, setSwitching] = useState(false);
  const [markerDrawerOpen, setMarkerDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [tileNotice, setTileNotice] = useState<{ msg: string; retry: () => void } | null>(null);
  const [bearing, setBearing] = useState(0);
  const [activeCity, setActiveCity] = useState<string | null>(null);
  const [densityTotal, setDensityTotal] = useState(0);
  const [densityVisible, setDensityVisible] = useState(true);
  const [frameLegendDismissed, setFrameLegendDismissed] = useState(false);
  const [hudCollapsed, setHudCollapsed] = useState(false);
  // Unified site settings (engagement store). GameMap subscribes read-only
  // here; the settings panel writes the store directly, and the effects
  // below live-apply map-affecting changes to the running map instance.
  const [siteSettings] = useSiteSettings();
  const [showSplash, setShowSplash] = useState(true);
  const [splashProgress, setSplashProgress] = useState<number | null>(15);
  const [splashStalled, setSplashStalled] = useState(false);
  const { found, toggleFound } = useFound();

  // ── Toast helper ──
  const showToast = useCallback((msg: string, ms = 5000) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  }, []);

  // ── Keep refs in sync with state ──
  useEffect(() => { discoveryRef.current = discovery; }, [discovery]);
  useEffect(() => { foundRef.current = found; }, [found]);
  // ── Camera flight helper (flat 2D map — 3D concept set aside) ──
  const flyTo = useCallback((lng: number, lat: number, zoom: number) => {
    const map = mapRef.current;
    if (!map) return;
    const targetPitch = 0;
    flyingRef.current = true;
    const done = () => { flyingRef.current = false; };
    if (isReducedMotion()) {
      map.jumpTo({ center: [lng, lat], zoom, pitch: targetPitch });
      done();
      return;
    }
    map.once("moveend", done);
    window.setTimeout(done, 2500); // safety net
    map.flyTo({ center: [lng, lat], zoom, pitch: targetPitch, duration: 1200 });
  }, []);

  // ── Cluster color mode (evidence / category) — persisted, applied live ──
  const clusterModeRef = useRef<ClusterColorMode>("evidence");
  const changeClusterMode = useCallback((mode: ClusterColorMode) => {
    clusterModeRef.current = mode;
    const map = mapRef.current;
    if (map) setClusterColorMode(map, mode);
    saveSettings({ clusterColorMode: mode });
  }, []);
  void changeClusterMode;

  // ── Go to position (spec §3.8) ──
  // A validated "lat, lng" pair flies the camera and drops a removable
  // "Searched position" marker (approximate). The marker persists until the
  // user removes it or runs another coordinate search.
  const [goToOpen, setGoToOpen] = useState(false);

  const clearSearchedMarker = useCallback(() => {
    searchedCleanupRef.current?.();
    searchedCleanupRef.current = null;
  }, []);

  /** Called only with validated, in-range coordinates (dialog guarantees it). */
  const goToPosition = useCallback((lat: number, lng: number) => {
    setGoToOpen(false);
    clearSearchedMarker();
    const map = mapRef.current;
    if (map) {
      searchedCleanupRef.current = mountSearchedMarker(map, lng, lat);
    }
    flyTo(lng, lat, 14);
    showToast("Jumped to coordinates — the marker is removable.");
  }, [flyTo, showToast, clearSearchedMarker]);

  // ── Pin selection ──
  // ── Pin selection (dispatches to the discovery reducer — R1) ──
  const selectPin = useCallback((pin: Pin, opts?: { fly?: boolean }) => {
    const full = findPin(PINS, pin.id) ?? pin;
    dispatch({ type: "SELECT_PIN", id: full.id });
    setPinMeta(full.name, full.description);
    setMarkerDrawerOpen(false);
    const map = mapRef.current;
    if (map && opts?.fly !== false) {
      flyTo(full.lng, full.lat, Math.max(map.getZoom(), 15));
    }
    if (map) {
      refreshPinState(map, { selectedId: full.id, foundIds: foundRef.current });
    }
  }, [flyTo]);
  const selectPinRef = useRef(selectPin);
  useEffect(() => { selectPinRef.current = selectPin; }, [selectPin]);

  const deselect = useCallback(() => {
    dispatch({ type: "DESELECT_PIN" });
    clearPinMeta();
    const map = mapRef.current;
    if (map) {
      refreshPinState(map, { selectedId: null, foundIds: foundRef.current });
    }
  }, []);

  // ── Rebuild the clustered entity source (filters / found / selection) ──
  // Reads discovery through the ref so rapid filter changes never race (R4).
  const rebuildEntityData = useCallback(() => {
    const map = mapRef.current;
    const d = discoveryRef.current;
    const pins = selectBasePins(PINS, d, foundRef.current);
    const fc = buildEntityGeoJSON(pins, {
      selectedId: d.selectedId,
      foundIds: foundRef.current,
    });
    entityDataRef.current = fc;
    const src = map?.getSource(CLUSTER_SOURCE_ID) as GeoJSONSource | undefined;
    if (src) {
      src.setData(fc);
      if (map) refreshPinState(map, { selectedId: d.selectedId, foundIds: foundRef.current });
    }
  }, []);

  // ── Rebuild entity data when filters or found-set change (query never
  // triggers a rebuild — it only filters the results list, R4) ──
  const { activeCats, evidenceOn, activeTags, foundMode } = discovery;
  useEffect(() => {
    rebuildEntityData();
  }, [activeCats, evidenceOn, activeTags, foundMode, found, rebuildEntityData]);
  const scheduleFoundRebuild = useCallback(() => {
    if (foundRebuildTimer.current) clearTimeout(foundRebuildTimer.current);
    foundRebuildTimer.current = setTimeout(() => rebuildEntityData(), 300);
  }, [rebuildEntityData]);

  // ══ Map init (runs once) ══
  // One-shot init: seeds React state from persisted settings + deep link, then
  // owns the MapLibre instance. setState-in-effect is intentional here.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // 2D canvas is the default renderer — the WebGL map only initializes
    // when the user opts in (?map=3d or the "3D" button).
    if (renderer !== "3d") return;
    const container = containerRef.current;
    if (!container || mapRef.current) return;
    mark("map-init-start");

    const persisted = loadSettings();
    const deeplink = parseDeepLink(window.location.search) ?? {};
    if (deeplink.style === "leonida-dark" || deeplink.style === "real-florida") {
      saveSettings({ baseLayer: deeplink.style });
    }

    // Capability tier
    const override = qaTierOverride();
    const tier: TierState = override === "minimal" ? "minimal"
      : override === "reduced" ? "reduced"
      : override === "full" ? "full"
      : detectTier();
    tierRef.current = tier;
    if (tier === "none") { setMapError(true); setShowSplash(false); return; }
    // Flat 2D map (3D concept set aside).
    setHudCollapsed(persisted.coordHudCollapsed);
    setFrameLegendDismissed(persisted.frameLegendDismissed);
    setDensityVisible(persisted.densityVisible);
    clusteringRef.current = persisted.clustering;
    // Seed the "already applied" refs so store-driven effects don't re-apply
    // what the init just applied.
    appliedClusteringRef.current = persisted.clustering;
    appliedDensityRef.current = persisted.densityVisible;
    // Discovery prefs persist across visits (spec §3.5/§3.6).
    dispatch({ type: "SET_SORT", sort: persisted.sort });
    clusterModeRef.current = persisted.clusterColorMode;

    const startCenter: [number, number] =
      deeplink.lat !== undefined && deeplink.lng !== undefined
        ? [deeplink.lng, deeplink.lat] : DEFAULT_CENTER;
    const startZoom = deeplink.zoom ?? DEFAULT_ZOOM;
    const startPitch = 0; // flat 2D — deep-link pitch ignored
    const startBearing = deeplink.bearing ?? 0;

    const styleManager = new StyleManager([
      {
        id: "entities",
          addTo(map) {
            if (!map.getSource(CLUSTER_SOURCE_ID)) {
              const spec = clusterSourceSpec() as unknown as Record<string, unknown>;
              spec.cluster = clusteringRef.current;
              map.addSource(CLUSTER_SOURCE_ID, spec as Parameters<typeof map.addSource>[1]);
            }
            if (entityDataRef.current) {
              (map.getSource(CLUSTER_SOURCE_ID) as GeoJSONSource | undefined)
                ?.setData(entityDataRef.current);
            }
            addMarkerLayers(map, { clusterColorMode: clusterModeRef.current });
            refreshPinState(map, {
              selectedId: discoveryRef.current.selectedId,
              foundIds: foundRef.current,
            });
          },
          removeFrom(map) {
            removeMarkerLayers(map);
            if (map.getSource(CLUSTER_SOURCE_ID)) map.removeSource(CLUSTER_SOURCE_ID);
          },
        } satisfies OverlayRegistrar,
        // Unnamed community-pin density layer
        {
          id: "density",
          addTo(map) {
            if (densityDataRef.current) {
              addDensityLayer(map, densityDataRef.current, persisted.densityVisible);
            }
          },
          removeFrom() { /* source is removed with the style */ },
        } satisfies OverlayRegistrar,
      ]);
    styleManagerRef.current = styleManager;
    setBaseStyle(styleManager.getStyleId());

    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container,
        style: styleManager.initialStyle(),
        center: startCenter,
        zoom: startZoom,
        pitch: startPitch,
        bearing: startBearing,
        attributionControl: { compact: true },
        pixelRatio: pixelRatioCap(tier),
        maxTileCacheSize: tier === "full" ? 200 : 50,
        dragRotate: false,
        touchPitch: false,
      });
    } catch (err) {
      console.error("[map] WebGL init failed", err);
      setMapError(true);
      setShowSplash(false);
      return;
    }
    mapRef.current = map;

    // Dead-GPU guard: a lost WebGL context leaves a transparent canvas over
    // the page background (a mysterious "black map" with no error UI).
    // tileFallback deliberately ignores context-loss errors, so handle it
    // here by falling back to the static list view.
    const mapCanvas = map.getCanvas();
    const onContextLost = (e: Event) => {
      e.preventDefault();
      setMapError(true);
      setShowSplash(false);
    };
    mapCanvas.addEventListener("webglcontextlost", onContextLost);

    // Tile failure ladder (degraded styles, never a fatal error for tiles).
    // The ladder's setStyle calls wipe custom sources/layers, so
    // onBaseStyleSwapped re-registers our GeoJSON overlays once the new
    // style is ready — otherwise a degradation leaves a pin-less map.
    const cleanupTile = installTileFallback(map, {
      onNotice: (msg, retry) => setTileNotice({ msg, retry }),
      onRecovered: () => setTileNotice(null),
      onBaseStyleSwapped: () => {
        const m = mapRef.current;
        const sm = styleManagerRef.current;
        if (!m || !sm) return;
        const rebuild = () => {
          try {
            sm.rebuildOverlays(m);
          } catch {
            /* overlays are best-effort; the notice banner explains state */
          }
        };
        if (m.isStyleLoaded()) rebuild();
        else m.once("idle", rebuild);
      },
    });

    // Track bearing for the compass
    map.on("moveend", () => {
      setBearing(map.getBearing());
    });

    // Right-drag tilt drift-back + frame-drop auto downgrade
    const cleanupDrift = installDriftBack(map);
    const cleanupDrops = watchFrameDrops(() => {
      const cur = tierRef.current;
      const next: TierState = cur === "full" ? "reduced" : cur === "reduced" ? "minimal" : cur;
      if (next === cur) return;
      tierRef.current = next;
      showToast("Lowered map detail to keep it smooth.");
    });

    // Deep-link URL sync
    const cleanupUrl = installUrlSync(
      map,
      () => {
        const c = map.getCenter();
        return {
          lat: c.lat, lng: c.lng, zoom: map.getZoom(),
          pitch: map.getPitch(), bearing: map.getBearing(),
          pinSlug: discoveryRef.current.selectedId
            ? findPin(PINS, discoveryRef.current.selectedId)?.slug
            : undefined,
          style: styleManager.getStyleId(),
        };
      },
      flyingRef
    );

    // Cluster expansion — a cluster click while a tool is active exits the
    // tool first (spec §1.1: selecting a marker explicitly exits the tool).
    // The unnamed density clusters expand too (separate source, same UX).
    const cleanupClusters = wireClusterInteraction(map, {
      onBeforeClick: () => {
        if (toolControlRef.current?.shouldSuppress()) {
          toolControlRef.current.exitTool();
        }
      },
      extraClusters: [
        { layerId: DENSITY_CLUSTER_ID, sourceId: DENSITY_SOURCE_ID },
      ],
    });

    // Unclustered pin clicks — same tool-exit rule as clusters.
    const pinClickLayers = [LAYER_PINS, LAYER_PINS_APPROX];
    const onPinClick = (e: MapMouseEvent) => {
      if (toolControlRef.current?.shouldSuppress()) {
        toolControlRef.current.exitTool();
      }
      const feats = map.queryRenderedFeatures(e.point, { layers: pinClickLayers });
      const f = feats[0];
      if (f && typeof f.id === "string") {
        const pin = findPin(PINS, f.id);
        if (pin) selectPinRef.current(pin);
      }
    };
    map.on("click", pinClickLayers, onPinClick);
    map.on("mouseenter", pinClickLayers, () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", pinClickLayers, () => { map.getCanvas().style.cursor = ""; });

    // Click empty map → deselect (not on pins/clusters)
    const onMapClick = (e: MapMouseEvent) => {
      const feats = map.queryRenderedFeatures(e.point, {
        layers: [...pinClickLayers, LAYER_CLUSTERS],
      });
      if (feats.length === 0) { deselect(); }
    };
    map.on("click", onMapClick);

    // Escape → close overlays first, then deselect
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      deselect();
      setDetailOpen(false);
      setAboutOpen(false);
      setGoToOpen(false);
      setSettingsOpen(false);
      setMarkerDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);

    // Splash stall timer
    const stallTimer = setTimeout(() => setSplashStalled(true), SPLASH_TIMEOUT_MS);

    // Absolute safety net: the splash can never trap the user. If the WebGL
    // map hasn't loaded within 25 s (hung fetch, a GPU that never finishes,
    // very slow device …), dismiss the splash and fall back to the 2D
    // canvas map — which always works and shows every pin.
    let loadFired = false;
    const forceTimer = setTimeout(() => {
      if (!loadFired) setMapError(true);
      setShowSplash(false);
    }, 25000);

    // Dead-render guard: some GPUs create a WebGL context and fire "load"
    // but never actually paint anything (the infamous black/blank map —
    // the probe's tiny 2x2 test can pass while the real map stays empty).
    // After the map goes idle we force one repaint and sample the canvas
    // pixels *inside* the render frame (preserveDrawingBuffer is false, so
    // readPixels is only valid there). If every sample is the same color,
    // the GPU painted nothing → fall back to the 2D canvas map, which
    // always shows the island and every pin.
    let paintVerified = false;
    const canvasHasVariance = (): boolean => {
      const canvas = map.getCanvas();
      const gl =
        canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      if (!gl) return true; // can't measure — don't kill a working map
      const w = canvas.width;
      const h = canvas.height;
      if (!w || !h) return true;
      const buf = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      const total = w * h;
      const step = Math.max(1, Math.floor(total / 2048));
      let first = -1;
      for (let i = 0; i < total; i += step) {
        const o = i * 4;
        const c = (buf[o] << 16) | (buf[o + 1] << 8) | buf[o + 2];
        if (first === -1) first = c;
        else if (c !== first) return true; // painted something real
      }
      return false; // every sample identical — nothing was painted
    };
    const verifyPaint = () => {
      if (paintVerified) return;
      paintVerified = true;
      // The user may have switched back to 2D (or the map unmounted) —
      // never touch a map that is no longer the live one.
      if (mapRef.current !== map) return;
      let done = false;
      const finish = (healthy: boolean) => {
        if (done) return;
        done = true;
        try { map.off("render", onRender); } catch { /* map gone */ }
        if (!healthy && mapRef.current === map) {
          console.warn("[map] dead render detected — blank canvas, falling back to 2D");
          setMapError(true);
          setShowSplash(false);
        }
      };
      const onRender = () => {
        // Inside the frame: the drawing buffer is valid here.
        let healthy = true;
        try {
          healthy = canvasHasVariance();
        } catch {
          healthy = true; // measurement failed — leave the map alone
        }
        finish(healthy);
      };
      map.on("render", onRender);
      map.triggerRepaint();
      // No frame at all within 10 s → the map isn't painting → dead.
      setTimeout(() => finish(false), 10000);
    };
    map.once("idle", () => {
      window.setTimeout(verifyPaint, 3000);
    });
    // Backstop: if "idle" never fires, still verify before the 25 s net.
    const paintTimer = window.setTimeout(verifyPaint, 18000);

    map.on("load", () => {
      loadFired = true;
      mark("style-loaded");
      setMapReady(true);
      setSplashProgress(45);
      styleManager.rebuildOverlays(map);
      const id = styleManager.getStyleId();
      try {
        const el = container.querySelector(".maplibregl-ctrl-attrib-inner");
        // While fallback tiles (or the degraded solid style) are showing,
        // the tile ladder owns the credit line so it names the provider
        // actually on screen; otherwise the base-style credit applies.
        if (el) el.textContent = getTileAttributionOverride() ?? styleManager.getAttribution(id);
      } catch { /* attribution is cosmetic */ }

      // ?search=lng,lat deep link → removable searched-position marker
      try {
        const q = new URLSearchParams(window.location.search);
        const s = q.get("search");
        if (s) {
          const [slng, slat] = s.split(",").map(Number);
          if (Number.isFinite(slng) && Number.isFinite(slat)) {
            searchedCleanupRef.current = mountSearchedMarker(map, slng, slat);
          }
        }
      } catch { /* malformed search param — ignore */ }

      // Dismiss the splash on a fixed, deterministic path — never gated on
      // the map "idle" event, which a struggling GPU may never fire.
      const dismissSplash = () => {
        mark("first-interactive");
        measure("map-init-start");
        assertBudgets();
        setSplashProgress(100);
        // Unmount only after the 500 ms fade-out completes.
        setTimeout(() => setShowSplash(false), 620);
      };

      // Named pins — with a timeout so a hung fetch can't stall the splash.
      // If pins fail, the map still opens; the user gets a retry toast.
      const pinsWithTimeout = Promise.race([
        loadNamedPins(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("[map] pins fetch timed out")), 9000),
        ),
      ]);
      pinsWithTimeout
        .then(() => {
          mark("clusters-ready");
          rebuildEntityData();
          setDataReady(true);
          setSplashProgress(80);
          if (deeplink.pinSlug) {
            const pin = findPin(PINS, deeplink.pinSlug);
            if (pin) selectPinRef.current(pin);
            else showToast(S.pinNotOnMap);
          }
          // Short grace for the first paint, then out — no idle wait.
          setTimeout(dismissSplash, 700);
        })
        .catch(() => {
          setDataReady(true);
          setSplashProgress(80);
          setTimeout(dismissSplash, 700);
          showToast("Couldn't load locations. Check your connection and retry.", 8000);
        });

      // Density dots stream in after first idle (never blocks pins)
      map.once("idle", () => {
        loadDensityGeoJSON()
          .then((obj) => {
            const g = obj as GeoJSON.FeatureCollection;
            densityDataRef.current = g;
            setDensityTotal(g.features.length);
            addDensityLayer(map, g, persisted.densityVisible);
            setSplashProgress((p) => (p !== null && p >= 100 ? p : 99));
          })
          .catch(() => { /* density is optional */ });
      });
    });

    // Illustrated-base guard: the artwork is same-origin and bundled, but a
    // missing/corrupt file must never strand the user on an empty background.
    // tileFallback handles tile errors; WebGL errors are fatal (handled above).
    const onMapError = (e: { sourceId?: string }) => {
      if (e?.sourceId !== LEONIDA_BASE_SOURCE_ID) return;
      setTileNotice({
        msg: "Base map artwork failed to load — dark background shown.",
        retry: () => {
          const mm = mapRef.current;
          if (mm) {
            try {
              ensureLeonidaBase(mm);
            } catch {
              /* retry is best-effort; the notice stays until it works */
              return;
            }
          }
          setTileNotice(null);
        },
      });
    };
    map.on("error", onMapError as Parameters<MapLibreMap["on"]>[1]);
    const cleanupBaseError = () =>
      map.off("error", onMapError as Parameters<MapLibreMap["on"]>[1]);

    return () => {
      clearTimeout(stallTimer);
      clearTimeout(forceTimer);
      clearTimeout(paintTimer);
      window.removeEventListener("keydown", onKey);
      mapCanvas.removeEventListener("webglcontextlost", onContextLost);
      cleanupUrl();
      cleanupDrift();
      cleanupDrops();
      cleanupClusters();
      cleanupTile();
      cleanupBaseError();
      searchedCleanupRef.current?.();
      searchedCleanupRef.current = null;
      map.remove();
      mapRef.current = null;
      styleManagerRef.current = null;
      clearPinMeta();
    };
    /* eslint-enable react-hooks/set-state-in-effect */
    // Re-runs when the renderer toggles 2D <-> 3D (cleanup tears the map down).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderer]);
  // ── Discovery actions: every intent dispatches to the single reducer (R1) ──
  const onQuery = useCallback((q: string) => dispatch({ type: "SET_QUERY", query: q }), []);
  const toggleCategory = useCallback(
    (slug: string) => dispatch({ type: "TOGGLE_CATEGORY", slug }),
    []
  );
  const allCats = useCallback(
    () => dispatch({ type: "SET_ALL_CATEGORIES", slugs: ALL_CATS }),
    [ALL_CATS]
  );
  const noneCats = useCallback(() => dispatch({ type: "SET_NO_CATEGORIES" }), []);
  /** R2: one action clears query, filters, sort, and selection atomically. */
  const resetAll = useCallback(
    () => dispatch({ type: "RESET_ALL", allCats: ALL_CATS }),
    [ALL_CATS]
  );
  const toggleEvidence = useCallback(
    (status: EvidenceStatus) => dispatch({ type: "TOGGLE_EVIDENCE", status }),
    []
  );
  const setFoundMode = useCallback(
    (mode: FoundMode) => dispatch({ type: "SET_FOUND_MODE", mode }),
    []
  );
  const setSort = useCallback((sort: SortId) => {
    dispatch({ type: "SET_SORT", sort });
    saveSettings({ sort }); // our settings persist — the competitor's didn't
  }, []);

  // ── Derived data: EVERYTHING renders from the reducer + found set (R1, R4) ──
  /** Pins matching every active filter (synchronous — 7 pins, trivially fast). */
  const basePins = useMemo(
    () => selectBasePins(PINS, discovery, found),
    [discovery, found]
  );
  /** Search over the filtered set, debounced (R4: no per-keystroke source churn). */
  const debouncedQuery = useDebouncedValue(discovery.query, 150);
  const searchResults = useMemo(() => {
    if (!dataReady) return [];
    return selectSearchResults(basePins, debouncedQuery);
  }, [basePins, debouncedQuery, dataReady]);
  /** Faceted category counts: "tap this tab → get N" (R3). */
  const facetedCounts = useMemo(
    () => selectFacetedCounts(PINS, discovery, found),
    [discovery, found]
  );
  /** Browse-all results list, honoring the persisted sort order (spec §3.5). */
  const sortedBase = useMemo(
    () => selectSortedPins(basePins, discovery.sort),
    [basePins, discovery.sort]
  );
  /** R3: every number labeled. */
  const summaryLine = useMemo(
    () => selectSummary(PINS.length, basePins.length),
    [basePins.length]
  );
  void summaryLine;
  const showResetAll = hasActiveFilters(discovery, ALL_CATS);
  const emptyMsg = useMemo(() => emptyStateMessage(discovery, ALL_CATS), [discovery, ALL_CATS]);
  void emptyMsg;
  const counters = useMemo(
    () => computeCounters({
      totalNamed: PINS.length,
      shownNamed: basePins.length,
      densityTotal,
      densityVisible,
      foundCount: found.size,
      loading: !dataReady,
    }),
    [basePins.length, densityTotal, densityVisible, found.size, dataReady]
  );
  void counters;

  // Drawer list: query filters the list (debounced); otherwise the sorted set.
  const BROWSE_CAP = 200;
  const drawerPins = useMemo(
    () => (debouncedQuery.trim() === "" ? sortedBase.slice(0, BROWSE_CAP) : searchResults),
    [debouncedQuery, sortedBase, searchResults]
  );
  const drawerShownCount = debouncedQuery.trim() === "" ? basePins.length : searchResults.length;
  const evidenceFacets = useMemo(
    () => ALL_EVIDENCE_STATUSES.map((status) => ({
      status,
      label: EVIDENCE_META[status].label,
      active: evidenceOn.includes(status),
    })),
    [evidenceOn]
  );

  // ── Share: Web Share API first (native sheet on mobile), clipboard fallback ──
  const copyText = useCallback(async (text: string, okMsg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      showToast(okMsg);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Couldn't copy — your browser blocked clipboard access.");
    }
  }, [showToast]);

  const shareUrl = useCallback(async (url: string, title: string, text: string, fallbackMsg: string) => {
    const nav = navigator as Navigator & {
      share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
    };
    if (typeof nav.share === "function") {
      try {
        await nav.share({ title, text, url });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard copy.
      }
    }
    await copyText(url, fallbackMsg);
  }, [copyText]);

  const shareView = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    const url = buildShareUrl({
      lat: c.lat, lng: c.lng, zoom: map.getZoom(),
      pitch: map.getPitch(), bearing: map.getBearing(),
      pinSlug: discoveryRef.current.selectedId
        ? (findPin(PINS, discoveryRef.current.selectedId)?.slug ?? undefined)
        : undefined,
      style: styleManagerRef.current?.getStyleId(),
    }, window.location.origin);
    void shareUrl(url, "GTA 6 Interactive Map — GTA6mapx", "Check this view on the GTA 6 map", "Link copied — share this exact view");
  }, [shareUrl]);

  const copyPinLink = useCallback((pin: Pin) => {
    const url = buildShareUrl(
      { lat: pin.lat, lng: pin.lng, zoom: 15, pinSlug: pin.slug },
      window.location.origin
    );
    void copyText(url, "Pin link copied");
  }, [copyText]);

  // ── Camera actions ──
  const jumpToCity = useCallback((city: CityDef) => {
    flyTo(city.center[0], city.center[1], city.zoom);
    setActiveCity(city.id);
  }, [flyTo]);

  // ── Live map appliers (no persistence) ──
  // The settings panel writes the unified store directly; these apply values
  // to the running MapLibre instance. The effects below invoke them when the
  // store changes from the panel (or another tab).

  const resetView = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    resetCamera(map, DEFAULT_CENTER, DEFAULT_ZOOM, false);
    setActiveCity(null);
  }, []);

  const changeBaseStyle = useCallback(async (id: BaseStyleId) => {
    const sm = styleManagerRef.current;
    const map = mapRef.current;
    if (!sm || !map || id === sm.getStyleId()) return;
    setSwitching(true);
    // A user-initiated switch targets a specific provider — restart the tile
    // ladder from the preferred stage so a previous fallback doesn't linger.
    resetTileStages();
    try {
      await sm.switchStyle(map, id);
      setBaseStyle(id);
    } catch {
      showToast("Couldn't load that base map — kept your current view.");
      setBaseStyle(sm.getStyleId());
    } finally {
      setSwitching(false);
    }
  }, [showToast]);

  // ── Density toggle ──
  const toggleDensity = useCallback((v: boolean) => {
    const map = mapRef.current;
    if (map) setDensityLayerVisible(map, v);
    setDensityVisible(v);
    appliedDensityRef.current = v;
    setSiteSettings({ map: { densityVisible: v } });
  }, []);

  // ── Clustering toggle (settings panel writes the store; the effect
  // below live-applies it) ──
  const applyClusteringLive = useCallback((on: boolean) => {
    const map = mapRef.current;
    if (!map) return;
    clusteringRef.current = on;
    removeMarkerLayers(map);
    if (map.getSource(CLUSTER_SOURCE_ID)) map.removeSource(CLUSTER_SOURCE_ID);
    const spec = clusterSourceSpec() as unknown as Record<string, unknown>;
    spec.cluster = on;
    map.addSource(CLUSTER_SOURCE_ID, spec as Parameters<typeof map.addSource>[1]);
    if (entityDataRef.current) {
      (map.getSource(CLUSTER_SOURCE_ID) as GeoJSONSource).setData(entityDataRef.current);
    }
    addMarkerLayers(map, { clusterColorMode: clusterModeRef.current });
    refreshPinState(map, { selectedId: discoveryRef.current.selectedId, foundIds: foundRef.current });
  }, []);

  // ── Live-apply unified-store changes (settings panel / other tabs) ──
  useEffect(() => {
    if (!mapReady || appliedClusteringRef.current === siteSettings.clustering) return;
    appliedClusteringRef.current = siteSettings.clustering;
    applyClusteringLive(siteSettings.clustering);
  }, [siteSettings.clustering, mapReady, applyClusteringLive]);

  useEffect(() => {
    const v = siteSettings.map.densityVisible;
    if (!mapReady || appliedDensityRef.current === v) return;
    appliedDensityRef.current = v;
    const map = mapRef.current;
    if (map) setDensityLayerVisible(map, v);
    setDensityVisible(v);
  }, [siteSettings.map.densityVisible, mapReady]);

  // ── Mark as found ──
  const onToggleFound = useCallback((id: string) => {
    toggleFound(id);
    scheduleFoundRebuild();
  }, [toggleFound, scheduleFoundRebuild]);

  const normBearing = ((bearing % 360) + 540) % 360 - 180;
  const showCompass = Math.abs(normBearing) > 2 && mapReady && !mapError;

  // ══ 2D canvas map — the default renderer ══
  // The plain-canvas map always works (no WebGL needed) and shows every
  // pin — the island, all 517 named markers (clustered with counts), and
  // the density dots. The WebGL map is opt-in via the "3D" button below
  // or ?map=3d; if it fails it falls back here automatically.
  if (renderer === "2d" || mapError) {
    return (
      <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col px-3 py-3 md:px-20 md:pt-24 md:pb-20">
        <div className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 md:fixed md:top-6">
          <div className="pointer-events-auto">
            <MapHeaderPill onOpenAbout={() => setAboutOpen(true)} />
          </div>
        </div>
        {/* Map panel */}
        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.6),0_0_90px_rgba(139,92,246,0.06)]">
          <SimpleMap />
          <div className="map-grade pointer-events-none absolute inset-0" aria-hidden="true" />
          {/* Opt-in WebGL map for capable GPUs. If a 3D attempt already
              failed (mapError), retry with a fresh page load so the map
              initializes cleanly. */}
          <button
            type="button"
            onClick={() => {
              // Intentional full reload (not router.push): the WebGL map
              // must initialize from scratch with ?map=3d in the URL.
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination
              if (mapError) window.location.assign("/map?map=3d");
              else setRenderer("3d");
            }}
            title="Try the WebGL map"
            className="absolute bottom-3 left-3 z-30 rounded-full border border-white/15 bg-black/55 px-3.5 py-1.5 text-xs font-semibold text-white/85 backdrop-blur-md transition-colors hover:border-[rgba(255,80,197,0.6)] hover:text-white"
          >
            {mapError ? "Retry 3D map" : "3D map"}
          </button>
        </div>
        {aboutOpen && (
          <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
        )}
      </div>
    );
  }

  // ══ Centered map-panel layout ══
  // The map is a panel in the middle of the page with breathing room on all
  // four sides (top / bottom / left / right). On desktop the rails, header
  // pill and HUD live in that breathing room (fixed to the viewport edges,
  // like the reference layout); on mobile they stay overlaid on the panel.
  // Drawers and popups always stay anchored to the panel, so the
  // interaction tree is unchanged — only the chrome frame moved.
  return (
    <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col px-3 py-3 md:px-20 md:pt-24 md:pb-20">
      {/* Map panel */}
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.6),0_0_90px_rgba(139,92,246,0.06)]">
        <div ref={containerRef} className="maplibre-container absolute inset-0" />
        <div className="map-grade" aria-hidden="true" />

        {/* Back to the 2D canvas map (desktop; mobile 3D users reload for 2D) */}
        <button
          type="button"
          onClick={() => setRenderer("2d")}
          title="Back to the 2D map"
          className="absolute bottom-3 left-3 z-30 hidden rounded-full border border-white/15 bg-black/55 px-3.5 py-1.5 text-xs font-semibold text-white/85 backdrop-blur-md transition-colors hover:border-[rgba(255,80,197,0.6)] hover:text-white md:block"
        >
          2D map
        </button>

        {/* Phase 4 tools layer — self-contained; slices mount as children.
            The left icon rail also mounts here: it needs the tools runtime. */}
        <MapToolsHost
          getMap={() => mapRef.current}
          getTier={() => tierRef.current}
          toast={showToast}
          units={siteSettings.units === "miles" ? "imperial" : "metric"}
          onUnitsChange={(u) =>
            setSiteSettings({ units: u === "imperial" ? "miles" : "km" })
          }
          toolControlRef={toolControlRef}
          switchBaseStyle={changeBaseStyle}
          getBaseStyleId={() =>
            styleManagerRef.current?.getStyleId() ?? "leonida-dark"
          }
        >
          {/* T1 draw / T2 measure / T3 overlays / T4 display slices */}
          <DrawTools />
          <MeasureTools />
          <OverlaysTools />
          <DisplayTools />
          <LeftRail
            markerDrawerOpen={markerDrawerOpen}
            onToggleMarkerDrawer={() => setMarkerDrawerOpen((v) => !v)}
            onOpenGoTo={() => setGoToOpen(true)}
            onZoomIn={() => mapRef.current?.zoomIn()}
            onZoomOut={() => mapRef.current?.zoomOut()}
          />
        </MapToolsHost>

        {/* Top: floating header pill */}
        <MapHeaderPill onOpenAbout={() => setAboutOpen(true)} />

        {/* Right: vertical icon rail */}
        <RightRail
          onOpenAbout={() => setAboutOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        {/* Top-right: share this view */}
        <div className="absolute right-3 top-3 z-30 hidden md:fixed md:top-6 md:right-5 md:block">
          <button
            type="button"
            onClick={shareView}
            aria-label="Share this view"
            title="Share this view"
            className="glass-panel flex h-11 w-11 items-center justify-center rounded-full text-[#c3cad4] transition-colors hover:border-[rgba(255,80,197,0.6)] hover:text-white"
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
              <circle cx="6" cy="12" r="2.5" />
              <circle cx="14" cy="5" r="2.5" />
              <circle cx="14" cy="15" r="2.5" />
              <path d="M8.2 10.8l3.6-3.6M8.2 13.2l3.6 0.6" />
            </svg>
          </button>
        </div>

        {/* Left: marker list drawer */}
        <MarkerListDrawer
          open={markerDrawerOpen}
          onClose={() => setMarkerDrawerOpen(false)}
          query={discovery.query}
          onQuery={onQuery}
          categories={facetedCounts}
          activeCats={discovery.activeCats}
          onToggleCategory={toggleCategory}
          onAllCats={allCats}
          onNoneCats={noneCats}
          evidence={evidenceFacets}
          onToggleEvidence={toggleEvidence}
          foundMode={discovery.foundMode}
          onFoundMode={setFoundMode}
          sort={discovery.sort}
          onSort={setSort}
          pins={drawerPins}
          totalNamed={PINS.length}
          shownCount={drawerShownCount}
          selectedId={discovery.selectedId}
          onSelectPin={(pin) => selectPin(pin)}
          onResetAll={resetAll}
          hasActiveFilters={showResetAll}
          densityVisible={densityVisible}
          densityTotal={densityTotal}
          onToggleDensity={toggleDensity}
          foundCount={found.size}
        />

        {/* Marker popup (desktop) — mobile uses the bottom sheet */}
        {selected && (
          <MarkerPopup
            pin={selected}
            found={found.has(selected.id)}
            onToggleFound={() => onToggleFound(selected.id)}
            onClose={deselect}
            onCopyCoords={() => copyText(honestCoordString(selected.lat, selected.lng), "Coordinates copied")}
            onCopyLink={() => copyPinLink(selected)}
            onFullDetails={() => setDetailOpen(true)}
            coordsCopied={copied}
            linkCopied={copied}
          />
        )}

        {/* Bottom-left: coordinate HUD */}
        <div className="hidden md:block">
          <HudCluster
            getMap={() => mapRef.current}
            collapsed={hudCollapsed}
            onToggleCollapsed={() => {
              const next = !hudCollapsed;
              setHudCollapsed(next);
              saveSettings({ coordHudCollapsed: next });
            }}
            hidden={!mapReady}
            onOpenGoTo={() => setGoToOpen(true)}
          />
        </div>

        {/* Bottom-center: base-style segmented control */}
        <BaseStyleSegment value={baseStyle} switching={switching} onChange={changeBaseStyle} />

        {/* Bottom-right: reset / compass + city quick-jump */}
        <div className="absolute bottom-3 right-3 z-30 hidden flex-col items-end gap-2 md:fixed md:bottom-6 md:right-5 md:flex">
          <div className="flex gap-2">
            {showCompass && (
              <button
                type="button"
                onClick={() => { const m = mapRef.current; if (m) snapNorth(m); }}
                aria-label="Reset north"
                title="Reset north"
                className="glass-panel flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors hover:border-[#8b5cf6]/50"
              >
                <svg viewBox="0 0 20 20" className="h-5 w-5" style={{ transform: `rotate(${bearing}deg)` }} aria-hidden="true">
                  <polygon points="10,2 13,12 10,10 7,12" fill="#ff50c5" />
                  <polygon points="10,18 13,12 10,14 7,12" fill="#8b94a3" />
                </svg>
              </button>
            )}
            <button
              type="button"
              onClick={resetView}
              aria-label="Reset view"
              title="Reset view"
              className="glass-panel flex h-10 w-10 items-center justify-center rounded-full text-[#c3cad4] transition-colors hover:border-[rgba(255,80,197,0.6)] hover:text-white"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
                <path d="M3 10a7 7 0 1 1 2 4.9" />
                <path d="M3 15v-4h4" />
              </svg>
            </button>
          </div>
          <div className="glass-panel rounded-full px-2 py-1">
            <CityJump active={activeCity} onJump={jumpToCity} />
          </div>
        </div>

        {baseStyle === "real-florida" && !frameLegendDismissed && (
          <div className="absolute left-1/2 top-20 z-10 w-max max-w-[calc(100%-6rem)] -translate-x-1/2">
            <GameFrameLegend
              onDismiss={() => {
                setFrameLegendDismissed(true);
                saveSettings({ frameLegendDismissed: true });
              }}
            />
          </div>
        )}

        <p className="pointer-events-none absolute bottom-3 left-1/2 z-[5] hidden -translate-x-1/2 whitespace-nowrap font-mono text-[10px] text-[#5b6472] lg:block" aria-hidden="true">
          Preview tiles — approximate positions · Right-drag to tilt
        </p>

        {/* Mobile: locations FAB (fab-mobile hides it at desktop widths —
            unlayered .btn-ghost display beats Tailwind's md:hidden) */}
        <button
          type="button"
          onClick={() => setMarkerDrawerOpen(true)}
          className="btn-ghost fab-mobile absolute bottom-3 left-3 z-30 rounded-full px-4 py-2 text-sm font-semibold md:hidden"
        >
          Locations
        </button>

        {/* Mobile: settings */}
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Open settings"
          className="glass-panel absolute bottom-3 right-3 z-30 flex h-11 w-11 items-center justify-center rounded-full text-[#c3cad4] md:hidden"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
            <circle cx="10" cy="10" r="2.6" />
            <path d="M10 2.5v2.4M10 15.1v2.4M2.5 10h2.4M15.1 10h2.4M4.7 4.7l1.7 1.7M13.6 13.6l1.7 1.7M15.3 4.7l-1.7 1.7M6.4 13.6l-1.7 1.7" />
          </svg>
        </button>

        {tileNotice && (
          <div className="absolute left-1/2 top-20 z-20 w-max max-w-[calc(100%-2rem)] -translate-x-1/2">
            <div className="glass-panel flex items-center gap-3 px-3 py-2 text-xs text-white">
              <span className="min-w-0">{tileNotice.msg}</span>
              <button
                type="button"
                onClick={tileNotice.retry}
                className="btn-neon shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {showSplash && (
          <SplashLoader
            progress={splashProgress}
            stalled={splashStalled}
            leaving={splashProgress !== null && splashProgress >= 100}
            onSkip={() => setShowSplash(false)}
          />
        )}
      </div>

      {/* Mobile detail sheet */}
      {selected && (
        <div className="md:hidden">
          <MobileSheet onClose={deselect}>
            <div className="p-4">
              <h2 className="font-display text-lg uppercase tracking-wide text-white">{selected.name}</h2>
              <p className="mt-1 font-mono text-xs text-[#8b94a3]">
                {EVIDENCE_META[selected.evidence.status].label} · {honestCoordString(selected.lat, selected.lng)} (approx.)
              </p>
              <p className="mt-2 text-sm text-[#c3cad4]">{selected.evidence.detail}</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => copyPinLink(selected)}
                  className="btn-ghost flex-1 rounded-lg px-3 py-2 text-sm font-semibold"
                >
                  {copied ? "Link copied" : "Copy link"}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleFound(selected.id)}
                  aria-pressed={found.has(selected.id)}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                    found.has(selected.id) ? "btn-neon" : "btn-ghost"
                  }`}
                >
                  {found.has(selected.id) ? "Found ✓" : "Mark found"}
                </button>
              </div>
            </div>
          </MobileSheet>
        </div>
      )}

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        baseStyle={baseStyle}
        onBaseStyleChange={changeBaseStyle}
      />

      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />

      <MarkerDetailModal
        pin={detailOpen ? selected : null}
        onClose={() => setDetailOpen(false)}
        onGoTo={(pin) => {
          setDetailOpen(false);
          flyTo(pin.lng, pin.lat, 15);
        }}
        onCopyLink={() => selected && copyPinLink(selected)}
        linkCopied={copied}
        found={selected ? found.has(selected.id) : false}
        onToggleFound={() => selected && onToggleFound(selected.id)}
      />

      <GoToPosition
        open={goToOpen}
        onClose={() => setGoToOpen(false)}
        onGo={goToPosition}
      />

      <Toast message={toast} />
    </div>
  );
}
