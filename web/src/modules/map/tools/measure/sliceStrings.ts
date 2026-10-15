// ─── modules/map/tools/measure/sliceStrings.ts ──────────────────────
// Measure-slice UI copy. Same audit approach as tools/strings.ts: ONE
// language (English), no empty strings. The coordinator merges these into
// tools/strings.ts later — until then the slice reads its own copy, so
// tools/strings.ts stays untouched.

export const measureStrings = {
  panelTitle: "Measurements",
  panelReopen: (n: number) =>
    `${n} measurement${n === 1 ? "" : "s"}`,
  finishHint: "Double-click or press Enter to finish · Esc cancels",
  finishMobile: "Tap Done to finish",
  undoVertex: "Undo last point",
  done: "Done",
  cancel: "Cancel",
  copied: "Copied",
  copy: "Copy result",
  copyFailed: "Copy failed — select the text manually.",
  deleteMeasurement: "Delete measurement",
  clearAll: "Clear all",
  clearConfirmTitle: "Delete all measurements?",
  clearConfirm: (n: number) =>
    `Delete ${n} measurement${n === 1 ? "" : "s"}? You can undo right after.`,
  deleteCount: (n: number) =>
    `Delete ${n} measurement${n === 1 ? "" : "s"}`,
  cleared: (n: number) =>
    `Cleared ${n} measurement${n === 1 ? "" : "s"} — Undo to restore.`,
  empty: "No measurements yet — pick Distance or Area to start.",
  emptySketchHint: "Click the map to place points.",
  collapseList: "Collapse list",
  expandList: "Expand list",
  disclaimer: "Planimetric — flat-map distance, not terrain-following.",
  approx:
    "World positions are approximate (clean-room transform, RMSE 5.41 km) — treat results as estimates.",
  unitsMetric: "Metric",
  unitsImperial: "Imperial",
  unitsToggle: "Toggle units",
  corrupt: "Saved measurements couldn't be read — starting fresh.",
  storageFull:
    "Storage is full — measurements are kept in memory for this session.",
  minVertices: (kind: string) =>
    `A ${kind} needs more points — keep clicking or press Esc.`,
  exportGeoJson: "Export GeoJSON",
  exportEmpty: "Nothing to export — no measurements yet.",
  exported: "measurements.geojson downloaded.",
  distanceBadge: "DIST",
  areaBadge: "AREA",
  close: "Close",
} as const;

export type MeasureStrings = typeof measureStrings;

/** Same audit approach as discovery R6 / tools/strings.ts: English-only. */
const NON_ENGLISH_TOKENS = [
  "koordinaten",
  "zur position",
  "anwenden",
  "suchen",
  "schließen",
  "werkzeug",
];

export function auditMeasureStrings(strings: MeasureStrings): string[] {
  const violations: string[] = [];
  const check = (value: string, key: string) => {
    if (typeof value !== "string" || value.trim().length === 0) {
      violations.push(`${key}: empty or not a string`);
      return;
    }
    const lower = value.toLowerCase();
    for (const token of NON_ENGLISH_TOKENS) {
      if (lower.includes(token)) violations.push(`${key}: contains "${token}"`);
    }
  };
  for (const [key, value] of Object.entries(strings)) {
    if (typeof value === "function") {
      try {
        const probed = (value as (...a: never[]) => string)(
          ...(["Test", 3].slice(0, value.length) as never[])
        );
        check(probed, key);
      } catch {
        violations.push(`${key}: template function threw on probe args`);
      }
    } else {
      check(value, key);
    }
  }
  return violations;
}
