// ─── modules/map/tools/display/units.ts ──────────────────────────────
// Units labeling for the display slice.
//
// The measure slice OWNS formatting (formatDistance/formatArea in
// tools/measure/format.ts). The single shared `Units` setting lives in the
// tool runtime (ToolsProvider, controlled by GameMap's settings) and is
// consumed directly via `useTools().units`. This file only provides the
// label helpers the Display panel needs — it does not duplicate the
// setting or the formatting rules.

import type { Units } from "../shared/toolRuntime";

/** Short label for the units segmented control / toggle. */
export function formatUnitsLabel(u: Units): string {
  return u === "imperial" ? "Imperial — miles, feet" : "Metric — kilometers, meters";
}

/** Compact two-option labels. */
export const UNITS_OPTIONS: { value: Units; label: string }[] = [
  { value: "metric", label: "Metric" },
  { value: "imperial", label: "Imperial" },
];
