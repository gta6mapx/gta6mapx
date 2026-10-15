// ─── modules/map/tools/overlays/tileVersionOverlays.ts ────────────────
// Built-in tile-version entries (spec §4.2a): "our own tile versions would
// go here" — the factory and attribution metadata shape.
//
// v1 registers ZERO entries, deliberately:
//  - No custom Leonida tiles have been built yet, so there is no v1/v2 to
//    register. When tile versions exist, each becomes one
//    kind: "tile-version" entry via makeTileVersionEntry() — the built-in
//    version-over-version comparison mechanic (spec §4.4).
//  - The OSM-derived real-Florida reference is ALREADY the "real-florida"
//    base style (styleManager.ts). Duplicating it as an overlay would be
//    redundant and would break the base-layer control's ownership of the
//    base tier (spec §4.2b: a base layer is always present, never null
//    under an overlay).
//
// RIGHTS: only our own tiles or openly-licensed sources with visible
// attribution ever go here. NEVER Rockstar map art, NEVER competitor tiles,
// NEVER hotlinking third-party map art (spec §4.4).

import type { RegisterInput } from "./overlayRegistry";

export interface TileVersionEntryDef {
  id: string;
  name: string;
  /** Raster tiles URL template for our own hosted tiles. */
  tileUrlTemplate: string;
  /** Visible attribution, e.g. "© OpenStreetMap contributors". */
  attribution: string;
  minzoom?: number;
  maxzoom?: number;
}

/** Built-in tile-version entries for v1. Empty — see header comment. */
export function builtInTileVersionEntries(): TileVersionEntryDef[] {
  return [];
}

/** Convert a tile-version definition into a registry registration. */
export function makeTileVersionEntry(def: TileVersionEntryDef): RegisterInput {
  return {
    id: def.id,
    name: def.name,
    kind: "tile-version",
    visible: true,
    meta: {
      tileUrlTemplate: def.tileUrlTemplate,
      attribution: def.attribution,
      minzoom: def.minzoom,
      maxzoom: def.maxzoom,
    },
  };
}

/**
 * Attribution wording shared with the base styles (styleManager.ts):
 * OSM-derived layers always credit © OpenMapTiles © OpenStreetMap
 * contributors, plus the fan-project disclaimer. When GTADB data is used,
 * its CC BY 4.0 credit (added by the site owner pre-deploy) applies.
 */
export const OSM_ATTRIBUTION = "© OpenMapTiles © OpenStreetMap contributors";
export const FAN_PROJECT_DISCLAIMER =
  "Fan project — not affiliated with Rockstar Games";
