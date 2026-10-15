// ─── modules/entities/data/gtadb/schema.ts ─────────────────────────────────
// STAGING ONLY — not imported by any page, route, or barrel.
// TypeScript types for the gtadb.org-derived staging database (review queue
// input). Nothing in this directory auto-publishes: named records become
// entity pages only after human review; pins are a map density layer only.

/** Dataset confidence, derived from the source record's category tags. */
export type GtadbConfidence = "supported" | "unknown";

/** Owner-specified category buckets. `cars` / `cities` are empty for this
 *  landmark dataset (no vehicle data, no settlement-level records) — the
 *  files exist so the bucket set stays stable across future imports. */
export type GtadbOwnerCategory =
  | "cars"
  | "locations"
  | "cities"
  | "stores"
  | "others";

/** Pessimistic evidence defaults for imported records. `rockstar-confirmed`
 *  and `trailer-confirmed` are never auto-assigned — a reviewer may upgrade
 *  only with a verifiable citation. */
export type StagedEvidenceStatus = "leak-reported" | "disputed";

export interface GtadbRawCoords {
  /** GTADB game-world frame, arbitrary game units. +x = east, +y = north. */
  x: number;
  y: number;
}

export interface GtadbLatLng {
  /** Placeholder-Florida WGS84 frame. APPROXIMATE — see transform.ts. */
  lat: number;
  lng: number;
}

export interface StagedNamedRecord {
  /** Stable id, e.g. "gtadb-6-L16". Unique across named records AND pins. */
  id: string;
  /** POI name = dataset name part before the first comma, normalized
   *  (trimmed, whitespace collapsed). Never invented. */
  name: string;
  /** slugify(name); collisions de-duplicated with -2 / -3 suffixes. */
  slug: string;
  /** District part of the dataset name (e.g. "Vice Beach"). Reviewer context
   *  only — extension beyond the original staging spec, kept so the district
   *  signal isn't lost when the POI name is split off. */
  district: string;
  ownerCategory: GtadbOwnerCategory;
  /** Raw dataset category tags, lowercased, typos normalized
   *  (e.g. "redisential" -> "residential"). */
  gtadbCategory: string[];
  rawCoords: GtadbRawCoords;
  coords: GtadbLatLng;
  evidenceStatus: StagedEvidenceStatus;
  confidence: GtadbConfidence;
  /** Provenance string, e.g. "gtadb.org community landmark dataset, rev 7c3f8c2 …" */
  source: string;
  /** Original editorial summary (≥ 50 chars), reviewer-written or
   *  reviewer-approved. Never copied from any source; describes the record
   *  as a dataset pin — no invented gameplay facts. */
  summary: string;
  /** Parent region assigned by the reviewer (e.g. "Vice City"). */
  region: string;
  /** Tags derived from `gtadbCategory` via the allow-list, plus the owner
   *  bucket tag ("store" for stores) and "community-data" for
   *  workflow-tag-only records. */
  tags: string[];
  /** Evidence detail line used if the record is approved, e.g.
   *  "Community dataset (gtadb.org-derived), rev 7c3f8c2 — pin approximate". */
  evidenceDetail: string;
  /** Existing site slug, set only when dedupe flagged this record
   *  (slug collision or normalized-name match). Reviewer resolves. */
  duplicateOf?: string;
  /** true = transformed coords are extrapolated outside the validated metro
   *  anchor zone and must be re-verified before the record is trusted
   *  geographically. Never ship false precision. */
  needsCoordVerification: boolean;
}

export interface StagedPin {
  /** Stable id, e.g. "gtadb-6-L1". Unnamed "?" records only. */
  id: string;
  coords: GtadbLatLng;
  rawCoords: GtadbRawCoords;
  ownerCategory: GtadbOwnerCategory;
  // NOTE: pins NEVER become pages. No name, no slug, no evidence fields.
  // They are a visual density layer only (excluded from sitemap/search/hubs).
}
