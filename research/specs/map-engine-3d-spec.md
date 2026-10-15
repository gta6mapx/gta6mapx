# 3D Map Engine — Build Spec (Phase 1: spec only)

**Project:** GTA6mapx.com `/map`
**Status:** SPEC ONLY — no application code in this document or its partials.
**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · MapLibre GL JS
**Code home:** `~/workspace/gta6mapx/web/src/modules/map/` (one responsibility per module)
**Date:** 2026-09-24

**Slice partials (source of truth per slice — this doc synthesizes and resolves intersections):**
- `_partials/style-baselayers-coords.md` — style architecture, base-layer switch, game-coordinate readout
- `_partials/clustering-performance.md` — clustering, pins-only layer, progressive loading, performance budget
- `_partials/camera-3d-mobile.md` — 3D behavior, camera/deep-links, tile fallback, mobile WebGL

> **Standing rule for the implementer:** before ANY Next.js code change, consult the
> bundled Next.js 16 docs at `~/workspace/gta6mapx/web/node_modules/next/dist/docs/`
> (per `web/AGENTS.md`). Breaking changes vs. older Next.js are expected.

---

## 1. Competitor tech analysis (what we learned, what we beat)

Observed (browser, read-only — no code or assets taken):

| Aspect | Their approach | Our answer |
|---|---|---|
| Map library | Leaflet + leaflet-markercluster | MapLibre GL JS (WebGL, GPU canvas rendering) |
| Dimensionality | **2D only** | **3D perspective + extruded buildings — our headline edge** |
| Base map | Custom fan-made 256px PNG tile pyramid (`/{version}/normal/{z}/{x}/{y}.png`) | Vector tiles (Phase A: OpenFreeMap placeholder → Phase B: our style JSON → Phase C: our Leonida tile pipeline) |
| Coordinate system | Custom game CRS, X/Y readouts (`X: -3407.500`) | Game-world affine transform wrapped in `gameCoords.ts`, anti-false-precision display ladder (their 3-decimal format is explicitly banned for us) |
| Comparison mode | "Real-Life Karte" swaps to OSM world tiles with game coords projected on Florida | Our original two-mode switch: Leonida Dark ↔ Real Florida (+ our differentiator: Leonida game-world boundary projected onto real Florida with an "approximate projection" honesty legend) |
| Markers | ~2,973 markers via DOM clustering | GeoJSON source clustering, zero pin DOM nodes, certainty-aware cluster rings |
| Marker richness | Photo, real address, game coords, ID, edit history, share link per marker | Match richness via detail panel + evidence chain (detail content owned by entities slice) |
| Search feedback | Confusing counters ("13 selected" persisting, mismatched totals) — **weakness** | Honest three-number counters (`2,314 of 2,973 shown — 659 filtered out`) — release requirement |
| Settings | Not persisted ("Your settings are not being saved") — **weakness** | Versioned localStorage persistence for map prefs — release requirement |
| Extras | Drawing toolkit, distance measure, map-version overlays, "Find the Marker" guessing game, media library | Drawing/measurement/game are **later phases** (separate specs); this spec must not block them — keep camera APIs public |

**What we deliberately do NOT copy:** their code (AGPL-3.0), tile URLs, assets, palette hex values, German/English label strings. Concepts (coordinate readout, comparison mode, share links, progress splash) are re-implemented originally.

---

## 2. Current state (what this spec replaces/extends)

`src/modules/map/GameMap.tsx` today: MapLibre + OpenFreeMap dark vector style, default
center Miami `25.7617, -80.1918`, **fixed 58° pitch**, fill-extrusion 3D buildings
(`minzoom 13.5`, height interpolates 13.5→15), 2D/3D toggle (900ms easeTo), pin-select
flyTo (zoom ≥15, pitch 58, 1200ms), reset view, `NavigationControl` with pitch
visualization, `?lat=&lng=&zoom=` deep links, copy-link share, WebGL-failure fallback
message, mobile bottom-sheet with swipe-to-dismiss, filters drawer. Pins are imperative
per-pin DOM `Marker`s — **no clustering** (scales to ~15 sample pins, not 3,000+).

Known must-fix items carried into implementation:
- Detail panel shows `pin.lat.toFixed(4)` — violates the anti-false-precision policy (§7).
- The imperative `Marker` effect is deleted by the clustering migration.
- `GameMap.tsx` shrinks to orchestration; logic moves to single-responsibility modules.

---

## 3. Hard constraints (non-negotiable)

1. **Legal — clean room.** Competitor code is AGPL-3.0: never read-to-copy, never
   reproduce (code, tile URL patterns, assets). Clustering math and affine transforms
   are standard textbook techniques — fine. Integration design is original.
   Pre-launch license blocker stands: gtadb.org CC BY 4.0 attribution is added by
   Husnain himself; the spec leaves an explicit empty credit slot, the implementer
   adds no credit text.
2. **Accuracy — no false precision.** Staging coordinates are approximate-grade
   (clean-room affine transform, LOOCV RMSE **5.41 km**, 294 records flagged
   `needCoordVerification`). Every coordinate surface obeys the precision ladder (§7).
3. **Modularity.** One responsibility per module under `src/modules/map/`. `GameMap.tsx`
   orchestrates; it owns no style JSON, transform math, clustering, or URL logic.
4. **Mobile-first.** One WebGL context (no dual map instances), bounded tile memory,
   pixel-ratio caps, adaptive degradation — the audience is mobile web.

---

## 4. Architecture overview

```
┌─────────────────────────────────────────────────────────────┐
│ GameMap.tsx  (orchestration only: mounts map, wires modules) │
└──┬──────────┬───────────┬──────────┬──────────┬──────────────┘
   │          │           │          │          │
   ▼          ▼           ▼          ▼          ▼
styleManager gameCoords  cluster   deepLink   deviceCaps
(canonical   (transform  Source+   (URL       (tiers,
 z-order,     +precision  layers,   schema,    pixel-ratio,
 base layers, ladder)     pins-only share)    gestures)
 overlay      │          layer)
 rebuild)     │             │
   ┌──────────┴───┐   ┌─────┴──────┐
   ▼              ▼   ▼            ▼
camera3d    tileFallback searchIndex mapCounters
(pitch ramp,(retry      (full-     (honest
 toggle,    ladder,     dataset    3-number
 reduced-   splash)     index)     display)
 motion)
   │              │
   ▼              ▼
settings      perf
(persisted   (budgets,
 prefs)       monitors)
```

**Key structural rule:** `styleManager` owns the base style and rebuilds the overlay
stack idempotently after every `setStyle`. Overlay *content* (cluster sources/layers,
pins-only layer, game-frame outline) is owned by their modules but **registered** with
`styleManager` via an overlay-registry hook, so a style swap can never strand layers.

---

## 5. Engineering decisions (the big calls)

### D1 — GeoJSON source clustering, zero pin DOM nodes (clustering slice)
MapLibre's native clustered `GeoJSONSource` renders clusters + pins as GPU canvas
layers. DOM-marker clustering was rejected with perf math: 3,000 DOM markers ≈
6–12 MB DOM, 6,000 listeners, full teardown/rebuild per filter change → multi-second
main-thread blocks and <20 fps on mobile. Clustered canvas: constant frame cost, one
`setData()` (<15 ms) per filter change. Params: 50 px radius, `clusterMaxZoom` 14,
click → `getClusterExpansionZoom` → `easeTo` 600–900 ms.

### D2 — Certainty survives clustering — trust requirement, release-blocking (clustering slice)
Every feature carries `certainty_rank` (confirmed=3 / likely=2 / speculation=1);
`clusterProperties` aggregates `max_certainty`; the cluster ring color = highest
certainty, with a mandatory **"mixed" treatment** (dashed ring / `±`) so a
98%-speculation cluster never reads as confirmed. Approximate-coordinate pins get a
distinct dashed/`≈` treatment. Legend data is guaranteed on every feature.

### D3 — Zoom-ramped pitch, not fixed 58° (camera slice)
Pitch follows zoom: 0° below z11 → 45° at z13.5 → **58° cap** at z15+, matching the
buildings' 13.5→15 height interpolation. 2D/3D toggle is pitch-only (preserves
center/zoom/bearing/selection), 900 ms. `prefers-reduced-motion` → all camera moves
instant, no flyTo. Compass/north-up snap appears only when |bearing| > 2°.

### D4 — One module owns the coordinate truth; precision is a ladder, not a format (style/coords slice)
`gameCoords.ts` wraps the affine transform via a versioned build-time artifact
(`transform.vN.json`: 6 coefficients + precomputed inverse, RMSE, dataset commit).
Phase C re-fit = bump the JSON, zero consumer code changes. Display ladder keyed off
RMSE: at v1, lat/lng at **2 decimals**, game X/Y at **nearest 100 units, always
`~`-prefixed**; the competitor-style `X: -3407.500` format is banned. The current
`toFixed(4)` in the detail panel is a must-fix. Share URLs carry 4-decimal lat/lng
(stable across re-fits, still rounded — never implied precision).

### D5 — `setStyle`, not dual map instances, for the base-layer switch (style slice)
Dual instances = two WebGL contexts + double tile memory → rejected under the
mobile-first constraint. Single-instance `setStyle` preserves camera natively; DOM
markers (while they exist) survive automatically; canvas overlay sources re-register
via the overlay registry. Switch lifecycle: 8 s timeout with revert-to-previous +
toast (never a half-styled map), `?style=` in share links, 3D preference preserved
(eases to 0 on satellite, restores on return).

### D6 — Full-dataset-first loading now; viewport paging designed in, flagged off (clustering slice)
3,000 points ≈ 300–600 KB GeoJSON (~80–150 KB gzipped) — smaller than one hero
image. Viewport data-paging in v1 adds stale-cluster complexity for no gain.
`viewportLoader.ts` ships as a pass-through defining the paging contract, activating
behind a flag at 10,000+ points (post-launch submissions scale).

### D7 — Canonical deep-link schema, URL as camera store (camera slice, extended here)
`?lat=&lng=&zoom=&pitch=&bearing=&pin=<slug>&style=` with validation/clamping;
`?gx=&gy=` accepted inbound as an alias (converted through the transform, displayed
through the precision ladder). `moveend` → debounced 400 ms `replaceState` (never
`pushState`); per-pin `?pin=<slug>` canonical links; `document.title` + meta
description update per pin with no route change. Settings persist prefs; the URL
persists camera.

### D8 — Never a blank map (camera slice)
Tile failure ladder at every stage: tile-error → 3× backoff retry → degraded style
→ user notice with Retry. 12 s splash timeout with honest event-driven progress
(never fakes 100%). WebGL tiers `full/reduced/minimal/none` with one-way auto
step-down on slow frames + "Retry 3D" toast; existing WebGL-unavailable fallback
(working list/search) kept and extended, plus `?forcemap=none` QA hook.

---

## 6. Interface contracts (module seams)

1. **Overlay registry** (`styleManager` ↔ content modules): `clusterSource`,
   `pinsOnlyLayer`, and the game-frame outline module each expose
   `registerOverlays(registry)` returning `{ addTo(map), removeFrom(map) }`.
   `styleManager.rebuildOverlays(map)` runs them in canonical z-order after every
   `setStyle`. No module may assume provider-specific layer ids — anchors are
   resolved by scanning `map.getStyle().layers` by type.
2. **Precision gate**: no UI module formats a coordinate directly. All coordinate
   display goes through `gameCoords.format*()`; all parsing through
   `gameCoords.parse*()`. Deep links emit via `gameCoords.toShareParams()`.
3. **Cluster ↔ selection**: selection sets a leaf-level `is_selected` property and
   calls `setData` once (<15 ms re-cluster); `clusterProperties` aggregates
   `max(is_selected)` for the cluster halo. No imperative cluster hunting.
4. **Search ↔ map**: `searchIndex` queries the full named dataset (never just the
   visible viewport); result selection flies to `clusterMaxZoom + 1` (z15),
   guaranteeing the pin is unclustered without fragile cluster-id lookups.
5. **Counters**: `mapCounters` is the single source of displayed counts; named pins,
   density layer, and filtered-out counts are always separate numbers.

---

## 7. Anti-false-precision policy (canonical)

Applies to readout HUD, search, deep links, detail panel, entity pages.

| Surface | v1 rule (RMSE 5.41 km) |
|---|---|
| lat/lng display | 2 decimals, `≈`-prefixed where game-derived |
| Game X/Y display | nearest 100 units, always `~`-prefixed (e.g. `~−3400`) |
| Share URL lat/lng | 4 decimals max (~11 m — still coarser than error, stable across re-fits) |
| `needCoordVerification` records | "approximate" quality forced on every surface + dashed/`≈` map treatment |
| HUD footnote | `Map fit v1 · ±5 km` always visible next to coordinates |

Revisit the ladder when the Phase C re-fit lands (tighter RMSE → finer display).

---

## 8. Module map (`src/modules/map/`)

| Module | Responsibility |
|---|---|
| `styleManager.ts` | Base-style registry, style resolution, canonical z-order, overlay registry + rebuild after `setStyle`, attribution data |
| `gameCoords.ts` | Affine transform wrapper, precision ladder, format/parse API, `transform.vN.json` consumer |
| `data/transform.v1.json` | Build-time artifact: 6 coefficients + inverse, RMSE, control-point refs, dataset commit |
| `clusterSource.ts` | Named-pin GeoJSON source (clustered), `certainty_rank`, `clusterProperties` aggregates |
| `pinAdapter.ts` | Entity/pin records → GeoJSON features (named only) |
| `markerLayer.ts` | Cluster circles + counts + unclustered pins, certainty styling |
| `pinsOnlyLayer.ts` | 1,626 unnamed dots: separate unclustered source, minzoom 10, no interactivity, "Community density" toggle |
| `clusterInteraction.ts` | Click-to-expand, selection halo, found-state styling |
| `searchIndex.ts` | Full named-dataset search (name + tags), certainty badges in results |
| `viewportLoader.ts` | Pass-through now; paging contract + 10k-point activation flag |
| `mapCounters.ts` | Honest three-number counters; density layer counted separately |
| `camera3d.ts` | Pitch ramp, 2D/3D toggle, reduced-motion, bearing/north-up |
| `deepLink.ts` | Canonical URL schema, validation, `replaceState` sync, title/meta updates |
| `tileFallback.ts` | Retry ladder, degraded style, splash progress, 12 s timeout |
| `deviceCaps.ts` | WebGL probe, capability tiers, pixel-ratio caps, one-way step-down |
| `settings.ts` | Versioned localStorage prefs (`gta6mapx:map-settings` v1), private-mode-safe |
| `perf.ts` | Budget marks, rAF frame monitor, longtask observer, `assertBudgets()`, `?perf=1` overlay |
| `components/BaseLayerSwitch.tsx` | Leonida Dark ↔ Real Florida UI (original design) |
| `components/CoordHud.tsx` | Terminal-style coordinate HUD (original design) |
| `components/GameFrameLegend.tsx` | "Approximate projection" honesty legend for Real Florida mode |

`GameMap.tsx` → orchestration only. `MapLoader.tsx` → owns splash chrome (untouched scope per camera slice).

---

## 9. Performance budget (release gates)

| Metric | Gate |
|---|---|
| Interactive (desktop broadband) | ≤ 1.5 s |
| Interactive (mid-tier mobile) | ≤ 2.5 s |
| Frame rate | 60 fps desktop / ≥ 30 fps mobile during pan/zoom |
| Main-thread tasks | zero > 50 ms |
| Marker data | ≤ 2 MB total; GeoJSON ≤ 150 KB / 80 KB gzipped |
| `setData` re-cluster (3k pts) | < 15 ms |

Instrumented via `perf.ts`; regressions fail the phase.

---

## 10. Phased implementation checklist

**Standing flow per phase:** implement → `npm run lint` → standalone TS check →
`npm run build` → route/visual smoke tests → commit → GitHub push → deploy.
(Next.js 16 docs pre-read required before the first code change of each phase.)

- [ ] **P0 — Harness.** Read `node_modules/next/dist/docs/` (AGENTS.md rule). Add
      `perf.ts` with budget assertions + `?perf=1` overlay; record baseline timings
      of the current map. Legal self-check: no competitor code/URLs/assets anywhere.
- [ ] **P1 — Coordinate truth.** `gameCoords.ts` + `data/transform.v1.json`
      (coefficients from the existing clean-room fit, RMSE 5.41 recorded).
      Fix `toFixed(4)` in the detail panel to the precision ladder. HUD shows
      `Map fit v1 · ±5 km`.
- [ ] **P2 — Style manager + 3D behavior.** `styleManager.ts` with canonical z-order
      and overlay registry; migrate the 3D-buildings layer into it; implement the
      zoom-ramped pitch in `camera3d.ts`; pitch-only 2D/3D toggle; reduced-motion;
      north-up snap. Verify: no visual regression vs. current map.
- [ ] **P3 — Clustering migration.** `pinAdapter` + `clusterSource` + `markerLayer`
      with certainty-aware rings and mixed-cluster treatment; delete the imperative
      `Marker` effect; selected/found states via `feature-state`/re-cluster.
      Acceptance: all-speculation clusters never look confirmed; <15 ms re-cluster.
- [ ] **P4 — Density layer.** `pinsOnlyLayer` (1,626 unnamed dots, minzoom 10,
      non-interactive, "Community density" toggle default ON persisted). Excluded
      from search/sitemap/counters/progress by construction (no slug in its GeoJSON).
- [ ] **P5 — Search + counters.** `searchIndex` over full named dataset with
      certainty badges; result select flies to z15; `mapCounters` honest
      three-number display (`X of Y shown — Z filtered out`, density counted
      separately, `…` never `0` while loading).
- [ ] **P6 — Deep links.** `deepLink.ts`: canonical schema
      `?lat=&lng=&zoom=&pitch=&bearing=&pin=&style=` (+`?gx=&gy=` inbound alias),
      validation/clamping, debounced `replaceState`, per-pin title/meta updates,
      share-link fidelity rules.
- [ ] **P7 — Base-layer switch.** `BaseLayerSwitch` UI + `setStyle` lifecycle
      (8 s timeout, revert + toast); Leonida Dark (default) ↔ Real Florida with
      game-frame boundary projection + `GameFrameLegend` honesty legend;
      attribution refresh per source; `?style=` round-trip; 3D preserved/restored.
- [ ] **P8 — Coordinate HUD + search mode.** `CoordHud` (rAF-throttled, collapsible,
      copy emits honest formatted string); "Coordinates" search mode accepting
      game X/Y and lat/lng through `gameCoords.parse*()`.
- [ ] **P9 — Tile fallback.** `tileFallback.ts`: retry ladder → degraded style →
      user notice + Retry; honest splash progress; 12 s timeout. Stage-1/2 tile
      sources land later as pure config swaps under the same contract.
- [ ] **P10 — Mobile hardening.** `deviceCaps.ts` tiers + one-way step-down +
      pixel-ratio caps; touch gesture spec (pan/pinch/tilt-rotate, no conflict with
      bottom-sheet swipe); extended WebGL-unavailable fallback; `?forcemap=none`
      QA hook. Test on real mid-tier Android + iOS Safari.
- [ ] **P11 — Settings persistence.** `settings.ts` v1: persist 2D/3D, pitch cap,
      base layer, bearing snap, density toggle. Camera stays in URL; pin/search/
      filters stay session-only.
- [ ] **P12 — Budget verification + scale smoke.** 3,000-point dataset through the
      full pipeline; assert all §9 gates; 10× base-layer switch stress; offline
      mid-switch timeout; share-link round-trip; a11y pass (keyboard path via
      search/list for canvas-rendered clusters).

## 11. Deferred (explicitly out of this spec)

Drawing/measurement toolkit, map-version overlays, "Find the Marker" game, media
library, submissions/moderation flow, account-synced progress — separate specs;
this spec keeps camera and overlay APIs public so they compose later. Final Leonida
tile pipeline (Phase C) is its own workstream; this spec's style/transform seams
absorb it as config + `transform.v2.json`.

## 12. Open questions for the parent

1. Confirm the 10,000-point threshold for activating viewport paging, or set another.
2. Certainty palette final values (green/amber/gray) are owned by the design slice —
   this spec needs the tokens before P3.
3. Satellite sub-toggle inside Real Florida mode: include in P7 or defer?
