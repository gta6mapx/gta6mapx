// Regenerates web/public/data/pins.geojson from the canonical Pin records in
// src/data/pins.ts, serialized through modules/map/pinAdapter.ts (the same
// adapter the live map uses). Run after editing pins.ts:
//
//   node --import ./scripts/register-at-alias.mjs scripts/gen-pins-geojson.mts
//
// Requires Node ≥ 22.6 (native TS type-stripping). The geojson is the runtime
// source for loadNamedPins(); keeping it in sync with pins.ts is mandatory.
import { writeFileSync } from "node:fs";
import { PINS } from "../src/data/pins";
import { pinToFeature } from "../src/modules/map/pinAdapter";

const collection = {
  type: "FeatureCollection",
  features: PINS.map((pin) => pinToFeature(pin)),
};

const outPath = new URL("../public/data/pins.geojson", import.meta.url);
writeFileSync(outPath, JSON.stringify(collection));

// Sanity: every feature must carry the 4-status evidence field.
const bad = collection.features.filter(
  (f) => !["rockstar-confirmed", "trailer-confirmed", "leak-reported", "disputed"].includes(
    (f.properties as { evidence: string }).evidence
  )
);
if (bad.length > 0) {
  console.error(`ERROR: ${bad.length} features missing a valid evidence status`);
  process.exit(1);
}
console.log(`wrote ${collection.features.length} features → public/data/pins.geojson`);
