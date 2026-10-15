/**
 * tileFallback.ts — tile failure ladder. Never a blank map.
 *
 * Owns:
 *  - the TILE_STAGES chain (Stage 0: OpenFreeMap dark placeholder;
 *    Stage 1: CARTO dark-matter — tried automatically when Stage 0 fails),
 *  - the DEGRADED_STYLE minimal fallback (solid dark background),
 *  - installTileFallback(): error detection → retries with backoff per stage
 *    → next stage → degraded-style swap + user notice with a Retry action →
 *    recovery detection,
 *  - a style-load WATCHDOG: MapLibre never times out a hanging style fetch
 *    on its own, so if the style JSON hasn't parsed within WATCHDOG_MS the
 *    ladder treats the stage as failed (covers networks that blackhole the
 *    tile host instead of erroring — no error event, no "load", black canvas).
 *
 * Stage promotion is a config change, not a code change: the ladder reads
 * the TILE_STAGES array. All code here is original.
 */

import type { Map as MLMap } from "maplibre-gl";

export interface TileStage {
  id: string;
  styleUrl: string;
  attribution: string;
  stageLabel: string;
  minzoom: number;
  maxzoom: number;
}

/**
 * Ordered fallback chain. Stage 0 is preferred; when its retries are
 * exhausted (or its style fetch hangs past the watchdog) the ladder
 * advances to the next stage automatically before giving up to the
 * solid-color degraded style.
 */
export const TILE_STAGES: TileStage[] = [
  {
    id: "stage-0",
    styleUrl: "https://tiles.openfreemap.org/styles/dark",
    attribution: "© OpenMapTiles © OpenStreetMap contributors",
    stageLabel: "Loading preview tiles…",
    minzoom: 0,
    maxzoom: 22,
  },
  {
    id: "stage-1",
    styleUrl: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
    attribution: "© OpenStreetMap contributors © CARTO",
    stageLabel: "Loading fallback tiles…",
    minzoom: 0,
    maxzoom: 22,
  },
];

/** Backward-compatible alias: the preferred stage. */
export const TILE_STAGE: TileStage = TILE_STAGES[0];

/**
 * Degraded fallback style: solid dark background, no sources.
 * Pins, list and search (React/GeoJSON, not tiles) keep working on top of it.
 */
export const DEGRADED_STYLE: object = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#0a0e14" },
    },
  ],
};

const FAN_NOTE = "Fan project — not affiliated with Rockstar Games";
const RETRY_DELAYS_MS = [1000, 3000, 9000];
const RECOVERY_QUIET_MS = 10000;
/** Style JSON parse budget: past this with no style, the fetch is hung. */
const WATCHDOG_MS = 15000;

// ─── Module-level ladder state (one map instance per page) ─────────────────
// Kept at module scope so hosts (attribution, base-style switches) can query
// and reset it without holding the install closure.
let activeStageIdx = 0;
let degradedActive = false;

/**
 * Attribution override for the map control. Returns null while the preferred
 * stage is healthy (the host's own attribution applies); otherwise the
 * fallback/degraded credit line, always keeping the fan-project note.
 */
export function getTileAttributionOverride(): string | null {
  if (degradedActive) return `Simplified view — tiles unavailable · ${FAN_NOTE}`;
  if (activeStageIdx > 0) {
    return `${TILE_STAGES[activeStageIdx].attribution} · ${FAN_NOTE}`;
  }
  return null;
}

/** True while fallback tiles (or the degraded solid style) are showing. */
export function isFallbackTilesActive(): boolean {
  return degradedActive || activeStageIdx > 0;
}

/**
 * Reset the ladder to the preferred stage. Call before a user-initiated
 * base-style switch so the switch starts from the canonical provider.
 */
export function resetTileStages(): void {
  activeStageIdx = 0;
  degradedActive = false;
}

interface TileFallbackOpts {
  /** Non-blocking notice (banner). `retry` re-arms the ladder and reloads the stage style. */
  onNotice(msg: string, retry: () => void): void;
  /** Fired when tiles are healthy again after a degradation. */
  onRecovered(): void;
  /**
   * Fired after degrade()/retry()/stage-advance swaps the base style.
   * `setStyle` wipes every custom source/layer, so the host must re-add its
   * GeoJSON overlays (pins, clusters, density, game frame) or the map goes
   * permanently pin-less on the swapped style.
   */
  onBaseStyleSwapped?: (map: MLMap) => void;
  /** Override the style-load watchdog budget (default 15 s). */
  styleLoadTimeoutMs?: number;
}

type ErrorHandler = (e: unknown) => void;

/** Heuristic: is this map "error" event a tile/source failure (not a fatal WebGL error)? */
function isTileishError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const err = (e as { error?: unknown }).error;
  const msg =
    typeof err === "object" && err !== null
      ? String((err as { message?: unknown }).message ?? "")
      : String(err ?? "");
  // Fatal context errors belong to deviceCaps (§4), not the tile ladder.
  if (/webgl|context lost|gpu/i.test(msg)) return false;
  const rec = e as Record<string, unknown>;
  // Tile/source failures carry tile, sourceId/source, or a fetch-ish message.
  if (rec.tile || rec.sourceId || rec.source) return true;
  return /tile|source|fetch|network|timeout|aborted|429|5\d\d/i.test(msg);
}

function withJitter(baseMs: number): number {
  return baseMs + Math.random() * baseMs * 0.25;
}

/**
 * Install the failure ladder on a live map instance.
 * Returns a cleanup function (removes listeners, clears timers).
 */
export function installTileFallback(map: MLMap, opts: TileFallbackOpts): () => void {
  const timers: Array<ReturnType<typeof setTimeout>> = [];
  let degraded = false;
  let attempt = 0; // 0 = idle; 1..3 = retry ladder in progress
  let errorsSinceAttempt = 0;
  let lastErrorAt = 0;
  let pendingRecovery = false;
  let recoveryBaseline = 0;
  let disposed = false;
  let watchdog: ReturnType<typeof setTimeout> | null = null;
  const watchdogMs = opts.styleLoadTimeoutMs ?? WATCHDOG_MS;

  // Fresh install (or remount): the ladder starts from the preferred stage.
  activeStageIdx = 0;
  degradedActive = false;

  const later = (ms: number, fn: () => void): void => {
    const t = setTimeout(() => {
      if (!disposed) fn();
    }, ms);
    timers.push(t);
  };

  const updateAttribution = () => {
    try {
      const el = map
        .getContainer()
        .querySelector(".maplibregl-ctrl-attrib-inner");
      const override = getTileAttributionOverride();
      // Null = preferred stage healthy: leave the host's attribution alone.
      if (el && override !== null) el.textContent = override;
    } catch {
      /* attribution is cosmetic */
    }
  };

  /** setStyle wipes custom sources/layers — let the host re-add its overlays. */
  const notifyStyleSwapped = () => {
    try {
      opts.onBaseStyleSwapped?.(map);
    } catch {
      /* overlay rebuild is best-effort; the notice banner already explains state */
    }
  };

  const disarmWatchdog = () => {
    if (watchdog !== null) {
      clearTimeout(watchdog);
      watchdog = null;
    }
  };

  /**
   * A parsed style disarms the watchdog; from here the error ladder owns
   * failures. (Checked via isStyleLoaded rather than the "load" event,
   * because "load" also waits on tiles — a tile hang must not look like a
   * style hang.)
   */
  const onStyleData = () => {
    try {
      if (map.isStyleLoaded()) disarmWatchdog();
    } catch {
      /* map may be mid-teardown */
    }
  };

  /** Move to the next tile stage, or fall back to the solid style. */
  const advanceStageOrDegrade = () => {
    if (disposed) return;
    attempt = 0;
    errorsSinceAttempt = 0;
    if (activeStageIdx + 1 < TILE_STAGES.length) {
      activeStageIdx += 1;
      applyStage();
    } else {
      degrade();
    }
  };

  const applyStage = () => {
    if (disposed) return;
    disarmWatchdog();
    try {
      map.setStyle(TILE_STAGES[activeStageIdx].styleUrl);
    } catch {
      // setStyle itself threw — skip straight past this stage.
      advanceStageOrDegrade();
      return;
    }
    updateAttribution();
    notifyStyleSwapped();
    armWatchdog();
  };

  const armWatchdog = () => {
    disarmWatchdog();
    watchdog = setTimeout(() => {
      watchdog = null;
      if (disposed || degraded) return;
      let loaded = false;
      try {
        loaded = map.isStyleLoaded() === true;
      } catch {
        /* treat as not loaded */
      }
      if (!loaded) {
        // The style fetch hung: no error event, no "load" — without this,
        // the map sits on a black canvas (and a stalled splash) forever.
        advanceStageOrDegrade();
      }
    }, watchdogMs);
    timers.push(watchdog);
  };

  const degrade = () => {
    if (degraded || disposed) return;
    degraded = true;
    degradedActive = true;
    attempt = 0;
    disarmWatchdog();
    try {
      map.setStyle(DEGRADED_STYLE as Parameters<MLMap["setStyle"]>[0]);
    } catch {
      /* degraded style is trivial; a throw here means a deeper problem */
    }
    updateAttribution();
    opts.onNotice(
      "Map tiles are having trouble loading — showing simplified view. Pins still work.",
      retry
    );
    notifyStyleSwapped();
  };

  const scheduleNextAttempt = () => {
    if (attempt >= RETRY_DELAYS_MS.length) {
      advanceStageOrDegrade();
      return;
    }
    const delay = withJitter(RETRY_DELAYS_MS[attempt]);
    attempt += 1;
    errorsSinceAttempt = 0;
    later(delay, () => {
      // Attempt = "did the errors persist across the backoff window?"
      // (MapLibre retries fetches itself; we observe rather than refetch —
      // a surgical single-tile refetch is not public API.)
      if (errorsSinceAttempt > 0) scheduleNextAttempt();
      else attempt = 0; // quiet window → ladder resets
    });
  };

  const onError: ErrorHandler = (e) => {
    if (degraded || disposed) return;
    if (!isTileishError(e)) return;
    errorsSinceAttempt += 1;
    lastErrorAt = Date.now();
    if (attempt === 0) scheduleNextAttempt();
  };

  const retry = () => {
    if (disposed) return;
    degraded = false;
    degradedActive = false;
    activeStageIdx = 0;
    attempt = 0;
    errorsSinceAttempt = 0;
    pendingRecovery = true;
    recoveryBaseline = lastErrorAt;
    applyStage();
    // If the map goes quiet (no tile errors) shortly after the retry, call it recovered.
    later(RECOVERY_QUIET_MS, () => {
      if (pendingRecovery && lastErrorAt <= recoveryBaseline) {
        pendingRecovery = false;
        opts.onRecovered();
      }
    });
  };

  // A clean idle with no errors since a retry also counts as recovered.
  const onIdle = () => {
    if (pendingRecovery && lastErrorAt <= recoveryBaseline) {
      pendingRecovery = false;
      opts.onRecovered();
    }
  };

  const onFullLoad = () => {
    disarmWatchdog();
  };

  map.on("error", onError as Parameters<MLMap["on"]>[1]);
  map.on("idle", onIdle);
  map.on("styledata", onStyleData as Parameters<MLMap["on"]>[1]);
  map.on("load", onFullLoad as Parameters<MLMap["on"]>[1]);
  armWatchdog();

  return () => {
    disposed = true;
    disarmWatchdog();
    for (const t of timers) clearTimeout(t);
    map.off("error", onError as Parameters<MLMap["on"]>[1]);
    map.off("idle", onIdle);
    map.off("styledata", onStyleData as Parameters<MLMap["on"]>[1]);
    map.off("load", onFullLoad as Parameters<MLMap["on"]>[1]);
  };
}
