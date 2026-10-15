// ─── modules/map/tools/display/GridLayer.ts ───────────────────────────
// Coordinate graticule (lng/lat) over the map. Zoom-adaptive interval per
// spec §5.1; coordinate labels at line ends ONLY at zoom ≥ 11.
//
// Honesty: our coordinates are real lng/lat — the panel label reads
// "Coordinate grid (lng/lat)". Never a fictional game-coordinate system.

import type {
  Map as MapLibreMap,
  GeoJSONSource,
  LngLatBounds,
} from "maplibre-gl";
import { addToolLayer, removeToolLayer } from "../shared/layerOrder";

export const GRID_SOURCE_ID = "gta6mapx-tool-grid";
export const GRID_LINES_LAYER_ID = "gta6mapx-tool-grid-lines";
export const GRID_LABELS_LAYER_ID = "gta6mapx-tool-grid-labels";

/** Zoom → graticule interval in degrees (spec §5.1 table). */
export function intervalForZoom(zoom: number): number {
  if (zoom >= 14) return 0.01;
  if (zoom >= 11) return 0.1;
  if (zoom >= 8) return 1;
  if (zoom >= 5) return 5;
  return 10;
}

/** Labels render only at this zoom and above. */
export const GRID_LABEL_MIN_ZOOM = 11;

function decimalsFor(interval: number): number {
  if (interval >= 1) return 0;
  if (interval >= 0.1) return 1;
  return 2;
}

function formatLng(v: number, decimals: number): string {
  const fixed = Math.abs(v).toFixed(decimals);
  return `${fixed}°${v < 0 ? "W" : v > 0 ? "E" : ""}`;
}

function formatLat(v: number, decimals: number): string {
  const fixed = Math.abs(v).toFixed(decimals);
  return `${fixed}°${v < 0 ? "S" : v > 0 ? "N" : ""}`;
}

function buildLines(
  bounds: LngLatBounds,
  interval: number
): { lines: GeoJSON.LineString[]; labels: GeoJSON.Feature<GeoJSON.Point>[] } {
  const west = bounds.getWest();
  const east = bounds.getEast();
  const south = Math.max(bounds.getSouth(), -90);
  const north = Math.min(bounds.getNorth(), 90);
  const decimals = decimalsFor(interval);

  const lines: GeoJSON.LineString[] = [];
  const labels: GeoJSON.Feature<GeoJSON.Point>[] = [];

  // Safety cap: never generate more than ~1500 lines per axis.
  const spanLng = east - west;
  const spanLat = north - south;
  if (spanLng / interval > 1500 || spanLat / interval > 1500) return { lines, labels };

  // Vertical (constant-lng) lines, label at the top end.
  const firstLng = Math.ceil(west / interval) * interval;
  for (let lng = firstLng; lng <= east + 1e-9; lng += interval) {
    lines.push({
      type: "LineString",
      coordinates: [
        [lng, south],
        [lng, north],
      ],
    });
    labels.push({
      type: "Feature",
      properties: { coordLabel: formatLng(lng, decimals) },
      geometry: { type: "Point", coordinates: [lng, north] },
    });
  }
  // Horizontal (constant-lat) lines, label at the right end.
  const firstLat = Math.ceil(south / interval) * interval;
  for (let lat = firstLat; lat <= north + 1e-9; lat += interval) {
    lines.push({
      type: "LineString",
      coordinates: [
        [west, lat],
        [east, lat],
      ],
    });
    labels.push({
      type: "Feature",
      properties: { coordLabel: formatLat(lat, decimals) },
      geometry: { type: "Point", coordinates: [east, lat] },
    });
  }
  return { lines, labels };
}

/** Rebuild grid data for the current camera. Called on zoomend + moveend. */
export function refreshGrid(map: MapLibreMap): void {
  const source = map.getSource(GRID_SOURCE_ID) as GeoJSONSource | undefined;
  if (!source) return;
  const zoom = map.getZoom();
  const interval = intervalForZoom(zoom);
  const { lines, labels } = buildLines(map.getBounds(), interval);
  source.setData({
    type: "FeatureCollection",
    features: [
      ...lines.map(
        (geometry): GeoJSON.Feature<GeoJSON.LineString> => ({
          type: "Feature",
          properties: {},
          geometry,
        })
      ),
      ...labels,
    ],
  });
  const labelsVisible = zoom >= GRID_LABEL_MIN_ZOOM;
  if (map.getLayer(GRID_LABELS_LAYER_ID)) {
    map.setLayoutProperty(
      GRID_LABELS_LAYER_ID,
      "visibility",
      labelsVisible ? "visible" : "none"
    );
  }
}

const listeners = new WeakMap<MapLibreMap, () => void>();

/** Idempotent: re-mounting refreshes in place; listeners attach once. */
export function mountGridLayer(map: MapLibreMap): void {
  if (!map.getSource(GRID_SOURCE_ID)) {
    map.addSource(GRID_SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }

  addToolLayer(map, "grid", {
    id: GRID_LINES_LAYER_ID,
    type: "line",
    source: GRID_SOURCE_ID,
    filter: ["!", ["has", "coordLabel"]],
    paint: {
      // Neon-subtle: 1px electric purple at ~15% opacity.
      "line-color": "rgba(139, 92, 246, 0.15)",
      "line-width": 1,
    },
  });

  addToolLayer(map, "grid", {
    id: GRID_LABELS_LAYER_ID,
    type: "symbol",
    source: GRID_SOURCE_ID,
    filter: ["has", "coordLabel"],
    layout: {
      "text-field": ["get", "coordLabel"],
      "text-size": 10,
      // text-font intentionally unset: renders from the vector tiles'
      // glyph range via MapLibre's default fontstack (same approach as
      // the cluster count layer in markerLayer.ts).
      "text-padding": 4,
      visibility: map.getZoom() >= GRID_LABEL_MIN_ZOOM ? "visible" : "none",
    },
    paint: {
      "text-color": "#9aa3b2", // neon-gray, 10px mono-styled
      "text-halo-color": "rgba(0, 0, 0, 0.75)",
      "text-halo-width": 2,
    },
  });

  if (!listeners.has(map)) {
    const onCamera = () => refreshGrid(map);
    map.on("zoomend", onCamera);
    map.on("moveend", onCamera);
    listeners.set(map, onCamera);
  }
  refreshGrid(map);
}

export function unmountGridLayer(map: MapLibreMap): void {
  const onCamera = listeners.get(map);
  if (onCamera) {
    map.off("zoomend", onCamera);
    map.off("moveend", onCamera);
    listeners.delete(map);
  }
  removeToolLayer(map, "grid", GRID_LABELS_LAYER_ID);
  removeToolLayer(map, "grid", GRID_LINES_LAYER_ID);
  if (map.getSource(GRID_SOURCE_ID)) map.removeSource(GRID_SOURCE_ID);
}
