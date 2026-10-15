# Dedupe report — 510 staged named records vs 28 existing locations

Run 2026-09-24, after transform v1, before review. Nothing was merged or
deleted — hits below set `duplicateOf` on the staged record and await the
reviewer. Suggested actions follow the import spec §5.2.

## Method (three signals, per spec §5.1)

1. **Name normalization** — lowercase, strip apostrophes (mirrors the site's
   `slugify()`), collapse whitespace/punctuation; exact normalized-name
   matches and Levenshtein ≤ 2 flagged.
2. **Slug collision** — staged slug already exists in the 28 curated
   locations → hard collision, reviewer merges or renames.
3. **Coordinate proximity (≤ 2 km)** — **NOT APPLICABLE**: the 28 existing
   locations carry no coordinates, so there is nothing to measure against.
   Re-run this signal if curated locations ever gain lat/lng.

## Hits: 3 of 510

### 1. `gtadb-6-L304` "Starlet Motel" — SLUG COLLISION → `duplicateOf: "starlet-motel"`
- Staged: name "Starlet Motel", district "Kelly County", categories
  `[demolished, hotel]`, confidence `unknown` → evidence `disputed`,
  rawCoords `[-5344.17, 3526.86]`, transformed `(25.954134, -80.318936)`,
  `needsCoordVerification: true` (extrapolated far region).
- Existing: "Starlet Motel", region "Port Gellhorn", evidence `leak-reported`
  ("Abandoned motel in Port Gellhorn").
- Suggested action: **merge candidate, reviewer decides**. Same normalized
  name + identical slug, but districts disagree (Kelly County vs Port
  Gellhorn) and the staged record is `demolished`/`disputed` while the
  curated one is `leak-reported`. Do not auto-merge: reviewer checks whether
  these are the same motel or a dataset mislabel, then merges (keeping the
  curated summary + appending the dataset as an evidence line) or keeps both
  with a renamed slug.

### 2. `gtadb-6-L16` "Y Vice City" — near-name (lev 1) vs "Vice City"
- Staged: name "Y Vice City", district "Vice Beach", categories `[hotel]`,
  confidence `supported` → `leak-reported`, rawCoords `[1951.75, 1591.84]`,
  transformed `(25.807105, -80.108698)`, `needsCoordVerification: false`.
- Existing: "Vice City" (the city itself, `rockstar-confirmed`).
- Suggested action: **reviewer decides — almost certainly NOT a duplicate**.
  "Y Vice City" is a hotel name containing the city name; the curated record
  is the entire city. Keep both; no slug conflict (`y-vice-city`).

### 3. `gtadb-6-L1500` "Catalan Bay" — near-name (lev 2) vs "Catalan Key"
- Staged: name "Catalan Bay", district "Leonida", categories `[natural]`,
  confidence `supported` → `leak-reported`, rawCoords `[440.98, -151.59]`,
  transformed `(25.767927, -80.173178)`, `needsCoordVerification: false`.
- Existing: "Catalan Key" (island, `disputed` CYBERLEEK leak).
- Suggested action: **reviewer decides — likely different things** (a bay vs
  a key). Keep both unless the reviewer finds they refer to the same place;
  no slug conflict (`catalan-bay`).

## Near-misses NOT flagged (reviewer may want a look)

- `gtadb-6-L266` "Jason's House" (Key Lento, `residential`+`safehouse`) vs
  existing "Jason's Safehouse" (Leonida Keys). Normalized names differ by
  more than lev 2, so no automatic flag — but they may describe the same
  place. No slug conflict (`jasons-house`).
- `gtadb-6-L530` "Mount Kalaga" vs existing "Mount Kalaga National Park"
  (`mount-kalaga` vs `mount-kalaga-national-park`). Different granularity
  (peak vs park); keep both unless reviewer merges.
- `gtadb-6-L2183` "Ocean Beach Pharmacy" vs existing "Ocean Beach" — a shop
  *in* the district, not the district. No action.

## Curated names with NO staged counterpart (dropped, no coordinates)

These existing locations matched dataset names but their records had `[]`
coordinates, so they were dropped at staging (§0.4) and produced no hit:
- "Malibu Club" (`L1392`, Vice Beach — categories `[events, leisure]`)
- "Monument of Leonida" (`L987`, Leonida — `[events, landmark]`)
- 60 further named records (forests, memorials, motels, …) — full list in
  the build log; re-stage if coordinates ever appear upstream.

## Internal dataset duplicates (not vs the site)

3 unnamed pin records carry `duplicate-of-<n>` workflow tags
(`duplicate-of-1142`, `-643`, `-823`). They stay as pins; the review tool
should surface the tag if a nearby named record is approved.

## Result

- `duplicateOf` set on **1** staged record (`gtadb-6-L304` → `starlet-motel`).
- 507 staged records are clean candidates for normal review.
- 0 slug collisions within the staging set itself.
- Proximity signal pending until curated locations have coordinates.
