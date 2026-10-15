"use client";

// ─── modules/map/tools/display/DisplaySettingsPanel.tsx ──────────────
// The Display panel: grid / camera HUD / heatmap toggles, marker-color
// customization (user annotations only), and the shared units toggle.
// Renders when runtime.activePanel === "display"; desktop uses GlassPanel
// anchored right of the toolbar, mobile uses the shared MobileSheet.

import { useTools } from "../shared/toolRuntime";
import { useIsMobile } from "../shared/mobile";
import GlassPanel from "../shared/glassPanel";
import MobileSheet from "../../components/MobileSheet";
import type { DisplaySettingsApi } from "./useDisplaySettings";
import { displaySliceStrings as s } from "./sliceStrings";
import {
  MARKER_COLOR_SWATCHES,
  USER_ANNOTATION_COLOR_CATEGORIES,
  getUserPinColor,
} from "./MarkerColors";
import { UNITS_OPTIONS, formatUnitsLabel } from "./units";

// Spec anchor: right of the vertical toolbar.
const PANEL_ANCHOR = "absolute left-[68px] top-[64px] z-20";

function ToggleRow({
  label,
  hint,
  kbd,
  checked,
  onChange,
  testLabel,
}: {
  label: string;
  hint: string;
  kbd?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  testLabel: string;
}) {
  return (
    <div className="flex min-h-[44px] items-center justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-semibold text-white">
          <span className="truncate">{label}</span>
          {kbd && (
            <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-[#8b94a3]">
              {kbd}
            </kbd>
          )}
        </p>
        <p className="truncate text-[11px] text-[#8b94a3]">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={testLabel}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${
          checked
            ? "border-[#ff50c5]/70 bg-[#ff50c5]/40"
            : "border-white/15 bg-white/10"
        }`}
      >
        <span
          className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full transition-all ${
            checked ? "left-[calc(100%-1.375rem)] bg-[#ff50c5]" : "left-1 bg-[#8b94a3]"
          }`}
        />
      </button>
    </div>
  );
}

export default function DisplaySettingsPanel({
  display,
}: {
  display: DisplaySettingsApi;
}) {
  const { setActivePanel, units, setUnits, isMinimalTier, toast } = useTools();
  const mobile = useIsMobile();
  const minimal = isMinimalTier();

  const close = () => setActivePanel(null);

  const content = (
    <div className="flex flex-col gap-1">
      {minimal ? (
        <p className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[11px] leading-relaxed text-[#8b94a3]">
          {s.minimalTierNote}
        </p>
      ) : (
        <>
          <ToggleRow
            label={s.gridLabel}
            hint={s.gridHint}
            kbd={s.gridKbd}
            checked={display.grid.visible}
            onChange={display.setGridVisible}
            testLabel={s.gridLabel}
          />
          <ToggleRow
            label={s.fovLabel}
            hint={s.fovHint}
            kbd={s.fovKbd}
            checked={display.fovHud.visible}
            onChange={display.setFovHudVisible}
            testLabel={s.fovLabel}
          />
          <ToggleRow
            label={s.heatmapLabel}
            hint={s.heatmapHint}
            kbd={s.heatmapKbd}
            checked={display.heatmap.visible}
            onChange={display.setHeatmapVisible}
            testLabel={s.heatmapLabel}
          />
          <p className="pb-1 text-[11px] italic text-[#8b94a3]">{s.heatmapLegend}</p>
        </>
      )}

      {/* Marker colors — user-authored annotations ONLY (never entity pins). */}
      <div className="mt-2 border-t border-white/10 pt-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white">
          {s.markerColorsTitle}
        </h3>
        <p className="mt-0.5 text-[11px] text-[#8b94a3]">{s.markerColorsHint}</p>
        <div className="mt-2 flex flex-col gap-3">
          {USER_ANNOTATION_COLOR_CATEGORIES.map((cat) => {
            const current = getUserPinColor(cat.id, display.markerColors);
            return (
              <div key={cat.id}>
                <div className="mb-1.5 flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 rounded-full border border-white/20"
                    style={{ backgroundColor: current }}
                  />
                  <span className="text-sm font-medium text-white">{cat.label}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {MARKER_COLOR_SWATCHES.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`${cat.label} color ${color}`}
                      aria-pressed={current === color}
                      title={color}
                      onClick={() => display.setMarkerColor(cat.id, color)}
                      className={`h-7 w-7 rounded-full border transition-transform ${
                        current === color
                          ? "scale-110 border-white"
                          : "border-white/20 hover:scale-105"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <label
                    className="relative flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-white/30 text-[10px] text-white"
                    title="Custom color"
                  >
                    <span aria-hidden="true">+</span>
                    <input
                      type="color"
                      aria-label={`${cat.label} custom color`}
                      value={current}
                      onChange={(e) => display.setMarkerColor(cat.id, e.target.value.toUpperCase())}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => {
            display.resetMarkerColors();
            toast(s.markerColorsReset);
          }}
          className="btn-ghost mt-3 rounded-lg px-3 py-2 text-xs font-semibold"
        >
          {s.resetDefaults}
        </button>
      </div>

      {/* Units — shared setting; writes through the runtime. */}
      <div className="mt-2 border-t border-white/10 pt-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white">
          {s.unitsTitle}
        </h3>
        <div
          role="group"
          aria-label={formatUnitsLabel(units)}
          className="mt-2 grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-black/40 p-1"
        >
          {UNITS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={units === opt.value}
              onClick={() => setUnits(opt.value)}
              className={`min-h-[44px] rounded-md text-sm font-semibold transition-colors ${
                units === opt.value
                  ? "bg-[#ff50c5]/25 text-white"
                  : "text-[#8b94a3] hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-[#8b94a3]">
          {formatUnitsLabel(units)} · {s.unitsHint}
        </p>
      </div>
    </div>
  );

  if (mobile) {
    return (
      <MobileSheet onClose={close}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">
            {s.panelTitle}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label={s.close}
            className="flex h-11 w-11 items-center justify-center rounded-md border border-white/15 text-sm text-white"
          >
            ✕
          </button>
        </div>
        {content}
      </MobileSheet>
    );
  }

  return (
    <div className={PANEL_ANCHOR}>
      <GlassPanel title={s.panelTitle} onClose={close} widthClass="w-80">
        {content}
      </GlassPanel>
    </div>
  );
}
