# gtadb/ — staging database (gtadb.org-derived, GTA VI)

**STAGING ONLY — not wired into any page, route, or barrel.**
Nothing in this directory is read by the Next.js app at runtime. It is
build-time input for the human review queue. Nothing auto-publishes:
named records become entity pages only after manual approval; pins are a
map density layer only.

## Source & provenance

- Dataset: gtadb.org community landmark dataset (GTA VI), file
  `map/data/6/landmarks.json` at pinned revision `7c3f8c2`
  (`rolux/gtadb.org` rev `7c3f8c295d64254e6b6d269b77c6f84fc4339f9c`).
- Discovered via `navanem/gta6-leonida-atlas` (used only to locate the data
  file — **no code was read or copied**; the Atlas code is AGPL-3.0).
- Fetched 2026-09-24 from `raw.githubusercontent.com` at the pinned
  revision. Raw snapshot kept ephemeral in `/tmp/gtadb_raw/`; SHA-256
  hashes recorded in `manifest.json` (re-fetch must reproduce them).
- `map/data/4` (GTA IV) and `map/data/5` (GTA V) were fetched for
  completeness but are NOT used — GTA 6 only.
- License (internal note): underlying gtadb.org-derived data is documented
  CC BY 4.0 (usable with attribution). **No attribution/credit text is added
  to the site by this pipeline — the owner adds it himself before public
  deploy (pre-launch blocker).**

## Raw record layout

Each dataset entry is a positional array:
`[name, gameCoords[x,y], screenshotSize[w,h], realWorldAnalog, analogLatLng,
sourceMapPixels, categories[], datasetId, timestamps[]]`.
`name` is `"POI, District"` or `"?"` (unnamed; variants `"? (N)"` etc.).
`datasetId` is NOT unique — staging ids are `gtadb-6-L<n>` from the
record keys.

## Files

| File | Contents |
|---|---|
| `manifest.json` | Source repo, pinned rev, fetch date, file paths + SHA-256, record counts, transform v1 (coefficients, control points, LOOCV validation, rejected experiments), license note. |
| `schema.ts` | TS types: `StagedNamedRecord`, `StagedPin`, supporting types. |
| `transform.ts` | Clean-room affine transform (coefficients, control points, validation docs, `applyTransformV1`, weighted-LS fitter for Phase B re-fit). |
| `cars.json` | Named records, owner bucket `cars` — **empty**: landmark dataset has no vehicle data. File exists to keep the bucket set stable. |
| `locations.json` | 300 named POI records (hotels, residential, landmarks, industry, transport, nature, …). |
| `cities.json` | Named records, owner bucket `cities` — **empty**: no settlement-level records in the dataset (districts are implied via the `district` field, not records). |
| `stores.json` | 66 named retail/restaurant records. |
| `others.json` | 144 named records with only workflow/editorial tags (or no categories). Reviewer re-buckets or rejects. |
| `pins.json` | 1,581 unnamed `"?"` records: id + transformed coords + raw coords + owner bucket. **Pins NEVER become pages** (no name/slug/evidence fields by design). |
| `dedupe-report.md` | Dedupe of the 510 named records against the 28 existing locations. |
| `README.md` | This file. |

## Counts (re-verified at fetch — differ slightly from the earlier scan)

| Metric | Value |
|---|---|
| Raw records (GTA VI file) | 2,198 |
| With coordinates | 2,091 (107 dropped at staging — no pin without a position) |
| Named, staged (review queue) | 510 — of which 396 `supported` → `leak-reported`, 114 `unknown` → `disputed` |
| Unnamed, staged (pins only) | 1,581 |
| Owner buckets (named) | locations 300 · stores 66 · others 144 · cars 0 · cities 0 |
| Dedupe hits vs 28 existing | 3 (see `dedupe-report.md`) |
| Review queue size | **510** |

Note: the earlier scan quoted 572 named / 1,626 unnamed — that counted
records WITHOUT coordinates too (585 / 1,613 in this snapshot). Per the
import spec §0.4, records without coordinates are dropped at staging, hence
510 / 1,581.

## Transform summary (full story in `transform.ts`)

- Model: affine, weighted least squares (clean-room implementation).
- v1 is **metro-anchored** (7 control points: Vice Beach, Vice City,
  Port Vice City, VCIA, Leaf Links, Rialto Islands, Starfish Island →
  their Miami counterparts). LOOCV RMSE **5.41 km** (spec bar 5.0 —
  marginally above, accepted as approximate-grade), max held-out
  **8.82 km** (bar 15 — passes).
- Two alternatives were tried and rejected (documented in `transform.ts`
  and `manifest.json`): street-address analog targets (RMSE 584 km) and
  9 region anchors incl. far regions (RMSE 168 km). Root cause: Leonida is
  a fictional rearrangement — the metro is drawn ~20–36× larger relative
  to the state than real Florida, so no single affine fits both.
- Every record stores BOTH `rawCoords` (game frame) and `coords`
  (placeholder Florida). `needsCoordVerification: true` on 294/510 named
  records outside the validated metro zone (extrapolated, unverified);
  216 inside the zone are interpolated between validated anchors.
- **Never ship false precision**: transformed coords are approximate
  placeholders. Phase B (custom Leonida tiles) requires a full re-fit.

## Category mapping (gtadb tags → owner buckets)

- `stores`: `retail`, `restaurant`
- `locations`: `hotel`, `residential`, `landmark`, `leisure`, `public`, `government`, `office`, `utilities`, `industrial`, `infrastructure`/`infr`, `transportation`, `construction`, `agriculture`, `natural`, `safehouse`, `events`, `service`, `point-of-interest`
- `others`: workflow/editorial tags only (`unconfirmed`, `demolished`, `todo`, …) or no categories
- `cars`, `cities`: no source data (empty arrays, documented)
- Normalizations: tags lowercased; `redisential` → `residential` (dataset typo).
- Confidence `unknown` (→ evidence `disputed`) when any tag is in
  `{unconfirmed, uncomfirmed, may-not-exist, maynot exist, cancelled,
  demolished, address-ambiguous, todo, fictional, maybe-reused,
  make-more-specific-later, duplicate-of-*}` or the name ends with `?`
  (29 names, e.g. "Leaf Links Golf Club?").

## Evidence defaults

- `supported` → `leak-reported` ("community dataset, gtadb.org-derived, rev 7c3f8c2 — pin approximate")
- `unknown` → `disputed` (with the dataset-confidence note)
- `rockstar-confirmed` / `trailer-confirmed` are NEVER auto-assigned.

## Wiring warning

**Do not import anything from this directory in pages, routes, or barrels.**
`npm run build` must pass with these files present but unreferenced. The
only sanctioned consumer is a future admin review-queue tool, which reads
the JSON at build/dev time.
