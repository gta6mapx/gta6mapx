// ─── modules/map/tools/display/sliceStrings.ts ────────────────────────
// Display-slice UI copy (English-only) + audit. Mirrors the tools/strings.ts
// pattern. NOT merged into tools/strings.ts — the coordinator merges slices.

export const displaySliceStrings = {
  // Panel
  panelTitle: "Display",
  // Graticule — label must say lng/lat; never imply a fictional
  // game-coordinate system.
  gridLabel: "Coordinate grid (lng/lat)",
  gridHint: "Zoom-adaptive graticule lines",
  gridKbd: "G",
  // Camera HUD
  fovLabel: "Camera HUD",
  fovHint: "Zoom · pitch · bearing readout",
  fovKbd: "F",
  // Heatmap
  heatmapLabel: "Heatmap",
  heatmapHint: "Pin density, weighted by evidence",
  heatmapKbd: "H",
  heatmapLegend: "Heat = pin density, weighted by evidence certainty.",
  // Marker colors (user-authored annotations only)
  markerColorsTitle: "Marker colors",
  markerColorsHint: "Your pins & annotations — entity pins stay evidence-colored",
  resetDefaults: "Reset to defaults",
  markerColorsReset: "Marker colors reset to defaults.",
  // Units (writes through runtime.setUnits — one shared setting)
  unitsTitle: "Units",
  unitsMetric: "Metric",
  unitsImperial: "Imperial",
  unitsHint: "Shared with measurement tools",
  // Minimal tier
  minimalTierNote:
    "Display layers are hidden on reduced-graphics mode. Units and marker colors still work.",
  // Generic
  close: "Close",
} as const;

export type DisplaySliceStrings = typeof displaySliceStrings;

/** Same audit approach as tools/strings.ts: English-only, no empties. */
const NON_ENGLISH_TOKENS = [
  "koordinaten",
  "zur position",
  "anwenden",
  "suchen",
  "schließen",
  "werkzeug",
];

export function auditDisplaySliceStrings(
  strings: DisplaySliceStrings
): string[] {
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
    check(value as string, key);
  }
  return violations;
}
