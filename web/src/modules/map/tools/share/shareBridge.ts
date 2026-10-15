// ─── modules/map/tools/share/shareBridge.ts ────────────────────────────
// Module-level handler registry so the single share UI can reach the
// slice-owned stores (draw / measure / overlays) without prop-drilling
// through GameMap. Each slice registers on mount and unregisters on
// unmount; the share components no-op gracefully when a slice is absent
// (e.g. minimal tier, where slices never mount).

import type { DrawFeature } from "../draw/types";
import type { Measurement } from "../measure/types";
import type { OverlayEntry } from "../overlays/overlayTypes";
import type {
  SharedDrawItem,
  SharedMeasureItem,
  SharedOverlayItem,
} from "./shareCodec";

export interface DrawShareHandlers {
  snapshot: () => DrawFeature[];
  /** Apply decoded items; returns the number actually added. */
  restore: (items: SharedDrawItem[]) => number;
}

export interface MeasureShareHandlers {
  snapshot: () => Measurement[];
  restore: (items: SharedMeasureItem[]) => number;
}

export interface OverlayShareHandlers {
  snapshot: () => OverlayEntry[];
  /** Returns { added, updated } for the toast count. */
  restore: (items: SharedOverlayItem[]) => { added: number; updated: number };
}

const handlers: {
  draw?: DrawShareHandlers;
  measure?: MeasureShareHandlers;
  overlays?: OverlayShareHandlers;
} = {};

export function registerDrawShareHandlers(h: DrawShareHandlers): () => void {
  handlers.draw = h;
  return () => {
    if (handlers.draw === h) handlers.draw = undefined;
  };
}

export function registerMeasureShareHandlers(h: MeasureShareHandlers): () => void {
  handlers.measure = h;
  return () => {
    if (handlers.measure === h) handlers.measure = undefined;
  };
}

export function registerOverlayShareHandlers(h: OverlayShareHandlers): () => void {
  handlers.overlays = h;
  return () => {
    if (handlers.overlays === h) handlers.overlays = undefined;
  };
}

export function getShareHandlers(): {
  draw?: DrawShareHandlers;
  measure?: MeasureShareHandlers;
  overlays?: OverlayShareHandlers;
} {
  return handlers;
}
