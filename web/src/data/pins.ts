// ─── GTA6mapx data model (v2) ───────────────────────────────────────────────
// Every pin carries the LEAK TRANSPARENCY ENGINE evidence chain — exactly
// one of four formal statuses (see modules/entities/types.ts). The old
// 3-tier `certainty` (confirmed/likely/speculation) was migrated by hand
// review on 2026-09-24 per research/specs/discovery-spec.md §2.5.
//
// Pre-launch sample pins use real Florida coordinates (Leonida ≈ Florida);
// custom Leonida tiles replace the base map. Coordinates are approximate
// grade — never presented as exact (see modules/map/gameCoords.ts).

import type { Evidence, EvidenceStatus } from "@/modules/entities/types";
import { GTADB_PINS } from "./gtadb-pins.generated";

export type { EvidenceStatus };

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string; // emoji used on pins for v1
}

export interface EntityRef {
  kind: "vehicle" | "location" | "weapon" | "character";
  slug: string; // deep-link target: /vehicles/[slug], /locations/[slug], …
}

export type Availability = "open" | "closed" | "demolished" | "cancelled" | "enterable";

export interface Pin {
  id: string; // stable, e.g. "p1"
  categorySlug: string; // one of CATEGORIES (functional — never provenance)
  name: string;
  slug: string; // used in ?pin= deep links
  lat: number;
  lng: number; // Leonida world frame (placeholder lat/lng until custom tiles)
  evidence: Evidence; // THE 4-status engine — required, exactly one
  availability?: Availability; // lifecycle, orthogonal to evidence
  region: string; // e.g. "Vice City", "Port Gellhorn" — for search + sort
  tags: string[]; // controlled vocabulary below — lowercase, hyphenated
  updatedAt: string; // ISO date — "Intel updated Sep 24, 2026"
  entityRef?: EntityRef; // link to the curated SEO page, when one exists
  sourceUrl?: string; // public source link only — never leaked files
  internalTags?: string[]; // moderation only — NEVER rendered publicly
  description: string; // original editorial summary — honesty-labeled
  /**
   * true = coordinates extrapolated outside the validated anchor zone
   * (community-dataset pins). Renders with the ≈ badge — approximate
   * positions are never presented as precise.
   */
  needCoordVerification?: boolean;
}

export const CATEGORIES: Category[] = [
  { id: "c1", name: "Collectibles", slug: "collectibles", icon: "💎" },
  { id: "c2", name: "Stores & Services", slug: "stores", icon: "🏪" },
  { id: "c3", name: "Missions", slug: "missions", icon: "🎯" },
  { id: "c4", name: "Vehicles", slug: "vehicles", icon: "🚗" },
  { id: "c5", name: "Secrets", slug: "secrets", icon: "✨" },
  { id: "c6", name: "Stunt Jumps", slug: "stunt-jumps", icon: "💥" },
  { id: "c7", name: "Landmarks", slug: "landmarks", icon: "📍" },
];

/**
 * Controlled tag vocabulary. Tags come ONLY from this list; free-text tags
 * are rejected at review time (spec §2.3). Keep lowercase-hyphenated.
 */
export const TAG_VOCABULARY: readonly string[] = [
  "guns", "store", "pay-n-spray", "collectible", "statue", "vehicle",
  "sports", "stunt", "ramp", "easter-egg", "motel", "mission", "story",
  "beach", "nightclub", "bar", "gas", "restaurant", "hotel", "safehouse",
  "clothes", "tattoos", "hair", "electronics", "stripclub", "supermarket",
  "boat", "airport", "police", "hospital", "park", "pier", "casino",
  "mall", "garage", "racetrack", "golf", "stadium", "church", "school",
  "bridge", "tunnel", "island", "swamp", "mountain", "farm", "port",
  "industrial", "residential", "downtown", "tourist", "waterfront",
] as const;

export function isKnownTag(tag: string): boolean {
  return (TAG_VOCABULARY as readonly string[]).includes(tag);
}

/** Evidence-strength rank: higher = stronger. Trust-critical — disputed is lowest. */
export const EVIDENCE_RANK: Record<EvidenceStatus, 1 | 2 | 3 | 4> = {
  "rockstar-confirmed": 4,
  "trailer-confirmed": 3,
  "leak-reported": 2,
  disputed: 1,
};

export function evidenceRank(status: EvidenceStatus): 1 | 2 | 3 | 4 {
  return EVIDENCE_RANK[status];
}

export const ALL_EVIDENCE_STATUSES: EvidenceStatus[] = [
  "rockstar-confirmed",
  "trailer-confirmed",
  "leak-reported",
  "disputed",
];

// Curated pre-launch pins (hand-reviewed 2026-09-24). Community-dataset
// pins (GTADB_PINS, generated) are appended below — same model, pessimistic
// evidence labels, ≈ badge where coordinates need verification.
const CURATED_PINS: Pin[] = [
  {
    id: "p1",
    categorySlug: "stores",
    name: "Ammu-Nation — Downtown Vice City",
    slug: "ammu-nation-downtown",
    lat: 25.7743, lng: -80.1937,
    evidence: { status: "trailer-confirmed", detail: "Trailer 2 @ 0:42" },
    region: "Vice City",
    tags: ["guns", "store", "downtown"],
    updatedAt: "2026-09-24",
    description:
      "Gun store in downtown Vice City, visible in Trailer 2. Its in-game inventory is unconfirmed until launch.",
  },
  {
    id: "p2",
    categorySlug: "stores",
    name: "Pay 'n Spray — Little Havana",
    slug: "pay-n-spray-little-havana",
    lat: 25.7649, lng: -80.2218,
    evidence: {
      status: "disputed",
      detail: "Fan reconstruction — no trailer or official source shows this location",
    },
    region: "Vice City",
    tags: ["pay-n-spray", "store"],
    updatedAt: "2026-09-24",
    internalTags: ["needs-verification"],
    description:
      "Possible spray shop location from a fan map reconstruction. Treat as unverified until launch.",
  },
  {
    id: "p3",
    categorySlug: "collectibles",
    name: "Leonida Memorabilia #1 — Ocean Drive",
    slug: "memorabilia-ocean-drive",
    lat: 25.7797, lng: -80.1300,
    evidence: { status: "trailer-confirmed", detail: "Trailer 1 @ 1:12 — statue visible" },
    region: "Vice City",
    tags: ["collectible", "statue", "tourist"],
    updatedAt: "2026-09-24",
    description:
      "Collectible statue spotted on Ocean Drive in Trailer 1. One of the memorabilia items expected at launch.",
  },
  {
    id: "p4",
    categorySlug: "vehicles",
    name: "Infernus Spawn — Starfish Island",
    slug: "infernus-starfish-island",
    lat: 25.7866, lng: -80.1647,
    evidence: {
      status: "disputed",
      detail: "Predicted from GTA Online patterns — unconfirmed for GTA 6",
    },
    region: "Vice City",
    tags: ["vehicle", "sports", "island"],
    updatedAt: "2026-09-24",
    internalTags: ["needs-verification"],
    description:
      "High-end sports car spawn predicted from GTA Online patterns. Verify after launch.",
  },
  {
    id: "p5",
    categorySlug: "stunt-jumps",
    name: "Stunt Jump — MacArthur Causeway",
    slug: "stunt-jump-macarthur-causeway",
    lat: 25.7789, lng: -80.1700,
    evidence: { status: "trailer-confirmed", detail: "Trailer 2 @ 1:47 — ramp visible" },
    region: "Vice City",
    tags: ["stunt", "ramp", "bridge"],
    updatedAt: "2026-09-24",
    description: "Ramp on the causeway looks purpose-built for a stunt jump.",
  },
  {
    id: "p6",
    categorySlug: "secrets",
    name: "Easter Egg — Abandoned Motel Sign",
    slug: "easter-egg-abandoned-motel",
    lat: 25.7519, lng: -80.2518,
    evidence: {
      status: "disputed",
      detail: "Community theory — no trailer or official source",
    },
    region: "Vice City",
    tags: ["easter-egg", "motel"],
    updatedAt: "2026-09-24",
    internalTags: ["needs-verification"],
    description:
      "Community theory about a hidden motel easter egg. Awaiting launch verification.",
  },
  {
    id: "p7",
    categorySlug: "missions",
    name: "Story Mission — 'New Beginnings' (rumored start)",
    slug: "mission-new-beginnings",
    lat: 25.7617, lng: -80.1918,
    evidence: {
      status: "disputed",
      detail: "Rumor — no trailer or official source",
    },
    region: "Vice City",
    tags: ["mission", "story", "downtown"],
    updatedAt: "2026-09-24",
    internalTags: ["needs-verification"],
    description:
      "Rumored opening mission area in central Vice City. Missions unlock with verified details after launch.",
  },
];

// Community-dataset pins (generated from gtadb.org-derived staging data).
// Same Pin model — popups, search, and deep links resolve for them; the lean
// runtime artifact (public/data/pins.geojson) is regenerated from PINS via
// scripts/gen-pins-geojson.mts.
export const PINS: Pin[] = [...CURATED_PINS, ...GTADB_PINS];

export const LAUNCH_DATE = new Date("2026-11-19T00:00:00Z");