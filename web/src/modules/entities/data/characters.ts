import type { Character } from "../types";

// ─── modules/entities/data/characters.ts ─────────────────────────────────────
// Pre-launch character roster. Everyone here was revealed through Rockstar's
// own materials (trailers + official site bios), as publicly reported.
// Summaries are original — never copied from Rockstar's site or press.

export const CHARACTER_ROLES = ["Protagonists", "Supporting"] as const;

// All five supporting characters were named in Rockstar's official character bios
// (May 2026) — primary Rockstar material, not just trailer sightings.

const RC = "Named in Rockstar's official character bios (May 2026); seen in Trailer 2 (public reporting)";

export const CHARACTERS: Character[] = [
  // ── Protagonists ──
  {
    slug: "lucia-caminos", name: "Lucia Caminos", kind: "character",
    role: "Protagonist",
    evidence: { status: "rockstar-confirmed", detail: "Named by Rockstar in Trailer 2 and on the official site" },
    summary: "Fresh out of Leonida Penitentiary and done playing by the rules. Taught to fight by her father and locked up for fighting for her family, Lucia is the emotional core of GTA 6's story — and the series' first mandatory female lead.",
    tags: ["protagonist", "playable"],
  },
  {
    slug: "jason-duval", name: "Jason Duval", kind: "character",
    role: "Protagonist",
    evidence: { status: "rockstar-confirmed", detail: "Named by Rockstar in Trailer 2 and on the official site" },
    summary: "Wants an easy life; keeps getting a harder one. An Army stint didn't shake his troubled youth, and he ended up running for drug crews in the Leonida Keys — until meeting Lucia changed everything.",
    tags: ["protagonist", "playable"],
  },
  // ── Supporting ──
  {
    slug: "cal-hampton", name: "Cal Hampton", kind: "character",
    role: "Supporting", affiliation: "Jason's circle",
    evidence: { status: "rockstar-confirmed", detail: RC },
    summary: "Conspiracy theorist, Jason's friend, and fellow associate of Brian Heder — the guy who sees patterns in everything, including, probably, your last three missions.",
    tags: ["supporting", "jason-ally"],
  },
  {
    slug: "boobie-ike", name: "Boobie Ike", kind: "character",
    role: "Supporting", affiliation: "Vice City business scene",
    evidence: { status: "rockstar-confirmed", detail: RC },
    summary: "A former street hustler who went legit — real estate, music, and whatever else pays. The kind of businessman whose past keeps knocking.",
    tags: ["supporting", "business"],
  },
  {
    slug: "drequan-priest", name: "Dre'Quan Priest", kind: "character",
    role: "Supporting", affiliation: "Music scene",
    evidence: { status: "rockstar-confirmed", detail: RC },
    summary: "Street hustler grinding to break into the music industry, partnered with Boobie Ike. Ambition like that always finds trouble in Vice City.",
    tags: ["supporting", "music"],
  },
  {
    slug: "real-dimez", name: "Real Dimez", kind: "character",
    role: "Supporting", affiliation: "Music scene",
    evidence: { status: "rockstar-confirmed", detail: RC },
    summary: "Bae-Luxe and Roxy — a rap duo chasing viral fame in Leonida's music scene, signed to Only Raw Records after an early hit with DWNPLY.",
    tags: ["supporting", "music"],
  },
  {
    slug: "raul-bautista", name: "Raul Bautista", kind: "character",
    role: "Supporting", affiliation: "Heist crew",
    evidence: { status: "rockstar-confirmed", detail: RC },
    summary: "A veteran bank robber always hunting for new talent — and getting more reckless with every score, per his official bio.",
    tags: ["supporting", "heists"],
  },
];
