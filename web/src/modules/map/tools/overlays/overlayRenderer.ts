// ─── modules/map/tools/overlays/overlayRenderer.ts ────────────────────
// Registry → MapLibre reconciliation (spec §4.1). Idempotent: calling
// reconcileOverlays twice with the same inputs is a no-op; re-registering
// an id updates in place, never duplicates.
//
// Style switches kill all sources/layers (MapLibre behavior), so the host
// re-runs reconcileOverlays on "styledata" — expose reconcileOverlays(map,
// entries, attachments) and call it after every base-layer switch.
//
// Layer insertion goes through addToolLayer(map, "overlays", …) so overlays
// sit directly above base tiles and below grid/heatmap/drawings/
// measurements/markers (spec §1.2).

import type {
  ImageSourceSpecification,
  LayerSpecification,
  Map as MapLibreMap,
  RasterSourceSpecification,
  SourceSpecification,
} from "maplibre-gl";
import { addToolLayer, removeToolLayer } from "../shared/layerOrder";
import {
  isTileVersionMeta,
  isUserImportMeta,
  overlayLayerId,
  overlaySourceId,
  type OverlayEntry,
} from "./overlayTypes";

/**
 * Runtime-only data the registry never persists:
 *  - user-import: object URL of the (downscaled) image + the 4 georeferenced
 *    image corners in MapLibre image-source coordinate order
 *    [topLeft, topRight, bottomRight, bottomLeft].
 *  - tile-version: raster tiles template (+ attribution shown in the panel).
 */
export interface OverlayAttachment {
  imageUrl?: string;
  imageCoordinates?: [number, number][];
  tiles?: string[];
  attribution?: string;
}

type RenderedKeys = Map<string, { layerId: string; key: string }>;
const renderedByMap = new WeakMap<MapLibreMap, RenderedKeys>();

function keysFor(map: MapLibreMap): RenderedKeys {
  let keys = renderedByMap.get(map);
  if (!keys) {
    keys = new Map<string, { layerId: string; key: string }>();
    renderedByMap.set(map, keys);
  }
  return keys;
}

function finitePair(p: [number, number]): boolean {
  return Number.isFinite(p[0]) && Number.isFinite(p[1]);
}

function buildSource(
  entry: OverlayEntry,
  attachment: OverlayAttachment
): SourceSpecification | null {
  if (isUserImportMeta(entry.meta)) {
    if (!attachment.imageUrl) return null;
    const coords = attachment.imageCoordinates;
    if (!coords || coords.length !== 4 || !coords.every(finitePair)) return null;
    const spec: ImageSourceSpecification = {
      type: "image",
      url: attachment.imageUrl,
      coordinates: [
        coords[0] as [number, number],
        coords[1] as [number, number],
        coords[2] as [number, number],
        coords[3] as [number, number],
      ],
    };
    return spec;
  }
  if (isTileVersionMeta(entry.meta)) {
    const tiles = attachment.tiles ?? [entry.meta.tileUrlTemplate];
    const spec: RasterSourceSpecification = {
      type: "raster",
      tiles,
      tileSize: entry.meta.tileSize ?? 256,
      minzoom: entry.meta.minzoom,
      maxzoom: entry.meta.maxzoom,
      attribution: entry.meta.attribution,
    };
    return spec;
  }
  return null;
}

/**
 * Reconcile every registry entry against the map. Safe to call on every
 * render, after base-layer switches, and after style reloads.
 */
export function reconcileOverlays(
  map: MapLibreMap,
  entries: OverlayEntry[],
  attachments: Record<string, OverlayAttachment>
): void {
  const keys = keysFor(map);
  const wantedLayerIds = new Set<string>();

  for (const entry of entries) {
    const layerId = overlayLayerId(entry.id);
    const sourceId = overlaySourceId(entry.id);
    wantedLayerIds.add(layerId);

    const attachment = attachments[entry.id];
    const spec = attachment ? buildSource(entry, attachment) : null;

    if (!spec) {
      // Nothing renderable right now (e.g. a user import whose file hasn't
      // been re-selected this session) — make sure nothing stale shows.
      removeToolLayer(map, "overlays", layerId);
      if (map.getSource(sourceId)) {
        try {
          map.removeSource(sourceId);
        } catch {
          /* already gone */
        }
      }
      keys.delete(sourceId);
      continue;
    }

    const rendered = keys.get(sourceId);
    const renderedKey = JSON.stringify({ entryId: entry.id, spec });

    if (!rendered || rendered.key !== renderedKey) {
      // Source is immutable in MapLibre (image coordinates can't change
      // after add) — rebuild both source and layer on any change.
      removeToolLayer(map, "overlays", layerId);
      if (map.getSource(sourceId)) {
        try {
          map.removeSource(sourceId);
        } catch {
          /* already gone */
        }
      }
      map.addSource(sourceId, spec);
      const layer: LayerSpecification = {
        id: layerId,
        type: "raster",
        source: sourceId,
        layout: { visibility: entry.visible ? "visible" : "none" },
        paint: { "raster-opacity": entry.opacity / 100 },
      };
      addToolLayer(map, "overlays", layer);
      keys.set(sourceId, { layerId, key: renderedKey });
    } else if (map.getLayer(layerId)) {
      // Live updates: opacity slider and visibility toggle apply instantly.
      map.setLayoutProperty(
        layerId,
        "visibility",
        entry.visible ? "visible" : "none"
      );
      map.setPaintProperty(layerId, "raster-opacity", entry.opacity / 100);
    }
  }

  // Sweep: drop layers/sources this slice rendered that are no longer
  // registered (unregistered entries, or entries from a previous session).
  for (const [sourceId, rendered] of [...keys.entries()]) {
    if (!wantedLayerIds.has(rendered.layerId)) {
      removeToolLayer(map, "overlays", rendered.layerId);
      if (map.getSource(sourceId)) {
        try {
          map.removeSource(sourceId);
        } catch {
          /* already gone */
        }
      }
      keys.delete(sourceId);
    }
  }
}

/** Test escape hatch: forget per-map render state. */
export function resetOverlayRendererForTests(): void {
  // WeakMap has no clear(); entries die with their maps.
}
