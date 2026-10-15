// ─── modules/map/tools/measure/MeasurePanel.tsx ─────────────────────
// Measurements list panel: collapsible rows (kind icon, formatted total,
// unit chip, select/delete, per-row copy), GeoJSON export, quick unit
// toggle, clear-all (no confirm ≤3, custom confirm ≥4).
//
// The planimetric disclaimer + approximate-positions note stay visible
// whenever the panel renders (spec §1.6). Desktop renders the GlassPanel
// shell; mobile renders the map's existing MobileSheet pattern.

"use client";

import { useState } from "react";
import GlassPanel from "../shared/glassPanel";
import { useTools, type Units } from "../shared/toolRuntime";
import { useIsMobile } from "../shared/mobile";
import MobileSheet from "../../components/MobileSheet";
import { useMeasureStore } from "./store";
import { measureStrings } from "./sliceStrings";
import { formatMeasurement } from "./format";
import { copyTextToClipboard } from "./interactions";
import { polylineLength, sphericalPolygonArea } from "./geodesic";
import type { Measurement } from "./types";

const EXPORT_FILENAME = "measurements.geojson";

interface ExportFeature {
  type: "Feature";
  properties: {
    id: string;
    kind: "distance" | "area";
    distance_m?: number;
    area_m2?: number;
    unit: Units;
    createdAt: string;
  };
  geometry:
    | { type: "LineString"; coordinates: [number, number][] }
    | { type: "Polygon"; coordinates: [number, number][][] };
}

/** Download the finished measurements as GeoJSON (raw lng/lat, EPSG:4326). */
function exportGeoJSON(measurements: Measurement[], units: Units): void {
  const features: ExportFeature[] = measurements.map((m) => {
    const coords = m.vertices.map((v) => [v[0], v[1]] as [number, number]);
    return {
      type: "Feature",
      properties: {
        id: m.id,
        kind: m.kind,
        ...(m.kind === "distance"
          ? { distance_m: polylineLength(m.vertices) }
          : { area_m2: sphericalPolygonArea(m.vertices) }),
        unit: units, // current display units — matches what the user sees
        createdAt: m.createdAt,
      },
      geometry:
        m.kind === "distance"
          ? { type: "LineString", coordinates: coords }
          : { type: "Polygon", coordinates: [[...coords, coords[0]]] },
    };
  });
  const blob = new Blob(
    [JSON.stringify({ type: "FeatureCollection", features }, null, 2)],
    { type: "application/geo+json" }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = EXPORT_FILENAME;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function UnitToggle() {
  const { units, setUnits } = useTools();
  const btn = (u: Units, label: string) => (
    <button
      type="button"
      onClick={() => setUnits(u)}
      aria-pressed={units === u}
      aria-label={`${measureStrings.unitsToggle}: ${label}`}
      className={`min-h-[36px] rounded-md px-2.5 font-mono text-[11px] transition-colors ${
        units === u
          ? "bg-[#ff50c5]/25 text-white"
          : "text-[#8b94a3] hover:text-white"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div
      role="group"
      aria-label={measureStrings.unitsToggle}
      className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-black/40 p-0.5"
    >
      {btn("metric", measureStrings.unitsMetric)}
      {btn("imperial", measureStrings.unitsImperial)}
    </div>
  );
}

function MeasureRow({ m }: { m: Measurement }) {
  const { units, toast } = useTools();
  const { state, actions } = useMeasureStore();
  const selected = state.selectedId === m.id;
  const total = formatMeasurement(m, units);

  const onCopy = async () => {
    const ok = await copyTextToClipboard(total);
    toast(ok ? measureStrings.copied : measureStrings.copyFailed);
  };

  return (
    <li
      className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors ${
        selected
          ? "border-[#ff50c5]/70 bg-[#ff50c5]/10"
          : "border-white/10 bg-black/30 hover:border-white/25"
      }`}
    >
      <button
        type="button"
        onClick={() => actions.select(selected ? null : m.id)}
        aria-pressed={selected}
        title={total}
        className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 text-left"
      >
        <span
          aria-hidden="true"
          className="shrink-0 text-sm"
          style={{ color: m.kind === "distance" ? "#FF2E88" : "#FF7A18" }}
        >
          {m.kind === "distance" ? "📐" : "⬒"}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-[13px] tabular-nums text-white">
          {total}
        </span>
        <span className="shrink-0 rounded border border-white/15 px-1.5 py-0.5 font-mono text-[10px] uppercase text-[#8b94a3]">
          {units === "metric" ? "metric" : "imperial"}
        </span>
      </button>
      <button
        type="button"
        onClick={onCopy}
        aria-label={`${measureStrings.copy}: ${total}`}
        title={`${measureStrings.copy}: ${total}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-white/10 text-sm text-[#c7cfdb] transition-colors hover:border-[#ff50c5]/60 hover:text-white"
      >
        ⧉
      </button>
      <button
        type="button"
        onClick={() => actions.deleteMeasurement(m.id)}
        aria-label={`${measureStrings.deleteMeasurement}: ${total}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-white/10 text-sm text-[#c7cfdb] transition-colors hover:border-red-500/60 hover:text-white"
      >
        ✕
      </button>
    </li>
  );
}

function MeasurePanelBody() {
  const { toast, units } = useTools();
  const { state, actions } = useMeasureStore();
  const [collapsed, setCollapsed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const n = state.measurements.length;

  const onClear = () => {
    if (n >= 4) {
      setConfirming(true);
      return;
    }
    const cleared = actions.clearAll();
    if (cleared > 0) toast(measureStrings.cleared(cleared));
  };

  const onConfirmClear = () => {
    const cleared = actions.clearAll();
    setConfirming(false);
    if (cleared > 0) toast(measureStrings.cleared(cleared));
  };

  const onExport = () => {
    if (n === 0) {
      toast(measureStrings.exportEmpty);
      return;
    }
    exportGeoJSON(state.measurements, units);
    toast(measureStrings.exported);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Header: count + collapse, unit toggle, export, clear */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? measureStrings.expandList : measureStrings.collapseList}
          className="flex min-h-[44px] items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white"
        >
          <span aria-hidden="true" className="text-[10px] text-[#8b94a3]">
            {collapsed ? "▶" : "▼"}
          </span>
          {measureStrings.panelTitle}
          <span className="rounded-full border border-white/15 px-1.5 py-0.5 font-mono text-[10px] text-[#8b94a3]">
            {n}
          </span>
        </button>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onExport}
            aria-label={measureStrings.exportGeoJson}
            title={measureStrings.exportGeoJson}
            className="flex h-11 w-11 items-center justify-center rounded-md border border-white/10 text-sm text-[#c7cfdb] transition-colors hover:border-[#ff50c5]/60 hover:text-white"
          >
            ⤓
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={n === 0}
            aria-label={measureStrings.clearAll}
            title={measureStrings.clearAll}
            className="flex h-11 items-center rounded-md border border-white/10 px-2.5 text-xs text-[#c7cfdb] transition-colors hover:border-red-500/60 hover:text-white disabled:opacity-40"
          >
            {measureStrings.clearAll}
          </button>
        </div>
      </div>
      <UnitToggle />

      {!collapsed &&
        (n === 0 ? (
          <p className="rounded-lg border border-dashed border-white/15 px-3 py-4 text-center text-xs leading-relaxed text-[#8b94a3]">
            {measureStrings.empty}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {state.measurements.map((m) => (
              <MeasureRow key={m.id} m={m} />
            ))}
          </ul>
        ))}

      {/* Honesty notes — always visible, even when the list is collapsed. */}
      <div className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-2">
        <p className="text-[11px] leading-relaxed text-[#8b94a3]">
          {measureStrings.disclaimer}
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-[#8b94a3]">
          {measureStrings.approx}
        </p>
      </div>

      {/* Custom clear-all confirm (≥4 items) — never window.confirm. */}
      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          data-tools-modal="true"
          aria-label={measureStrings.clearConfirmTitle}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="glass-panel w-full max-w-xs rounded-xl p-4">
            <h3 className="text-sm font-bold text-white">
              {measureStrings.clearConfirmTitle}
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-[#c7cfdb]">
              {measureStrings.clearConfirm(n)}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="flex h-11 flex-1 items-center justify-center rounded-lg border border-white/15 text-xs text-white transition-colors hover:border-white/40"
              >
                {measureStrings.cancel}
              </button>
              <button
                type="button"
                onClick={onConfirmClear}
                className="flex h-11 flex-1 items-center justify-center rounded-lg border border-red-500/60 bg-red-500/20 text-xs font-bold text-white transition-colors hover:bg-red-500/30"
              >
                {measureStrings.deleteCount(n)}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function MeasurePanel({ onClose }: { onClose: () => void }) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <MobileSheet onClose={onClose}>
        <MeasurePanelBody />
      </MobileSheet>
    );
  }
  return (
    <GlassPanel
      title={measureStrings.panelTitle}
      onClose={onClose}
      widthClass="w-80"
    >
      <MeasurePanelBody />
    </GlassPanel>
  );
}
