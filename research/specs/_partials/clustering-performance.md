# Sub-Spec: Marker Clustering + Progressive Loading + Performance Budget

**Slice owner:** clustering-performance (Phase 1 = SPEC ONLY — no application code in this slice).
**Status:** spec v1.0 — 2026-09-24.
**Parent context:** GTA6mapx.com 3D map engine spec. App: `~/workspace/gta6mapx/web` (Next.js 16, React 19, TypeScript, Tailwind CSS 4, MapLibre GL JS).
**Legal hard line:** the competitor's code (map.stateofleonida.net) is AGPL-3.0 — never read-to-copy, never reproduce. Clustering via supercluster-style math is standard open-source technique; the integration design below is original. Any later code work must consult the bundled Next.js 16 docs at `web/node_modules/next/dist/docs/` before touching Next.js code, per `web/AGENTS.md`.

**Current state (what this replaces):** `src/modules/map/GameMap.tsx` creates one imperative `maplibre.Marker` (a real DOM node) per pin in a React effect, with zero clustering. That scales to ~15 sample pins; it does not scale to 3,000+. This slice is the migration path from DOM markers to GPU-rendered clustered layers.

---

## 1. Clustering strategy — GeoJSON source clustering (RECOMMENDED)

### 1.1 Decision: GeoJSON source + cluster layers (not DOM markers, not client DOM clustering)

| Approach | How it works | Verdict |
|---|---|---|
| **A. GeoJSON source clustering** (RECOMMENDED) | One `GeoJSONSource` with `cluster: true`; MapLibre runs the clustering math internally (same algorithm family as supercluster) and renders clusters + unclustered points as **canvas layers** (WebGL). Zero DOM nodes for pins. | ✅ Recommended |
| B. Client-side DOM marker clustering (e.g. Leaflet-style markercluster ported to MapLibre `Marker`s) | JS computes clusters, creates/destroys `Marker` DOM elements per cluster state. | ❌ Rejected — still pays DOM cost (see §3.4); 3k markers × DOM nodes = jank on mobile; imperative React-effect churn |
| C. Raw supercluster in app code driving DOM | Hand-rolled index + DOM updates. | ❌ Rejected — reinvents what the MapLibre source already does natively; more code, same DOM cost |

**Rationale for A:** MapLibre's built-in clustering uses the same point-clustering math family as supercluster (grid-based hierarchical clustering over zoom levels) without a separate library dependency. 3,000 points cluster in single-digit milliseconds on the main thread (or in a worker — see §1.6). Rendering happens on the GPU as part of the map canvas: pan/zoom stays at 60fps because no DOM layout is involved. Filtering = one `setData()` call; the source re-clusters automatically. This is the standard industry approach for thousands of points in MapLibre and keeps our integration code original (we only configure MapLibre's public API, which is ISC-licensed — no AGPL code is read or copied).

### 1.2 Cluster parameters

| Parameter | Value | Rationale |
|---|---|---|
| `clusterRadius` | **50 px** at all zooms (start; tune 40–60 after live test) | 50px balances tap-target size on mobile with decluttering; competitor used Leaflet defaults (~80px) which over-clustered at mid zooms |
| `clusterMaxZoom` | **14** | Below z14 pins uncluster into individual markers. z14 ≈ neighborhood level on Leonida tiles — individual pins become meaningful. Above z14, clustering still declutters dense collectible clusters |
| `clusterMinPoints` | 2 (default) | Single pins never form a "cluster of 1" |
| Cluster expansion | **Click → `getClusterExpansionZoom(clusterId)` → `map.easeTo({ zoom, center })`** | Smooth animated zoom to the exact zoom where the cluster breaks apart; no jarring jumps |
| Expansion animation | `easeTo` duration **600–900ms** (scale with zoom delta: ~150ms per zoom level, clamped) | Feels responsive, not nauseating |

**Zoom-dependent radius (tuning lever, not v1 default):** keep radius constant at 50px in v1. If dense downtown areas still look noisy at z11–13 during live testing, the approved tuning is a zoom-expression on a *second* cluster layer config — not runtime DOM work. Document the tuning in the module; do not ship two configs in v1.

### 1.3 Cluster rendering — data-driven circles with counts

Clusters render as **two canvas layers** (no DOM):

1. **Cluster circle layer** (`type: "circle"`): radius stepped by point count (e.g. small <10, medium <50, large 50+), fill = dark panel color, **stroke ring colored by the cluster's highest certainty** (see §1.4).
2. **Cluster count layer** (`type: "symbol"`): white bold count text centered on the circle.

Stepped sizing via MapLibre step expressions on `point_count`. Keep circle diameters ≤ 64px so clusters stay tappable without covering the map. Text must use the site's font stack via `text-font` (no external font fetch on the critical path — fall back to system fonts if the glyph range isn't in the vector tiles; cluster counts are digits, universally available).

### 1.4 Certainty-aware cluster styling — TRUST REQUIREMENT

This is the user's #1 trust demand (confirmed-vs-speculation labeling must survive clustering). Spec:

- **Certainty rank property:** every GeoJSON feature carries `certainty_rank`: confirmed=3, likely=2, speculation=1, plus the string `certainty` for styling/labels.
- **Cluster aggregation:** configure the source's `clusterProperties` to compute `max_certainty: ["max", ["get", "certainty_rank"]]` per cluster (MapLibre supports aggregate expressions on clustered sources — original usage of public API).
- **Ring color rule (HARD):** the cluster's stroke ring color = color of `max_certainty`. The site's certainty palette (confirmed = green, likely = amber/yellow, speculation = gray/red — final palette owned by the design slice) applies identically to pins and cluster rings, so a user learns one legend.
  - A cluster whose leaves are ALL speculation (max_certainty=1) renders with the **speculation ring** — it must never look confirmed. This is a release-blocking acceptance criterion.
  - A mixed cluster (e.g. 1 confirmed + 49 speculation) shows the confirmed ring (highest certainty wins) **plus a "mixed" treatment**: the count label gets a small `±` prefix or the ring is drawn dashed. Exact treatment is the design slice's call; the requirement is that mixed clusters are visually distinguishable from pure-certainty clusters. Rationale: a confirmed ring on a 98%-speculation cluster would mislead; the dash/`±` keeps the highest-certainty signal honest.
- **Unclustered pin layer** styles each point by its own `certainty` (circle fill or icon halo). Approximate-coordinate pins (the 294 `needCoordVerification` records, LOOCV RMSE 5.41 km) get an additional distinct treatment — dashed outline or an "≈" badge — so approximate positions are never presented as precise. Exact treatment owned by design slice; presence of the treatment is this slice's requirement.
- **Legend:** the map legend (owned by UI slice) must show certainty colors with plain-language labels ("Confirmed by Rockstar", "Likely — trailer/leak evidence", "Speculation — unverified"). This slice guarantees the data (`certainty`, `certainty_rank`, `max_certainty`) is present on every rendered feature so the legend is always truthful.

### 1.5 Category-aware behavior when filters change

- Filter state (category toggles) lives in React state as today.
- On filter change: build a **filtered GeoJSON FeatureCollection** (named pins only — see §2 for the separate unnamed layer) and call `source.setData(filtered)`. MapLibre re-clusters synchronously; at 3k points this is <15ms (measured in §5).
- **Debounce:** filter toggles are discrete clicks — no debounce needed. But rapid multi-toggle (user tapping 4 categories fast) should batch: the React state update already batches; `setData` fires once per render commit. Spec: exactly one `setData` per committed filter state.
- **Selected pin survives filtering:** if the selected pin's category is toggled off, the detail panel stays open (it describes a real entity) but the map marker disappears with all others — and a small "hidden by filter" notice appears in the panel. If its category is toggled back on, selection restores without re-clicking.
- **Found pins:** `found` is localStorage state (existing `useFound`). Unclustered layer uses `feature-state` (`found: true/false`) for instant per-pin styling (checkmark/dim) without `setData`. Cluster aggregation includes `found_count` via `clusterProperties` so a cluster can show a subtle "all found" treatment (e.g. dimmed ring) — recomputed on the same `setData` path as filters; found-toggles batch into a debounced `setData` (300ms) rather than per-click, to avoid re-cluster churn while the user marks several pins.

### 1.6 Selected-pin and found-pin states inside clusters

- **Selected pin inside a cluster:** the unclustered layer styles the selected feature (via `feature-state` `selected: true`) with a highlight ring + slight scale. If the selected pin is currently clustered (user zoomed out), the cluster containing it gets a **selection halo** — implement via `clusterProperties` `has_selected: ["max", ["==", ["get", "id"], selectedId]]`... note: `clusterProperties` aggregates over leaf properties, and the selected id is app state, not a leaf property. Two approved implementations (implementer picks):
  - (a) On selection, set a leaf-level approach aside and instead do a one-time `querySourceFeatures` for clusters, find the cluster containing the pin id, and set `feature-state` on the cluster feature. Simple, no re-aggregation.
  - (b) Rebuild filtered GeoJSON with a `is_selected` leaf property on the selected pin and `setData`; `clusterProperties` aggregates `max(is_selected)`. Costs one re-cluster (<15ms) — acceptable and keeps all cluster logic declarative.
  - Recommended: (b) — single code path, no imperative cluster hunting.
- **Found pins inside clusters:** `found_count` aggregate (see §1.5). A cluster where `found_count == point_count` renders dimmed/desaturated ("all found here"). Partially-found clusters render normally — do not attempt per-leaf found visualization inside a cluster circle; it doesn't scale visually.
- **Keyboard/a11y:** clusters are canvas-rendered, not DOM — they are not keyboard-focusable. The existing search + list UI (sidebar) remains the keyboard path to every pin. This is an accepted trade-off, documented: canvas clustering buys 60fps; the accessible alternative path is search/list, which must therefore be complete (see §4).

---

## 2. The 1,626 unnamed pins-only layer

**What it is:** 1,626 records with no real name (`"?"` in staging) and therefore no entity page, no SEO value, no detail content. They exist to give the map density and a sense of coverage ("the community has mapped 1,626 more points").

### 2.1 Separate lightweight source + layer

- **Separate `GeoJSONSource`** (`pins-only`, `cluster: false` — never clustered with named pins; clustering 1,626 extra points into named clusters would corrupt counts and the honesty counters).
- **Rendering:** single `circle` layer, tiny dots: **3px radius at z10, scaling to 5px at z15** via interpolate expression; low opacity (0.35–0.5); neutral color (slate/gray — deliberately NOT any certainty color, since these carry no evidence claim).
- **Zoom gating:** `minzoom: 10` — below z10 the dots are hidden entirely (density without meaning is noise at world view). Optional `maxzoom` fade if perf testing shows overdraw in the densest district (tuning lever).
- **Interactivity:** **none by default.** No click handlers, no popups, no cursor change. Rationale: 1,626 anonymous dots with popups saying "unknown" add zero value and invite accidental taps on mobile. Approved minimal alternative: a `mousemove` hover that shows a static tooltip "Unnamed community pin — no details yet" ONLY on non-touch devices, throttled. Default = off; enable only if user testing asks.
- **Toggleable:** a "Community density" toggle in the filters panel, default **ON** (density is a selling point), persisted in localStorage. Toggling = `setLayoutProperty(layer, "visibility", ...)` — instant, no data rebuild.

### 2.2 Exclusions (hard)

- **Search:** the pins-only source is never added to the search index (§4). Searching "casino" must not return 40 anonymous dots.
- **Sitemap/SEO:** unnamed pins get no URLs, no JSON-LD, no sitemap entries (already decided in gtadb-import-spec.md — this slice enforces it at the map layer: the pins-only GeoJSON is built from a data file that carries no `slug`, so URL construction is impossible by construction).
- **Counters:** the honest counters (§4) count named pins. The density layer gets its own separate line in the UI ("+1,626 community pins" shown next to its toggle), never mixed into the named-pin counts.
- **Progress:** unnamed pins are not markable as found (nothing to "find" — no entity). The found aggregate ignores this source entirely.

### 2.3 Data shape

The pins-only GeoJSON is a build-time artifact: `[{ id, lat, lng, approx?: boolean }]` — the minimal fields. Approximate-coordinate unnamed pins (subset of the 294) render with lower opacity (0.25) rather than a badge — at 3px, badges are unreadable; honesty is carried by the toggle label ("positions approximate").

---

## 3. Progressive loading

### 3.1 Strategy: full-dataset-first now, viewport-paged growth path designed in

Be honest about scale: **3,000 points is small.** A 3k-feature GeoJSON is ~300–600 KB uncompressed (~80–150 KB gzipped) — smaller than one hero image. `setData` with 3k points + clustering completes in <15ms. Viewport-based *data* paging is therefore **not needed for v1** and would add complexity (stale clusters at viewport edges, double-counting) for no measurable gain.

What IS needed, and what this slice specifies:

1. **Initial-load sequence** (§3.2) — ordered, with skeleton states.
2. **Viewport-culled rendering** — free with canvas layers: MapLibre only rasterizes features in the viewport. Unlike DOM markers (which exist and cost layout even offscreen), offscreen clustered points cost nothing per frame.
3. **A designed-in viewport paging module** (`viewportLoader.ts`, §6) that stays a **pass-through in v1** (loads the full GeoJSON once) but defines the paging contract (bounds + buffer → page fetch → merge) so the post-launch submissions flow (10k+ pins) doesn't require re-architecture. The paging path activates behind a feature flag when the dataset crosses **10,000 points** (threshold documented here; paging below that is pure overhead).

### 3.2 Initial-load sequence

Order matters — first paint of *something meaningful* fast, details streaming:

1. **Style + base tiles** — map `load` event. Show the map chrome immediately (header, filters skeleton). Target: style loaded ≤1s on desktop broadband.
2. **Named-pin cluster source** — fetch GeoJSON (local static asset in v1: `public/data/pins.geojson`, generated at build time from reviewed entities; post-launch: API route with ETag caching) during `requestIdleCallback` after `load`, then `addSource` + cluster layers. Show inline loading state: shimmer over the map + "Loading N locations…" (N known from a tiny manifest fetch or the build-time count constant).
3. **Unclustered pin layer** — added with the source (same `addSource` call); no separate step, listed for clarity.
4. **Pins-only density layer** — added last, after `idle`, so named content is interactive first. Its fetch is lower priority (`fetchpriority: low`).
5. **Offscreen prefetch** — none in v1 (full dataset is already local). Growth path: `viewportLoader` prefetches adjacent tiles' pages on `idle`.

**Failure states:** if the pins GeoJSON fetch fails, the map still renders (tiles + chrome) with a retry banner — "Couldn't load locations. Retry." The map is never a blank error screen. If WebGL is unavailable, the existing `mapError` fallback (list + search still work) is kept — clustering changes nothing about that path.

### 3.3 Skeleton / loading states

- **Map area:** shimmer gradient overlay + centered status line ("Loading 2,973 locations…") with a determinate-feeling progress (indeterminate shimmer + real count when known). Dismissed on source `data` event (not on `load` — data readiness is the true criterion).
- **Filters panel:** category buttons render immediately (static config), but show a disabled state with the honest counter reading "…" until data arrives.
- **Search:** input is interactive immediately; searching before data loads shows "Locations still loading…" instead of "No results" (never present absence-of-data as absence-of-results — trust requirement).
- **Deep links** (`?lat=&lng=&zoom=` + a future `?pin=` param): the map flies to the deep-linked view as today; pin selection waits for the data-ready event, then resolves. No silent failure: if the pin id isn't in the dataset, show "This location isn't on the map yet."

### 3.4 Why NOT 3,000 DOM markers — the perf math

The current implementation creates one `maplibre.Marker` per pin. Each `Marker` is a real DOM node (a `div` with classes, `role="button"`, `tabindex`, `aria-label`, plus 2 event listeners in the current code). At 3,000 pins:

| Cost | Per marker | × 3,000 | Notes |
|---|---|---|---|
| DOM node + render object | ~2–4 KB | **6–12 MB** | Before any JS heap for the Marker wrappers |
| Event listeners | 2 (click, keydown) | **6,000 listeners** | Each is a closure retaining the pin object |
| Position sync per frame | `setLngLat` → style transform write | 3,000 style writes / frame during pan | Forces style recalc; cannot hit 60fps on mobile |
| React effect churn | remove-all + re-create-all on every `visible`/`found`/`selected` change | full 3k teardown + rebuild | Toggling one filter = seconds of jank, dropped frames, GC pressure |

Measured expectation (no need to benchmark to know): 3k DOM markers → **multi-second main-thread blocks on filter change**, **<20fps pans on mid-tier mobile**, and memory growth from detached nodes on every re-render (the current effect removes markers, but listener closures and React state churn still cost).

With GeoJSON clustering: **zero pin DOM nodes**. The map canvas is one `<canvas>`; clusters and pins are GPU-drawn. Pan/zoom frame cost is ~constant regardless of point count (MapLibre culls to viewport). Filter change = one `setData` (<15ms) + one re-cluster. Memory: one parsed GeoJSON (~0.5 MB) + one cluster index (~tens of KB). This is the entire economic argument for §1.1.

---

## 4. Search + filter interplay

### 4.1 Search operates on the FULL dataset, not just the visible map

- **Index:** `searchIndex.ts` builds an in-memory index at data-ready time from **all named pins** (every category, every certainty, regardless of current filters or viewport). Unnamed pins-only records are excluded (§2.2). 3k short strings index in <50ms; a simple normalized-substring + prefix-ranked index is sufficient — no Fuse.js dependency in v1 (fewer bytes, fewer failure modes; revisit at 10k+).
- **Ranking:** exact prefix match > word-boundary match > substring match; ties broken by certainty rank (confirmed first — trust-positive: the most trustworthy result surfaces first), then name length.
- **Result cap:** 8 results in the dropdown (competitor showed a raw list; 8 keeps it scannable on mobile). Each row shows name + category icon + certainty badge — the badge is mandatory in results (trust requirement: never show a name without its evidence label).
- **Empty query state:** as today (no dropdown). **No-match state:** "No locations match 'xyz'" — plus, if filters are active, a one-tap "Clear filters and search all" action (the competitor's confusing behavior was partly that filtered-out results looked like missing results).

### 4.2 Selecting a result: fly + expand its cluster

The selected pin may be (a) unclustered at current zoom, (b) inside a cluster, or (c) filtered out. Spec:

1. Resolve pin → `lng/lat`.
2. If the pin's category is currently filtered out: offer "Show anyway" — one tap re-enables its category, rebuilds the source (§1.5), then continues. Never silently show a pin from a disabled category.
3. `map.flyTo({ center, zoom: max(current, 15), duration: 1200 })` — as today.
4. After `moveend`: check whether the pin is rendered unclustered. If it's inside a cluster, use the **supercluster expansion-zoom API pattern via MapLibre's clustered source**: `source.getClusterExpansionZoom(clusterId, (err, zoom) => map.easeTo({ center: pin, zoom }))`. To find the containing cluster id at the current zoom: `querySourceFeatures` on the cluster layer filtered to clusters, then test containment (point-in-cluster via the cluster's coordinates + radius is approximate; the robust pattern is: `getClusterLeaves` walk or simply easeTo to `clusterMaxZoom + 1` at the pin's location — at z15 clustering is off (§1.2), so the pin is guaranteed unclustered). **Simplification (approved):** skip cluster-id hunting — `easeTo({ center: pin, zoom: clusterMaxZoom + 1 })` guarantees the pin is unclustered and selected. One animation, no async cluster queries, no edge cases. The expansion-zoom API is documented as the alternative if per-cluster zoom-to-fit is ever wanted.
5. Set selection state → unclustered layer highlights via `feature-state` (§1.6), detail panel opens.

### 4.3 Filter changes rebuild the clustered source

Per §1.5: exactly one `setData(filteredGeoJSON)` per committed filter state. The pins-only density layer is independent (visibility toggle only, §2.1).

### 4.4 Honest counters — fixing the competitor's weakness

The competitor's counters were observed as opaque/confusing. Our counters are always three numbers, always labeled, always consistent:

- **Filter bar:** `2,314 of 2,973 shown — 659 filtered out` (updates live on toggle).
- **Density toggle row:** `+1,626 community pins` (separate line, separate concept — never folded into the named count).
- **Progress bar:** `142 of 2,973 found` (denominator = named pins; unnamed pins aren't findable, §2.2).
- **Search dropdown footer (when filters active):** `Searching all 2,973 — 659 hidden by filters` with the clear-filters action (§4.1).
- **Rules:** denominators never change silently; "shown" always means "rendered on the map right now" (named, passing filters); approximate-coordinate pins are included in counts but the map legend notes their treatment (§1.4). While data is loading, counters show `…` — never `0` (0 would be a lie).

---

## 5. Performance budget

All budgets are **release gates for the map slice**: a build that misses them doesn't ship the map changes.

### 5.1 Concrete numbers

| Metric | Budget | Context |
|---|---|---|
| Initial interactive (map usable: pan/zoom + click cluster) | **≤ 1.5s desktop**, **≤ 2.5s mid-tier mobile** | Measured from navigation start to map `idle` + cluster source data-ready, on throttled Moto G4-class CPU + Fast 3G for mobile |
| Frame rate during pan/zoom | **60fps desktop**, **≥ 30fps mobile** | Sustained, not peak; measured over a 5s scripted pan |
| Main-thread block per task | **≤ 50ms** (no long tasks) | `setData`/re-cluster, filter rebuild, search index build must each complete <50ms at 3k points |
| Marker data memory | **≤ 2 MB** parsed GeoJSON + index for 3k named pins; **≤ 1 MB** for 1,626 pins-only | Enforced by keeping pins-only features to 4 fields (§2.3) |
| Total page JS heap (map route) | **≤ 60 MB** on mobile | Leaves headroom on 2–3 GB RAM devices |
| Tile data (initial viewport) | **≤ 2 MB** transferred | OpenFreeMap vector tiles; viewport-dependent, monitor not gate |
| Pins GeoJSON transfer | **≤ 150 KB gzipped** (named), **≤ 80 KB gzipped** (pins-only) | Static asset with immutable cache headers; ETag revalidation post-launch |
| Search index build | **≤ 50ms** at 3k entries | Main thread; runs once at data-ready |
| Filter → re-cluster → painted | **≤ 200ms** end-to-end | Perceived instant; includes one `setData` + style recalc + frame |

### 5.2 What to measure and how

All measurement hooks live in **`src/modules/map/perf.ts`** (module inventory §6). No other module instruments itself; `perf.ts` exposes:

- **`mark(name)` / `measure(name)`** — thin wrappers over `performance.mark`/`performance.measure` with a consistent `gta6mapx:map:` prefix. Key marks: `map-init-start`, `style-loaded` (map `load`), `data-fetch-start/end`, `clusters-ready` (source `data` event), `first-interactive` (`idle` after data-ready), `filter-start/end`, `search-index-built`.
- **`startFrameMonitor()` / `stopFrameMonitor()`** — `requestAnimationFrame` delta histogram during interactions (pan/zoom). Reports p50/p95 frame times and dropped-frame count (>2× budget). Used by a hidden `?perf=1` debug overlay (dev only, never shipped to prod UI) and by automated checks.
- **`observeLongTasks(onViolation)`** — `PerformanceObserver` on `longtask` entries; any task >50ms on the map route logs a warning with attribution (`entry.name`, duration) to the console in dev and to the (future) analytics endpoint in prod. A long task during filter/search/cluster ops is a budget violation, not background noise.
- **`assertBudgets()`** — runs after `first-interactive`: checks recorded measures against §5.1, returns a pass/fail report object. In dev, failures render in the `?perf=1` overlay; in CI (Playwright, later phase), failures fail the run.
- **Web Vitals passthrough** — INP and LCP on `/map` reported via the existing analytics path (owned by another slice; `perf.ts` only ensures map interactions are attributable by wrapping handlers — no duplicate reporting).

**Deliberately NOT measured here:** tile-server latency percentiles (provider-side), SEO/crawl metrics (entities slice), backend API latency (post-launch API slice). This slice measures what it controls: main-thread work, frame delivery, and data-pipeline timing.

### 5.3 Regression rules

- Adding a feature to the map slice must not add a synchronous main-thread task >50ms at 3k points — verify with `assertBudgets()` before merge.
- The pins-only layer must never regress named-pin interactivity: it's added after `idle` (§3.2) and carries no event handlers (§2.1).
- Bundle: the map route's JS must stay lazy-loaded (dynamic import of the map component, as today via `"use client"` boundary) — clustering adds zero new runtime dependencies in v1 (MapLibre built-in clustering; no supercluster npm package needed since we use the source's native clustering).

---

## 6. Module inventory — `src/modules/map/`

One responsibility per module. `GameMap.tsx` remains the orchestrator (React state, layout, panel) and **must not** contain clustering math, GeoJSON construction, or instrumentation — it calls these modules.

| File | Responsibility |
|---|---|
| `clusterSource.ts` | Owns the clustered GeoJSON source lifecycle: `addSource` config (radius/maxZoom per §1.2), `clusterProperties` certainty/found aggregation (§1.4–1.5), `setData` on filter/selection change. The ONLY module that touches the cluster source. |
| `pinAdapter.ts` | Converts `Pin` records → GeoJSON features: sets `certainty`, `certainty_rank`, `categorySlug`, `approx` flag, minimal properties. Single place where the data model meets the map. |
| `markerLayer.ts` | Unclustered-pin + cluster circle + cluster count layers: layer defs, data-driven paint expressions (certainty colors, stepped cluster sizes, selected/found `feature-state` styling). No data logic. |
| `pinsOnlyLayer.ts` | The 1,626 unnamed density layer: separate source, zoom-gated tiny dots, visibility toggle, no interactivity (§2). |
| `clusterInteraction.ts` | Cluster click → expansion zoom (`easeTo`, §1.2/§4.2), cursor affordance on hover, selection-halo coordination with `clusterSource`. No rendering. |
| `searchIndex.ts` | Full-dataset named-pin index: build, ranked query (§4.1), result type. Excludes pins-only records by construction. |
| `viewportLoader.ts` | Progressive/paged loading contract: v1 = pass-through single fetch with priority ordering (§3.2); defines the bounds+buffer paging interface activated by flag at 10k+ points (§3.1). |
| `mapCounters.ts` | The honest-counter model: computes shown/total/filtered-out/density/found numbers from filter state + dataset (§4.4). The ONLY module that formats counts for UI. |
| `perf.ts` | Instrumentation only: marks/measures, rAF frame monitor, longtask observer, `assertBudgets()` (§5.2). Imported by orchestrator and CI; never by layer modules. |
| `GameMap.tsx` (existing, slimmed) | Orchestrator: React state (filters, query, selection, 3D), layout, panel/sheet, deep links. Delegates all map-data work to the modules above. Target: net-negative lines vs. today (marker effect deleted). |

**Dependency direction:** `GameMap` → `clusterSource` → `pinAdapter`; `GameMap` → `markerLayer`, `pinsOnlyLayer`, `clusterInteraction`, `searchIndex`, `viewportLoader`, `mapCounters`, `perf`. Layer modules never import each other; shared types live in `pinAdapter.ts` (feature property types) and `mapCounters.ts` (counter model).

---

## 7. Implementation checklist (this slice)

**Pre-work**
- [ ] Read bundled Next.js 16 docs (`web/node_modules/next/dist/docs/`) before any code changes — check for `dynamic` import / client-component conventions affecting the map route.
- [ ] Confirm MapLibre GL JS version in `package.json` supports `clusterProperties` on `GeoJSONSource` (needed for §1.4–1.5 aggregation).
- [ ] Lock the certainty color palette with the design slice (needed by `markerLayer.ts` and the legend).

**Data pipeline (build-time)**
- [ ] Generate `public/data/pins.geojson` (named pins, via `pinAdapter` field contract) from reviewed entities; add a build step so it regenerates when entity data changes.
- [ ] Generate `public/data/pins-only.geojson` (1,626 unnamed, 4 fields max: id/lat/lng/approx) from staging; verify no `slug`/`name` fields leak in.
- [ ] Record byte sizes; verify against §5.1 transfer budgets (≤150 KB / ≤80 KB gzipped).

**Modules**
- [ ] `pinAdapter.ts` — feature conversion + property types; unit-test certainty_rank mapping (confirmed=3/likely=2/speculation=1).
- [ ] `clusterSource.ts` — source config, `clusterProperties` (max_certainty, found_count), single-`setData` filter path; unit-test aggregation expressions against fixture data.
- [ ] `markerLayer.ts` — three layers (clusters, counts, unclustered pins); data-driven certainty styling; selected/found `feature-state`; approximate-pin treatment.
- [ ] `pinsOnlyLayer.ts` — separate source, minzoom 10, tiny dots, visibility toggle persisted to localStorage; assert zero event handlers.
- [ ] `clusterInteraction.ts` — click-to-expand `easeTo`; search-select path via `clusterMaxZoom + 1` guarantee (§4.2).
- [ ] `searchIndex.ts` — full-dataset index, ranking (prefix > word-boundary > substring, certainty tiebreak), 8-result cap, "searching all N" footer state.
- [ ] `viewportLoader.ts` — v1 pass-through with priority ordering (named → idle → pins-only); paging interface stubbed behind the 10k flag.
- [ ] `mapCounters.ts` — honest counters; unit-test: filtered-out = total − shown, density never in named counts, loading state renders "…" not "0".
- [ ] `perf.ts` — marks/measures, frame monitor, longtask observer, `assertBudgets()`; `?perf=1` dev overlay.

**GameMap.tsx migration**
- [ ] Delete the imperative `markersRef`/`Marker` effect (the DOM-marker path).
- [ ] Wire modules: init → `viewportLoader` → `clusterSource`/`pinsOnlyLayer` → `markerLayer` → `clusterInteraction`; search → `searchIndex`; counters → `mapCounters`; everything → `perf` marks.
- [ ] Keep: deep links, 3D toggle, mobile bottom sheet, detail panel, `useFound`, error fallback, share-link copy.

**Acceptance (release gates)**
- [ ] **Trust:** a speculation-only cluster never renders a confirmed ring (visual test: fixture dataset, screenshot assertion or manual sign-off); mixed clusters show the mixed treatment; every search result row shows its certainty badge; counters match §4.4 formats exactly.
- [ ] **Budgets:** `assertBudgets()` passes on throttled mobile profile — ≤2.5s interactive, ≥30fps pan, zero >50ms tasks in filter/search/cluster paths.
- [ ] **Scale smoke:** 3,000 named + 1,626 pins-only loaded; pan/zoom across the whole island at z10–z16 with no dropped-frame regression vs. the 15-pin baseline.
- [ ] **Legal:** no competitor code referenced, read, or copied — MapLibre public API only; attribution/license posture unchanged (owner adds GTADB credit pre-deploy — existing blocker, not this slice).
- [ ] **A11y:** keyboard path to every pin via search/list verified (canvas clusters are not focusable — accepted, §1.6); cluster counts have sufficient color contrast on the dark map.
