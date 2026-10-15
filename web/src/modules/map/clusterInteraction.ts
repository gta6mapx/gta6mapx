// ─── clusterInteraction.ts ────────────────────────────────────────────────
// Cluster click → animated expansion zoom, plus pointer affordance on hover.
// No rendering here. MapLibre v6's getClusterExpansionZoom is promise-based
// (the callback form was removed in v5).

import type * as maplibregl from "maplibre-gl";
import { CLUSTER_MAX_ZOOM, CLUSTER_SOURCE_ID } from "./clusterSource";
import { LAYER_CLUSTERS } from "./markerLayer";

export interface ExtraClusterLayer {
  layerId: string;
  sourceId: string;
}

/**
 * Wires click-to-expand on the cluster layer (plus optional extra cluster
 * layers, e.g. the unnamed density clusters). Returns an unwire function
 * for teardown. Expansion zooms to the exact zoom where the cluster breaks
 * apart, with duration scaled by zoom delta (~150ms/level, clamped 600–900ms).
 */
export function wireClusterInteraction(
  map: maplibregl.Map,
  opts?: { onBeforeClick?: () => void; extraClusters?: ExtraClusterLayer[] }
): () => void {
  const targets: ExtraClusterLayer[] = [
    { layerId: LAYER_CLUSTERS, sourceId: CLUSTER_SOURCE_ID },
    ...(opts?.extraClusters ?? []),
  ];
  const layerIds = targets.map((t) => t.layerId);
  const sourceByLayer = new Map(targets.map((t) => [t.layerId, t.sourceId] as const));

  const onClick = (e: maplibregl.MapLayerMouseEvent) => {
    // Tools own the map while active — a cluster click explicitly exits the
    // tool (spec §1.1) and the click then proceeds normally.
    opts?.onBeforeClick?.();
    const features = map.queryRenderedFeatures(e.point, { layers: layerIds });
    const cluster = features[0];
    if (!cluster) return;
    const clusterId = cluster.properties?.cluster_id;
    if (typeof clusterId !== "number") return;
    const geometry = cluster.geometry;
    if (geometry.type !== "Point") return;
    const sourceId = sourceByLayer.get(cluster.layer.id);
    if (!sourceId) return;
    const source = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    source
      .getClusterExpansionZoom(clusterId)
      .then((zoom) => {
        const delta = Math.abs(zoom - map.getZoom());
        const duration = Math.min(900, Math.max(600, Math.round(150 * delta)));
        map.easeTo({ center: geometry.coordinates as [number, number], zoom, duration });
      })
      .catch(() => {
        // Cluster vanished between click and expansion (filter race) —
        // nothing to expand; ignore.
      });
  };

  // Cheap hover affordance, cluster layer only.
  const onMouseMove = () => {
    map.getCanvas().style.cursor = "pointer";
  };
  const onMouseLeave = () => {
    map.getCanvas().style.cursor = "";
  };

  map.on("click", layerIds, onClick);
  map.on("mousemove", layerIds, onMouseMove);
  map.on("mouseleave", layerIds, onMouseLeave);

  return () => {
    map.off("click", layerIds, onClick);
    map.off("mousemove", layerIds, onMouseMove);
    map.off("mouseleave", layerIds, onMouseLeave);
  };
}

/**
 * Search-select path (spec §4.2): easeTo(clusterMaxZoom + 1) guarantees the
 * pin is unclustered — no async cluster-id hunting, no edge cases.
 */
export function flyToUnclustered(map: maplibregl.Map, lng: number, lat: number): void {
  map.easeTo({
    center: [lng, lat],
    zoom: Math.max(map.getZoom(), CLUSTER_MAX_ZOOM + 1),
    duration: 900,
  });
}
