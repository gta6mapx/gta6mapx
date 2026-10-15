// ─── modules/map/tools/strings.ts ─────────────────────────────────────────
// Tools UI strings. Same R6 rule as discovery/strings.ts: ONE language
// (English). Every tool UI string lives here — components import copy from
// this file, never hardcode tool strings inline.
//
// Slice dictionaries (draw / measure / overlays / display) live next to
// their slices and are aggregated below, so this file stays the ONE audited
// entry point: `toolsStrings` + `auditAllToolsStrings()`.

import { drawStrings, auditDrawStrings } from "./draw/sliceStrings";
import { measureStrings, auditMeasureStrings } from "./measure/sliceStrings";
import { overlayStrings, auditOverlayStrings } from "./overlays/sliceStrings";
import {
  displaySliceStrings,
  auditDisplaySliceStrings,
} from "./display/sliceStrings";

export const toolsStrings = {
  // Toolbar
  toolbarLabel: "Map tools",
  toolNavigate: "Navigate",
  toolNavigateHint: "Select and pan the map",
  toolDraw: "Draw",
  toolDrawHint: "Freehand, lines, shapes",
  toolPen: "Pen",
  toolPenHint: "Freehand drawing",
  toolLine: "Line",
  toolLineHint: "Click to place vertices",
  toolRect: "Rectangle",
  toolRectHint: "Drag two corners",
  toolCircle: "Circle",
  toolCircleHint: "Drag center to edge",
  toolMeasure: "Measure",
  toolMeasureDistance: "Measure distance",
  toolMeasureDistanceHint: "Click points, double-click to finish",
  toolMeasureArea: "Measure area",
  toolMeasureAreaHint: "Click points, double-click to finish",
  toolOverlays: "Overlays",
  toolOverlaysHint: "Image and tile overlays",
  toolDisplay: "Display",
  toolDisplayHint: "Grid, heatmap, marker colors",
  toolShortcuts: "Keyboard shortcuts",
  toolNotReady: "Available in the next tools update",
  exitTool: "Exit tool",
  shortcutWith: (name: string, key: string) => `${name} — ${key}`,

  // Draw-mode (touch)
  touchDrawMode: "Draw mode",
  touchDrawModeHint: "One finger draws, two fingers pan and zoom",
  drawModeBanner: (tool: string) => `${tool} — tap Done when finished`,
  done: "Done",
  cancel: "Cancel",
  undo: "Undo",
  redo: "Redo",
  undoLabel: (label: string) => `Undo: ${label}`,
  redoLabel: (label: string) => `Redo: ${label}`,
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
  selectDrawingHint: "Click a drawing to select it. Drag to move, Delete to remove.",
  noDrawings: "No drawings yet — pick a draw tool to start.",
  exportPng: "Export PNG",
  exportGeoJson: "Export GeoJSON",
  importGeoJson: "Import GeoJSON",
  importSummary: (ok: number, bad: number) =>
    `Imported ${ok} drawing${ok === 1 ? "" : "s"}${bad > 0 ? `, skipped ${bad} invalid` : ""}.`,
  importErrors: "Some features were skipped:",
  drawingsCorrupt:
    "Saved drawings couldn't be read — moved to a backup slot. Starting fresh.",
  drawingsSaved: "Drawings saved on this device.",

  // Measure
  measurePanelTitle: "Measurements",
  measurePick: "Pick a measure tool",
  measureFinishHint: "Double-click or press Enter to finish · Esc cancels",
  measureFinishMobile: "Tap Done to finish",
  measureUndoVertex: "Undo last point",
  measureTotal: "Total",
  measureCopied: "Copied",
  measureCopy: "Copy",
  measureDelete: "Delete measurement",
  measureClear: "Clear all",
  measureClearConfirm: (n: number) =>
    `Delete ${n} measurements? You can undo right after.`,
  measureEmpty: "No measurements yet — pick Distance or Area to start.",
  measureDisclaimer: "Planimetric — flat-map distance, not terrain-following.",
  measureApprox: "Positions are approximate — treat results as estimates.",
  unitsMetric: "Metric",
  unitsImperial: "Imperial",
  unitsToggle: "Toggle units",
  measurementsCorrupt: "Saved measurements couldn't be read — starting fresh.",
  measureMinVertices: (kind: string) =>
    `A ${kind} needs more points — keep clicking or press Esc.`,

  // Overlays
  overlaysTitle: "Overlays",
  overlaysEmpty: "No overlays yet — import an image to compare against anything.",
  importImage: "Import image overlay",
  overlayOpacity: "Opacity",
  overlayVisible: "Visible",
  overlayHidden: "Hidden",
  overlayRename: "Rename",
  overlayRemove: "Remove",
  overlayRemoveConfirm: (name: string) => `Remove overlay "${name}"?`,
  overlayNeedsFile: "Needs file — re-select the image to restore placement",
  overlayReselect: "Re-select file",
  overlayPlaceTitle: "Place image on map",
  overlayPlaceStep: (n: number) =>
    n <= 3 ? `Click map point ${n} of 3` : `Click image corner ${n - 3} of 3`,
  overlayPlaceHint:
    "Click 3 points on the map, then the matching 3 corners on your image.",
  overlayTooBig: "Image is larger than 10 MB — pick a smaller file.",
  overlayBadType: "That file isn't an image — pick a PNG or JPEG.",
  overlayDownscaled: "Image downscaled to fit the 2048 px limit.",
  overlayLocalOnly: "Image files aren't stored — keep your file; re-select it next visit and your placement is restored.",
  overlayHashMismatch:
    "This file doesn't match the saved one — place the 3 points again.",
  overlayCompare: "Compare",
  overlayAttribution: (name: string) => `© ${name}`,

  // Display
  displayTitle: "Display",  displayGrid: "Coordinate grid",
  displayGridHint: "lng/lat graticule, zoom-adaptive",
  displayFov: "Camera HUD",
  displayFovHint: "Zoom · pitch · bearing readout",
  displayHeatmap: "Heatmap",
  displayHeatmapHint: "Pin density, weighted by evidence",
  heatmapLegend: "Heat = pin density, weighted by evidence certainty.",
  displayMarkerColors: "Marker colors",
  displayMarkerColorsHint: "Applies to your pins and annotations",
  resetDefaults: "Reset to defaults",
  markerColorsReset: "Marker colors reset to defaults.",

  // Compare (swipe comparison of the two base styles)
  toolCompare: "Compare",
  toolCompareHint: "Side-by-side base map comparison",
  compareExit: "Exit comparison",
  compareMinimalTier: "Comparison needs standard graphics mode.",
  compareFailed: "Comparison couldn't start — graphics unavailable.",
  compareSideLeft: "Left",
  compareSideRight: "Right",
  compareDividerLabel: "Comparison divider — arrow keys move it",
  compareAttribution: "© OpenMapTiles © OpenStreetMap contributors",
  // Honesty note: annotations are hidden while comparing, on both sides.
  compareAnnotationsHidden:
    "Annotations are hidden on both sides while comparing.",

  // Share annotations (link with drawings / measurements / overlay placement)
  shareAnnotations: "Share annotations",
  shareAnnotationsHint: "Copy a link with your drawings and measurements",
  shareTitle: "Share annotations",
  shareCopyLink: "Copy link",
  shareCopied: "Link copied — share your annotations.",
  shareCopyBlocked: "Couldn't copy — your browser blocked clipboard access.",
  shareNothingToShare:
    "Nothing to share yet — draw, measure, or add an overlay first.",
  shareCounts: (d: number, m: number, o: number) =>
    `${d} drawing${d === 1 ? "" : "s"} · ${m} measurement${m === 1 ? "" : "s"} · ${o} overlay${o === 1 ? "" : "s"}`,
  // The image file itself never travels in a share link — placement only.
  shareImageNote: "The image itself isn't shared, only its placement.",
  shareTruncated: (n: number) =>
    `Shared link keeps the ${n} newest annotations — older ones were left out.`,
  shareDrawingsFull:
    "Your drawings are full — some shared drawings couldn't be added.",
  shareLoaded: (n: number) =>
    `Loaded ${n} shared annotation${n === 1 ? "" : "s"} — positions are approximate.`,
  shareLoadFailed: "Couldn't load shared annotations.",

  // Shortcuts dialog
  shortcutsTitle: "Keyboard shortcuts",
  shortcutsClose: "Close",
  shortcutGroupTools: "Tools",
  shortcutGroupView: "View",
  shortcutGroupEdit: "Editing",
  scNavigate: "Navigate / exit tool",
  scUndo: "Undo",
  scRedo: "Redo",
  scDelete: "Delete selected",
  scGrid: "Toggle coordinate grid",
  scHeatmap: "Toggle heatmap",
  scFov: "Toggle camera HUD",
  sc2d: "Switch to 2D",
  sc3d: "Switch to 3D",
  scZoomIn: "Zoom in",
  scZoomOut: "Zoom out",
  scClose: "Close dialog / cancel",
  scHelp: "This cheat sheet",

  // Generic
  close: "Close",
  rename: "Rename",
  save: "Save",
  remove: "Remove",
  show: "Show",
  hide: "Hide",
  minimalTierNote: "Tools are limited on this device (reduced graphics mode).",
} as const;

export type ToolsStrings = typeof toolsStrings;

/** Same audit approach as discovery R6: English-only, no empty strings. */
const NON_ENGLISH_TOKENS = [
  "koordinaten",
  "zur position",
  "anwenden",
  "suchen",
  "schließen",
  "werkzeug",
];

export function auditToolsStrings(strings: ToolsStrings): string[] {
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

/**
 * Aggregated dictionaries — one entry point for every tool string.
 * Slices keep importing their own files directly; this is the audited whole.
 */
export const allToolsStrings = {
  chrome: toolsStrings,
  draw: drawStrings,
  measure: measureStrings,
  overlays: overlayStrings,
  display: displaySliceStrings,
} as const;

/** Runs every slice audit plus the chrome audit. Zero violations expected. */
export function auditAllToolsStrings(): string[] {
  return [
    ...auditToolsStrings(toolsStrings).map((v) => `chrome: ${v}`),
    ...auditDrawStrings(drawStrings).map((v) => `draw: ${v}`),
    ...auditMeasureStrings(measureStrings).map((v) => `measure: ${v}`),
    ...auditOverlayStrings(overlayStrings).map((v) => `overlays: ${v}`),
    ...auditDisplaySliceStrings(displaySliceStrings).map((v) => `display: ${v}`),
  ];
}
