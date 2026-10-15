"use client";

// ─── modules/engagement/settings/SettingsPanel.tsx ──────────────────────
// Unified settings panel (engagement spec §3.1).
//
// Entry points:
//  - gear in /map chrome → rendered as a map overlay (map state never lost),
//  - gear in SiteHeader → rendered as a modal on other surfaces (map-only
//    options disabled with an "Available on the map" hint).
//
// All options apply instantly and write through to the unified store
// (`gta6mapx:settings:v1`). Native inputs throughout: radios for
// theme/accent/units/panel-style, switches (role="switch" + aria-checked)
// for toggles. No language selector is rendered — English only at launch
// (spec §3.1 L1); the store keeps the field for a future i18n phase.

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  resetSettings,
  useSiteSettings,
  useStorageWarning,
  type AccentId,
  type PanelDensityId,
  type PanelStyleId,
  type ThemeId,
  type UnitsId,
} from "./store";
// Cluster color scheme + base style read/write THROUGH the map adapter
// (modules/map/settings.ts) so the panel stays in sync with GameMap.
import {
  loadSettings as loadMapSettings,
  saveSettings as saveMapSettings,
} from "@/modules/map/settings";
import type { BaseStyleId } from "@/modules/map/styleManager";

export type SettingsSurface = "map" | "site";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  surface: SettingsSurface;
  /** Controlled base style — the coordinator passes GameMap's value. */
  baseStyle?: BaseStyleId;
  /** The coordinator passes GameMap's changeBaseStyle here. */
  onBaseStyleChange?: (style: BaseStyleId) => void;
}

const THEME_OPTIONS: { id: ThemeId; name: string; blurb: string }[] = [
  {
    id: "neon-mirage",
    name: "Neon Mirage",
    blurb: "Canonical Vice City neon-noir — deep navy base, pink-to-orange glow.",
  },
  {
    id: "midnight-outrun",
    name: "Midnight Outrun",
    blurb: "Darker and bluer — restrained neon for night use.",
  },
  {
    id: "sunset-boulevard",
    name: "Sunset Boulevard",
    blurb: "Warm-leaning — stronger orange and magenta, higher luminance.",
  },
];

const ACCENT_OPTIONS: { id: AccentId; name: string; hex: string }[] = [
  { id: "neon-pink", name: "Neon Pink", hex: "#ff2d78" },
  { id: "sunset-orange", name: "Sunset Orange", hex: "#ff8a3c" },
  { id: "electric-cyan", name: "Electric Cyan", hex: "#22d3ee" },
  { id: "vice-purple", name: "Vice Purple", hex: "#a855f7" },
  { id: "lime", name: "Lime", hex: "#a3e635" },
];

const UNIT_OPTIONS: { id: UnitsId; name: string; blurb: string }[] = [
  { id: "km", name: "Kilometers", blurb: "Metric distances everywhere." },
  { id: "miles", name: "Miles", blurb: "Imperial distances everywhere." },
];

const PANEL_OPTIONS: { id: PanelStyleId; name: string; blurb: string }[] = [
  {
    id: "hud",
    name: "Floating HUD",
    blurb: "Translucent glass panels with neon borders.",
  },
  {
    id: "docked",
    name: "Docked",
    blurb: "Flush, opaque, squarer panels — less visual noise.",
  },
];

const DENSITY_OPTIONS: { id: PanelDensityId; name: string; blurb: string }[] = [
  {
    id: "comfortable",
    name: "Comfortable",
    blurb: "Roomier spacing for panels and drawers.",
  },
  {
    id: "compact",
    name: "Compact",
    blurb: "Tighter chrome — more map visible.",
  },
];

const BASE_STYLE_OPTIONS: { id: BaseStyleId; name: string; blurb: string }[] = [
  {
    id: "leonida-dark",
    name: "Leonida",
    blurb: "Custom dark Vice City map tiles.",
  },
  {
    id: "real-florida",
    name: "Real Florida",
    blurb: "Real-world reference tiles for orientation.",
  },
];

const CLUSTER_COLOR_OPTIONS: { id: "evidence" | "category"; name: string }[] = [
  { id: "evidence", name: "Evidence status" },
  { id: "category", name: "Category" },
];

const HEX_INPUT = /^#[0-9a-fA-F]{6}$/;

function SectionTitle({ children }: { children: string }) {
  return (
    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#8b94a3]">
      {children}
    </p>
  );
}

function RadioRow<T extends string>({
  groupName,
  optionId,
  name,
  blurb,
  checked,
  onSelect,
  swatch,
}: {
  groupName: string;
  optionId: T;
  name: string;
  blurb?: string;
  checked: boolean;
  onSelect: (id: T) => void;
  swatch?: string;
}) {
  const inputId = useId();
  return (
    <label
      htmlFor={inputId}
      className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-[10px] border px-3 py-2 transition-colors motion-reduce:transition-none ${
        checked
          ? "border-[var(--accent-line)] bg-[var(--accent-soft)]"
          : "border-[#1f2632] hover:border-[var(--accent-line)]"
      }`}
    >
      <input
        id={inputId}
        type="radio"
        name={groupName}
        value={optionId}
        checked={checked}
        onChange={() => onSelect(optionId)}
        className="h-4 w-4 shrink-0 accent-[var(--accent)]"
      />
      {swatch ? (
        <span
          aria-hidden="true"
          className="h-6 w-6 shrink-0 rounded-full border border-white/20"
          style={{ backgroundColor: swatch }}
        />
      ) : null}
      <span className="min-w-0">
        <span className="block text-[0.8125rem] font-semibold text-[#e8ecf1]">
          {name}
        </span>
        {blurb ? (
          <span className="block text-[0.75rem] leading-snug text-[#8b94a3]">
            {blurb}
          </span>
        ) : null}
      </span>
    </label>
  );
}

function Switch({
  label,
  hint,
  checked,
  onToggle,
  disabled,
  disabledHintId,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onToggle: (checked: boolean) => void;
  disabled?: boolean;
  disabledHintId?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-describedby={disabled && disabledHintId ? disabledHintId : undefined}
      disabled={disabled}
      onClick={() => onToggle(!checked)}
      className="flex min-h-[44px] w-full items-center justify-between gap-4 rounded-[10px] border border-[#1f2632] bg-transparent px-3 py-2.5 text-left transition-colors motion-reduce:transition-none hover:border-[var(--accent-line)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[#1f2632]"
    >
      <span>
        <span className="block text-[0.8125rem] font-semibold text-[#e8ecf1]">
          {label}
        </span>
        {hint ? (
          <span className="mt-0.5 block text-[0.75rem] text-[#8b94a3]">{hint}</span>
        ) : null}
      </span>
      <span
        aria-hidden="true"
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors motion-reduce:transition-none ${
          checked ? "bg-[var(--accent)]" : "bg-[#1a2230]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all motion-reduce:transition-none ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

/**
 * Settings panel. Instant-apply; every control writes through to the unified
 * store. Presentation: bottom sheet on mobile, right-side drawer on desktop
 * (same shell as the map's previous drawer so map state is never lost).
 */
export function SettingsPanel({
  open,
  onClose,
  surface,
  baseStyle,
  onBaseStyleChange,
}: SettingsPanelProps) {
  const [settings, setSettings] = useSiteSettings();
  const storageWarning = useStorageWarning();
  const [confirmingReset, setConfirmingReset] = useState(false);
  // Free-typed custom-accent hex draft; committed to the store only when a
  // valid #rrggbb value is present.
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const themeGroup = useId();
  const accentGroup = useId();
  const unitGroup = useId();
  const panelGroup = useId();
  const mapHintId = useId();

  const mapOnly = surface !== "map";

  // Two-tap reset state is cleared on close (no setState-in-effect needed).
  const handleClose = useCallback(() => {
    setConfirmingReset(false);
    setHexDraft(null);
    onClose();
  }, [onClose]);

  // Base map style: controlled by the coordinator when provided, otherwise
  // through the map adapter (same store, same key as GameMap).
  const resolvedBaseStyle: BaseStyleId = baseStyle ?? loadMapSettings().baseLayer;
  const handleBaseStyle = useCallback(
    (style: BaseStyleId) => {
      if (onBaseStyleChange) onBaseStyleChange(style);
      else saveMapSettings({ baseLayer: style });
    },
    [onBaseStyleChange]
  );

  // Cluster color scheme — always read/written through the map adapter so
  // this panel and GameMap can never disagree.
  const clusterColorMode = loadMapSettings().clusterColorMode;

  const customAccentHex = settings.accentCustom ?? "#ff2d78";
  const customAccentActive = settings.accentCustom != null;

  // ESC to close + focus trap (Tab cycles inside the dialog).
  useEffect(() => {
    if (!open) return;
    const el = panelRef.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
        return;
      }
      if (e.key !== "Tab" || !el) return;
      const focusables = Array.from(
        el.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((n) => n.getAttribute("aria-hidden") !== "true");
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  if (!open) return null;

  const handleReset = () => {
    if (!confirmingReset) {
      setConfirmingReset(true);
      return;
    }
    resetSettings();
    setConfirmingReset(false);
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* scrim — tap to close */}
      <button
        type="button"
        aria-label="Close settings"
        onClick={handleClose}
        className="absolute inset-0 cursor-default bg-black/50"
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="settings-panel glass-panel absolute inset-x-0 bottom-0 max-h-[78dvh] overflow-y-auto rounded-b-none rounded-t-2xl p-5 pb-[env(safe-area-inset-bottom)] md:inset-x-auto md:bottom-0 md:right-0 md:top-0 md:max-h-none md:w-[360px] md:rounded-l-2xl md:rounded-tr-none"
      >
        {/* mobile drag handle (visual) */}
        <div
          aria-hidden="true"
          className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#1f2632] md:hidden"
        />

        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-lg tracking-wide text-[#e8ecf1]">
            Settings
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close settings"
            autoFocus
            className="btn-ghost flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full p-2"
          >
            <span aria-hidden="true" className="text-xl leading-none">
              ×
            </span>
          </button>
        </div>

        {storageWarning ? (
          <p
            role="status"
            className="mb-5 rounded-[10px] border border-[#1f2632] bg-[#1a2230]/60 px-3 py-2 text-[0.75rem] text-[#8b94a3]"
          >
            Settings won&apos;t be saved in this browser session.
          </p>
        ) : null}

        <div className="flex flex-col gap-6">
          <fieldset>
            <legend className="mb-2">
              <SectionTitle>Theme</SectionTitle>
            </legend>
            <div className="flex flex-col gap-2">
              {THEME_OPTIONS.map((t) => (
                <RadioRow
                  key={t.id}
                  groupName={themeGroup}
                  optionId={t.id}
                  name={t.name}
                  blurb={t.blurb}
                  checked={settings.theme === t.id}
                  onSelect={(id) => setSettings({ theme: id })}
                />
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2">
              <SectionTitle>Accent color</SectionTitle>
            </legend>
            <div className="flex flex-col gap-2">
              {ACCENT_OPTIONS.map((a) => (
                <RadioRow
                  key={a.id}
                  groupName={accentGroup}
                  optionId={a.id}
                  name={a.name}
                  checked={settings.accent === a.id && !customAccentActive}
                  onSelect={(id) =>
                    setSettings({ accent: id, accentCustom: null })
                  }
                  swatch={a.hex}
                />
              ))}
              <div
                className={`flex min-h-[44px] items-center gap-3 rounded-[10px] border px-3 py-2 transition-colors motion-reduce:transition-none ${
                  customAccentActive
                    ? "border-[var(--accent-line)] bg-[var(--accent-soft)]"
                    : "border-[#1f2632]"
                }`}
              >
                <input
                  type="color"
                  value={customAccentHex}
                  onChange={(e) =>
                    setSettings({ accentCustom: e.target.value })
                  }
                  aria-label="Custom accent color picker"
                  className="h-9 w-12 shrink-0 cursor-pointer rounded border border-white/20 bg-transparent p-0.5"
                />
                <label className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="sr-only">Custom accent hex value</span>
                  <input
                    type="text"
                    value={hexDraft ?? settings.accentCustom ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setHexDraft(v);
                      if (HEX_INPUT.test(v)) setSettings({ accentCustom: v });
                    }}
                    onBlur={() => setHexDraft(null)}
                    placeholder="#ff2d78"
                    spellCheck={false}
                    autoComplete="off"
                    maxLength={7}
                    aria-label="Custom accent hex, for example #ff2d78"
                    className="w-full min-w-0 rounded-lg border border-[#1f2632] bg-black/40 px-2.5 py-2 font-mono text-[0.8125rem] text-[#e8ecf1] placeholder:text-[#5b6474] focus:border-[var(--accent-line)] focus:outline-none"
                  />
                </label>
                <span className="shrink-0 text-[0.75rem] font-semibold text-[#8b94a3]">
                  {customAccentActive ? "Custom" : "Hex"}
                </span>
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2">
              <SectionTitle>Panel style</SectionTitle>
            </legend>
            <div className="flex flex-col gap-2">
              {PANEL_OPTIONS.map((p) => (
                <RadioRow
                  key={p.id}
                  groupName={panelGroup}
                  optionId={p.id}
                  name={p.name}
                  blurb={p.blurb}
                  checked={settings.panelStyle === p.id}
                  onSelect={(id) => setSettings({ panelStyle: id })}
                />
              ))}
            </div>
          </fieldset>

          <div>
            <div className="mb-2">
              <SectionTitle>Panels</SectionTitle>
            </div>
            <div className="flex flex-col gap-2">
              <Switch
                label="Glass effect"
                hint="Blurred translucent panels — off renders them solid"
                checked={settings.glassPanels}
                onToggle={(v) => setSettings({ glassPanels: v })}
              />
              <div
                role="radiogroup"
                aria-label="Panel density"
                className="grid grid-cols-2 gap-2"
              >
                {DENSITY_OPTIONS.map((d) => {
                  const checked = settings.panelDensity === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      onClick={() => setSettings({ panelDensity: d.id })}
                      title={d.blurb}
                      className={`min-h-[44px] rounded-[10px] border px-3 py-2 text-left transition-colors motion-reduce:transition-none ${
                        checked
                          ? "border-[var(--accent-line)] bg-[var(--accent-soft)]"
                          : "border-[#1f2632] hover:border-[var(--accent-line)]"
                      }`}
                    >
                      <span className="block text-[0.8125rem] font-semibold text-[#e8ecf1]">
                        {d.name}
                      </span>
                      <span className="block text-[0.75rem] leading-snug text-[#8b94a3]">
                        {d.blurb}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <fieldset>
            <legend className="mb-2">
              <SectionTitle>Distance units</SectionTitle>
            </legend>
            <div className="flex flex-col gap-2">
              {UNIT_OPTIONS.map((u) => (
                <RadioRow
                  key={u.id}
                  groupName={unitGroup}
                  optionId={u.id}
                  name={u.name}
                  blurb={u.blurb}
                  checked={settings.units === u.id}
                  onSelect={(id) => setSettings({ units: id })}
                />
              ))}
            </div>
          </fieldset>

          <div>
            <div className="mb-2">
              <SectionTitle>Map</SectionTitle>
            </div>
            <div className="flex flex-col gap-2">
              <Switch
                label="Cluster nearby pins"
                hint="Group close pins into numbered badges at low zoom"
                checked={settings.clustering}
                onToggle={(v) => setSettings({ clustering: v })}
                disabled={mapOnly}
                disabledHintId={mapHintId}
              />
              <Switch
                label="Map grid overlay"
                hint="Subtle HUD-style lat/lng grid lines"
                checked={settings.grid}
                onToggle={(v) => setSettings({ grid: v })}
                disabled={mapOnly}
                disabledHintId={mapHintId}
              />
              {/* 3D buildings toggle removed — map is flat 2D now (3D concept set aside). */}
              <Switch
                label="Camera FOV readout"
                hint="Small HUD readout of camera bearing, pitch and zoom"
                checked={settings.fovHud}
                onToggle={(v) => setSettings({ fovHud: v })}
                disabled={mapOnly}
                disabledHintId={mapHintId}
              />
              <Switch
                label="Community heatmap"
                hint="Density heat of community pin positions"
                checked={settings.map.heatmap}
                onToggle={(v) => setSettings({ map: { heatmap: v } })}
                disabled={mapOnly}
                disabledHintId={mapHintId}
              />
            </div>
            <div className="mt-4">
              <div className="mb-2">
                <SectionTitle>Base map style</SectionTitle>
              </div>
              <div
                role="group"
                aria-label="Base map style"
                className="grid grid-cols-2 gap-2"
              >
                {BASE_STYLE_OPTIONS.map((b) => {
                  const pressed = resolvedBaseStyle === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      aria-pressed={pressed}
                      onClick={() => handleBaseStyle(b.id)}
                      title={b.blurb}
                      disabled={mapOnly}
                      className={`min-h-[44px] rounded-[10px] border px-3 py-2 text-left transition-colors motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50 ${
                        pressed
                          ? "border-[var(--accent-line)] bg-[var(--accent-soft)]"
                          : "border-[#1f2632] hover:border-[var(--accent-line)]"
                      }`}
                    >
                      <span className="block text-[0.8125rem] font-semibold text-[#e8ecf1]">
                        {b.name}
                      </span>
                      <span className="block text-[0.75rem] leading-snug text-[#8b94a3]">
                        {b.blurb}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-4">
              <label className="flex items-center gap-2">
                <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#8b94a3]">
                  Cluster colors
                </span>
                <select
                  value={clusterColorMode}
                  onChange={(e) =>
                    saveMapSettings({
                      clusterColorMode: e.target
                        .value as "evidence" | "category",
                    })
                  }
                  disabled={mapOnly}
                  aria-label="Cluster color scheme"
                  className="h-10 min-w-0 flex-1 cursor-pointer rounded-lg border border-[#1f2632] bg-[#0d1219] px-2.5 text-xs font-medium text-[#e8ecf1] transition-colors hover:border-[var(--accent-line)] focus:border-[var(--accent-line)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {CLUSTER_COLOR_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id} className="bg-[#0d1219]">
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {mapOnly ? (
              <p
                id={mapHintId}
                className="mt-2 text-[0.75rem] text-[#8b94a3]"
              >
                Map options are available on the map.
              </p>
            ) : null}
          </div>

          <div className="rounded-[10px] border border-[#1f2632] p-3">
            <SectionTitle>Motion</SectionTitle>
            <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-[#8b94a3]">
              Animations follow your system setting. Turn on Reduce Motion in
              your operating system to disable animations.
            </p>
          </div>

          <div className="border-t border-[#1f2632] pt-4">
            <button
              type="button"
              onClick={handleReset}
              aria-live="polite"
              className={`flex min-h-[44px] w-full items-center justify-center rounded-[10px] border px-3 text-[0.8125rem] font-semibold transition-colors motion-reduce:transition-none ${
                confirmingReset
                  ? "border-[#ef4444]/60 bg-[#ef4444]/10 text-[#fca5a5]"
                  : "border-[#1f2632] text-[#8b94a3] hover:border-[#ef4444]/40 hover:text-[#e8ecf1]"
              }`}
            >
              {confirmingReset
                ? "Tap again to confirm reset"
                : "Reset to defaults"}
            </button>
            {confirmingReset ? (
              <button
                type="button"
                onClick={() => setConfirmingReset(false)}
                className="mt-2 flex min-h-[44px] w-full items-center justify-center text-[0.75rem] text-[#8b94a3] hover:text-[#e8ecf1]"
              >
                Cancel
              </button>
            ) : null}
          </div>

          {/* Legal — always rendered, never conditional. */}
          <div className="border-t border-[#1f2632] pt-4">
            <SectionTitle>Legal</SectionTitle>
            <p className="mt-2 text-[0.75rem] leading-relaxed text-[#8b94a3]">
              GTA6mapx is an independent fan project. It is not affiliated
              with or endorsed by Rockstar Games or Take-Two Interactive.
            </p>
            <p className="mt-2 text-[0.75rem] leading-relaxed text-[#8b94a3]">
              Map data: gtadb.org contributors —{" "}
              <a
                href="https://creativecommons.org/licenses/by/4.0/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-[#e8ecf1]"
              >
                CC BY 4.0
              </a>
            </p>
            <p className="mt-1 text-[0.75rem] leading-relaxed text-[#8b94a3]">
              Base map © OpenMapTiles © OpenStreetMap contributors
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
