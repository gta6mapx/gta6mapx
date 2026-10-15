// ─── Dedupe candidates vs curated data (structured from dedupe-report.md) ─────
// Structured notes for the admin review queue. duplicateOf slugs are set on
// the staged records themselves; near-misses are advisory only.

export interface DedupeCandidate {
  stagedId: string;
  stagedName: string;
  type: "slug-collision" | "near-name";
  note: string;
  suggestedAction: string;
}

export const DEDUPE_CANDIDATES: DedupeCandidate[] = [
  {
    stagedId: "gtadb-6-L304",
    stagedName: "Starlet Motel",
    type: "slug-collision",
    note: 'Slug "starlet-motel" already exists in curated locations ("Starlet Motel", region Port Gellhorn, leak-reported). Staged record: district Kelly County, categories [demolished, hotel], confidence unknown → disputed, extrapolated coords.',
    suggestedAction:
      "Reviewer decides: merge (keep curated summary + append dataset as evidence line) or keep both with a renamed slug. Do not auto-merge — districts and evidence disagree.",
  },
  {
    stagedId: "gtadb-6-L25",
    stagedName: "Dominion Hotel",
    type: "slug-collision",
    note: 'Slug "dominion-hotel" already exists in curated locations ("Dominion Hotel", region Vice City, trailer-confirmed). Staged record: district Vice Beach, category [hotel], confidence supported → leak-reported.',
    suggestedAction:
      "Reviewer decides: likely the same hotel — merge (keep curated summary + append dataset as evidence line) or reject as duplicate. Renaming the slug keeps both only if they are genuinely different buildings.",
  },
  {
    stagedId: "gtadb-6-L16",
    stagedName: "Y Vice City",
    type: "near-name",
    note: 'Near-name match (lev 1) vs curated "Vice City" — but the curated record is the city itself (rockstar-confirmed); the staged record is a hotel named "Y Vice City" in Vice Beach.',
    suggestedAction: "Almost certainly NOT a duplicate. Keep both; no slug conflict.",
  },
  {
    stagedId: "gtadb-6-L1500",
    stagedName: "Catalan Bay",
    type: "near-name",
    note: 'Near-name match (lev 2) vs curated "Catalan Key" (disputed CYBERLEEK island). A bay vs a key — likely different things.',
    suggestedAction: "Keep both unless reviewer finds they refer to the same place. No slug conflict.",
  },
  {
    stagedId: "gtadb-6-L266",
    stagedName: "Jason's House",
    type: "near-name",
    note: 'Advisory (not auto-flagged): may describe the same place as curated "Jason\'s Safehouse" (Leonida Keys).',
    suggestedAction: "Reviewer eyeballs before approving.",
  },
  {
    stagedId: "gtadb-6-L530",
    stagedName: "Mount Kalaga",
    type: "near-name",
    note: 'Advisory: vs curated "Mount Kalaga National Park" — different granularity (peak vs park).',
    suggestedAction: "Keep both unless reviewer merges.",
  },
];
