// ─── modules/engagement/game/gameData.ts ─────────────────────────────────────
// Round pool data for "Find the Location".
//
// Hand-authored `gamePin` records ({ locationSlug, lng, lat }). Coordinates
// are APPROXIMATE-GRADE: derived from the Florida real-world analogs of each
// Leonida location (Leonida ≈ Florida; Vice City ≈ Miami, 25.76/−80.19) and
// marked `approximate: true`. They exist to be guessed at, not to be facts —
// scoring tiers are deliberately wide and results say so.
//
// Eligibility is a LIVE FILTER on evidence.status, not curation:
// rockstar-confirmed + trailer-confirmed locations only. Leak-reported and
// disputed locations (Malibu Club, Monument of Leonida, Lummox County) are
// excluded by the filter itself — no code change needed when a status changes.
// Locations without a pin here are silently skipped.

import { LOCATIONS } from "@/modules/entities/data/locations";
import type { GameLocation } from "@/modules/entities/types";

export type GameDifficulty = "easy" | "medium" | "hard";

export interface GamePin {
  locationSlug: string;
  /** Approximate truth coordinate, map frame [lng, lat]. */
  lng: number;
  lat: number;
  approximate: true;
  /** Clue text: hand-authored from the entity summary, name + region stripped. */
  clue: string;
}

// Coordinates below are approximate-grade (see module header).
const RAW_PINS: GamePin[] = [
  { locationSlug: "vice-city", lng: -80.1918, lat: 25.7617, approximate: true,
    clue: "The state's largest city and the game's primary urban setting — a far larger, modern take on the iconic Miami-inspired metropolis, with beaches, nightlife, ports and dense neighborhoods." },
  { locationSlug: "leonida-keys", lng: -81.05, lat: 24.75, approximate: true,
    clue: "An island chain south of the mainland, linked by long bridges — expect boating, smuggling runs and waterfront hideouts." },
  { locationSlug: "grassrivers", lng: -80.9, lat: 25.86, approximate: true,
    clue: "Vast swamp wetlands — airboats, wildlife and muddy off-road trails. The state's wild frontier." },
  { locationSlug: "port-gellhorn", lng: -85.66, lat: 30.16, approximate: true,
    clue: "A forgotten stretch of the west coast — industrial docks, truck stops, motels and working rail lines. A working-class port town." },
  { locationSlug: "ambrosia", lng: -80.94, lat: 26.75, approximate: true,
    clue: "Rural farmland heartland — backroads, fields and small-town secrets." },
  { locationSlug: "mount-kalaga-national-park", lng: -83.9, lat: 30.6, approximate: true,
    clue: "A forested mountain region in the far north — elevation, overlooks and hiking trails. The state's high ground." },
  { locationSlug: "ocean-beach", lng: -80.13, lat: 25.78, approximate: true,
    clue: "A tourist beachfront strip — hotels, neon and the classic retro-city vibe, rebuilt bigger." },
  { locationSlug: "vice-beach", lng: -80.12, lat: 25.81, approximate: true,
    clue: "The main beach district — jet skis, boardwalks and crowds." },
  { locationSlug: "ocean-drive", lng: -80.131, lat: 25.774, approximate: true,
    clue: "An iconic oceanfront boulevard lined with art-deco hotels — the supercar cruising strip." },
  { locationSlug: "vice-city-port", lng: -80.16, lat: 25.77, approximate: true,
    clue: "A massive shipping port — cranes, containers and cargo ships. Prime smuggling-mission territory." },
  { locationSlug: "vice-city-international-airport", lng: -80.29, lat: 25.795, approximate: true,
    clue: "An enormous airport for overseas flights — one of the state's signature locations." },
  { locationSlug: "little-haiti", lng: -80.2, lat: 25.82, approximate: true,
    clue: "A neighborhood with Caribbean flavor — Haitian-themed murals and street-level detail seen in official material." },
  { locationSlug: "leaf-links", lng: -80.14, lat: 25.86, approximate: true,
    clue: "Golf-course islands returning from the classic city, per official location lists." },
  { locationSlug: "washington-beach", lng: -80.14, lat: 25.8, approximate: true,
    clue: "A beach district just north of the tourist beachfront — named in official edition copy as a personal watercraft's docking point." },
  { locationSlug: "vercetti-estate", lng: -80.154, lat: 25.778, approximate: true,
    clue: "A notorious kingpin's old mansion — named in official edition copy as the inspiration for two revolvers' styling. Never shown on-screen; whether you can enter is unconfirmed." },
  { locationSlug: "starlet-motel", lng: -85.62, lat: 30.16, approximate: true,
    clue: "A run-down motel complex on the forgotten west coast — setting of a famous “Trust? — Trust” scene. Reported as an early safehouse and meeting point." },
  { locationSlug: "jasons-safehouse", lng: -80.55, lat: 25.05, approximate: true,
    clue: "A waterfront stilt house in the southern island chain — one protagonist's starting safehouse, seen in Trailer 2 and named in official edition copy." },
  { locationSlug: "vice-dale-county", lng: -80.35, lat: 25.65, approximate: true,
    clue: "The county wrapped around the big city — the Miami-Dade of the in-universe world, confirmed by name on a police seal in Trailer 1." },
  { locationSlug: "leonard-county", lng: -80.35, lat: 26.05, approximate: true,
    clue: "An eastern county — confirmed by name on road signs in official gameplay footage. Details still thin." },
  { locationSlug: "kelly-county", lng: -81.3, lat: 27.0, approximate: true,
    clue: "A western county of open land — named in official site copy as the west-coast port town's county. High-speed chase territory." },
  { locationSlug: "mariana-county", lng: -80.85, lat: 25.5, approximate: true,
    clue: "A southern wetlands county with an isolated airstrip — confirmed by road signs in official footage." },
  { locationSlug: "catalan-key", lng: -80.75, lat: 25.15, approximate: true,
    clue: "A key dominated by a large complex with circular structures, per public reporting on official close-up material." },
  { locationSlug: "gloriana-key", lng: -80.65, lat: 24.95, approximate: true,
    clue: "An industrial key with storage tanks, per public reporting on official material." },
  { locationSlug: "dalton-island", lng: -80.13, lat: 25.72, approximate: true,
    clue: "A residential island with a marina — read by the mapping community as the Fisher Island analogue." },
  { locationSlug: "tequesta-retreat", lng: -80.45, lat: 26.05, approximate: true,
    clue: "A retreat location in the southern island chain, named in official location lists." },
  { locationSlug: "little-cuba", lng: -80.219, lat: 25.766, approximate: true,
    clue: "A neighborhood of bustling panaderías and Cuban-American street life, named directly on the official game website." },
  { locationSlug: "tisha-wocka", lng: -80.21, lat: 26.12, approximate: true,
    clue: "A flea market known for bootleg-brand stalls, named directly on the official game website." },
  { locationSlug: "thrillbilly-mud-club", lng: -81.0, lat: 26.9, approximate: true,
    clue: "An open, muddy off-road motorsports park near the great wetlands, where mud-covered crowds party around monster trucks and swamp buggies; its logo is watermarked on Trailer 1 footage." },
  { locationSlug: "allied-crystal-sugar-refinery", lng: -80.943, lat: 26.756, approximate: true,
    clue: "The industrial sugar refinery that anchors the farmland heartland — official site copy says it provides the region's jobs while the local biker gang provides almost everything else." },
  { locationSlug: "dominion-hotel", lng: -80.19, lat: 25.767, approximate: true,
    clue: "A luxury hotel outside which Trailer 2 lines up a row of high-end supercars, including modern luxury marques." },
];

const PIN_BY_SLUG = new Map<string, GamePin>(RAW_PINS.map((p) => [p.locationSlug, p]));

/** Eligibility is a live evidence filter — never curation. */
const ELIGIBLE_STATUSES = new Set(["rockstar-confirmed", "trailer-confirmed"]);

export function getPin(slug: string): GamePin | undefined {
  return PIN_BY_SLUG.get(slug);
}

/** Round target: the location entity + its hand-authored pin. */
export interface RoundTarget {
  location: GameLocation;
  pin: GamePin;
}

/**
 * Live-filtered round pool. Pin-less eligible locations are silently
 * skipped (the game never breaks if the pool is smaller than 30).
 */
export function getEligibleTargets(difficulty: GameDifficulty): RoundTarget[] {
  const out: RoundTarget[] = [];
  for (const loc of LOCATIONS) {
    if (loc.kind !== "location") continue;
    if (!ELIGIBLE_STATUSES.has(loc.evidence.status)) continue;
    if (difficulty === "easy" && loc.evidence.status !== "rockstar-confirmed") continue;
    if (difficulty === "hard" && loc.evidence.status !== "trailer-confirmed") continue;
    const pin = PIN_BY_SLUG.get(loc.slug);
    if (!pin) continue;
    out.push({ location: loc, pin });
  }
  return out;
}

/** Neutral Leonida-wide overview camera — every round starts here. */
export const NEUTRAL_VIEW = {
  center: [-81.3, 27.4] as [number, number],
  zoom: 6,
  pitch: 45,
} as const;
