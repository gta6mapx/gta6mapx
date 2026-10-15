// Generates src/data/gtadb-pins.generated.ts from the gtadb.org-derived
// staging JSONs (src/modules/entities/data/gtadb/{locations,stores,others}.json).
//
// Run AFTER any staging change:
//   node --import ./scripts/register-at-alias.mjs scripts/gen-gtadb-pins.mts
// Then regenerate the runtime artifact:
//   node --import ./scripts/register-at-alias.mjs scripts/gen-pins-geojson.mts
//
// CATEGORY MAPPING (functional — never provenance):
//   ownerCategory "stores"            → "stores"
//   gtadbCategory includes "transportation" → "vehicles"
//   everything else                   → "landmarks" (new CATEGORIES entry)
//
// EVIDENCE: staging already carries pessimistic labels only —
// "leak-reported" or "disputed". rockstar-confirmed / trailer-confirmed are
// NEVER auto-assigned; a reviewer may upgrade only with a verifiable citation.
// needsCoordVerification → Pin.needCoordVerification → the "≈" badge on the
// map, so extrapolated positions are never presented as precise.
//
// LICENSE: underlying data documented CC BY 4.0 (gtadb.org). Attribution
// credit is added by the site owner himself before public deploy — this
// script intentionally writes NO credit text into the site.

import { readFileSync, writeFileSync } from "node:fs";
import type { Pin } from "../src/data/pins";

interface StagedRecord {
  id: string;
  name: string;
  slug: string;
  ownerCategory: string;
  gtadbCategory: string[];
  coords: { lat: number; lng: number };
  evidenceStatus: "leak-reported" | "disputed";
  evidenceDetail: string;
  region: string;
  tags: string[];
  summary: string;
  needsCoordVerification: boolean;
}

function categoryFor(rec: StagedRecord): string {
  if (rec.ownerCategory === "stores") return "stores";
  if (rec.gtadbCategory.includes("transportation")) return "vehicles";
  return "landmarks";
}

function esc(s: string): string {
  return JSON.stringify(s);
}

// Curated pins live in pins.ts (not imported here — pins.ts imports the
// file this script generates, so importing it would be a cycle). Their
// ids/slugs are read from the current runtime artifact instead.
const curatedArtifact = JSON.parse(
  readFileSync(new URL("../public/data/pins.geojson", import.meta.url), "utf8")
) as { features: { id?: unknown; properties?: { slug?: unknown } }[] };
const curatedSlugs = new Set(
  curatedArtifact.features.map((f) => String(f.properties?.slug ?? f.id))
);
const curatedIds = new Set(curatedArtifact.features.map((f) => String(f.id)));
const seenSlugs = new Set<string>();
const seenIds = new Set<string>();

const files = ["locations.json", "stores.json", "others.json"] as const;
const out: string[] = [];
const catCounts: Record<string, number> = {};
let approxCount = 0;

for (const file of files) {
  const recs = JSON.parse(
    readFileSync(new URL(`../src/modules/entities/data/gtadb/${file}`, import.meta.url), "utf8")
  ) as StagedRecord[];
  for (const rec of recs) {
    // ——— validation ———
    if (!rec.id || seenIds.has(rec.id) || curatedIds.has(rec.id)) {
      throw new Error(`[gen-gtadb-pins] duplicate/empty id: ${rec.id}`);
    }
    if (!rec.slug || seenSlugs.has(rec.slug) || curatedSlugs.has(rec.slug)) {
      throw new Error(`[gen-gtadb-pins] duplicate/empty slug: ${rec.slug} (${rec.id})`);
    }
    if (!Number.isFinite(rec.coords?.lat) || !Number.isFinite(rec.coords?.lng)) {
      throw new Error(`[gen-gtadb-pins] bad coords: ${rec.id}`);
    }
    if (!["leak-reported", "disputed"].includes(rec.evidenceStatus)) {
      throw new Error(`[gen-gtadb-pins] bad evidence status: ${rec.id}`);
    }
    if (!rec.name || !rec.summary) {
      throw new Error(`[gen-gtadb-pins] missing name/summary: ${rec.id}`);
    }
    seenIds.add(rec.id);
    seenSlugs.add(rec.slug);

    const categorySlug = categoryFor(rec);
    catCounts[categorySlug] = (catCounts[categorySlug] ?? 0) + 1;
    if (rec.needsCoordVerification) approxCount++;

    const pin: Pin = {
      id: rec.id,
      categorySlug,
      name: rec.name,
      slug: rec.slug,
      lat: rec.coords.lat,
      lng: rec.coords.lng,
      evidence: { status: rec.evidenceStatus, detail: rec.evidenceDetail },
      region: rec.region || "Leonida",
      tags: rec.tags,
      updatedAt: "2026-09-24",
      description: rec.summary,
      internalTags: ["community-data", "gtadb", rec.ownerCategory],
      needCoordVerification: rec.needsCoordVerification,
    };
    out.push(
      `  {\n` +
        `    id: ${esc(pin.id)},\n` +
        `    categorySlug: ${esc(pin.categorySlug)},\n` +
        `    name: ${esc(pin.name)},\n` +
        `    slug: ${esc(pin.slug)},\n` +
        `    lat: ${pin.lat},\n` +
        `    lng: ${pin.lng},\n` +
        `    evidence: { status: ${esc(pin.evidence.status)}, detail: ${esc(pin.evidence.detail)} },\n` +
        `    region: ${esc(pin.region)},\n` +
        `    tags: [${pin.tags.map(esc).join(", ")}],\n` +
        `    updatedAt: ${esc(pin.updatedAt)},\n` +
        `    description: ${esc(pin.description)},\n` +
        `    internalTags: [${(pin.internalTags ?? []).map(esc).join(", ")}],\n` +
        `    needCoordVerification: ${pin.needCoordVerification === true},\n` +
        `  }`
    );
  }
}

const header = `// GENERATED — do not edit by hand. Regenerate with:
//   node --import ./scripts/register-at-alias.mjs scripts/gen-gtadb-pins.mts
//
// ${out.length} community landmark pins from the gtadb.org-derived staging
// dataset (rev 7c3f8c2), mapped to the site's Pin model. Evidence labels are
// pessimistic by construction ("leak-reported" / "disputed" only).
// License: underlying data documented CC BY 4.0 (gtadb.org) — attribution
// credit is added by the site owner himself; this file carries no credit text.
import type { Pin } from "./pins";

export const GTADB_PINS: Pin[] = [
${out.join(",\n")}
];
`;

const outPath = new URL("../src/data/gtadb-pins.generated.ts", import.meta.url);
writeFileSync(outPath, header);
console.log(`wrote ${out.length} pins → src/data/gtadb-pins.generated.ts`);
console.log("category split:", JSON.stringify(catCounts));
console.log(`approx (≈ badge): ${approxCount}`);
