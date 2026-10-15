/**
 * styleManager.ts — base-style registry, style switching, and overlay rebuild.
 *
 * Owns:
 *  - the base-layer style registry (leonida-dark / real-florida),
 *  - switchStyle(): single-instance `map.setStyle` with an 8 s timeout,
 *    revert-to-previous, and start/end lifecycle callbacks,
 *  - rebuildOverlays(): idempotent overlay re-registration after every setStyle,
 *  - the illustrated Leonida artwork registrar (leonida-dark only),
 *  - the game-frame overlay (real-florida reference mode only),
 *  - the decorative 3d-buildings extrusion layer (vector tile styles only),
 *  - attribution strings per style.
 *
 * Dual map instances were rejected (two WebGL contexts + double tile memory);
 * setStyle preserves the camera natively — we never re-apply camera state.
 * All code and artwork here are original. No competitor code or assets are referenced.
 */

import type { Map as MLMap, StyleSpecification } from "maplibre-gl";
// ─── gameCoords contract (owned by another worker) ──────────────────────────
// GAME_WORLD_BOUNDS: { xMin, xMax, yMin, yMax } (game-world units, Leonida frame)
// gameToMap(x, y) → { lat: number; lng: number; quality: "verified"|"approximate" }
import { GAME_WORLD_BOUNDS, gameToMap } from "./gameCoords";
import { buildLeonidaBaseRegistrar } from "./leonidaBase";
import { loadSettings, saveSettings } from "./settings";

export type BaseStyleId = "leonida-dark" | "real-florida";

/** Content modules plug their layers in here; styleManager re-runs them after setStyle. */
export interface OverlayRegistrar {
  id: string;
  addTo(map: MLMap): void;
  removeFrom(map: MLMap): void;
}

interface BaseStyleDef {
  id: BaseStyleId;
  /** Remote tile style URL, or an inline style object (leonida-dark). */
  style: string | StyleSpecification;
  supports3D: boolean;
  isRaster: boolean;
}

/**
 * Inline dark style for the illustrated Leonida base. No remote tiles —
 * the artwork (leonidaBase registrar) is the base layer. The background
 * color matches the artwork's ocean edge so the void blends seamlessly.
 */
const LEONIDA_DARK_INLINE_STYLE: StyleSpecification = {
  version: 8,
  name: "GTA6mapx Leonida",
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#180a4e" },
    },
  ],
};

const BASE_STYLES: Record<BaseStyleId, BaseStyleDef> = {
  "leonida-dark": {
    id: "leonida-dark",
    style: LEONIDA_DARK_INLINE_STYLE,
    supports3D: true,
    isRaster: true,
  },
  "real-florida": {
    id: "real-florida",
    // Same keyless provider, bright cartography. Satellite sub-toggle is
    // deferred (parent decision); Florida mode = OSM-style cartography +
    // the game-frame outline + the honesty legend.
    style: "https://tiles.openfreemap.org/styles/bright",
    supports3D: true,
    isRaster: false,
  },
};

const DEFAULT_STYLE_ID: BaseStyleId = "leonida-dark";
const SWITCH_TIMEOUT_MS = 8000;

/**
 * Public base-style lookup — used by the compare tool's second map instance,
 * which renders a base style directly (no StyleManager ownership). Returns a
 * remote style URL or an inline style object, depending on the base.
 */
export function baseStyleSpecFor(id: BaseStyleId): string | StyleSpecification {
  return BASE_STYLES[id].style;
}

/** Thrown (and surfaced to the UI toast) when a style switch times out. */
export class SwitchTimeoutError extends Error {
  constructor() {
    super("style-switch-timeout");
    this.name = "SwitchTimeoutError";
  }
}

// ─── Game-frame overlay (owned by styleManager) ─────────────────────────────

const FRAME_SOURCE_ID = "gta6-gameframe";
const FRAME_FILL_LAYER_ID = "gta6-gameframe-fill";
const FRAME_OUTLINE_LAYER_ID = "gta6-gameframe-outline";

/** Bounds expanded 15% (centered) so the frame reads as an approximation, not a border. */
function expandedBounds(): { xMin: number; xMax: number; yMin: number; yMax: number } {
  const b = GAME_WORLD_BOUNDS;
  const w = b.xMax - b.xMin;
  const h = b.yMax - b.yMin;
  const ex = w * 0.075;
  const ey = h * 0.075;
  return { xMin: b.xMin - ex, xMax: b.xMax + ex, yMin: b.yMin - ey, yMax: b.yMax + ey };
}

/** Game-frame rectangle → GeoJSON polygon in lat/lng. Pure; unit-testable. */
export function buildGameFrameGeoJSON(): GeoJSON.Feature<GeoJSON.Polygon> {
  const b = expandedBounds();
  const corners: Array<[number, number]> = [
    [b.xMin, b.yMin],
    [b.xMax, b.yMin],
    [b.xMax, b.yMax],
    [b.xMin, b.yMax],
  ];
  const ring = corners.map(([x, y]) => {
    const p = gameToMap(x, y);
    return [p.lng, p.lat] as [number, number];
  });
  ring.push(ring[0]);
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [ring] },
  };
}

function buildFrameRegistrar(getStyleId: () => BaseStyleId): OverlayRegistrar {
  return {
    id: "game-frame",
    addTo(map: MLMap) {
      // The frame marks the approximate game region against real geography —
      // only meaningful in real-florida mode. On leonida-dark the illustrated
      // artwork IS the game world, so the frame stays hidden.
      if (getStyleId() !== "real-florida") return;
      const data = buildGameFrameGeoJSON();
      const existing = map.getSource(FRAME_SOURCE_ID) as unknown as
        | { setData: (d: GeoJSON.Feature<GeoJSON.Polygon>) => void }
        | undefined;
      if (existing && typeof existing.setData === "function") {
        existing.setData(data);
      } else {
        map.addSource(FRAME_SOURCE_ID, { type: "geojson", data });
      }
      if (!map.getLayer(FRAME_FILL_LAYER_ID)) {
        map.addLayer({
          id: FRAME_FILL_LAYER_ID,
          type: "fill",
          source: FRAME_SOURCE_ID,
          paint: { "fill-color": "#8b5cf6", "fill-opacity": 0.06 },
        });
      }
      // The dashed outline marks the approximate game region against real
      // Florida geography — only meaningful in real-florida mode.
      if (getStyleId() === "real-florida" && !map.getLayer(FRAME_OUTLINE_LAYER_ID)) {
        map.addLayer({
          id: FRAME_OUTLINE_LAYER_ID,
          type: "line",
          source: FRAME_SOURCE_ID,
          paint: {
            "line-color": "#8b5cf6",
            "line-width": 2,
            "line-dasharray": [2, 2],
          },
        });
      }
    },
    removeFrom(map: MLMap) {
      for (const layerId of [FRAME_OUTLINE_LAYER_ID, FRAME_FILL_LAYER_ID]) {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
      }
      if (map.getSource(FRAME_SOURCE_ID)) map.removeSource(FRAME_SOURCE_ID);
    },
  };
}

// ─── StyleManager ────────────────────────────────────────────────────────────

export class StyleManager {
  private registrars: OverlayRegistrar[];
  private currentId: BaseStyleId;
  private startCbs: Array<() => void> = [];
  private endCbs: Array<(ok: boolean, msg?: string) => void> = [];

  constructor(registrars: OverlayRegistrar[]) {
    // Canonical z-order: the illustrated Leonida artwork goes first (bottom),
    // then the game frame, so pin/cluster content (registered by content
    // modules) always draws above the base.
    this.registrars = [
      buildLeonidaBaseRegistrar(() => this.currentId),
      buildFrameRegistrar(() => this.currentId),
      ...registrars,
    ];
    this.currentId = this.readPersistedStyleId();
  }

  private readPersistedStyleId(): BaseStyleId {
    try {
      const saved = loadSettings().baseLayer;
      if (saved === "leonida-dark" || saved === "real-florida") return saved;
    } catch {
      /* fall through to default */
    }
    return DEFAULT_STYLE_ID;
  }

  /** Base style to construct the map with (persisted choice, or the default). */
  initialStyle(): string | StyleSpecification {
    return BASE_STYLES[this.currentId].style;
  }

  getStyleId(): BaseStyleId {
    return this.currentId;
  }

  onSwitchStart(cb: () => void): void {
    this.startCbs.push(cb);
  }

  onSwitchEnd(cb: (ok: boolean, msg?: string) => void): void {
    this.endCbs.push(cb);
  }

  private emitStart(): void {
    for (const cb of this.startCbs) {
      try {
        cb();
      } catch {
        /* listener errors must not break the switch */
      }
    }
  }

  private emitEnd(ok: boolean, msg?: string): void {
    for (const cb of this.endCbs) {
      try {
        cb(ok, msg);
      } catch {
        /* listener errors must not break the switch */
      }
    }
  }

  private awaitStyleLoad(map: MLMap, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (map.isStyleLoaded()) {
        resolve();
        return;
      }
      const timer = setTimeout(() => {
        cleanup();
        reject(new SwitchTimeoutError());
      }, timeoutMs);
      const onData = () => {
        if (map.isStyleLoaded()) {
          cleanup();
          resolve();
        }
      };
      const cleanup = () => {
        clearTimeout(timer);
        map.off("styledata", onData);
      };
      map.on("styledata", onData);
    });
  }

  private updateAttribution(map: MLMap): void {
    try {
      const inner = map.getContainer().querySelector(".maplibregl-ctrl-attrib-inner");
      if (inner) inner.textContent = this.getAttribution(this.currentId);
    } catch {
      /* attribution control absent — non-fatal */
    }
  }

  /**
   * Switch the base style on the single map instance. The camera is preserved
   * natively by setStyle — we never re-apply it. On timeout the previous
   * style is restored (best effort) and a SwitchTimeoutError is thrown so the
   * UI can toast.
   */
  async switchStyle(map: MLMap, id: BaseStyleId): Promise<void> {
    if (id === this.currentId) return;
    const previous = this.currentId;
    this.emitStart();
    this.currentId = id;

    try {
      map.setStyle(BASE_STYLES[id].style);
    } catch {
      this.currentId = previous;
      this.emitEnd(false, "style-switch-timeout");
      throw new SwitchTimeoutError();
    }

    try {
      await this.awaitStyleLoad(map, SWITCH_TIMEOUT_MS);
    } catch {
      // Revert to the previous style; never leave a half-styled map.
      this.currentId = previous;
      try {
        map.setStyle(BASE_STYLES[previous].style);
        await this.awaitStyleLoad(map, SWITCH_TIMEOUT_MS);
      } catch {
        /* best effort — the map keeps its last usable style */
      }
      this.emitEnd(false, "style-switch-timeout");
      throw new SwitchTimeoutError();
    }

    this.rebuildOverlays(map);
    this.updateAttribution(map);
    saveSettings({ baseLayer: id });

    // 3D-preference hook: if a future style ever lacks supports3D, ease the
    // pitch flat instead of fighting it. Both current styles support 3D, so
    // this branch is dormant — kept for the style contract.
    if (!BASE_STYLES[id].supports3D && map.getPitch() > 0) {
      map.easeTo({ pitch: 0, duration: 600 });
    }

    this.emitEnd(true);
  }

  /**
   * Idempotent overlay rebuild: remove every registrar's layers, re-add them
   * in canonical order, then re-add the 3D buildings extrusion (decorative).
   * Call after every setStyle — a style swap must never strand layers.
   */
  rebuildOverlays(map: MLMap): void {
    for (const r of this.registrars) {
      try {
        r.removeFrom(map);
      } catch {
        /* removeFrom is best-effort by contract */
      }
    }
    for (const r of this.registrars) {
      try {
        r.addTo(map);
      } catch (err) {
        console.warn(`[styleManager] overlay "${r.id}" failed to re-add:`, err);
      }
    }
    this.add3DBuildings(map);
  }

  /**
   * Decorative 3D building extrusion. Any failure (missing source-layer in a
   * future style, layer-creation exception) is caught and skipped silently —
   * buildings are decoration; the map stays fully usable.
   */
  private add3DBuildings(map: MLMap): void {
    // 3D concept set aside — flat 2D map; never add the extrusion layer.
    return;
    if (!BASE_STYLES[this.currentId].supports3D) return;
    try {
      if (!map.getSource("openmaptiles")) return; // style lacks the vector source
      if (map.getLayer("3d-buildings")) return; // already present (idempotent)
      const layers = map.getStyle()?.layers ?? [];
      const anchor = layers.find(
        (l) => l.type === "symbol" && (l as { layout?: Record<string, unknown> }).layout?.["text-field"]
      )?.id;
      map.addLayer(
        {
          id: "3d-buildings",
          type: "fill-extrusion",
          source: "openmaptiles",
          "source-layer": "building",
          filter: ["==", "extrude", "true"],
          minzoom: 13.5,
          paint: {
            "fill-extrusion-color": [
              "interpolate",
              ["linear"],
              ["get", "render_height"],
              0,
              "#2a3444",
              60,
              "#3b4a63",
              150,
              "#57406b",
            ],
            "fill-extrusion-height": [
              "interpolate",
              ["linear"],
              ["zoom"],
              13.5,
              0,
              15,
              ["get", "render_height"],
            ],
            "fill-extrusion-base": [
              "interpolate",
              ["linear"],
              ["zoom"],
              13.5,
              0,
              15,
              ["get", "render_min_height"],
            ],
            "fill-extrusion-opacity": 0.9,
          },
        },
        anchor
      );
    } catch (err) {
      console.warn("[styleManager] 3d-buildings skipped (decorative):", err);
    }
  }

  /**
   * Attribution per style: provider credit + fan-project disclaimer.
   *
   * GTADB CC BY 4.0 CREDIT — INSERTION POINT (owner adds pre-deploy):
   *   append e.g. " · Map data © gtadb.org (CC BY 4.0)" here before launch.
   *   Left EMPTY intentionally — do not ship without it.
   */
  getAttribution(id: BaseStyleId): string {
    const provider =
      id === "leonida-dark"
        ? "Base map artwork © GTA6mapx (original)"
        : "© OpenMapTiles © OpenStreetMap contributors";
    const gtadbCredit = ""; // ← GTADB CC BY 4.0 credit goes here (owner, pre-deploy)
    const fanProject = "Fan project — not affiliated with Rockstar Games";
    return [provider, gtadbCredit, fanProject].filter(Boolean).join(" · ");
  }
}
