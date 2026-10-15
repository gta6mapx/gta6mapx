/**
 * leonidaBase.ts — the illustrated Leonida game-world base map.
 *
 * Owns GTA6mapx's original base artwork (public/maps/leonida-base.webp): a
 * stylized, hand-directed rendering of the fictional state of Leonida in our
 * neon Vice City identity. All artwork is original to this project — no
 * competitor code, tiles, stylesheets, wording, or visual assets are used.
 *
 * The artwork is registered as a MapLibre `image` source whose four corners
 * are pinned to LEONIDA_BASE_QUAD in game coordinates (converted through the
 * clean-room gameToMap transform). Every pin placed through the same
 * transform therefore lands on the drawn landmass by construction.
 *
 * Pure helpers (quad, corners, center) are unit-testable. The registrar
 * follows the OverlayRegistrar contract owned by styleManager, which keeps
 * it style-aware: the artwork is only added for the "leonida-dark" base.
 */

import type { Map as MLMap } from "maplibre-gl";
import { gameToMap } from "./gameCoords";

/** Same-origin artwork URL (bundled under web/public/maps). */
export const LEONIDA_BASE_URL = "/maps/leonida-base.webp";

/**
 * Game-coordinate quad the artwork covers. Square (17 600 × 17 600 units),
 * fitted from the GTADB district centroids so the drawn metropolis, keys
 * chain, lake, ports, and farmland sit under the real pin clusters.
 */
export const LEONIDA_BASE_QUAD = {
  xMin: -11400,
  xMax: 6200,
  yMin: -8900,
  yMax: 8700,
} as const;

export const LEONIDA_BASE_SOURCE_ID = "gta6-leonida-base";
export const LEONIDA_BASE_LAYER_ID = "gta6-leonida-base-layer";

/**
 * Artwork corners as [lng, lat] in MapLibre image-source order:
 * top-left, top-right, bottom-right, bottom-left.
 */
export function leonidaBaseCorners(): [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
] {
  const q = LEONIDA_BASE_QUAD;
  const tl = gameToMap(q.xMin, q.yMax);
  const tr = gameToMap(q.xMax, q.yMax);
  const br = gameToMap(q.xMax, q.yMin);
  const bl = gameToMap(q.xMin, q.yMin);
  return [
    [tl.lng, tl.lat],
    [tr.lng, tr.lat],
    [br.lng, br.lat],
    [bl.lng, bl.lat],
  ];
}

/** Quad center as [lng, lat] — the default camera target. */
export function leonidaBaseCenter(): [number, number] {
  const q = LEONIDA_BASE_QUAD;
  const p = gameToMap((q.xMin + q.xMax) / 2, (q.yMin + q.yMax) / 2);
  return [p.lng, p.lat];
}

/**
 * Idempotent: add the image source + bottom raster layer when absent.
 * The layer is inserted before the first existing layer so the artwork
 * always stays beneath pins, clusters, and overlays.
 */
export function ensureLeonidaBase(map: MLMap): void {
  if (!map.getSource(LEONIDA_BASE_SOURCE_ID)) {
    type AddSourceSpec = Parameters<MLMap["addSource"]>[1];
    const spec = {
      type: "image",
      url: LEONIDA_BASE_URL,
      coordinates: leonidaBaseCorners(),
    } as unknown as AddSourceSpec;
    map.addSource(LEONIDA_BASE_SOURCE_ID, spec);
  }
  if (!map.getLayer(LEONIDA_BASE_LAYER_ID)) {
    const first = map.getStyle()?.layers?.[0]?.id;
    map.addLayer(
      {
        id: LEONIDA_BASE_LAYER_ID,
        type: "raster",
        source: LEONIDA_BASE_SOURCE_ID,
        paint: { "raster-opacity": 1, "raster-fade-duration": 0 },
      },
      first
    );
  }
}

/** Best-effort removal (StyleManager rebuild path). */
export function removeLeonidaBase(map: MLMap): void {
  if (map.getLayer(LEONIDA_BASE_LAYER_ID)) map.removeLayer(LEONIDA_BASE_LAYER_ID);
  if (map.getSource(LEONIDA_BASE_SOURCE_ID)) map.removeSource(LEONIDA_BASE_SOURCE_ID);
}

/**
 * Style-aware registrar for the StyleManager: only the "leonida-dark" base
 * shows the illustrated artwork; other bases (e.g. real-florida tiles)
 * render without it.
 */
export function buildLeonidaBaseRegistrar(
  getStyleId: () => string
): {
  id: string;
  addTo(map: MLMap): void;
  removeFrom(map: MLMap): void;
} {
  return {
    id: "leonida-base",
    addTo(map: MLMap) {
      if (getStyleId() !== "leonida-dark") return;
      ensureLeonidaBase(map);
    },
    removeFrom(map: MLMap) {
      removeLeonidaBase(map);
    },
  };
}
