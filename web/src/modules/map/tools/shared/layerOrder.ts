// ─── modules/map/tools/shared/layerOrder.ts ─────────────────────────────
// Fixed layer ordering (spec §1.2), bottom → top:
//   base → overlays → grid → heatmap → drawings → measurements → markers → labels
//
// Tool families insert their layers *below* the first layer of the next
// family via addLayer(..., beforeId). Each family registers its layer ids so
// anchors resolve deterministically even when families mount in any order.

import type { Map as MapLibreMap, LayerSpecification } from "maplibre-gl";
import {
  LAYER_CLUSTERS,
  LAYER_CLUSTER_COUNT,
  LAYER_PINS,
  LAYER_PINS_APPROX,
} from "../../markerLayer";

export const TOOL_FAMILY_ORDER = [
  "overlays",
  "grid",
  "heatmap",
  "drawings",
  "measurements",
  "markers",
] as const;

export type ToolFamily = (typeof TOOL_FAMILY_ORDER)[number];

/** Marker/pin layer ids (Phase 2) — everything tool-related stays below these. */
const MARKER_LAYER_IDS = [
  LAYER_CLUSTERS,
  LAYER_PINS,
  LAYER_PINS_APPROX,
  LAYER_CLUSTER_COUNT,
];

const registry = new Map<ToolFamily, Set<string>>();

function familyLayers(family: ToolFamily): Set<string> {
  let set = registry.get(family);
  if (!set) {
    set = new Set<string>();
    registry.set(family, set);
  }
  return set;
}

/** Slices call this right after adding each of their layers. */
export function registerToolLayer(family: ToolFamily, layerId: string): void {
  familyLayers(family).add(layerId);
}

/**
 * Registered layer ids for one family (copy). Compare mode uses this to
 * hide annotation families (overlays/drawings/measurements) while the
 * swipe comparison is active — see CompareTools.
 */
export function toolFamilyLayerIds(family: ToolFamily): string[] {
  return [...familyLayers(family)];
}

/** Slices call this when removing a layer (style switches, teardown). */
export function unregisterToolLayer(family: ToolFamily, layerId: string): void {
  registry.get(family)?.delete(layerId);
}

/** Forget every registration (full map teardown). */
export function clearToolLayerRegistry(): void {
  registry.clear();
}

/**
 * The layer id a family should insert *before* — the first existing layer
 * of the next family in the canonical order. `undefined` → append on top
 * (caller should re-run `restackToolLayers` once markers mount).
 */
export function anchorForFamily(
  map: MapLibreMap,
  family: ToolFamily
): string | undefined {
  const idx = TOOL_FAMILY_ORDER.indexOf(family);
  for (let i = idx + 1; i < TOOL_FAMILY_ORDER.length; i++) {
    const next = TOOL_FAMILY_ORDER[i];
    const ids =
      next === "markers" ? MARKER_LAYER_IDS : [...familyLayers(next)];
    for (const id of ids) {
      if (map.getLayer(id)) return id;
    }
  }
  return undefined;
}

/**
 * Add a layer below the family's anchor. Idempotent — if the layer already
 * exists it is moved to the correct position instead of duplicated.
 */
export function addToolLayer(
  map: MapLibreMap,
  family: ToolFamily,
  layer: LayerSpecification
): void {
  registerToolLayer(family, layer.id);
  if (map.getLayer(layer.id)) {
    const anchor = anchorForFamily(map, family);
    if (anchor) map.moveLayer(layer.id, anchor);
    return;
  }
  map.addLayer(layer, anchorForFamily(map, family));
}

/** Remove a tool layer and drop its registration. Safe when absent. */
export function removeToolLayer(
  map: MapLibreMap,
  family: ToolFamily,
  layerId: string
): void {
  unregisterToolLayer(family, layerId);
  if (map.getLayer(layerId)) map.removeLayer(layerId);
}

/**
 * Re-establish canonical bottom→top order across all registered tool layers.
 * Call after base-style switches (which rebuild all layers) and once markers
 * mount, per spec §1.2's moveLayer fallback.
 */
export function restackToolLayers(map: MapLibreMap): void {
  // Walk top-down: markers first so every family anchors below them.
  for (let i = TOOL_FAMILY_ORDER.length - 2; i >= 0; i--) {
    const family = TOOL_FAMILY_ORDER[i];
    const anchor = anchorForFamily(map, family);
    for (const id of familyLayers(family)) {
      if (!map.getLayer(id)) continue;
      try {
        if (anchor) map.moveLayer(id, anchor);
      } catch {
        // Anchor vanished mid-switch — leave the layer where it is.
      }
    }
  }
}

/** Test escape hatch. */
export function resetToolLayerRegistryForTests(): void {
  registry.clear();
}
