// ─── modules/map/tools/compare/compareState.ts ─────────────────────────
// Pure helpers for the swipe-comparison mode. No MapLibre, no React —
// unit-testable (see scripts/tools-acceptance.mts §A6).

import type { BaseStyleId } from "../../styleManager";

/** Divider travel limits (percent of viewport width). Never full-bleed:
 *  both sides stay visible so the comparison is always meaningful. */
export const COMPARE_DIVIDER_MIN = 5;
export const COMPARE_DIVIDER_MAX = 95;

/** Clamp a divider position to [MIN, MAX]; non-finite input → centered. */
export function clampDividerPct(pct: number): number {
  if (!Number.isFinite(pct)) return 50;
  return Math.min(
    COMPARE_DIVIDER_MAX,
    Math.max(COMPARE_DIVIDER_MIN, Math.round(pct))
  );
}

export const DEFAULT_COMPARE_LEFT: BaseStyleId = "leonida-dark";
export const DEFAULT_COMPARE_RIGHT: BaseStyleId = "real-florida";

export const COMPARE_STYLE_LABELS: Record<BaseStyleId, string> = {
  "leonida-dark": "Leonida Dark",
  "real-florida": "Real Florida",
};

export interface StylePair {
  left: BaseStyleId;
  right: BaseStyleId;
}

/**
 * Resolve a style-chip pick while keeping the pair distinct: picking the
 * style already on the other side swaps the two instead of duplicating.
 */
export function resolveStylePair(
  left: BaseStyleId,
  right: BaseStyleId,
  changed: "left" | "right",
  next: BaseStyleId
): StylePair {
  if (changed === "left") {
    return next === right ? { left: next, right: left } : { left: next, right };
  }
  return next === left ? { left: right, right: next } : { left, right: next };
}
