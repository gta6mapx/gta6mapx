"use client";

// ─── modules/engagement/settings/store.ts ───────────────────────────────
// Unified settings store for GTA6mapx (engagement spec §3.2).
//
// Single source of truth for ALL site settings, persisted to the versioned
// key `gta6mapx:settings:v1`. Guarantees:
//  - lazy JSON read/write, try/catch on every storage access (private-mode-safe)
//  - write-through on every change, debounced ≤300 ms (250 ms)
//  - whitelist validation on load: corrupt JSON / unknown version /
//    out-of-range values → defaults (never half-applied from a bad payload)
//  - mandatory `version` field
//  - `storage` event cross-tab sync
//  - SSR-safe: server snapshot is always defaults; client loads lazily
//  - storage unavailable → in-memory only + one-time subtle notice
//  - one-time migration from legacy keys (`gta6mapx:map-settings`,
//    `gta6mapx:legend-collapsed`); legacy keys are deleted after migration
//    so settings never fork across two stores.
//
// The map-only extras (base layer, sort, HUD dismissal, …) live under the
// namespaced `map` sub-object — still ONE store, one key. The legacy
// `modules/map/settings.ts` module is a thin adapter over this store so
// existing map code paths keep working unchanged.

import { useSyncExternalStore } from "react";

// ─── Schema ──────────────────────────────────────────────────────────────

export type ThemeId = "neon-mirage" | "midnight-outrun" | "sunset-boulevard";
export type AccentId =
  | "neon-pink"
  | "sunset-orange"
  | "electric-cyan"
  | "vice-purple"
  | "lime";
export type UnitsId = "km" | "miles";
export type PanelStyleId = "hud" | "docked";
export type PanelDensityId = "comfortable" | "compact";

export const THEME_IDS: readonly ThemeId[] = [
  "neon-mirage",
  "midnight-outrun",
  "sunset-boulevard",
];
export const ACCENT_IDS: readonly AccentId[] = [
  "neon-pink",
  "sunset-orange",
  "electric-cyan",
  "vice-purple",
  "lime",
];
export const UNITS_IDS: readonly UnitsId[] = ["km", "miles"];
export const PANEL_STYLE_IDS: readonly PanelStyleId[] = ["hud", "docked"];
export const PANEL_DENSITY_IDS: readonly PanelDensityId[] = [
  "comfortable",
  "compact",
];

/**
 * Map-only extras. These are NOT engagement options — they persist map chrome
 * state (base layer, discovery prefs, HUD dismissal, annotation colors) that
 * the unified key must own so settings never fork across two stores.
 */
export interface SettingsMapExtras {
  baseLayer: "leonida-dark" | "real-florida";
  pitchMax: number;
  bearingSnap: boolean;
  densityVisible: boolean;
  sort: "name" | "evidence" | "updated" | "region";
  clusterColorMode: "evidence" | "category";
  coordHudCollapsed: boolean;
  frameLegendDismissed: boolean;
  heatmap: boolean;
  markerColors: Record<string, string>;
  legendCollapsed: boolean;
}

export interface SiteSettings {
  version: 1;
  theme: ThemeId;
  accent: AccentId;
  /** User-supplied hex accent (overrides the named accent's color); null = off. */
  accentCustom: string | null;
  units: UnitsId;
  panelStyle: PanelStyleId;
  /** Extra density setting for panel chrome (radios, paddings). */
  panelDensity: PanelDensityId;
  /** Master switch for the glass/blur panel treatment. */
  glassPanels: boolean;
  clustering: boolean;
  grid: boolean;
  buildings3d: boolean;
  fovHud: boolean;
  /** English only at launch. The selector stays hidden (spec §3.1 L1). */
  language: "en";
  map: SettingsMapExtras;
}

/** Patch shape: top-level fields plus a shallow-mergeable `map` slice. */
export type SettingsPatch = Partial<
  Omit<SiteSettings, "version" | "map" | "language">
> & {
  map?: Partial<SettingsMapExtras>;
};

export const SETTINGS_KEY = "gta6mapx:settings:v1";
export const SETTINGS_VERSION = 1 as const;

const LEGACY_SETTINGS_KEY = "gta6mapx:map-settings";
const LEGEND_COLLAPSED_KEY = "gta6mapx:legend-collapsed";

/** Debounce for write-through persistence (spec: ≤300 ms). */
const WRITE_DEBOUNCE_MS = 250;

const DEFAULT_MAP_EXTRAS: SettingsMapExtras = {
  baseLayer: "leonida-dark",
  pitchMax: 58,
  bearingSnap: true,
  densityVisible: true,
  sort: "name",
  clusterColorMode: "evidence",
  coordHudCollapsed: false,
  frameLegendDismissed: false,
  heatmap: false,
  markerColors: {},
  legendCollapsed: false,
};

export const DEFAULT_SETTINGS: SiteSettings = Object.freeze({
  version: 1,
  theme: "neon-mirage",
  accent: "neon-pink",
  accentCustom: null,
  units: "km",
  panelStyle: "hud",
  panelDensity: "comfortable",
  glassPanels: true,
  clustering: true,
  grid: false,
  buildings3d: true,
  fovHud: false,
  language: "en",
  map: Object.freeze({ ...DEFAULT_MAP_EXTRAS }),
}) as SiteSettings;

// ─── Private-mode-safe storage ───────────────────────────────────────────

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function getStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function readRaw(storage: StorageLike | null, key: string): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(storage: StorageLike | null, key: string, value: string): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeRaw(storage: StorageLike | null, key: string): void {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    /* ignore — best effort */
  }
}

// ─── Validation ──────────────────────────────────────────────────────────

function isOneOf<T extends string>(value: unknown, list: readonly T[]): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

function isBool(value: unknown): value is boolean {
  return typeof value === "boolean";
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function sanitizeMarkerColors(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof v === "string" && HEX_COLOR.test(v)) out[k] = v.toUpperCase();
    }
  }
  return out;
}

function sanitizeMapExtras(input: unknown): SettingsMapExtras {
  const rec =
    input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const d = DEFAULT_MAP_EXTRAS;
  return {
    baseLayer:
      rec.baseLayer === "leonida-dark" || rec.baseLayer === "real-florida"
        ? rec.baseLayer
        : d.baseLayer,
    pitchMax:
      typeof rec.pitchMax === "number" && Number.isFinite(rec.pitchMax)
        ? Math.min(Math.max(rec.pitchMax, 0), 58)
        : d.pitchMax,
    bearingSnap: isBool(rec.bearingSnap) ? rec.bearingSnap : d.bearingSnap,
    densityVisible: isBool(rec.densityVisible) ? rec.densityVisible : d.densityVisible,
    sort: isOneOf(rec.sort, ["name", "evidence", "updated", "region"] as const)
      ? rec.sort
      : d.sort,
    clusterColorMode: isOneOf(rec.clusterColorMode, ["evidence", "category"] as const)
      ? rec.clusterColorMode
      : d.clusterColorMode,
    coordHudCollapsed: isBool(rec.coordHudCollapsed)
      ? rec.coordHudCollapsed
      : d.coordHudCollapsed,
    frameLegendDismissed: isBool(rec.frameLegendDismissed)
      ? rec.frameLegendDismissed
      : d.frameLegendDismissed,
    heatmap: isBool(rec.heatmap) ? rec.heatmap : d.heatmap,
    markerColors: sanitizeMarkerColors(rec.markerColors),
    legendCollapsed: isBool(rec.legendCollapsed)
      ? rec.legendCollapsed
      : d.legendCollapsed,
  };
}

/**
 * Whitelist-validate a parsed payload. Unknown/missing `version` (or a newer
 * one) → full defaults, never half-applied. A known v1 payload gets
 * per-field validation with per-field default fallback.
 */
function sanitize(input: unknown): SiteSettings {
  if (!input || typeof input !== "object") return { ...DEFAULT_SETTINGS, map: { ...DEFAULT_SETTINGS.map } };
  const rec = input as Record<string, unknown>;
  if (rec.version !== SETTINGS_VERSION) {
    return { ...DEFAULT_SETTINGS, map: { ...DEFAULT_SETTINGS.map } };
  }
  const d = DEFAULT_SETTINGS;
  return {
    version: 1,
    theme: isOneOf(rec.theme, THEME_IDS) ? rec.theme : d.theme,
    accent: isOneOf(rec.accent, ACCENT_IDS) ? rec.accent : d.accent,
    accentCustom:
      rec.accentCustom === null ||
      (typeof rec.accentCustom === "string" && HEX_COLOR.test(rec.accentCustom))
        ? rec.accentCustom
        : d.accentCustom,
    units: isOneOf(rec.units, UNITS_IDS) ? rec.units : d.units,
    panelStyle: isOneOf(rec.panelStyle, PANEL_STYLE_IDS)
      ? rec.panelStyle
      : d.panelStyle,
    panelDensity: isOneOf(rec.panelDensity, PANEL_DENSITY_IDS)
      ? rec.panelDensity
      : d.panelDensity,
    glassPanels: isBool(rec.glassPanels) ? rec.glassPanels : d.glassPanels,
    clustering: isBool(rec.clustering) ? rec.clustering : d.clustering,
    grid: isBool(rec.grid) ? rec.grid : d.grid,
    buildings3d: isBool(rec.buildings3d) ? rec.buildings3d : d.buildings3d,
    fovHud: isBool(rec.fovHud) ? rec.fovHud : d.fovHud,
    language: "en",
    map: sanitizeMapExtras(rec.map),
  };
}

/** Sanitize an incoming patch — unknown keys and bad values are dropped. */
function sanitizePatch(patch: SettingsPatch): SettingsPatch {
  const out: SettingsPatch = {};
  if (isOneOf(patch.theme, THEME_IDS)) out.theme = patch.theme;
  if (isOneOf(patch.accent, ACCENT_IDS)) out.accent = patch.accent;
  if (patch.accentCustom === null) out.accentCustom = null;
  else if (
    typeof patch.accentCustom === "string" &&
    HEX_COLOR.test(patch.accentCustom)
  )
    out.accentCustom = patch.accentCustom;
  if (isOneOf(patch.units, UNITS_IDS)) out.units = patch.units;
  if (isOneOf(patch.panelStyle, PANEL_STYLE_IDS)) out.panelStyle = patch.panelStyle;
  if (isOneOf(patch.panelDensity, PANEL_DENSITY_IDS))
    out.panelDensity = patch.panelDensity;
  if (isBool(patch.glassPanels)) out.glassPanels = patch.glassPanels;
  if (isBool(patch.clustering)) out.clustering = patch.clustering;
  if (isBool(patch.grid)) out.grid = patch.grid;
  if (isBool(patch.buildings3d)) out.buildings3d = patch.buildings3d;
  if (isBool(patch.fovHud)) out.fovHud = patch.fovHud;
  if (patch.map && typeof patch.map === "object") {
    // Only keep keys the caller actually sent; validate each value.
    const slim: Partial<SettingsMapExtras> = {};
    const m = patch.map;
    if (m.baseLayer === "leonida-dark" || m.baseLayer === "real-florida")
      slim.baseLayer = m.baseLayer;
    if (typeof m.pitchMax === "number" && Number.isFinite(m.pitchMax))
      slim.pitchMax = Math.min(Math.max(m.pitchMax, 0), 58);
    if (isBool(m.bearingSnap)) slim.bearingSnap = m.bearingSnap;
    if (isBool(m.densityVisible)) slim.densityVisible = m.densityVisible;
    if (isOneOf(m.sort, ["name", "evidence", "updated", "region"] as const))
      slim.sort = m.sort;
    if (isOneOf(m.clusterColorMode, ["evidence", "category"] as const))
      slim.clusterColorMode = m.clusterColorMode;
    if (isBool(m.coordHudCollapsed)) slim.coordHudCollapsed = m.coordHudCollapsed;
    if (isBool(m.frameLegendDismissed))
      slim.frameLegendDismissed = m.frameLegendDismissed;
    if (isBool(m.heatmap)) slim.heatmap = m.heatmap;
    if (m.markerColors && typeof m.markerColors === "object")
      slim.markerColors = sanitizeMarkerColors(m.markerColors);
    if (isBool(m.legendCollapsed)) slim.legendCollapsed = m.legendCollapsed;
    if (Object.keys(slim).length > 0) out.map = slim;
  }
  return out;
}

// ─── Legacy migration ────────────────────────────────────────────────────

const LEGACY_THEME_MAP: Record<string, ThemeId> = {
  vice: "neon-mirage",
  midnight: "midnight-outrun",
  neon: "sunset-boulevard",
};

function isVisibleFlag(v: unknown): v is { visible: boolean } {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { visible?: unknown }).visible === "boolean"
  );
}

/**
 * Build a settings object from the legacy `gta6mapx:map-settings` payload
 * (plus `gta6mapx:legend-collapsed`). Returns null when there is nothing to
 * migrate. Only whitelisted legacy fields are carried over.
 */
function migrateLegacy(storage: StorageLike | null): SiteSettings | null {
  if (!storage) return null;
  const raw = readRaw(storage, LEGACY_SETTINGS_KEY);
  const legendRaw = readRaw(storage, LEGEND_COLLAPSED_KEY);
  if (!raw && legendRaw == null) return null;

  let legacy: Record<string, unknown> = {};
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        legacy = parsed as Record<string, unknown>;
      }
    } catch {
      legacy = {};
    }
  }

  const base: SiteSettings = {
    ...DEFAULT_SETTINGS,
    map: { ...DEFAULT_SETTINGS.map },
  };

  const legacyTheme =
    typeof legacy.theme === "string" ? LEGACY_THEME_MAP[legacy.theme] : undefined;
  if (legacyTheme) base.theme = legacyTheme;
  if (legacy.units === "metric") base.units = "km";
  else if (legacy.units === "imperial") base.units = "miles";
  if (isBool(legacy.mode3d)) base.buildings3d = legacy.mode3d;
  if (isBool(legacy.clustering)) base.clustering = legacy.clustering;
  if (isVisibleFlag(legacy.grid)) base.grid = legacy.grid.visible;
  if (isVisibleFlag(legacy.fovHud)) base.fovHud = legacy.fovHud.visible;

  const m = base.map;
  if (legacy.baseLayer === "leonida-dark" || legacy.baseLayer === "real-florida")
    m.baseLayer = legacy.baseLayer;
  if (typeof legacy.pitchMax === "number" && Number.isFinite(legacy.pitchMax))
    m.pitchMax = Math.min(Math.max(legacy.pitchMax, 0), 58);
  if (isBool(legacy.bearingSnap)) m.bearingSnap = legacy.bearingSnap;
  if (isBool(legacy.densityVisible)) m.densityVisible = legacy.densityVisible;
  if (
    legacy.sort === "name" ||
    legacy.sort === "evidence" ||
    legacy.sort === "updated" ||
    legacy.sort === "region"
  )
    m.sort = legacy.sort;
  if (legacy.clusterColorMode === "evidence" || legacy.clusterColorMode === "category")
    m.clusterColorMode = legacy.clusterColorMode;
  if (isBool(legacy.coordHudCollapsed)) m.coordHudCollapsed = legacy.coordHudCollapsed;
  if (isBool(legacy.frameLegendDismissed))
    m.frameLegendDismissed = legacy.frameLegendDismissed;
  if (isVisibleFlag(legacy.heatmap)) m.heatmap = legacy.heatmap.visible;
  if (legacy.markerColors && typeof legacy.markerColors === "object")
    m.markerColors = sanitizeMarkerColors(legacy.markerColors);
  if (legendRaw === "1" || legendRaw === "0") m.legendCollapsed = legendRaw === "1";

  return base;
}

// ─── Core state ──────────────────────────────────────────────────────────

let initialized = false;
let current: SiteSettings = DEFAULT_SETTINGS;
let storageAvailable = true;
let storageWarningFired = false;

type Listener = () => void;
const listeners = new Set<Listener>();
const warningListeners = new Set<Listener>();

let writeTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Apply theme/accent/panel to the document root so CSS custom properties
 * (`--neon-*`, `--surface-*`, `--accent`, …) take effect site-wide.
 * Client-only; no-ops on the server.
 */
export function applySettingsToDocument(s: SiteSettings): void {
  if (typeof document === "undefined") return;
  try {
    const root = document.documentElement;
    root.setAttribute("data-theme", s.theme);
    root.setAttribute("data-accent", s.accent);
    root.setAttribute("data-panel", s.panelStyle);
    root.setAttribute("data-density", s.panelDensity);
    root.setAttribute("data-glass", s.glassPanels ? "on" : "flat");
    // Custom accent overrides the named accent's color tokens site-wide
    // (inline style beats the [data-accent] rules; the named id stays so
    // removing the custom value restores the swatch exactly).
    if (s.accentCustom && HEX_COLOR.test(s.accentCustom)) {
      const { r, g, b } = hexToRgb(s.accentCustom);
      const a = (alpha: number) => `rgba(${r}, ${g}, ${b}, ${alpha})`;
      root.style.setProperty("--neon-pink", s.accentCustom);
      root.style.setProperty("--neon-pink-soft", a(0.14));
      root.style.setProperty("--neon-pink-line", a(0.3));
      root.style.setProperty("--glass-border", `1px solid ${a(0.22)}`);
      root.style.setProperty("--glass-border-strong", `1px solid ${a(0.45)}`);
      root.style.setProperty(
        "--glass-shadow",
        `0 12px 40px rgba(0, 0, 0, 0.55), 0 0 24px ${a(0.1)}`
      );
    } else {
      for (const p of CUSTOM_ACCENT_PROPS) root.style.removeProperty(p);
    }
  } catch {
    /* DOM unavailable — cosmetic only */
  }
}

/** Parse "#rrggbb" into channels; assumes HEX_COLOR-tested input. */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

/** Inline custom properties set on <html> for a user-supplied accent. */
const CUSTOM_ACCENT_PROPS = [
  "--neon-pink",
  "--neon-pink-soft",
  "--neon-pink-line",
  "--glass-border",
  "--glass-border-strong",
  "--glass-shadow",
] as const;

function fireStorageWarning(): void {  if (storageWarningFired) return;
  storageWarningFired = true;
  warningListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* listener error must not break settings */
    }
  });
}

function persist(): void {
  writeTimer = null;
  const storage = getStorage();
  const ok = writeRaw(storage, SETTINGS_KEY, JSON.stringify(current));
  if (!ok) {
    // Storage blocked (private mode): keep working in-memory, warn once.
    storageAvailable = false;
    fireStorageWarning();
  } else {
    storageAvailable = true;
  }
}

function schedulePersist(): void {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(persist, WRITE_DEBOUNCE_MS);
}

function emit(): void {
  applySettingsToDocument(current);
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* listener error must not break settings */
    }
  });
}

function ensureInit(): void {
  if (initialized) return;
  initialized = true;
  const storage = getStorage();
  const raw = readRaw(storage, SETTINGS_KEY);
  if (raw) {
    try {
      current = sanitize(JSON.parse(raw));
    } catch {
      current = { ...DEFAULT_SETTINGS, map: { ...DEFAULT_SETTINGS.map } };
    }
  } else {
    // First run with the new key: migrate legacy settings if present.
    const migrated = migrateLegacy(storage);
    current = migrated ?? { ...DEFAULT_SETTINGS, map: { ...DEFAULT_SETTINGS.map } };
    if (migrated) schedulePersist();
  }
  // Legacy keys are a stale fork once the unified store owns settings —
  // delete them (best effort) so settings can never live in two stores.
  removeRaw(storage, LEGACY_SETTINGS_KEY);
  removeRaw(storage, LEGEND_COLLAPSED_KEY);
  applySettingsToDocument(current);

  // Cross-tab sync: another tab's write replaces our state (no re-persist,
  // so tabs can't ping-pong).
  try {
    if (typeof window !== "undefined") {
      window.addEventListener("storage", (e: StorageEvent) => {
        if (e.key !== SETTINGS_KEY) return;
        try {
          current =
            e.newValue != null
              ? sanitize(JSON.parse(e.newValue))
              : { ...DEFAULT_SETTINGS, map: { ...DEFAULT_SETTINGS.map } };
        } catch {
          current = { ...DEFAULT_SETTINGS, map: { ...DEFAULT_SETTINGS.map } };
        }
        emit();
      });
    }
  } catch {
    /* storage events unavailable — tabs just won't live-sync */
  }
}

// ─── Public API ──────────────────────────────────────────────────────────

/** Read the current settings. Never throws; never returns a corrupt object. */
export function getSettings(): SiteSettings {
  ensureInit();
  return current;
}

/**
 * Write-through update. Applies instantly in-memory (and to the DOM),
 * persists debounced ≤300 ms. Unknown/bad fields are dropped.
 */
export function setSettings(patch: SettingsPatch): void {
  ensureInit();
  const clean = sanitizePatch(patch);
  const next: SiteSettings = {
    ...current,
    ...clean,
    map: clean.map ? { ...current.map, ...clean.map } : current.map,
    version: 1,
  };
  // No-op when nothing actually changed (prevents listener ping-pong).
  if (
    next.theme === current.theme &&
    next.accent === current.accent &&
    next.accentCustom === current.accentCustom &&
    next.units === current.units &&
    next.panelStyle === current.panelStyle &&
    next.panelDensity === current.panelDensity &&
    next.glassPanels === current.glassPanels &&
    next.clustering === current.clustering &&
    next.grid === current.grid &&
    next.buildings3d === current.buildings3d &&
    next.fovHud === current.fovHud &&
    JSON.stringify(next.map) === JSON.stringify(current.map)
  ) {
    return;
  }
  current = next;
  emit();
  schedulePersist();
}

/**
 * Reset to defaults. Clears the settings key (spec §3.1) and applies
 * defaults instantly. The key is left cleared — no rewrite.
 */
export function resetSettings(): void {
  ensureInit();
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  removeRaw(getStorage(), SETTINGS_KEY);
  current = { ...DEFAULT_SETTINGS, map: { ...DEFAULT_SETTINGS.map } };
  emit();
}

/** Subscribe to settings changes (cross-tab aware). */
export function subscribeSettings(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** True once storage was found unavailable (private mode). Fires once. */
export function subscribeStorageWarning(fn: Listener): () => void {
  warningListeners.add(fn);
  return () => {
    warningListeners.delete(fn);
  };
}

export function hasStorageWarning(): boolean {
  return storageWarningFired;
}

export function isStorageAvailable(): boolean {
  ensureInit();
  return storageAvailable;
}

// ─── React bindings ──────────────────────────────────────────────────────

/**
 * SSR-safe binding: the server (and first hydration paint) always sees
 * defaults — no hydration mismatch. Client state loads lazily on subscribe.
 */
export function useSiteSettings(): [SiteSettings, (patch: SettingsPatch) => void] {
  const settings = useSyncExternalStore(
    subscribeSettings,
    () => getSettings(),
    () => DEFAULT_SETTINGS
  );
  return [settings, setSettings];
}

/** One-time subtle notice when settings can't be persisted this session. */
export function useStorageWarning(): boolean {
  return useSyncExternalStore(
    subscribeStorageWarning,
    () => hasStorageWarning(),
    () => false
  );
}

// ─── Test escape hatches ─────────────────────────────────────────────────

/** Flush any pending debounced write immediately. */
export function flushSettings(): void {
  if (writeTimer) {
    clearTimeout(writeTimer);
    persist();
  }
}

/**
 * Drop all in-memory state (module init flag, pending writes, warning flag)
 * so the next read re-initializes from storage. Test-only.
 */
export function resetSettingsForTests(): void {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  initialized = false;
  current = DEFAULT_SETTINGS;
  storageAvailable = true;
  storageWarningFired = false;
}
