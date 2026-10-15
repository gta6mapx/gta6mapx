// ─── modules/map/tools/draw/sliceStrings.ts ─────────────────────────────
// Draw-slice UI copy. English-only (same R6 rule as tools/strings.ts).
// The coordinator merges this into tools/strings.ts — do NOT edit that
// file from this slice.

export const drawStrings = {
  panelTitle: "Drawing",
  toolActiveHint: (tool: string) => `${tool} active — click the map to draw`,
  selectHint: "Click a drawing to select it. Drag to move, Delete to remove.",
  noDrawings: "No drawings yet — pick a draw tool to start.",
  undo: "Undo",
  redo: "Redo",
  undoLabel: (label: string) => `Undo: ${label}`,
  redoLabel: (label: string) => `Redo: ${label}`,
  nothingToUndo: "Nothing to undo",
  nothingToRedo: "Nothing to redo",
  deleteSelected: "Delete selected",
  clearAll: "Clear all",
  clearDrawingsTitle: "Delete all drawings?",
  clearDrawingsBody: (n: number) =>
    `This will delete ${n} drawing${n === 1 ? "" : "s"}. You can undo right after.`,
  deleteDrawings: (n: number) => `Delete ${n} drawing${n === 1 ? "" : "s"}`,
  clearedDrawings: (n: number) =>
    `Cleared ${n} drawing${n === 1 ? "" : "s"} — Undo to restore.`,
  drawingLimit: (n: number) =>
    `Drawing limit reached (${n}) — delete or clear some to continue.`,
  drawingColor: "Color",
  drawingThickness: "Thickness",
  drawingOpacity: "Opacity",
  drawingFill: "Fill",
  drawingFillOpacity: "Fill opacity",
  appliesToSelection: "Applies to: selection",
  appliesToNew: "Applies to: new drawings",
  recentColors: "Recent",
  customColor: "Custom color",
  exportPng: "Export PNG",
  exportGeoJson: "Export GeoJSON",
  importGeoJson: "Import GeoJSON",
  importTitle: "Import result",
  importSummary: (ok: number, bad: number) =>
    `Imported ${ok} drawing${ok === 1 ? "" : "s"}${
      bad > 0 ? `, skipped ${bad} invalid` : ""
    }.`,
  importErrors: "Some features were skipped:",
  importEmpty: "No valid drawings found in that file.",
  importTooMany: (n: number) =>
    `Import capped at ${n} drawings — the rest were skipped.`,
  importBadFile: "That file isn't a valid drawings GeoJSON file.",
  importLimitBlocked: (n: number) =>
    `Drawing limit (${n}) — import blocked. Delete or clear some first.`,
  drawingsCorrupt:
    "Saved drawings couldn't be read — moved to a backup slot. Starting fresh.",
  quotaWarning:
    "Storage is full — drawings will be kept for this session only.",
  pngExported: "PNG exported.",
  pngFailed: "PNG export failed — try again.",
  geojsonExported: "GeoJSON exported.",
  geojsonFailed: "GeoJSON export failed — try again.",
  done: "Done",
  cancel: "Cancel",
  close: "Close",
  finishLine: "Finish line",
  cancelLine: "Cancel line",
  drawModeBanner: (tool: string) => `${tool} — tap Done when finished`,
  lineNeedsTwo: "A line needs at least 2 points — keep tapping or cancel.",
  deletedDrawing: "Drawing deleted.",
  restoredUndo: (label: string) => `Undid: ${label}`,
  restoredRedo: (label: string) => `Redid: ${label}`,
} as const;

export type DrawStrings = typeof drawStrings;

/** Same audit approach as tools/strings.ts: English-only, no empty strings. */
const NON_ENGLISH_TOKENS = [
  "koordinaten",
  "zur position",
  "anwenden",
  "suchen",
  "schließen",
  "werkzeug",
];

export function auditDrawStrings(strings: DrawStrings): string[] {
  const violations: string[] = [];
  const check = (value: string, key: string) => {
    if (typeof value !== "string" || value.trim().length === 0) {
      violations.push(`${key}: empty or not a string`);
      return;
    }
    const lower = value.toLowerCase();
    for (const token of NON_ENGLISH_TOKENS) {
      if (lower.includes(token))
        violations.push(`${key}: contains "${token}"`);
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
