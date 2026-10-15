// ─── modules/map/tools/display/MarkerColors.ts ────────────────────────
// Per-category color customization — with a LOCKED SCOPE CONSTRAINT:
//
// Entity pins and clusters are evidence-colored by design (Phase 1 identity
// decision: the four certainty colors — rockstar-confirmed,
// trailer-confirmed, leak-reported, disputed — are RESERVED for the evidence
// model). Recoloring them would break the trust-first visual language, so
// this module MUST NOT recolor entity pins or clusters. Ever.
//
// `markerColors` applies ONLY to user-authored annotations: drawings,
// measurements, and user pins (when that feature lands). The draw/measure
// slices own their live paint; this module provides the persisted defaults
// they fall back to, plus the swatch definitions for the Display panel.

/** Categories this module may color — user-authored annotations only. */
export interface UserAnnotationColorCategory {
  id: string;
  label: string;
}

export const USER_ANNOTATION_COLOR_CATEGORIES: UserAnnotationColorCategory[] = [
  { id: "user-pin", label: "Your pins" },
  { id: "drawing", label: "Drawing default" },
  { id: "measurement", label: "Measurement default" },
];

/** 12 curated neon-safe swatches: spec §1.7 palette + 4 extras. */
export const MARKER_COLOR_SWATCHES: string[] = [
  "#FF2E88", // Neon Pink
  "#FF7A18", // Sunset Orange
  "#8B5CF6", // Electric Cyan
  "#00F5D4", // Miami Teal
  "#A855F7", // Purple Haze
  "#FACC15", // Laser Lemon
  "#F8FAFC", // Ghost White
  "#0B0B10", // Void Black
  "#F472B6", // Neon Rose
  "#60A5FA", // Electric Blue
  "#34D399", // Mint
  "#FB7185", // Coral
];

/** Defaults: distinguishable in 2D and 3D on the dark base. */
export const DEFAULT_USER_ANNOTATION_COLORS: Record<string, string> = {
  "user-pin": "#FF2E88",
  "drawing": "#8B5CF6",
  "measurement": "#FACC15",
};

/**
 * Resolve the color for a user-annotation category: persisted override
 * wins, otherwise the built-in default. Unknown categories fall back to
 * the first default (never undefined).
 */
export function getUserPinColor(
  categoryId: string,
  overrides: Record<string, string> = {}
): string {
  const override = overrides[categoryId];
  if (typeof override === "string" && override.length > 0) return override;
  const fallback = DEFAULT_USER_ANNOTATION_COLORS[categoryId];
  if (fallback) return fallback;
  return DEFAULT_USER_ANNOTATION_COLORS["user-pin"] as string;
}
