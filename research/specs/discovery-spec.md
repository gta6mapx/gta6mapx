# Discovery Spec — Search / Filters / Markers
**Project:** GTA6mapx.com · Phase 1 (spec only, no application code)
**Owner:** Discovery coordinator (search · filters · markers)
**Date:** 2026-09-24
**Status:** SPEC — to be implemented in Phase 2+ by the build team

---

## 1. What we observed (competitor notes — State of Leonida)

All findings below come from a read-only browser analysis of
`https://map.stateofleonida.net/`. **None of their code, markup, or text is
reproduced here** — only concepts, re-expressed in our own words for an
original implementation. Their code is AGPL-3.0 and their data carries its
own license; we treat the site as a research lead only.

### 1.1 Category model

- **~2,973 markers** split by *provenance* rather than by function:
  **Landmarks (2,791)** · **Leaks (42)** · **Trailer (93 — e.g. T1/01, T3/172)**
  · **Screenshots (~47)**.
- Every marker also carries **type tags** (RETAIL, RESIDENTIAL, LEISURE,
  TRANSPORTATION, GOVERNMENT, UTILITIES, NATURAL, HOTEL, CONSTRUCTION,
  INDUSTRIAL, EVENTS, OFFICE, PUBLIC, LANDMARK, RESTAURANT, AGRICULTURE,
  FICTIONAL, POINT-OF-INTEREST) and **#POI tags**
  (#NIGHTCLUB, #BAR, #BUS, #GAS, #SUPERMARKET, #SHOES, #TATTOOS,
  #ELECTRONICS, #GUNS, #STRIPCLUB, #HAIR, #CLOTHES, #SAFEHOUSE,
  #PAY'N'SPRAY).
- **Media-source tags (L1–L6)** record which leak batch / media a marker
  came from. **Status tags** record trust lifecycle:
  UNCONFIRMED, DEMOLISHED, CLOSED, CANCELLED, `//MAY-NOT-EXIST`,
  `//DOESNT-EXIST?`, ENTERABLE, REUSED. Uncertain names are prefixed `?`.
- Internal housekeeping tags (`//PINK`, `//GREEN`, `//BLUE`, `//TODO`,
  `//DUPLICATE-OF-1142`, `//ADDRESS-AMBIGUOUS`) are used by their mappers.

**Observation:** mixing *provenance* (Trailer/Leaks) into the category tabs
conflates "what is this thing" with "how do we know it exists". Their rumor
handling is informal — tags and `?` prefixes — with no single formal toggle.

### 1.2 Marker popup / detail panel content blocks

Verified on a Landmark popup and a Trailer popup. Each shows:

1. Marker **name** (with `?` prefix when uncertain)
2. **Tag chips** (type + status + media-source tags)
3. **Photo** — real-life reference photo for landmarks; in-game/trailer
   still for trailer markers
4. **Real-life address** or Google plus-code link
5. **Game coordinates** (their custom X/Y frame, e.g. `X: -3407.500,
   Y: -2809.500`)
6. **Marker ID + last-edited timestamp** (e.g. `L1006`, edited 16.09.2026)
7. **Action buttons**: GTA Wiki link, "Full View", "Go to Location",
   "Go to Real-Life", Google Earth, copy-link, share-link

### 1.3 Search & filter behavior

- **Marker search box** — name-based matching (tested: "casino" → 13 hits).
- **Tag filter dropdown** with opaque semantics.
- **Sort**: ID or Name A–Z.
- **Category tabs** (All / Landmarks / Leaks / Trailer / Screenshots) with
  per-category counts.
- **Marker clustering** with user-selectable cluster color schemes
  (Default / Site Color / Leonida / Ocean / Mono / Custom).
- **Coordinate search** ("Go to Position") for their custom X/Y frame, plus
  a "Marker Finder" mode.
- **Deep links**: `?marker=L1006`, `?marker=trailer1_003`, `?credits`; the
  page title/description update per marker (per-marker SEO pages).

### 1.4 Bugs we must NOT repeat (observed)

1. **Stale "selected" state:** after clearing the search box, the text
   "13 selected" persisted — clear did not reset selection affordances.
2. **Contradictory empty state:** "No markers found" appeared while matches
   were still selected — the empty-state and the results list read from
   different state.
3. **Unexplained counter mismatch:** "2749 MARKERS" vs "2973 Markers loaded"
   with no label explaining what each number means.
4. **Mixed-language UI:** German labels ("Koordinatensuche",
   "Zur Position", "Anwenden", "Klein/Mittel/Groß") appear even in English
   mode.
5. **Tile seams / blank purple grid** at some zoom transitions (engine
   domain, noted for awareness).
6. **Settings not persisted** ("Your settings are not being saved" —
   session-only).

---

## 2. Mapping their model onto OURS

### 2.1 Evidence statuses — their informal tags → our Leak Transparency Engine

Our engine has **four formal statuses** (defined in
`src/modules/entities/types.ts`). Every marker MUST carry exactly one.

| Their informal signal | Our formal status | Rule |
|---|---|---|
| Official Rockstar announcement / press materials | `rockstar-confirmed` | Only when Rockstar itself announced it |
| Marker sourced from an official trailer/screenshot, clearly visible (their Trailer/Screenshot categories, media stills) | `trailer-confirmed` | "Clearly visible in official trailer/promo" |
| Marker sourced from leaked footage (their Leaks category, L1–L6 leak-batch tags) | `leak-reported` | Unverified; presented as rumor, never as fact |
| Leak whose authenticity is questioned (`//DOESNT-EXIST?`, `//MAY-NOT-EXIST`, `?`-prefixed names, community dispute) | `disputed` | Included for transparency, labeled as questioned |

**Design rule:** provenance is a *filter dimension*, never a category tab.
Their Landmarks/Leaks/Trailer/Screenshots tabs become our **Evidence**
filter (4 chips). Categories stay *functional* (see §3.3).

### 2.2 Lifecycle tags — a separate dimension, not evidence

Their DEMOLISHED / CLOSED / CANCELLED / ENTERABLE tags describe a
**lifecycle/availability state**, orthogonal to evidence. A marker can be
`trailer-confirmed` AND `closed`. Our model adds an optional, separate field:

```
availability?: "open" | "closed" | "demolished" | "cancelled" | "enterable"
```

- Rendered as a small neutral chip in the popup ("Reported closed"),
  never merged into the evidence badge.
- Their `//DUPLICATE-OF-1142`, `//TODO`, `//PINK`, `//ADDRESS-AMBIGUOUS`
  tags are **internal moderation tags** — stored for the review queue, never
  rendered publicly.

### 2.3 Their type / #POI tags → our tag taxonomy

Their type tags (RETAIL, TRANSPORTATION, HOTEL…) and #POI tags map onto our
existing `Entity.tags: string[]` plus map-category membership:

- **Category** (single, functional): collectibles · stores-services ·
  missions · vehicles · secrets · stunt-jumps — our existing `CATEGORIES`.
- **Tags** (many): nightclub, bar, gas, supermarket, tattoos, guns,
  stripclub, hair, clothes, safehouse, pay-n-spray, beach, hotel,
  restaurant, … lowercase, hyphenated, from a controlled vocabulary.
- **Rule:** tags come only from the controlled vocabulary in the data file;
  free-text tags are rejected at review time.

### 2.4 Popups → our detail panel + entity deep-links

Their 7 popup blocks map onto our detail panel (§3.6) with two upgrades:

1. **Evidence chain block** replaces their informal tag chips — our
   formal badge + the `evidence.detail` string (e.g. "Trailer 2 @ 0:42")
   + public source link when one exists. This is our differentiator; it
   must be the most prominent block after the name.
2. **Entity deep-link**: where a marker corresponds to a curated entity
   (33 locations, 58 vehicles, 29 weapons, 7 characters), the panel links
   to its existing SEO page (`/vehicles/[slug]` etc.). This is the
   "Open full intel →" action. Non-entity pins (collectibles, stunt jumps)
   get the same panel without the entity link.

### 2.5 Current-state reconciliation (important)

`src/data/pins.ts` currently uses an **older 3-tier certainty**
(`confirmed | likely | speculation`) that predates the Leak Transparency
Engine. **Decision: migrate all pins to the 4-status engine before
building the new discovery layer** (Phase A checklist). The `/map` page
metadata text ("Confirmed / Likely / Speculation") is updated in the same
pass. Mapping: `confirmed` → `rockstar-confirmed`; `likely` →
`trailer-confirmed` (review each pin — some "likely" pins are leak-sourced
and become `leak-reported`); `speculation` → `leak-reported` or `disputed`
per the rules in §2.1.

---

## 3. Build spec

### 3.1 Data model additions (spec — implement in Phase A)

Extend the pin/entity model (backwards-compatible; matches the spirit of
`supabase/schema.sql`):

```ts
// Additions to the Pin concept (names illustrative — implementer chooses)
interface MapPin {
  id: string;                 // stable, e.g. "p1"; used in ?pin= deep links
  categorySlug: string;       // one of CATEGORIES
  name: string;
  tags: string[];             // controlled vocabulary, lowercase-hyphenated
  lat: number; lng: number;   // Leonida world frame (custom tiles, later)
  evidence: Evidence;         // THE 4-status engine — required, exactly one
  availability?: "open" | "closed" | "demolished" | "cancelled" | "enterable";
  region: string;             // e.g. "Vice City", "Port Gellhorn" — for search + sort
  updatedAt: string;          // ISO date — "Intel updated Sep 12, 2026"
  entityRef?: { kind: Entity["kind"]; slug: string }; // link to SEO page
  sourceUrl?: string;         // public source link only (never leaked files)
  internalTags?: string[];    // moderation only — NEVER rendered publicly
  description: string;        // original editorial summary — honesty-labeled
}
```

- **No invented data, ever.** Popups render only curated fields. Anything
  unknown is shown as "Unreported —" or omitted, never guessed. No fake
  prices, specs, spawn points, or gameplay claims.
- Photos: popups reserve a media block, but we ship with **original
  placeholder art** until we hold licensed/authorized imagery. **Never**
  hotlink or reproduce their trailer stills or real-life photos.

### 3.2 Unified search

- **Scope:** matches against name, tags, category name, and region.
  Case-insensitive, diacritic-insensitive.
- **Behavior:**
  - Debounced (~150 ms). Dataset ≤ ~5k markers filters synchronously;
    if async is ever needed, a generation token discards stale runs.
  - Dropdown shows top **8 results**, each row: pin name (truncated),
    category chip, evidence badge. Keyboard: ↓/↑ navigate, Enter flies
    to the highlighted result, Esc closes + clears.
  - Selecting a result: opens the detail panel, flies the camera to the
    pin (3D pitch preserved), **and clears the query** — one atomic state
    update (anti-bug R2).
  - Empty query → dropdown hidden, nothing rendered.
- **Empty state** (anti-bug R5): `No markers match "{query}"{filter context}.
  [Clear search & filters]` — one tap resets everything.
- **Search must not filter the map silently.** The map shows the filtered
  set; the result list is a navigation aid. Both read the same array
  (anti-bug R1).

### 3.3 Filter panel UI

**Desktop (sidebar, left, ~320px):**
1. Search box (with clear ✕ button that appears when query non-empty)
2. **Category tabs** — our 6 functional categories as toggle chips with
   **faceted live counts** (each tab's count = markers matching all OTHER
   active filters; see §3.4). "All" resets category filtering.
3. **Evidence filter** — 4 chips (Rockstar-confirmed / Trailer-confirmed /
   Leak-reported / Disputed leak), multi-select; default = all on.
4. **Tag filter** — collapsible chip group from the controlled vocabulary
   (shown tags = those present in the current filtered set, capped ~20,
   most frequent first).
5. **Found toggle** — All / Found / Not found (ties into existing progress).
6. **Sort** — dropdown (§3.5).
7. **Results summary line** — always visible: "Showing N of M markers"
   (anti-bug R3).

**Mobile (drawer):** floating "Filters" button toggles a bottom drawer
(existing pattern kept) containing the same blocks in stacked order;
collapsible to a slim bar. Touch targets ≥ 44px.

**Filter semantics:** OR *within* a dimension (any selected category),
AND *across* dimensions (category ∧ evidence ∧ tags ∧ found-state ∧
search). Exactly one rule, stated in the panel footnote so behavior is
predictable.

### 3.4 Category tabs with live counts

- Tabs: All · Collectibles · Stores & Services · Missions · Vehicles ·
  Secrets · Stunt Jumps — with each tab's icon.
- **Faceted counts:** a tab's number counts markers matching the current
  search + evidence + tag + found filters, ignoring only that tab's own
  dimension. This answers "how many would I get if I tapped this?" —
  directly fixing their opaque-counters bug.
- Selecting a tab does not clear other filters; "All" clears the category
  dimension only. A global "Reset all" appears whenever any filter is
  active.
- Tab switches animate the marker set (cluster layer re-filter);
  no full-map re-render flash.

### 3.5 Sort options

Applies to the **results list** (search dropdown + a "browse all results"
list when filters are active without a query):

1. **Name A–Z** (default)
2. **Strongest evidence first** — rockstar-confirmed → trailer-confirmed →
   leak-reported → disputed
3. **Recently updated** — `updatedAt` desc
4. **Region** — grouped by region, alphabetical

Sort selection persists to localStorage (ties into their "settings not
saved" gap — our discovery preferences persist).

### 3.6 Clustering UX

- Markers render through a **clustered data layer** (not one DOM node per
  pin) so 3k+ markers stay smooth in 3D.
- Cluster glyph: count + dominant-evidence-status ring color from our
  design tokens (Vice City neon palette — original design, not theirs).
- Click a cluster → camera eases to expand it; at max zoom, pins unstack
  into individual markers.
- **Cluster coloring modes** (their color-scheme idea, our design):
  "By evidence" (default — reinforces the transparency story) and
  "By category". Toggle lives in the map toolbar; choice persists.
- Clustering never hides the filtered set: filters apply *before*
  clustering; a filter that yields 3 pins shows 3 pins, not an empty map
  with a cluster of 3 somewhere off-screen.

### 3.7 Rich marker popup / detail panel (content blocks, in order)

Rendered in our dossier/case-file design language (original — see the
landing redesign), desktop sidebar panel + mobile bottom sheet (existing
`MobileSheet` swipe-to-dismiss kept):

1. **Header:** name · category chip · evidence badge (formal, with
   `EVIDENCE_META.blurb` as tooltip) · "Intel updated {date}"
2. **Evidence chain block** ⭐ (our differentiator):
   status label + `evidence.detail` (e.g. "Trailer 2 @ 0:42") + public
   source link if present. Disputed pins get an extra one-line caution
   strip in our own words.
3. **Media block:** reserved slot — original placeholder art until
   authorized imagery exists. Caption credits the source when we have one.
4. **Intel summary:** original editorial `description`, honesty-labeled.
5. **Location block:** region · coordinates (our Leonida frame; lat/lng
   until custom tiles land) · `realWorldInspiration` where the location
   entity has one (our original wording).
6. **Entity deep-link:** "Open full intel →" → `/vehicles/[slug]` etc.
   when `entityRef` exists. Non-entity pins omit this row.
7. **Actions:** Mark as found (existing) · Copy share link (deep link
   with `?pin=`) · Share (Web Share API w/ clipboard fallback).
8. **Footer note:** "Progress saves on this device — no account needed."
   (until account sync ships).

### 3.8 Coordinate search ("Jump to coordinates")

- Toolbar action "⌖ Go to position": accepts `lat, lng` in our current
  frame (later: the custom Leonida X/Y frame — the input labels the frame
  it expects, e.g. "Leonida grid X / Y").
- Validation: out-of-bounds input shows an inline error naming the valid
  range; never flies to a nonsense location.
- On success: camera flies there and drops a temporary reticle pin
  (dismisses on next map click). No permanent marker is created.

### 3.9 Marker deep links + per-marker SEO

- **Deep link:** `/map?pin=<id>` — opens the map, flies to the pin,
  opens its detail panel. Composes with existing
  `?lat=&lng=&zoom=` (pin wins for camera when both present).
  Invalid `?pin=` → ignored silently with the default view (no error
  page, no crash).
- **Share links** from the panel copy the `?pin=` URL; the page
  `<title>`/meta description update to the selected pin
  ("{Pin name} — GTA 6 Interactive Map · GTA6mapx") for share unfurls.
- **Per-marker SEO:** pins with `entityRef` canonicalize to the entity's
  existing SSG page (`/vehicles/[slug]` …) — that page is the indexed
  unit and already ships ItemList/Article/Breadcrumb JSON-LD. Standalone
  indexed pages for non-entity pins (collectibles, stunt jumps) are
  **deferred to Phase 3** (needs real launch data + Supabase); until then
  they are reachable only in-app.
- **Noindex guard:** `/map` itself stays non-indexable as an app shell;
  discovery SEO flows through the entity pages.

### 3.10 Explicit anti-bug rules (testable acceptance criteria)

Derived directly from their observed bugs. Every rule gets a test.

- **R1 — Single source of truth.** Search query, filters, sort, selection,
  and the rendered marker array live in one reducer. The results list,
  dropdown, empty state, and all counters derive from the same array.
  No parallel "selected" state.
- **R2 — Atomic clear.** The clear action (✕, Esc, "Reset all") resets
  query, dropdown, highlight, and any "N selected" affordance in one
  update. Test: search "casino" → clear → assert zero selection
  affordances remain.
- **R3 — Labeled counters.** Every number on screen is labeled and
  unambiguous: "Showing N of M markers" where M = total dataset size.
  Faceted tab counts carry a tooltip: "Matches your other filters."
  Test: with dataset of M, assert the summary line always shows M.
- **R4 — No stale async.** Filtering is synchronous for ≤5k markers.
  If debounce/async is introduced, a generation counter discards stale
  completions. Test: type "c", "ca", "cas" rapidly → only "cas" results
  render.
- **R5 — Honest empty states.** The empty state names the query and the
  active filters and offers one-tap reset. "No markers found" may never
  appear while results are selected/rendered. Test both.
- **R6 — One language.** All UI strings come from a single dictionary
  file; English ships first. No mixed-language fallbacks, no untranslated
  keys leaking through. Test: snapshot the filter panel strings against
  the dictionary.
- **R7 — Invalid input degrades silently.** Bad `?pin=`, bad coordinates,
  unknown category slugs in URLs → default view, inline message where
  the user typed. Never a crash, never a blank map.

---

## 4. What we deliberately do NOT copy

- Their category-by-provenance tabs (we use functional categories +
  a separate evidence dimension — strictly better and original).
- Their informal tag soup (we use the formal 4-status engine + a
  controlled tag vocabulary).
- Their visual design, copy, marker art, photos, or tile artwork.
- Their AGPL-3.0 code — the implementation is ours throughout.
- Their data — popups show only our curated entities/pins with honesty
  statuses. GTADB-derived records stay unpublished until the user adds
  the CC BY 4.0 attribution himself (standing pre-launch blocker).

## 5. Cross-team dependencies

- **Design system:** dossier/case-file tokens for badges, chips, cluster
  rings, panel (Vice City neon — our original language).
- **3D map engine:** clustered marker layer API, camera flyTo contract,
  Leonida coordinate frame definition (for §3.8 labels).
- **Settings:** persistence contract (localStorage keys for sort, cluster
  mode, filter defaults).
- **Community (later):** `internalTags` moderation queue; user submissions
  flow into the review pipeline, not directly onto the map.

## 6. Phased implementation checklist

**Phase A — Data model & migration**
- [ ] Add `tags`, `region`, `updatedAt`, `entityRef`, `availability`,
      `internalTags` to the pin model (names per implementer)
- [ ] Migrate every pin from 3-tier `certainty` to the 4-status
      `Evidence` (§2.5); review each pin's status by hand
- [ ] Update `/map` page metadata copy (drop "Confirmed / Likely /
      Speculation")
- [ ] Controlled tag vocabulary documented in the data file

**Phase B — Unified search**
- [ ] Search box + 8-result dropdown (name/tags/category/region)
- [ ] Keyboard nav, Enter-to-fly, Esc-to-clear
- [ ] Atomic select→fly→clear (R2); honest empty state (R5)

**Phase C — Filters, tabs, sort**
- [ ] Category tabs with faceted live counts (§3.4)
- [ ] Evidence 4-chip filter; tag chip group; found toggle
- [ ] Sort dropdown (4 options); persistence
- [ ] "Showing N of M markers" summary line (R3); Reset-all (R1/R2)

**Phase D — Clustering UX**
- [ ] Clustered marker layer (engine team contract)
- [ ] Evidence/category coloring modes; expand-on-click; max-zoom unstack

**Phase E — Rich detail panel**
- [ ] All 8 content blocks (§3.7); evidence chain prominent
- [ ] Entity deep-link "Open full intel →"; share/copy actions
- [ ] Mobile bottom sheet parity (existing swipe-to-dismiss kept)

**Phase F — Coordinates, deep links, hardening**
- [ ] "Go to position" with validation + reticle pin
- [ ] `?pin=` deep links; per-pin title/meta; invalid-input handling (R7)
- [ ] Full anti-bug test pass: R1–R7 acceptance tests green
- [ ] Build, lint, typecheck, route smoke tests

---
*End of discovery spec. Implementation owner: build team (Phase 2+).*
