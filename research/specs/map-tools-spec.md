# Map Tools Spec — Drawing, Measurement, Overlays & Display

**Project:** GTA6mapx.com · **Phase:** 1 — spec only (no implementation code)
**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · MapLibre GL JS
**Module home:** `src/modules/map/tools/` (+ `src/modules/map/components/toolbar/`)
**Status:** spec finalized 2026-09-24 · supersedes nothing (first version)

> **Original work.** Competitor map sites were observed read-only as concept
> reference only. Their code is AGPL-3.0 — never reproduce it. Never hotlink,
> copy, or embed their tile assets. Never ship Rockstar map art. Everything
> below is an original design on MapLibre GL JS.

Related work: `src/modules/map/GameMap.tsx` (existing 3D map, 2D/3D toggle,
`PITCH_3D = 58`), `src/modules/progress/useFound.ts` (localStorage pattern to
follow). This spec is organized as: **§1 shared contracts** (binding on all
tool modules) → **§2 drawing** → **§3 measurement** → **§4 overlays** →
**§5 display settings** → **§6 toolbar & shortcuts** → **§7 module tree** →
**§8 phased implementation checklist**.

---

## 1. Shared contracts (binding)

Every tool module below MUST honor these contracts. They exist to prevent the
three tool families from conflicting with each other, with markers, and with
the base map.

### 1.1 Tool lifecycle state machine

One active tool at a time. Lifecycle: `idle → active → commit | cancel`.

- `ActiveTool = "select" | ToolKind | null`, where `null` = navigate mode
  (default; map behaves normally). `ToolKind = "pen" | "line" | "rect" |
  "circle" | "measure-distance" | "measure-area"`.
- Activating a tool while another is active **cancels the first** (in-progress
  work discarded; nothing is silently committed).
- `commit` (double-click / Enter / Done button) saves the shape/measurement
  and returns to `idle`. `cancel` (Esc / re-click active tool / select a
  marker) discards in-progress work and returns to `idle`.
- **Active tool state is session-only and NEVER persisted.** A reload always
  returns to idle navigate mode. In-progress sketches are dropped on reload
  (best-effort `beforeunload` warning only if a sketch is mid-commit).
- While any tool is active: marker click-through is disabled (clicking a pin
  is a no-op, no popup opens). Selecting a marker explicitly exits the tool.
- Panels (Overlays / Display) may stay open while a tool is active, but only
  one panel at a time on desktop; mobile uses a single bottom-sheet instance.

### 1.2 Fixed layer ordering (bottom → top)

1. **base** — base vector/raster tiles (base-layer switch operates here only)
2. **overlays** — registered overlays in registry order (raster/image layers)
3. **grid** — graticule vector lines (§5.1)
4. **heatmap** — marker-density heat layer (§5.3)
5. **drawings** — user draw shapes (§2)
6. **measurements** — distance/area guides (§3)
7. **markers** — entity pins (existing)
8. **labels/popups** — pin labels, detail popups (existing)

Overlay/tool layers insert via `addLayer(..., beforeId)` before the first
marker/drawing layer; if the "before" layer doesn't exist yet (markers mount
later), fall back to `moveLayer` after mount — never duplicate layers.

### 1.3 Persistence conventions

- Every persisted blob uses a **versioned key** (`gta6mapx.<domain>.v<n>`).
- Reads are client-only (`useEffect`-guarded), wrapped in try/catch with
  schema-shape validation. On failure: drawings are **quarantined** to
  `gta6mapx.drawings.v1.corrupt.<timestamp>` (never silently delete user
  data); measurements reset to empty with a one-time non-blocking toast.
  Never throw to the user.
- On version mismatch: run a migrator if one exists, else reset to defaults
  and log.
- `QuotaExceededError`: keep in-memory state, warn once per session.

Keys (locked):

| Key | Contents |
|---|---|
| `gta6mapx.drawings.v1` | `{ version, savedAt, features: DrawFeature[] }` |
| `gta6mapx.measurements.v1` | `{ version, measurements: Measurement[] }` (raw vertices only) |
| `gta6mapx.display-settings.v1` | all display settings incl. `units`, marker colors, overlay order/opacity/visibility (NOT image files — see §4.2c), `is3D` |

Unlike the observed competitor (whose settings were session-only), **all
display settings persist** across reloads.

### 1.4 Interaction locks

Per-tool map-interaction rules, managed by a shared `mapInteractionLocks`
helper:

| Tool mode | Locks |
|---|---|
| Rectangle draw | `boxZoom` OFF (Shift-drag is the rect gesture); `dragPan` stays ON |
| Pen (freehand) | `dragPan` OFF while pointer is down (mouse users expect click-drag to draw); right-drag pan remains as escape hatch; re-enable on pointerup / tool exit |
| Measure (either) | `doubleClickZoom` OFF (double-click commits); `dragPan` stays ON |
| Mobile draw mode ON | one finger draws; two fingers pan/zoom (`touchZoomRotate` stays enabled); `dragPan`/`scrollZoom` one-finger interference off |

### 1.5 Styling identity

- Neon-noir HUD. Primary accent neon pink (`#FF2E88`-family), secondary
  electric cyan (`#22D3EE`-family), warm orange (`#FF7A18`-family).
- Chips/panels: dark glass (`bg-black/70 backdrop-blur`), 1px neon borders,
  tabular/mono numerals for readouts.
- Cursor: `crosshair` while any tool is active.
- `prefers-reduced-motion: reduce` disables all toolbar/panel animations
  (flyout, sheet slide, highlight transitions become instant); gate any
  JS-driven animation duration behind the same query.
- Touch targets ≥ 44px for buttons, ≥ 24px (28–32 recommended) for map vertex dots.

### 1.6 2D/3D rules

- All pointer input resolves via `map.unproject()` → lng/lat on the **ground
  plane**. A pitched camera changes perspective only; stored coordinates are
  camera-independent, so drawings and measurements persist untouched across
  2D/3D toggles and re-render identically.
- `line-pitch-alignment` stays `viewport` (default) so annotation strokes keep
  constant screen thickness in both modes — deliberate: annotation legibility
  over terrain-draped realism.
- Measurements are **planimetric** (flat-map) — NOT terrain- or
  building-height-following. The UI MUST carry a small honest disclaimer:
  *"Planimetric — flat-map distance, not terrain-following."* This stays true
  after custom Leonida tiles land (no elevation model in v1).

### 1.7 Neon drawing palette (shared by draw tools)

8 swatches: `#FF2E88` Neon Pink · `#FF7A18` Sunset Orange · `#22D3EE` Electric
Cyan · `#00F5D4` Miami Teal · `#A855F7` Purple Haze · `#FACC15` Laser Lemon ·
`#F8FAFC` Ghost White · `#0B0B10` Void Black. Plus native custom color input +
"recent colors" row (last 6, persisted).

---

## 2. Drawing toolkit

Self-contained module: `src/modules/map/tools/draw/`. User-authored vector
annotations only — no game data involved. v1: single-user, local-only.

### 2.1 Tool set & interaction model

| Tool | Desktop pointer model | Finish | Cancel | Touch |
|---|---|---|---|---|
| **Pen** (freehand) | `pointerdown` starts, `pointermove` appends (pointer capture), `pointerup` commits | pointerup (auto-commit) | Esc mid-stroke discards preview | one-finger draw; commits on touchend |
| **Line** (polyline) | click places each vertex; live rubber-band preview | double-click, Enter, or click first vertex (snap-close hint ≤10 px) | Esc or right-click discards | tap per vertex; on-screen ✓/✗ buttons as double-tap fallback |
| **Rectangle** | drag corner A → B; alt: click-click two corners | pointerup / second click | Esc or right-click before release | tap two opposite corners |
| **Circle** | drag center → edge (radius = pointer distance); alt: click center, click edge | pointerup / second click | Esc or right-click before release | tap center, tap edge point |

- Minimum-geometry guards: line needs ≥2 distinct vertices; rect/circle need
  non-zero area (drag <4 px = cancel, treated as click).
- Right-click cancel must `preventDefault` the context menu only while a draw
  is in progress.

### 2.2 Styling controls

- Swatches (§1.7) + custom color; thickness slider 1–12 px (default 3);
  opacity slider 0–100% (default 90%).
- Fill for closed shapes (rect, circle) only: toggle (default ON) + separate
  fill-opacity slider (default 20%). Open shapes never fill.
- Style edits apply to the current selection if one exists, else become the
  default for new drawings. Toolbar shows "applies to: selection / new
  drawings" hint.

### 2.3 Rendering

- Single GeoJSON source `drawings-src` (one `FeatureCollection`, stable string
  ids) + layers: `draw-fill` (fill, closed kinds), `draw-line` (line, all),
  `draw-vertex` (circle, line-kind only, shown while selected/drawing —
  visual only in v1).
- Selection highlight via `map.setFeatureState({source, id}, {selected:true})`
  + data-driven paint (`["case", ["boolean",["feature-state","selected"],false],
  highlightColor, baseColor]`) and dashed-white `line-dasharray` overlay. No
  duplicate features.
- Live preview uses a separate ephemeral source `draw-preview-src` (never
  persisted, never in history).
- Circles stored as 64-vertex polygon approximations + semantic
  `meta { center, radiusMeters }` so re-generation is exact.

### 2.4 Selection & editing

- Select mode (or no tool + Alt/Cmd): `queryRenderedFeatures` on draw layers →
  nearest feature within 8 px → highlight + style mini-editor.
- `Delete`/`Backspace` removes selected (pushes history). Esc deselects.
- **Drag-to-move: YES in v1** — whole-feature translate by pointer delta in
  lng/lat (~20 lines, no topology risk; repositioning annotations is core to
  map markup). Vertex editing deferred to v2.
- Move: `pointerdown` on a selected feature disables `dragPan` for the
  gesture, translates on `pointermove`, commits + pushes history on
  `pointerup`. Pointerdown that misses all drawings pans normally.

### 2.5 Undo/redo — snapshot pattern (locked decision)

Rationale: mutations are heterogeneous (draw, move, delete, style, clear,
import) — inverse ops per mutation would be error-prone; snapshots are one
code path and our data volume is tiny (≤200 features → 50-deep stack <5 MB
worst case).

- Before every committed mutation, push `structuredClone(features)` + label +
  timestamp. Undo pops to redo stack and restores; any new mutation clears
  redo. Depth **50**, oldest dropped silently.
- `Ctrl/Cmd+Z` / `Ctrl/Cmd+Shift+Z` or `Ctrl+Y` (ignored in text inputs).
  Toolbar buttons with disabled states + tooltips ("Undo: delete circle").

### 2.6 Clear-all

Custom on-identity confirm dialog (not `window.confirm`): shows drawing count,
"Cancel" / "Delete N drawings" (destructive). Confirm pushes a history
snapshot first → **fully restorable via Undo**. Toast after: "Cleared N
drawings — Undo to restore."

### 2.7 Persistence

Per §1.3, key `gta6mapx.drawings.v1` = `{ version: 1, savedAt, features }`.
Save debounced 500 ms after committed changes (never during preview/move).
Restore on mount with validation; corruption → quarantine + non-blocking
banner. `QuotaExceededError` → in-memory + one warning per session.

### 2.8 Export / import

- **PNG:** default **render-once** (no `preserveDrawingBuffer` — it permanently
  costs GPU/compositor performance for a rare action): on export,
  `map.once("render", capture)` + `map.triggerRepaint()`; `canvas.toBlob()`
  → download `gta6mapx-drawings-<YYYYMMDD-HHmm>.png`. Captures WebGL canvas
  only (map + drawings), not DOM HUD. Documented fallback: flip
  `preserveDrawingBuffer: true` behind a flag if render-once ever returns
  blank on a platform. v1: 1x scale (2x = v2).
- **GeoJSON export:** current features as `FeatureCollection` with
  `properties.draw = { kind, style, createdAt }` so re-import round-trips →
  `gta6mapx-drawings-<date>.geojson`.
- **GeoJSON import:** file picker (`.geojson`/`.json`); validate top-level
  `FeatureCollection`, features with geometry in `{LineString, Polygon}`,
  finite coordinates within world bounds; per-file error list; **cap 200
  imported** (combined total ≤ §2.9 limit); fresh ids + `createdAt: now`;
  single undoable mutation.

### 2.9 Limits & performance

- **Max 200 drawings.** At cap, new draws blocked with notice ("Drawing limit
  reached (200) — delete or clear some to continue").
- Freehand simplification pipeline: radial pre-filter (<2 px apart at current
  zoom, dropped) → Douglas–Peucker (tolerance 2 px expressed in degrees via
  `map.unproject` delta at stroke centroid) → hard cap 2,000 vertices/stroke,
  doubling tolerance until under cap.
- `source.setData()` per committed change is O(n) over ≤200 small features —
  negligible. Preview mutates only the preview source.

### 2.10 Mobile

Dedicated draw-mode toggle (floating pencil FAB, thumb-reachable): ON →
one finger draws, pinch zooms (`touchZoomRotate`); slim banner shows active
tool + "Done". **Tools auto-exit to navigate after each completed shape on
touch** (prevents stray marks); desktop keeps tools sticky. Line tool gets
on-screen ✓/✗ buttons. Tap selects; drag on a selected feature moves it
(same hit-test gate as desktop).

### 2.11 Key interfaces (spec)

```ts
type ToolKind = "pen" | "line" | "rect" | "circle";
type ActiveTool = "select" | ToolKind | null;

interface DrawStyle {
  color: string; thickness: number; // 1..12
  opacity: number;                  // 0..100
  fill: boolean;                    // closed shapes only
  fillOpacity: number;               // 0..100
}
interface CircleMeta { center: [number, number]; radiusMeters: number }
interface DrawFeature {
  id: string;                       // crypto.randomUUID()
  kind: ToolKind;
  geometry: GeoJSON.LineString | GeoJSON.Polygon;
  style: DrawStyle;
  meta?: CircleMeta;
  createdAt: string; updatedAt: string; // ISO
}
interface DrawingsDoc { version: 1; savedAt: string; features: DrawFeature[] }
interface HistoryEntry { features: DrawFeature[]; label: string; at: string }
```

**v2 (out of scope):** vertex editing, multi-select, 2x PNG, resize handles,
text labels, shareable drawing links, cloud sync.

---

## 3. Measurement tools

Self-contained module: `src/modules/map/tools/measure/`. v1: distance tool,
area tool, global units, multiple concurrent measurements, persistence,
copy, GeoJSON export, mobile support. v2 (out): bearings, terrain-following,
POI snapping, circle/radius, named sets, URL sharing.

### 3.1 Tools & activation

- Toolbar "Measure" (ruler icon) → picker: **Distance** / **Area**. One tool
  active at a time; activating exits pin selection, cursor → `crosshair`.
- Exiting (Esc / re-click) leaves finished measurements visible; only the
  in-progress sketch is cancelled. Pin click-selection suspended while active.

### 3.2 Gestures (locked)

- **Finish:** double-click OR Enter OR click last vertex marker (all three;
  double-click is the documented desktop primary). Area auto-closes on finish.
- **Cancel sketch:** Esc or on-screen ✕ (mobile).
- **Undo one vertex:** right-click (desktop `contextmenu`); on-screen Undo chip
  on mobile. Right-click never deletes finished measurements.
- **Mobile:** floating **Done** button finishes — double-tap is unreliable and
  is NOT a finish gesture on touch.
- Distance needs ≥2 vertices; area needs ≥3; fewer cancels the sketch.

### 3.3 Distance tool

Click-to-place vertices (neon dots, ≥24px touch targets); multi-segment
polyline; **live running total** label follows cursor (committed + rubber-band
segment); **per-segment length labels** at midpoints; final **total chip**
anchored at last vertex (the selectable/copyable result).

### 3.4 Area tool

Click-to-place vertices; dashed rubber-band auto-close preview to first
vertex; **live area readout** follows cursor; on finish: solid neon outline +
translucent fill (~20% opacity); result chip anchored at polygon centroid.

### 3.5 Units system

- Global `Units = "metric" | "imperial"` — **one shared setting** living in
  `gta6mapx.display-settings.v1` (§1.3, §5.5), consumed by measure tools.
  Toggle lives in Display settings panel AND as a quick-toggle chip inline on
  the measurements UI. Changing units re-renders every label live.
- Values stored in meters / m²; totals **recomputed from raw vertices** on
  load so unit toggles apply retroactively.

**Formatting rules (exact):**

| System | Distance | Area |
|---|---|---|
| Metric | `<1000 m` → `850 m` (int); `≥1000 m` → `1.24 km` (2dp) | `<1,000,000 m²` → `45,200 m²`; `≥` → `1.24 km²` (2dp) |
| Imperial | `<1 mi` → `2,789 ft` (int); `≥1 mi` → `1.24 mi` (2dp) | `<1 mi²` (27,878,400 ft²) → `486,000 ft²`; `≥` → `2.31 mi²` (2dp) |

Rounding half-up, `en-US` separators. Copy text mirrors the chip exactly.

### 3.6 Geodesic accuracy

- **Distance:** haversine on WGS84 lng/lat (R = 6,371,008.8 m). Write the
  ~10-line formula originally — do NOT vendor AGPL code, do NOT add Turf.
- **Area:** spherical excess (not planar shoelace); document method in code
  comments.
- Haversine-vs-ellipsoid error ~0.3% — fine for game-map scale; state in
  comments. Our Miami-area placeholder coords are real lng/lat, so geodesic
  math is valid.

### 3.7 Multiple measurements

Several finished measurements coexist, each with its own chip (distance: last
vertex; area: centroid). Click chip/geometry to select (brighter glow + ring);
click empty map to deselect. `Delete`/`Backspace` or chip ✕ removes selected.
**Clear-all:** button in measurements panel header; no confirm for ≤3 items,
confirm dialog for ≥4. Collapsible measurements list: rows with kind icon,
formatted total, unit chip, select/delete, export button, quick unit toggle,
and the planimetric disclaimer (§1.6).

### 3.8 Persistence

Key `gta6mapx.measurements.v1`. Per measurement: `id`, `kind`, `vertices:
[lng,lat][]` (source of truth — **never store computed totals**), `unit`
snapshot (display context only), `createdAt` ISO. Restore on init with
shape validation; corruption → discard + one-time toast "Saved measurements
couldn't be read — starting fresh." Cap: newest 50, drop oldest.

### 3.9 Copy / export

- Click result chip → `navigator.clipboard.writeText` of display text
  (`1.24 km`), with "Copied" micro-confirmation; fallback path for
  non-secure contexts.
- **Export GeoJSON** (v1, include if cheap): `measurements.geojson` —
  `LineString`/`Polygon` features with `properties: { id, kind, distance_m |
  area_m2, unit, createdAt }`, raw lng/lat (EPSG:4326).

### 3.10 Mobile

Tap-to-place; Done button finishes; on-screen Undo chip during sketch;
≥24px vertex/chip targets; results panel as bottom sheet (reuse map's
existing sheet pattern); pinch/two-finger pan keep working; single-finger
drag pans while sketching (vertices on tap only, not drag).

### 3.11 Key interfaces (spec)

```ts
type Units = "metric" | "imperial";
type MeasureKind = "distance" | "area";
type MeasureVertex = [lng: number, lat: number]; // GeoJSON order
interface Measurement {
  id: string; kind: MeasureKind;
  vertices: MeasureVertex[];  // raw lng/lat — source of truth
  unit: Units;                // creation-time context only
  createdAt: string;          // ISO 8601
}
interface SketchState {
  tool: MeasureKind | null;
  vertices: MeasureVertex[];
  cursor: MeasureVertex | null;
  selectedId: string | null;
}
```

---

## 4. Overlay layer system

### 4.1 Managed overlay registry

Every overlay is managed through a **single registry** (state + UI), never
ad-hoc sources. Entry shape:

```
{ id: string        // e.g. "leonida-v1", "user-import-<hash8>"
  name: string
  kind: "tile-version" | "user-import" | "reference"
  visible: boolean
  opacity: number   // 0–100
  order: number
  meta: kind-specific // tile URL template / control points / attribution }
```

The renderer subscribes to the registry and reconciles MapLibre
sources/layers: add source + raster layer on register, set `raster-opacity`
on change, toggle `visibility`, remove both on unregister. Reconciliation is
idempotent — re-registering an `id` updates, never duplicates. Layer order
follows §1.2 (base → overlays → grid → heatmap → drawings → measurements →
markers → labels).

### 4.2 Our overlays — rights-safe only

**a) Custom Leonida tile versions (v1, v2, …).** Each version is its own
`kind: "tile-version"` entry with URL template + attribution. Multiple
versions may be visible simultaneously with **independent opacity sliders** —
the built-in comparison mechanic is version-over-version, never
ours-vs-Rockstar.

**b) Base-layer switch interaction.** The base switch (GTA-styled tiles ↔
real-world tiles) operates on the **base** layer only. Overlays persist
across base switches, keep registry order, and live in the Overlays panel —
never inside the base control. A base layer is always present (never null
under an overlay).

**c) User-imported image overlay (differentiator, v1).** The user provides the
art; we provide the tool — this is how "compare against anything" stays
legal.
1. Overlays panel → "Import image overlay" → file picker.
2. **Control-point placement mode:** click 3 points on the map, then the 3
   corresponding corners on the image preview (order enforced and labeled:
   "Click map point 1, then image point 1…").
3. Compute a **3-corner affine transform** and render as a MapLibre `image`
   source.

**Decision — 3-corner affine (not 2-corner).** 2 corners only give uniform
scale + rotation + translation, which breaks on stretched/cropped screenshots
(the common upload case). 3 corners give full affine (translation, rotation,
independent x/y scale, shear) for one extra click. v1 ships 3-corner only.

**Persistence (honest limitation).** The image file loads as a browser object
URL and is **NOT persisted** (localStorage quota; IndexedDB deferred).
Persisted per import: 3 control-point pairs, opacity/visibility, **SHA-256
file hash**. On reload the import shows as **"needs file"** (grayed) until
the user re-selects the file; hash match → instant re-georeference, no
re-clicking; mismatch → re-place points. UI copy: *"Image files aren't stored
— keep your file; re-select it next visit and your placement is restored."*

**Safety rails:** max 10 MB; downscale to ≤2048 px longest edge; reject
non-image MIME; client-local only — never uploaded to any server.

### 4.3 Per-overlay controls

Overlays panel rows: visibility toggle, **opacity slider 0–100%**, rename
(user imports), remove (user imports + tile versions; built-in references
hide but aren't deleted). Thumbnails for image imports; attribution text for
licensed entries. "Solo" mode deferred to v2.

### 4.4 Comparison overlays — done right

**No Rockstar map art anywhere** — no GTA V/IV/Vice City comparisons, no
hotlinking, no embedding. Built-in comparisons are limited to
**openly-licensed sources with visible attribution** (e.g., OSM-derived real
Florida reference, © OpenStreetMap contributors). Comparison UX = our tile
v1 vs v2 (or vs OSM-Florida) with independent opacity sliders.

---

## 5. Display settings

Single settings model persisted in `gta6mapx.display-settings.v1` (§1.3).
One Display panel, desktop-anchored / mobile bottom sheet.

### 5.1 Coordinate grid (graticule)

Toggleable vector line layer. Zoom-adaptive interval:

| Zoom | 0–4 | 5–7 | 8–10 | 11–13 | 14+ |
|---|---|---|---|---|---|
| Interval | 10° | 5° | 1° | 0.1° | 0.01° |

Recompute on `zoomend`. Neon-subtle styling (1px, cyan/pink ~15% opacity);
coordinate labels at line ends only at zoom ≥ 11 (neon-gray 10px mono).
**Honesty:** our coordinates are lng/lat — panel label reads "Coordinate grid
(lng/lat)". Never imply a fictional game-coordinate system.

### 5.2 Camera / FOV HUD

Toggleable readout chip (map corner, HUD-styled): **zoom (1dp) · pitch (°) ·
bearing (°)**, updating on `moveend` (throttled `move`, max 4 Hz).
Informational only; `aria-live="off"` + `title` tooltip.

### 5.3 Heatmap

Toggleable MapLibre `heatmap` layer over the marker pin source, rendered
**under** markers (pins stay clickable). **Decision — certainty-weighted**
(our core differentiator is the evidence model): Confirmed = 1.0, Likely =
0.6, Speculation = 0.3, missing certainty = 0.6. Uniform weighting would let
rumor pins masquerade as confirmed density — misleading. Neon ramp
(transparent → purple → pink → hot orange). One-line legend: *"Heat = pin
density, weighted by evidence certainty."*

### 5.4 Marker colors

Per-category color rows (vehicles, locations, weapons, characters, cheats,
user pins): swatch picker (12 curated neon-safe swatches + native custom
input), live-applied to marker layer paint, **"Reset to defaults"** button.
Defaults must stay distinguishable in 2D and 3D on the dark base.

### 5.5 Settings shape (locked)

```ts
{ version: 1,
  grid: { visible: boolean, intervalOverride: "auto" | number | null },
  fovHud: { visible: boolean },
  heatmap: { visible: boolean },
  markerColors: { [categoryId: string]: string, _defaultsVersion: 1 },
  units: "metric" | "imperial",
  baseLayer: string,
  overlays: { order: string[], byId: { [id: string]: { visible: boolean, opacity: number } } },
  view: { is3D: boolean } }
```

---

## 6. Toolbar UI & keyboard shortcuts

### 6.1 Desktop toolbar

Slim **vertical icon toolbar**, left edge of the map viewport below the site
header (`top` = header height + 12px). Groups top→bottom:

1. **Navigate** — select/pan (`V`)
2. **Draw** — flyout: pen (`P`), polyline (`L`), rectangle (`R`), circle (`C`)
3. **Measure** — distance (`M`), area (`A`)
4. **Overlays** — opens Overlays panel
5. **Display** — opens Display settings panel

~40px icon buttons, 8px radius; active tool = neon-pink ring + filled accent;
tooltips show **name + shortcut** ("Measure distance — M") on hover/focus.
Esc or re-click exits to idle. Panels open as glass panels anchored right of
the toolbar; one panel at a time.

### 6.2 Mobile toolbar

Single **FAB** bottom-right (56px, neon gradient, above bottom-sheet area) →
**bottom-sheet tool menu** with ≥48px rows: Navigate / Pen / Line / Rectangle /
Circle / Measure distance / Measure area / Overlays / Display. **Draw-mode
toggle** at sheet top: ON → one finger draws, two fingers pan (hint text);
resets to OFF on tool exit. Overlays/Display open as full bottom sheets
sharing the sheet component.

### 6.3 Conflict rules

§1.1 + §1.4 apply. Additionally: while a panel is open it doesn't cancel
tools; opening a second panel closes the first.

### 6.4 Keyboard shortcuts (canonical table)

Disabled while focus is in input/textarea/select/contenteditable (and while
the dialog is open, except Esc/`?`). `Ctrl/Cmd` per platform.

| Key | Action |
|---|---|
| `V` | Select / navigate mode (exit any tool) |
| `P` / `L` / `R` / `C` | Pen / polyline / rectangle / circle |
| `M` / `A` | Measure distance / area |
| `Esc` | Cancel tool / close panel or dialog |
| `Ctrl/Cmd+Z` · `Ctrl/Cmd+Shift+Z` / `Ctrl+Y` | Undo / redo (drawing+measurement edit stack only) |
| `Delete` / `Backspace` | Delete selected drawing/measurement |
| `G` | Toggle coordinate grid |
| `H` | Toggle heatmap |
| `F` | Toggle FOV/camera HUD chip |
| `2` / `3` | 2D (pitch 0) / 3D (pitch 58°) |
| `+`/`=` · `-`/`_` | Zoom in / out |
| `?` (Shift+/) | Shortcuts cheat-sheet dialog (focus-trapped; also via toolbar keyboard icon) |

**Rejected for v1:** keyboard overlay-opacity stepping (`[`/`]`) — invites
accidental changes with no visible target context; opacity stays a
panel-slider concern.

---

## 7. Module tree

All new files under `src/modules/map/`. One responsibility per file.

```
src/modules/map/
  useMapSettings.ts            # tiny shared settings store (units etc.), useFound-style pattern
  tools/
    shared/
      mapInteractionLocks.ts   # enable/disable boxZoom/dragPan/doubleClickZoom per tool mode
      glassPanel.tsx           # shared glassmorphism panel/sheet shell (reduced-motion aware)
    draw/
      types.ts                 # ToolKind, DrawStyle, DrawFeature, DrawingsDoc, history types
      palette.ts               # neon swatches, default style, recent colors, style→paint converters
      geometry.ts              # pure geometry: rect/polygon builders, 64-gon circle,
                               # Douglas-Peucker, feature translate, validation (no MapLibre imports)
      store.ts                 # drawings state + selection + undo/redo stacks + persistence/quarantine
      layers.ts                # source/layer creation, feature-state selection highlight, preview source
      interactions.ts          # pointer wiring per tool, hit-testing, drag-move, keyboard
      export.ts                # PNG render-once capture, GeoJSON download + import/validation
      DrawToolbar.tsx          # "use client": tool buttons, swatches, sliders, undo/redo, clear, export/import
      DrawDialogs.tsx          # confirm-clear, import summary/errors, limit notice
    measure/
      types.ts                 # Measurement, MeasureVertex, Units, MeasureKind
      geodesic.ts              # haversine, spherical area, polyline total, centroid (pure, no MapLibre)
      format.ts                # formatDistance/formatArea per §3.5 (pure)
      store.ts                 # tool state, sketch, finished list, selection, persistence (sole state owner)
      interactions.ts          # click/dblclick/contextmenu/keydown wiring, sketch lifecycle, unproject
      MeasureToolbar.tsx       # "use client": picker, Done/Undo/Cancel chips, unit quick-toggle, clear, export
      MeasureLayers.tsx        # "use client": sources + line/fill/symbol layers for sketches & results
      MeasurePanel.tsx         # "use client": measurements list, select/delete, unit toggle, disclaimer, export
    overlays/
      overlayTypes.ts          # registry entry types, kind unions, defaults
      overlayRegistry.ts       # register/unregister/reorder/setOpacity/setVisibility (framework-agnostic)
      overlayRenderer.ts       # registry → MapLibre sources/layers reconciliation (beforeId ordering)
      tileVersionOverlays.ts   # built-in tile-version entries + attribution metadata
      userImageOverlay.ts      # file intake, validation/downscale, 3-point affine, image source, SHA-256
      useOverlays.ts           # React binding: registry ↔ UI state + placement-metadata persistence
      OverlaysPanel.tsx        # list, toggles, opacity sliders, import/remove/rename
    display/
      displaySettingsTypes.ts  # settings shape, defaults, version constant (§5.5)
      displaySettingsStore.ts  # load/migrate/persist the single localStorage key
      useDisplaySettings.ts    # hook: state + updaters + reset-to-defaults
      GridLayer.ts             # graticule layer, zoom→interval table, labels
      FovHud.tsx               # camera readout chip (throttled move updates)
      HeatmapLayer.ts          # heatmap over marker source, certainty weights, neon ramp
      MarkerColors.ts          # per-category color application + swatch definitions
      units.ts                 # km/mi formatting helpers consumed by measure tools
      DisplaySettingsPanel.tsx # grid, FOV, heatmap, marker colors + reset, units toggle
  components/toolbar/
    Toolbar.tsx                # desktop vertical bar: groups, active state, tooltips, flyout wiring
    DrawFlyout.tsx             # pen/line/rect/circle flyout menu
    ToolButton.tsx             # icon button: tooltip + shortcut hint + active ring
    MobileToolFab.tsx          # floating action button
    MobileToolSheet.tsx        # bottom-sheet tool menu + draw-mode toggle
    ShortcutsDialog.tsx        # "?" cheat-sheet modal
    useToolMode.ts             # lifecycle state machine (idle→active→commit/cancel), Esc handling
    useKeyboardShortcuts.ts    # keybindings, input-focus guard, dialog state
```

---

## 8. Phased implementation checklist

Build in this order. Each phase: implement → `npm run lint` + typecheck +
`npm run build` → route smoke test (`/map` 200, no console errors) → commit →
push → deploy. No phase starts until the previous one is green.

- [ ] **Phase T0 — Foundation.** `tools/shared/` (`mapInteractionLocks.ts`,
      `glassPanel.tsx`), `useMapSettings.ts`, `useToolMode.ts`
      (lifecycle), `useKeyboardShortcuts.ts` + `ShortcutsDialog.tsx` (table
      §6.4 wired to no-op-safe handlers), `Toolbar.tsx` + `ToolButton.tsx` +
      `DrawFlyout.tsx` shells with Navigate active. Fixed layer-order
      constants + `beforeId` insertion helper. Verify: toolbar renders,
      shortcuts exit to idle, panels don't exist yet (buttons disabled with
      tooltips "coming in phase T1/T2/T3").
- [ ] **Phase T1 — Drawing toolkit.** `tools/draw/` per §2 + toolbar wiring
      (flyout → tools). Verify acceptance: draw each tool; undo/redo 50-deep
      labels; drag-move; clear-all → undo restores; reload restores from
      `gta6mapx.drawings.v1`; corrupted payload quarantines with banner;
      200-limit notice; PNG export downloads; GeoJSON round-trips; 2D/3D
      toggle keeps drawings identical; mobile draw-mode toggle works.
- [ ] **Phase T2 — Measurement.** `tools/measure/` per §3 + `units.ts` +
      settings-panel units toggle. Verify acceptance: distance 3-clicks →
      double-click total within 0.5% of independent haversine check; area
      4-clicks → Enter within 1% of spherical-excess reference; unit toggle
      re-renders all labels (`850 m`↔`2,789 ft` etc.); Esc cancels;
      right-click undoes vertex; Delete removes selected; clear-all
      thresholds; reload restores raw vertices; chip copy == displayed text;
      disclaimer visible; mobile Done button finishes.
- [ ] **Phase T3 — Overlays.** `tools/overlays/` per §4 + `OverlaysPanel.tsx`
      + registry/renderer. Verify: register/unregister idempotent; opacity
      slider sets `raster-opacity` live; visibility toggle; persist across
      base-layer switch; user image import 3-point affine renders correctly
      (test with a stretched screenshot); reload shows "needs file" then
      re-georeferences on hash match; 10 MB / MIME / downscale guards fire;
      remove/rename work.
- [ ] **Phase T4 — Display settings.** `tools/display/` per §5 +
      `DisplaySettingsPanel.tsx`. Verify: grid intervals per zoom table, labels
      ≥z11; FOV chip live (≤4 Hz); heatmap renders under markers with
      certainty legend; marker colors apply live + reset; all settings persist
      across reload (unlike competitor's session-only); `view.is3D` restores.
- [ ] **Phase T5 — Mobile hardening.** `MobileToolFab.tsx` +
      `MobileToolSheet.tsx`; bottom-sheet variants of Overlays/Display/
      Measure panels; draw-mode toggle per §2.10; ≥44px targets; double-tap
      NOT a finish gesture anywhere on touch; reduced-motion respected.
      Verify on a real mobile viewport (DevTools device emulation minimum;
      physical device preferred).
- [ ] **Phase T6 — Polish & acceptance.** Export-all (drawings + measurements
      GeoJSON), empty states, error toasts, `?` cheat-sheet content review,
      final lint/typecheck/build, `/map` smoke + WebGL check, commit → push →
      deploy.

### Acceptance criteria (cross-phase)

1. One active tool at a time; Esc always returns to idle; marker clicks are
   no-ops while a tool is active.
2. Reload: drawings + measurements + all display settings restore; active
   tool does not.
3. Layer order base → overlays → grid → heatmap → drawings → measurements →
   markers → labels holds in both 2D and 3D.
4. No new hard dependencies (no Turf, no drawing libraries — original code).
5. Planimetric disclaimer visible wherever measurements render.
6. No competitor code, tiles, or assets anywhere; no Rockstar map art;
   attributions present for OSM-derived layers.
7. Production build passes; `/map` returns 200 with zero console errors.

## 9. Open questions (non-blocking, for Husnain)

- Should measurements/drawings be shareable via deep links, or stay
  local-only? (Spec default: local-only v1.)
- Confirm pink = distance / orange = area color assignment.
- Should the user-image overlay ever graduate to IndexedDB persistence, or is
  "re-select file" acceptable long-term?
