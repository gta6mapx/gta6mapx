# Sub-spec: MapLibre Style Architecture + Base-Layer Switch + Game-Coordinate Readout

**Slice:** `src/modules/map/` — style/baselayers/coords only.
**Status:** Phase 1 = spec only. No application code in this document.
**Applies to:** GTA6mapx.com `/map` (Next.js 16 / React 19 / MapLibre GL JS).
**Parent docs:** `~/workspace/gta6mapx/MVP-SPEC.md`, `research/gtadb-import-spec.md` (§1 transform).

> **Standing instruction carried into implementation:** before any Next.js code
> change, the implementer MUST consult the bundled Next.js 16 docs at
> `~/workspace/gta6mapx/web/node_modules/next/dist/docs/` (per `web/AGENTS.md`).
> Breaking changes vs. older Next.js are expected.

---

## 0. Hard constraints (non-negotiable for this slice)

1. **Legal — clean room.** A competitor's map code is AGPL-3.0. Never copy their
   code, tile URL patterns, or assets. Inspired-by *concepts* (a coordinate
   readout, a real-world comparison mode) are fine; every implementation here
   must be original. This spec contains no competitor URLs, asset paths, or
   palette values.
2. **Accuracy — no false precision.** Our staging coordinates live in a game-world
   frame mapped by a clean-room affine transform whose LOOCV RMSE is
   **5.41 km** — approximate grade. Every coordinate surface in this slice
   (readout, search, deep links, entity pages) MUST display precision coarser
   than the transform error, and MUST label game-derived positions as
   approximate. See §3.3 for the precision ladder.
3. **Modularity.** One responsibility per module under `src/modules/map/`.
   Map logic (`GameMap.tsx`) consumes these modules; it does not own style
   JSON, transform math, or readout formatting.
4. **Mobile-first.** Our audience is mobile web. Anything in this slice must be
   cheap on mobile GPUs (one WebGL context, bounded tile memory) and usable
   on small screens.

---

## 1. MapLibre style architecture

### 1.1 Source evolution: placeholder → staged → final

The base map goes through three phases. The architecture must absorb all three
**without changing map logic** — only `styleManager.ts` (§1.3) changes.

| Phase | Base source | What it is |
|---|---|---|
| **A — placeholder (now)** | Keyless third-party vector tiles, dark theme | What `GameMap.tsx` uses today: a ready-made dark vector style over OpenMapTiles-schema tiles of real Florida. Ship-ready today, admitted placeholder (the footer already says "Preview tiles — final map art arrives at launch"). |
| **B — restyled vector** | Same vector tile schema, **our own style JSON** | We keep the tile *source* but author our own layers/paint from scratch: dark-neon Leonida aesthetic (§4.3), our own label hierarchy, game-frame region labels. No new tile pipeline needed. |
| **C — final Leonida tiles** | Our own tile pipeline (vector or raster) | Custom game-world tiles in the Leonida frame. When this lands, the coordinate frame changes (see §3.6 re-fit) and Phase A/B styles retire. |

**Design rule:** style definitions are data + small builder logic inside
`styleManager.ts`, never hardcoded in `GameMap.tsx`. The tile *endpoint* for
Phase C is injected from config (env / config module), never baked into a
string literal in map logic, so endpoint rotation is a config change.

### 1.2 Style JSON composition

Each base-layer definition produces a complete MapLibre style object with
these source groups:

1. **Base geography source** — vector tiles (Phase A/B) or raster tiles
   (Phase C / satellite mode). This is the only part that differs between
   base layers.
2. **Overlay sources (ours, style-independent):**
   - `gta6mapx-entities` — GeoJSON source for entity pins/clusters. Owned by
     the map, re-added by `styleManager` after every `setStyle` (see §1.4).
   - `gta6mapx-gameframe` — GeoJSON polygon(s) of the game-world boundary,
     projected into the current frame via `gameCoords.ts`. Used by the
     real-world comparison mode (§2.1). Re-added the same way.
3. **No inline sprites/glyphs dependency surprises:** Phase A/B reuse the
   tile provider's sprite/glyph endpoints as referenced by *their* style JSON
   (we fetch the whole style JSON, we don't hand-assemble their URLs).
   Phase B's custom style JSON points `glyphs`/`sprite` at endpoints we
   control or at the provider's documented public endpoints — spec'd at
   implementation time, not hardcoded guesses.

### 1.3 Layer ordering strategy

Canonical z-order, bottom → top. `styleManager` enforces this order every time
it (re)builds the overlay stack, so a style swap can never leave our layers
underneath the base:

1. **Base fill layers** — land, water, landcover (from the style's own layers;
   we do not reorder the provider's internal stack except where noted).
2. **Base line layers** — roads, rail, boundaries.
3. **3D buildings (`gta6-3d-buildings`)** — `fill-extrusion`, inserted
   **below the first symbol (label) layer**, exactly as today. Gated:
   `minzoom: 13.5`, height interpolates in from 13.5 → 15 (existing behavior,
   preserved). Only added when the active style's source actually contains a
   building source-layer; `styleManager` checks `map.getSource()` and skips
   gracefully on raster styles (satellite mode has no extrusion — see §2.1).
4. **Label layers** — base style's own labels (Phase B: our authored labels).
5. **Game-frame overlay (`gta6-gameframe-outline`, `gta6-gameframe-fill`)** —
   our GeoJSON boundary, *above* labels so the outline reads clearly, with
   low-opacity fill so underlying geography stays visible.
6. **Entity clusters (`gta6-clusters`, `gta6-cluster-count`)** — circle +
   count labels, above everything geographic.
7. **Entity pins (`gta6-pins`)** — symbol layer for unclustered pins, topmost
   geographic layer. (Whether pins stay as imperative DOM `Marker`s or move
   to a symbol layer is a separate slice's decision; this slice's ordering
   reserves the slot either way. DOM markers always render above the canvas.)

**Ordering mechanism:** after `setStyle` completes, `styleManager.rebuildOverlays(map)`
runs idempotently: remove any of our layer ids if present, re-add sources,
re-add layers in the canonical order using `beforeId` anchors resolved from
the *new* style (first symbol layer id for buildings, etc.). The anchor
resolution must not assume provider-specific layer ids — it scans
`map.getStyle().layers` by type (`symbol` with `text-field`), as the current
code already does.

### 1.4 The swappable-style abstraction — `src/modules/map/styleManager.ts`

One module, one responsibility: **everything about base styles and the
overlay stack**. `GameMap.tsx` calls it; it never constructs style JSON.

Responsibilities owned by `styleManager.ts`:
- **Style registry:** the list of available base layers (id, display name,
  short description, capability flags). Capability flags per style:
  `supports3D` (has building source), `isRaster`, `frame` (`"florida"` |
  `"leonida"`), `minZoom`/`maxZoom` the style is valid for.
- **Style resolution:** given a style id + phase config, produce the style
  input for `map.setStyle()` (URL string for Phase A, JSON object for
  Phase B/C).
- **Switch orchestration:** the `setStyle` lifecycle — emit switch events,
  await style load, then `rebuildOverlays()`. Handles the async gap where
  `map.getStyle().layers` is the *new* style but our overlays aren't back yet.
- **Overlay stack rebuild:** idempotent re-add of our sources + layers in
  canonical order (§1.3), including re-resolving label anchors.
- **Attribution:** `getAttribution(styleId)` returns the exact attribution
  string(s) for the active source(s); `GameMap` feeds this to the
  attribution control. Attribution is per-style data, never hardcoded in UI.
- **Style persistence:** the active style id round-trips through the deep-link
  query param (`?style=…`, see §3.5) so shared links reproduce the view.

Explicitly NOT owned here: camera state, markers/pins, selection, search,
progress. Those stay in `GameMap.tsx` / their own modules.

---

## 2. Base-layer switch design (original implementation)

### 2.1 The two modes

| Mode | Style id | What the user sees | Purpose |
|---|---|---|---|
| **Leonida Dark** (default) | `leonida-dark` | Stylized dark-neon vector map of the game world (Phase A: real-Florida geography in dark theme as acknowledged placeholder; Phase B: our authored Leonida styling; Phase C: true Leonida tiles) | Primary exploration surface |
| **Real Florida** (comparison) | `real-florida` | Real-world reference tiles (satellite imagery preferred; OSM-standard cartography as fallback) **plus our game-world outline overlay** — the Leonida boundary polygon projected onto real Florida via `gameCoords.ts`, with a legend explaining the projection is approximate | "Where would this be in real life?" comparison |

This is our own design on the *concept* of a real-world toggle: the
differentiator is the **projected game-world outline with an honesty legend**,
not a bare tile swap. The overlay + legend are the feature; the tiles are
commodity.

**Satellite vs. cartography for Real Florida:** default to satellite raster
(free-use imagery with attribution, e.g. Esri World Imagery terms — verify at
implementation time and record the exact attribution string in
`styleManager`). Provide a secondary toggle inside the mode for
cartography (OSM-standard style) for users who want labels/roads. This is a
sub-option of the mode, not a third top-level base layer.

### 2.2 Switching mechanics — decision: `setStyle`, not dual instances

| Approach | Pros | Cons | Verdict |
|---|---|---|---|
| **`map.setStyle()` on one instance** | One WebGL context (mobile-safe); camera preserved natively; DOM `Marker`s survive automatically; single tile cache; simpler lifecycle | Async swap — overlays must be rebuilt after style load; brief visual flash; layer ids must be managed | **Chosen** |
| **Two map instances, toggle visibility** | Instant visual swap; no overlay rebuild | Two WebGL contexts (mobile GPUs often refuse the second); double tile memory; camera must be manually synced on every move; markers duplicated or re-parented; container sizing bugs | **Rejected** — violates the mobile-first constraint (§0.4) |

**Switch sequence (owned by `styleManager.switchStyle(map, styleId)`):**
1. Snapshot intent: record target style id; UI enters *switching* state
   (see §2.4).
2. Call `map.setStyle(resolvedStyle)`. Camera, bearing, pitch are preserved
   by MapLibre natively — do not re-apply them.
3. On style `load` event: `rebuildOverlays(map)` (idempotent), refresh
   attribution control text, re-assert 3D building layer only if
   `supports3D`.
4. Emit `switch-ready`; UI leaves *switching* state. Update `?style=` in the
   URL (history.replaceState — no navigation).
5. **Timeout guard:** if style `load` doesn't fire within N seconds
   (spec: 8s, tunable), revert to the previous style id, rebuild overlays,
   and surface a non-blocking toast: "Couldn't load that base map — kept
   your current view." The map must never be left in a half-styled state.

### 2.3 Preserving state across switches

- **Camera** — preserved natively by `setStyle`. No code needed; spec
  forbids re-applying camera on switch (avoids fight-with-user bugs).
- **Markers** — imperative DOM `Marker`s are DOM nodes positioned by
  MapLibre; they survive `setStyle` untouched. After `rebuildOverlays`,
  `styleManager` verifies marker count matches the expected visible set and
  logs a warning if not (diagnostic only — never silently drops pins).
- **Selection** — React state in `GameMap`; unaffected by style swaps.
- **Filters / search query / found-progress** — React/localStorage state;
  unaffected.
- **3D toggle** — the user's 2D/3D preference (`is3D`) persists across
  switches; on entering a style with `supports3D: false` (satellite), pitch
  eases to 0 and the 3D toggle shows a disabled-with-reason state
  ("3D needs the Leonida base"); on returning to `leonida-dark`, the stored
  preference is restored.
- **Game-frame outline** — re-projected through `gameCoords.ts` on every
  switch and on transform version bumps; it is derived data, never stored.

### 2.4 Attribution requirements per source

Attribution is **data owned by `styleManager`**, rendered through MapLibre's
attribution control (compact mode, as today):

- `leonida-dark` Phase A: tile provider + © OpenStreetMap contributors
  (exact strings as required by the provider's terms; record the source of
  each string in a comment for audit).
- `leonida-dark` Phase B/C: our own tiles → "© GTA6mapx fan project" +
  underlying data credits (OSM where applicable).
- `real-florida` satellite: imagery provider attribution per their terms
  (verify at implementation; e.g. Esri-style "Imagery © …" strings) +
  © OpenStreetMap contributors where OSM data is used.
- **Always appended, every mode:** the fan-project disclaimer short form
  ("Fan project — not affiliated with Rockstar Games"), linking to the full
  disclaimer in the footer.
- **GTADB-derived pin data:** attribution to gtadb.org (CC BY 4.0) is a
  **pre-launch blocker owned by Husnain** (recorded decision — he adds it
  himself). This slice must not ship any public deploy without it, but the
  spec does not author the credit text. `styleManager.getAttribution()` must
  include a clearly-marked insertion point for it.

### 2.5 Loading states during switch

- `isSwitching` boolean in `GameMap` state, set from `styleManager` switch
  events.
- Visual: map canvas dims slightly (CSS overlay, pointer-events none) +
  small pill top-center: "Switching base map…" with spinner. The pill uses
  the site's dark panel styling; it must not block the Filters button.
- During switching: the base-layer control is disabled (aria-disabled +
  visual), but pan/zoom stay live — never freeze the user's camera.
- On timeout/failure: toast (auto-dismiss 5s) + revert, per §2.2 step 5.
- First-load is separate from switching: `MapLoader.tsx` keeps owning the
  initial boot skeleton; `styleManager` only handles post-boot switches.

### 2.6 Base-layer control UI (original design)

- Placement: grouped with the existing 3D/Reset controls, top-left stack —
  a segmented control `[ Leonida | Florida ]` with icons (no emoji-only;
  icon + text label, 44px touch targets).
- Behavior: keyboard accessible (`role="radiogroup"`), announces switches
  via `aria-live="polite"` ("Base map: Real Florida").
- The satellite/cartography sub-toggle appears *only* inside Real Florida
  mode, as a secondary segmented pair beneath the main control.
- A one-line legend appears in Real Florida mode, bottom-left above the
  readout: "Dashed outline ≈ Leonida game world projected onto Florida —
  approximate." Dismissible, remembers dismissal in localStorage.

---

## 3. Game-coordinate readout system

### 3.1 `src/modules/map/gameCoords.ts` — the transformer module

One module, one responsibility: **all conversions between the game-world
frame and the map frame, plus the honesty policy**. Nothing else in the app
does coordinate math.

**Inputs (data, not code):** the transform is a versioned artifact,
`src/modules/map/data/transform.vN.json`, generated at build time from the
staging fit (`research/staging/gtadb/.../transform-vN.json`). Contents:
the 6 affine coefficients (forward game→lat/lng), inverse coefficients
(precomputed at generation time — never invert at runtime in a hot path),
`version`, `rmseKm` (5.41 for v1), `fittedAgainst` (dataset commit),
`generatedAt`, and the control-point count. `gameCoords.ts` imports the
current version and exposes its metadata — the UI never hardcodes "5.41".

**Responsibilities:**
- `gameToMap(x, y)` → `{ lat, lng, quality }` — forward affine application.
  `quality` is `"verified" | "approximate"`, derived from record flags
  (see below) and the transform's RMSE band.
- `mapToGame(lat, lng)` → `{ x, y }` — inverse, for the readout and for
  parsing game-frame deep links.
- `getTransformInfo()` → `{ version, rmseKm, fittedAgainst }` — for the HUD
  footnote and diagnostics.
- **Precision policy** (§3.3) — the single source of truth for how many
  decimals / what rounding / what prefix any surface may show. Exposed as
  formatting helpers so UI components can't freelance their own precision.
- **Record quality:** staging marks 294 far-region records
  `needCoordVerification: true`. Any conversion for such a record returns
  `quality: "approximate"` regardless of RMSE, and surfaces must show the
  "approximate location" badge. This flag flows from entity data through to
  the readout — `gameCoords.ts` defines the flag's meaning, entity modules
  carry it.

**What it does NOT do:** rendering, React state, URL parsing (it *converts*;
`GameMap` parses), tile math, or anything with the map instance.

### 3.2 The affine model (reference)

Forward: `lat = a·x + b·y + c`, `lng = d·x + e·y + f` — 6 parameters from
weighted least squares over 7 control points (clean-room fit; math is
textbook, not anyone's IP). Inverse coefficients are precomputed when the
`transform.vN.json` artifact is generated. Phase C (custom Leonida tiles)
requires a re-fit against the new frame — §3.6.

### 3.3 Display rules — the anti-false-precision policy

**Core rule:** displayed precision must always be *coarser* than the
transform's error. With RMSE 5.41 km, showing 4-decimal lat/lng (≈11 m) or
3-decimal game units is dishonest. (Note: the current detail panel shows
`pin.lat.toFixed(4)` — the implementation checklist §6 requires fixing this.)

**Precision ladder** (keyed off `rmseKm` from `getTransformInfo()`, so the
UI auto-tightens when a better fit lands):

| Transform RMSE | Lat/lng display | Game X/Y display | Prefix |
|---|---|---|---|
| > 5 km (v1: 5.41) | **2 decimals** (≈1.1 km) | **nearest 100 units** | `~` always |
| 1–5 km | 2 decimals | nearest 100 units | `~` always |
| 0.1–1 km | 3 decimals (≈110 m) | nearest 10 units | `~` always |
| < 0.1 km | 4 decimals | nearest 1 unit | none (only if a future fit justifies it) |

Additional rules:
- Game-world X/Y are **always** `~`-prefixed and never shown with decimals
  at v1 accuracy. The competitor-style `X: -3407.500` format is explicitly
  banned — three decimals on game units implies sub-unit precision we do
  not have.
- Any `needCoordVerification` record: append the "approximate location"
  badge wherever its coordinates appear (readout, detail panel, entity page
  map snippet). The badge is part of the honesty system, not decoration.
- HUD footnote shows the transform version + RMSE in plain language:
  `Map fit v1 · ±5 km` — never the raw coefficient values.

### 3.4 HUD-style coordinate readout control (original design)

**Concept** (inspired by the *idea* of an X/Y readout; our own design):
a collapsible "coordinates console" in the **bottom-left** of the map,
styled as a dark terminal strip matching the site's neon identity —
monospace, subtle scanline-free, no gimmicks.

**Content (live, follows map center crosshair):**
- Line 1 — game frame: `GX ~−3400 · GY ~−2800` (rounded per §3.3 ladder,
  `~`-prefixed).
- Line 2 — map frame: `≈ 25.76, −80.19` (2 decimals at v1).
- Line 3 (conditional) — `⚠ approximate — fan-map fit v1 (±5 km)` shown
  whenever RMSE > 1 km (i.e. always at v1); plus `unverified pin` when the
  selected pin carries `needCoordVerification`.
- A center crosshair marker (CSS, subtle) indicates the readout samples the
  map center. Toggleable via a small ⌖ button; collapsed state remembers in
  localStorage. Copy button copies the *honest* formatted string
  (e.g. `~GX -3400, ~GY -2800 (≈25.76, -80.19)`).

**Behavior:**
- Updates on `move` (throttled via `requestAnimationFrame`, not per-event
  setState — performance rule for the implementer).
- Hidden on very small heights? No — it's one compact line on mobile
  (game coords only) expanding to full console on ≥sm screens.
- Never shows during `mapError` state.

### 3.5 Conversion API: search "go to coordinates" + deep links

**Search integration** (`GameMap` search box, new mode):
- A segmented toggle in the search dropdown: `Name | Coordinates`.
- Coordinates mode accepts:
  - Game frame: `x, y` pairs, e.g. `-3400, -2800` or `x:-3400 y:-2800`
    (parser owned by `GameMap`/search module; conversion via
    `gameCoords.gameToMap`). Out-of-frame inputs → inline error
    "Outside the known game area."
  - Map frame: `lat, lng` decimal pairs.
- On submit: `flyTo` the converted point, drop a temporary crosshair pin,
  and show the approximate badge when `quality === "approximate"`.
- The parser must reject ambiguous input rather than guess (e.g. a bare
  `25.76` with no partner → error, not a guess).

**Deep links (extends existing `?lat=&lng=&zoom=`):**
- New params: `?gx=&gy=` (game-frame link; converted at load via
  `gameCoords`), `?style=leonida-dark|real-florida` (restores base layer).
- Precedence: explicit `lat/lng` wins if both present; `gx/gy` converts
  then behaves identically. Invalid numbers → fall back to default view
  (never crash, never half-apply).
- `copyLink` ("Share map view") includes the current `style` and emits
  `lat/lng` (map frame — stable across transform versions; game-frame
  params are accepted inbound but we share map-frame outbound so links
  don't rot when the fit improves).
- All shared-coordinate formatting in `copyLink` goes through the
  precision policy (§3.3) — shared links must not leak false precision
  either.

### 3.6 Phase C note — re-fit procedure hook

When custom Leonida tiles replace the placeholder frame, the transform must
be re-fit (procedure lives in `research/gtadb-import-spec.md` §1.5). This
slice's contract for that day:
- `transform.vN.json` bumps version; `gameCoords.ts` reads the new file —
  **no code change** needed in consumers.
- The precision ladder (§3.3) auto-tightens displays if RMSE drops.
- The game-frame outline GeoJSON re-projects automatically (it's derived).
- `?gx=&gy=` deep links keep working (conversion is version-aware via the
  artifact's `version` field; old links are interpreted in the *current*
  fit and labeled approximate — document this in the HUD footnote).

---

## 4. Scale-dependent styling notes

### 4.1 Zoom bands

| Zoom | What's shown | Notes |
|---|---|---|
| 0–8 | Region/county labels only; game-frame outline prominent; **no pins** | Orienting view. Outline is the hero. |
| 8–11 | Clusters appear (counts only); major place labels | Default load is z11 — clusters visible immediately. |
| 11–13.5 | Individual pins fade in; minor labels; road detail increases | Pin interaction fully live. |
| 13.5+ | 3D building extrusion ramps in (13.5→15, existing); full label detail | Only on `supports3D` styles; skipped on satellite. |
| 16+ | Pin hit-areas grow; selected-pin halo emphasizes | Detail/exploration depth. |

**Density rules:** cluster radius adapts per band (spec values at
implementation; principle: fewer, larger clusters low-zoom; single pins by
z12). Label collision ranking: region > city > POI > street; game-world
labels (Phase B+) outrank real-world micro-labels at equal rank in Leonida
mode. Label density halves on screens < 380px wide (mobile declutter rule).

### 4.2 3D gating (existing behavior, preserved + extended)

- Extrusion layer: `minzoom 13.5`, height/base interpolate 13.5→15 — keep
  as-is in Leonida mode.
- Pitch: default 58° on load (existing); 2D/3D toggle preserved across base
  switches (§2.3).
- Satellite mode: no extrusion (raster source has no buildings); pitch
  eases to 0 on entry, restores preference on exit.
- Performance guard: if `map.showTerrain`/extrusion causes frame drops on
  low-end devices, the implementer adds a `prefers-reduced-motion` +
  device-memory heuristic to default those users to 2D — spec the hook,
  tune thresholds from real metrics.

### 4.3 Dark neon Leonida aesthetic guidance (our own palette)

Original direction — Miami neon-noir, defined here, not sampled from any
competitor:

- **Canvas:** near-black blue (`#0a0e14` family, already the site's bg token
  — extend, don't invent a parallel scale).
- **Water:** deep desaturated teal-blue, slightly lighter than canvas so
  coastlines read; subtle inner glow at high zoom only.
- **Land:** very dark blue-grey; parks/vegetation a muted deep green
  (never bright).
- **Roads:** dark slate with faint lighter casing; major arterials pick up
  a dim warm-amber edge at z12+ (the "neon grid" hint — restrained).
- **Labels:** off-white (`#c3cad4` family) for standard labels;
  **uppercase + letterspaced** condensed feel for region/county labels;
  key landmarks (Vice Beach, Leonida Keys…) in warm gold accent;
  interactive/highlight states in neon cyan; CTAs/badges may use
  Vice-pink/magenta sparingly. One accent per view — never cyan + pink +
  gold competing.
- **Game-frame outline:** dashed neon-cyan stroke, low-opacity cyan fill —
  reads as "hologram projection", reinforcing the approximate/fan-made
  honesty story.
- **Typography feel:** condensed grotesque for map labels (system stack is
  fine — no webfont payload on the map); UI chrome keeps the site's current
  type.
- **What to avoid:** pure-black voids, high-saturation fills at low zoom,
  glow effects on mobile low-zoom (GPU cost), any styling that mimics the
  competitor's map 1:1.

Phase A keeps the provider's dark style untouched (it's an acknowledged
placeholder). Phase B authors the above from scratch against the same
vector schema.

---

## 5. Module inventory for this slice

All under `src/modules/map/`. One responsibility each.

| File | Responsibility |
|---|---|
| `styleManager.ts` | **Base-style authority.** Style registry (ids, capability flags, attribution strings), style resolution per phase, `setStyle` switch orchestration with timeout/revert, idempotent overlay-stack rebuild in canonical z-order (§1.3), `?style=` persistence. Map logic never touches style JSON. |
| `gameCoords.ts` | **Coordinate-truth authority.** Wraps the affine transform artifact; forward/inverse conversion; record-quality flags (`needCoordVerification`); the precision ladder + formatting helpers (§3.3); `getTransformInfo()`. No rendering, no React. |
| `data/transform.v1.json` | **Versioned transform artifact** (data, generated at build time from staging). 6 forward coefficients + precomputed inverse, `version`, `rmseKm`, `fittedAgainst`, `generatedAt`, control-point count. Bumped, never edited in place. |
| `components/BaseLayerSwitch.tsx` | **Base-layer switch UI.** Segmented `[Leonida \| Florida]` radiogroup + satellite/cartography sub-toggle + switching pill + failure toast trigger. Disabled state during switch; `aria-live` announcements. Pure presentational; all logic via `styleManager`. |
| `components/CoordHud.tsx` | **Coordinate readout console.** Bottom-left terminal-style readout (§3.4): live GX/GY + lat/lng via `gameCoords`, crosshair, collapse toggle, copy-honest-string button, approximate/fit footnote. Throttled `move` updates. |
| `components/GameFrameLegend.tsx` | **Honesty legend for Real Florida mode.** Dismissible one-liner explaining the projected outline is approximate; localStorage dismissal. (Small enough to live here rather than a generic UI module — it's map-frame-specific copy.) |
| `GameMap.tsx` (refactor, not new) | **Consumer.** Delegates style init + switches to `styleManager`, coordinate math to `gameCoords`, mounts `BaseLayerSwitch` + `CoordHud`; owns camera intent, markers, selection, search parsing, deep-link param handling (`?style=`, `?gx=&gy=`). Loses its hardcoded `TILE_STYLE` const and `toFixed(4)` coordinate displays. |
| `MapLoader.tsx` (unchanged scope) | Keeps owning initial boot skeleton/error state. `styleManager` handles only post-boot switches. Listed here so the boundary is explicit. |

**Not in this slice** (other sub-specs own them): marker clustering
implementation, entity data model, search result ranking, progress
persistence, mobile bottom sheet, admin/moderation.

---

## 6. Implementation checklist for this slice

**Before writing code:**
- [ ] Implementer reads the bundled Next.js 16 docs at
  `web/node_modules/next/dist/docs/` (per `web/AGENTS.md`) — required
  before any Next.js change.
- [ ] Re-read `research/gtadb-import-spec.md` §1 (transform model, control
  points, validation thresholds) and this spec's §0 constraints.
- [ ] Confirm free-use imagery terms + exact attribution strings for the
  Real Florida satellite source; record strings in `styleManager` with a
  comment citing the terms page. (Leave the gtadb.org CC BY 4.0 credit slot
  empty — Husnain adds it himself pre-deploy; deploy is blocked without it.)

**`gameCoords.ts` + data artifact:**
- [ ] Generate `src/modules/map/data/transform.v1.json` from the staging
  fit (6 coefficients, precomputed inverse, version, `rmseKm: 5.41`,
  dataset commit, control-point count). Build-time script, checked-in output.
- [ ] Implement forward/inverse conversion + `getTransformInfo()` +
  precision-ladder formatting helpers. Unit-test: known control points
  round-trip within tolerance; formatting helper returns 2-decimal lat/lng
  and `~`-prefixed 100-rounded GX/GY at v1 RMSE.
- [ ] Wire `needCoordVerification` → `quality: "approximate"` through entity
  data to every coordinate surface.

**`styleManager.ts`:**
- [ ] Style registry with capability flags (`supports3D`, `isRaster`,
  `frame`, zoom range) for `leonida-dark` (Phase A style URL) and
  `real-florida` (satellite + cartography sub-option).
- [ ] `switchStyle()` with the §2.2 sequence: setStyle → await load →
  rebuild overlays → attribution refresh → `?style=` URL update; 8s
  timeout with revert-to-previous + toast.
- [ ] Idempotent `rebuildOverlays()`: re-add `gta6mapx-entities` +
  `gta6mapx-gameframe` sources and layers in canonical z-order (§1.3),
  resolving the first-symbol-layer anchor from the *new* style (no
  hardcoded provider layer ids); 3D buildings only when `supports3D`.
- [ ] `getAttribution(styleId)` per-source strings + fan-disclaimer short
  form + clearly-marked gtadb.org credit insertion point (empty until
  Husnain fills it).
- [ ] Phase-B/C readiness: style resolution reads tile endpoints from
  config, not literals; document where the Phase B custom style JSON will
  plug in.

**UI components:**
- [ ] `BaseLayerSwitch.tsx`: segmented control, sub-toggle, switching
  disabled state, `aria-live` announcements, 44px targets.
- [ ] `CoordHud.tsx`: bottom-left console, GX/GY + lat/lng via
  `gameCoords`, rAF-throttled move updates, collapse (localStorage), copy
  button emitting the honest formatted string, fit footnote
  (`Map fit v1 · ±5 km`), hidden on `mapError`.
- [ ] `GameFrameLegend.tsx`: dismissible approximate-projection legend,
  Real Florida mode only.

**`GameMap.tsx` refactor:**
- [ ] Remove hardcoded `TILE_STYLE`; init style via `styleManager`.
- [ ] Preserve camera/markers/selection/filters across switches (§2.3);
  3D preference persists, eases to 0 on satellite, restores on return.
- [ ] Search "Coordinates" mode: parse `x,y` / `lat,lng`, convert via
  `gameCoords`, flyTo + temporary crosshair + approximate badge; reject
  ambiguous input.
- [ ] Deep links: accept `?gx=&gy=` and `?style=`; `copyLink` emits
  `lat/lng` (map frame) + `style`, formatted through the precision policy.
- [ ] **Fix false precision:** replace `pin.lat.toFixed(4)` /
  `pin.lng.toFixed(4)` in the detail panel with policy-formatted output
  (2 decimals + `~` at v1) and add the approximate badge.
- [ ] Mount `BaseLayerSwitch`, `CoordHud`, `GameFrameLegend`; wire
  `isSwitching` dimming pill.

**Verification:**
- [ ] Switch Leonida ↔ Florida 10× on desktop + a mid-range Android:
  no half-styled state, overlays rebuilt every time, attribution correct
  per mode, camera never jumps.
- [ ] Kill the tile endpoint mid-switch (devtools offline): timeout fires,
  previous style restored, toast shown, map interactive.
- [ ] Readout check: move map, confirm GX/GY are `~`-prefixed and
  100-rounded, lat/lng 2-decimal, footnote shows `v1 · ±5 km`.
- [ ] Share-link round trip: copy link in Florida mode → open in fresh
  tab → same style, same view, no console errors.
- [ ] Accessibility pass: switch control keyboard-operable, readout
  `aria-live` polite, color contrast of HUD text on map ≥ 4.5:1.
- [ ] Confirm no competitor code/URLs/assets/palette values appear
  anywhere in the diff (legal self-check).
