# GTADB Dataset Import Pipeline — SPEC (v1.0, 2026-09-24)

**Scope:** Pre-launch import plan for the community landmark dataset derived from
gtadb.org data (as bundled in the `navanem/gta6-leonida-atlas` repo) into GTA6mapx.
This is a **SPEC ONLY** — no code, no import run, no deployment.

**Design constraints carried in:**
- GTA 6 only. Fan-platform framing; no affiliation with Rockstar/Take-Two.
- Leak Transparency Engine: every imported item carries an evidence chain; imported
  data is **never** presented as fact.
- **License hard lines:** the Atlas repo's CODE is AGPL-3.0 → never read-to-copy,
  never reproduce it (including its coordinate-transform code). The underlying
  gtadb.org-derived DATA is documented CC BY 4.0 → usable with attribution.
  **Attribution text is NOT added by this pipeline** — the owner adds it himself
  before public deploy (pre-launch blocker already recorded in memory).

---

## Stage 0 — Source definition & reproducibility

### 0.1 Pinned source
- **Data origin:** gtadb.org community map data (sourced by the Atlas project from
  `rolux/gtadb.org`, pinned revision `7c3f8c295d64254e6b6d269b77c6f84fc4339f9c`).
- **Dataset carrier:** `navanem/gta6-leonida-atlas` — clone **only** at the pinned
  commit the dataset was last verified against. Never fetch from `main`/`HEAD` at
  build time; the community map evolves daily and a floating ref is not reproducible.
- **What we read from it:** the data file(s) (JSON) and their README/license notes
  ONLY. **Do not open, read, or copy any `.ts`/`.js`/`.py` transform or mapping code.**

### 0.2 Fetch procedure (staging, not the site)
1. `git clone --no-checkout` the Atlas repo into a scratch dir, then
   `git checkout <pinned-commit> -- <data-file-path(s)>`.
2. Copy the checked-out data file(s) into the staging directory (below).
3. Verify the snapshot: record file paths, byte sizes, SHA-256 per file, and the
   source commit. Any later re-fetch must reproduce identical hashes or it is a
   **different dataset** and requires a fresh review.

### 0.3 Staging location & versioning
- Staging dir: `~/workspace/gta6mapx/research/staging/gtadb/<SOURCE_COMMIT>-<FETCH_DATE>/`
  (e.g. `staging/gtadb/220d740338bc-2026-09-24/`).
- Inside: `dataset/` (raw JSON), `MANIFEST.md` (source repo, commit, file paths,
  SHA-256 hashes, fetch date, CC BY 4.0 license note), `FIELD-INVENTORY.md`
  (the exact field names/types found in the snapshot — see Stage 3).
- **Nothing from staging is read by the Next.js app at runtime.** Staging is
  build-time input only; the site consumes only files the review pipeline emits
  into `web/src/modules/entities/data/`.

### 0.4 Quality inventory of the snapshot (from prior scan; re-verify at fetch)
- 2,198 records total; 2,091 with coordinates.
- 572 have real (non-"?" ) names: 540 classified SUPPORTED, 32 classified UNKNOWN.
- 1,626 are effectively unnamed `"?"` pins.
- Records missing coordinates are **dropped at staging** (no pin without a position).

---

## Stage 1 — Coordinate transform (independently written math spec)

**Problem:** dataset coordinates are in GTADB's game-world frame (an abstract
in-game coordinate space). GTA6mapx's current map frame is placeholder Florida
lat/lng rendered on real-world vector tiles (MapLibre + OpenFreeMap, default
center ≈ Miami `25.7617, -80.1918`). Custom Leonida tiles are not built yet.

**The transform must be written from first principles by our own implementation.
It is a clean-room re-derivation — similarity/affine fitting is standard math,
not Atlas IP.**

### 1.1 Frame definitions
- **Source frame S:** GTADB game-world coordinates `(x, y)` (or `(x, z)` depending
  on the snapshot's field layout — confirmed at Stage 0.3 field inventory).
  Units are arbitrary game units; axes orientation is confirmed empirically in §1.3.
- **Target frame T (Phase A — placeholder):** WGS84 lat/lng as used by the live
  `/map` (real Florida, `GameMap.tsx`).
- **Target frame T (Phase B — custom tiles):** the pixel/CRS frame of our future
  Leonida tile set. The re-fit procedure for Phase B is in §1.5.

### 1.2 Transform model — affine fit via least squares
Model (6 parameters):

```
lat = a·x + b·y + c
lng = d·x + e·y + f
```

Rationale: an affine map captures translation, rotation, uniform/non-uniform
scale and axis skew — everything a game-world→flat-map projection needs for a
fan-map use case. A projective (8-param) fit is allowed as an experiment, but
affine is the default: fewer parameters, less overfitting to sparse control
points, and it keeps residuals honest.

### 1.3 Control-point selection (independent, no Atlas implementation involved)
Control points are pairs: `(game-coord from the dataset) ↔ (lat/lng we assign)`.
Selection rules:

1. **Choose 6–10 landmarks that are unambiguous in both frames.** Candidates must
   be *independently* known: our 28 hand-written locations plus real-world
   Florida anchors they map to, e.g.:
   - Ocean Drive ↔ real Ocean Drive, Miami Beach
   - Vice Beach ↔ Miami Beach shoreline
   - Vice City Port ↔ Port of Miami
   - Vice City International Airport ↔ Miami International Airport area
   - Leonida Keys chain ↔ Florida Keys chain (2–3 anchor islands, e.g. the
     southernmost key and the bridge midpoint)
   - Grassrivers ↔ Everglades interior
   - Malibu Club ↔ a fixed point inside the beach district
2. **Spread across the whole map** (north/south/east/west + center). A fit with
   all points clustered in Vice City is invalid — extrapolation to the Keys or
   northern forests will be garbage.
3. **Each point gets a confidence weight** (e.g. Ocean Drive = high, "southernmost
   key" = medium). Fit is weighted least squares so fuzzy anchors don't drag the fit.
4. **Do not copy Atlas's control points, its transform code, or its map.** Our
   anchors are our own (real Florida geography + our editorial locations). The
   least-squares math itself is textbook and not anyone's IP.
5. Empirically confirm axis orientation first: plot a handful of points through a
   naive identity map and check that, e.g., the Keys chain extends *south*
   (negative lat direction) and the northern forest points land *north*.
   Flip/swap axes in the model before fitting if needed — this is standard
   coordinate-handshake, not copied work.

### 1.4 Validation — residuals and spot checks
1. **Leave-one-out cross-validation:** fit on N−1 points, predict the held-out
   point, record error. Repeat for all N.
2. **Thresholds (Phase A, placeholder Florida frame):**
   - RMSE over held-out predictions ≤ **5 km** → acceptable for a fan-map
     placeholder (pins are "approximate location" markers, and the frame itself
     is admitted placeholder).
   - Any single held-out error > **15 km** → the control set is bad (wrong
     anchor assignment or mislabeled dataset point); do not ship the fit —
     re-examine that anchor.
3. **Visual spot checks on `/map`:** overlay transformed named landmarks on the
   live map and eyeball against real Florida geography — Keys pins must sit on
   the island chain, the port pin on a coastline, the airport pin near an
   airfield. Screenshot and file the spot-check in staging.
4. **Sanity rules:** pins must not land in the Atlantic where land is expected
   (Vice City pins over open ocean = broken transform); pins for the northern
   forest must be north of the city pins. Any violation = stop and re-fit.
5. **Version the transform:** store the 6 coefficients, control-point list (with
   weights), RMSE, and the dataset commit it was fit against in staging
   (`transform-v1.json`). Every future re-fit bumps the version.

### 1.5 Phase B — re-fit when custom Leonida tiles replace the placeholder frame
The placeholder fit **does not transfer**. When our own tile pipeline ships:
1. Define the tile frame's anchor set: the same named landmarks, now located at
   known positions in *our* tile coordinates (read from our tile source, not
   copied from any external project).
2. Re-run §1.2–§1.4 against the new target frame → `transform-v2.json`.
3. Re-transform ALL staged coordinates (both pins and approved entity records).
4. Re-run the full residual validation and visual spot-check suite before any
   re-fitted coordinate reaches the site.
5. Tighter thresholds are expected in Phase B (real Leonida geometry) — set them
   then; the pipeline must support them without re-architecture.

---

## Stage 2 — Classification & routing

| Bucket | Count (re-verify) | Route | Entity/SEO pages? |
|---|---|---|---|
| Named, SUPPORTED confidence | ~540 | **Human review queue** — reviewer approves/rejects each record; approved ones become curated `GameLocation` entries | Only after manual approval |
| Named, UNKNOWN confidence | ~32 | **Human review queue, pre-labeled `disputed`** — higher scrutiny | Only after manual approval |
| Unnamed (`"?"` pins) | ~1,626 | **Map pins only** — density layer on `/map`, no metadata pages | **Never** — no `/locations/unknown-123` low-quality URLs |

Hard rules:
- **No auto-publish, ever.** The review queue is the only path from "dataset
  record" to "entity page."
- Unnamed pins are a *visual layer only*: rendered as small markers with at most
  a category label (e.g. "unnamed landmark — community data"). They are excluded
  from sitemap, search, and the locations hub.
- Records without coordinates are dropped at staging (§0.4).

---

## Stage 3 — Schema mapping: dataset fields → `GameLocation`

### 3.1 Field inventory first
The implementer reads **only the data JSON** at the pinned commit and records
every field name/type in `staging/.../FIELD-INVENTORY.md`. Expected fields (to be
confirmed — adjust mapping if names differ):
- `name` (string; `"?"` = unnamed bucket)
- coordinate fields (e.g. `x`, `y`/`z`; units arbitrary)
- `confidence` (enum like `SUPPORTED` / `UNKNOWN`)
- `category`/`type` (enum: landmark, business, nature, transport, …)

### 3.2 Mapping template (dataset → `GameLocation` in `modules/entities/types.ts`)
| Dataset field | → | `GameLocation` field | Notes |
|---|---|---|---|
| `name` | → | `name` | Normalized (trim; collapse whitespace). |
| transformed coords | → | **new optional fields** `lat?: number; lng?: number` on `GameLocation` | Add to `types.ts` during pipeline implementation. Until then, transformed coords live only in the staging/review artifacts. |
| `confidence` | → | informs `evidence.status` default (§4.1), not mapped 1:1 | |
| `category` | → | `tags[]` | Mapped through an allow-list dictionary (`dataset category → our tag`); unknown categories → tag `community-data`. No invented tags. |
| — | → | `region` | **Reviewer-assigned** from the nearest known region (Vice City, Leonida Keys, …); never auto-derived from a leak map label. |
| — | → | `realWorldInspiration` | Optional; reviewer fills only when it is safe (real Florida analog). Blank is fine. |
| — | → | `summary` | **Written by the reviewer** — original editorial text only, ≥ 50 chars (§4.2). Never copied from the dataset or any source. |
| — | → | `evidence` | See §4.1. Populated with `sourceUrl` = canonical gtadb.org dataset link + revision note (no other external URLs unless the reviewer verifies them). |
| — | → | `slug` | Derived via existing `slugify()`; collisions handled in §5. |

### 3.3 The 32 UNKNOWN-confidence named records
- Routed to review pre-labeled `disputed` with `detail` noting "UNKNOWN confidence
  in source dataset".
- Higher bar for approval: reviewer must find an independent public source
  (trailer/leak reporting) before upgrading to `leak-reported`; otherwise they
  stay `disputed` or are rejected.
- If approved, their pages carry the disputed badge and the dataset confidence
  note in the evidence detail — transparency, not laundering.

---

## Stage 4 — Quality gates (before ANY page is created from imported data)

### 4.1 Evidence-status assignment — defaults are pessimistic, never auto-confirm
- Default for imported named records: **`leak-reported`** ("community dataset,
  gtadb.org-derived, rev `<commit>`").
- UNKNOWN-confidence records: default **`disputed`**.
- **`rockstar-confirmed` / `trailer-confirmed` are never auto-assigned.** A
  reviewer may upgrade only with a verifiable citation (official announcement,
  trailer timestamp) that they check themselves.
- The review tool shows the reviewer a one-click "evidence status" picker with
  the four statuses and their definitions from `EVIDENCE_META`.

### 4.2 Required fields per approved record
`name` · transformed `lat/lng` · `region` (reviewer-assigned) · `evidence.status`
· `evidence.detail` (mentions dataset + revision) · `evidence.sourceUrl` ·
`summary` (original editorial, ≥ 50 chars, no copied text) · `tags[]` (from
allow-list) · `slug` (unique). Any missing field = cannot approve.

### 4.3 Banned content
- No invented prices, stats, specs, gameplay mechanics, or opening-hours-style
  "facts" not present in the source data.
- No copying summaries/descriptions from gtadb.org, the Atlas UI, or any site —
  summaries are always rewritten.
- No hosting leaked images/video (standing rule) — entity pages link or cite
  textually like news outlets do.
- No score-based auto-publish and no auto-upgrade of evidence status (§4.1).

### 4.4 Manual approval step
- Review queue UI (admin-side, local): each candidate shows dataset name,
  transformed coords (with mini-map preview), category→tags, dedupe candidates
  (§5), evidence-status picker, and editable summary/region fields.
- Approve → record is written into `web/src/modules/entities/data/` (or the
  Supabase table once wired) as a normal curated `GameLocation`; Reject → logged
  with reason in staging (`review-decisions.json`).
- Approvals are batched per review session; the session log is committed with
  the data so the evidence chain is auditable.

### 4.5 Leak Transparency Engine fields
Every imported record, approved or not, carries:
- `evidence.status` per §4.1
- `evidence.detail`: e.g. `"Community dataset (gtadb.org-derived), rev 7c3f8c2 — pin approximate"` plus reviewer note for UNKNOWN records
- `evidence.sourceUrl`: canonical dataset source link recorded at fetch time
- On-page: the evidence badge + detail render exactly like existing records
  (no special "imported" second-class UI that could confuse the honesty model)

---

## Stage 5 — Dedupe against the 28 existing locations

Run AFTER transform (§1), BEFORE review — the reviewer sees dedupe candidates per
record.

### 5.1 Matching strategy (three signals)
1. **Name normalization:** lowercase → strip apostrophes (match `slugify()`
   behavior) → collapse whitespace/punctuation. Compare normalized names;
   flag near-matches (Levenshtein distance ≤ 2 on normalized name) as candidates.
   Also check an alias list (e.g. "VCIA" ≈ "Vice City International Airport") —
   the alias list is reviewer-curated, starts empty.
2. **Slug collision:** run the candidate name through the site's `slugify()`; if
   the slug already exists in `LOCATIONS` (or `VEHICLES`), it is a hard collision —
   the record cannot be approved under that slug without merge/rename.
3. **Coordinate proximity in the transformed frame:** nearest existing record
   within **2 km** (Phase A; tighten in Phase B) is a merge candidate even when
   names differ (datasets often label the same POI differently, e.g.
   "Malibu Club" vs "club building").

### 5.2 Merge vs keep-both rules
- **Same normalized name + within 2 km** → merge candidate (default suggestion:
  merge into the existing curated record, keeping the curated summary and
  appending the dataset as an additional evidence line).
- **Same name but > 10 km apart** → keep both, flag to reviewer (likely a
  dataset mislabel or a genuinely different place with a similar name);
  reviewer resolves with renamed slug if kept.
- **Within 2 km but different names** → reviewer decides (merge / keep-both /
  rename). The tool shows both names, distance, and both evidence statuses.
- **No match on any signal** → clean candidate, proceeds to normal review.

### 5.3 What the reviewer sees per candidate
Dataset name · transformed coords + mini-map · normalized-name matches (with
distance) · slug-collision verdict · nearest existing record + distance in km ·
the existing record's evidence status · suggested action (merge/keep-both/needs
decision) · one-click accept/reject of the suggestion.

---

## Stage 6 — Rollout order

1. **Fetch & stage** the pinned snapshot (§0). Verify hashes, write manifest +
   field inventory. (No site changes.)
2. **Write the transform independently** (§1.1–§1.3). Fit on control points,
   run LOOCV (§1.4), screenshot spot-checks. Transform is not used until it
   passes thresholds.
3. **Transform the unnamed 1,626** → pins-only density layer on `/map`.
   No pages, no sitemap entries. This is the lowest-risk visible win and
   exercises the transform at scale.
4. **Run dedupe** on the 572 named (§5) → populate the review queue (§4.4).
5. **Reviewer (human) sessions:** approve/reject named records in batches;
   approved records enter `GameLocation` data with full evidence chains (§4).
6. **Ship approved pages** with the standard build (SSG + JSON-LD, same as the
   existing 28).
7. **Phase B (later):** when custom Leonida tiles ship → re-fit transform (§1.5),
   re-transform everything, re-validate, regenerate pins and record coords.
   Approved editorial content (summaries, regions) carries over; only geometry
   changes.

**"Do not" list**
- Do NOT bulk-import anything into the site — every named record passes human review.
- Do NOT read, copy, or re-implement any code from the Atlas repo (AGPL-3.0);
  the transform is clean-room math (§1).
- Do NOT write attribution/credit text into the site — the owner adds it himself
  before public deploy (license pre-launch blocker).
- Do NOT create entity/SEO pages for unnamed `"?"` pins — pins only, no URLs.
- Do NOT auto-assign `rockstar-confirmed`/`trailer-confirmed` — defaults are
  `leak-reported` / `disputed`.
- Do NOT invent fields (prices, specs, descriptions) the dataset doesn't carry.
- Do NOT fetch from a floating branch at build time — pinned commit + hash
  verification only.
- Do NOT host leaked images/video — cite textually.
- Do NOT copy summaries from any source — reviewer-written, original.
- Do NOT deploy: this pipeline stages and prepares; launch/deploy is a separate,
  owner-confirmed step.

---

## Appendix A — Known numbers (re-verify at each fetch)

| Metric | Value (scan of 2026-09-24) |
|---|---|
| Total records | 2,198 |
| With coordinates | 2,091 |
| Named (non-"?" ) | 572 (540 SUPPORTED, 32 UNKNOWN) |
| Unnamed "?" | 1,626 |
| Existing curated locations | 28 (`modules/entities/data/locations.ts`) |
| Source dataset revision | gtadb.org pin `7c3f8c295d64254e6b6d269b77c6f84fc4339f9c` |

## Appendix B — 3 biggest risks (for the parent's summary)

1. **Transform error = wrong pins = the #1 trust killer.** Competitor research
   says misplaced locations destroy fan-map trust fastest. Mitigation: weighted
   least-squares on independently chosen spread control points, LOOCV residuals
   with hard thresholds, visual spot-checks, and a full re-fit (not a tweak) when
   custom tiles ship.
2. **Evidence contamination at scale.** 572 named records from a community
   dataset will contain mislabels, duplicates, and speculation. One careless
   bulk step turns our "Leak Transparency Engine" into a leak-laundering engine.
   Mitigation: human review queue with pessimistic default statuses, banned
   auto-upgrades, original summaries only, dedupe with keep-both safety.
3. **License boundary.** AGPL-3.0 code (never copy, including the transform
   implementation) vs CC BY 4.0 data (usable with attribution). The pre-launch
   blocker stands: owner-added attribution must be live on the site before any
   public deploy, or the import ships a license violation with it.
