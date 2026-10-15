# 3D Engine + Camera + Tiles + Mobile Spec (Phase 1 — spec only)

**Project:** GTA6mapx.com · **Slice owner:** this partial spec
**Status:** SPEC ONLY — no application code in this phase.
**Scope boundary:** 3D behavior, camera state/deep-links, tile loading/fallback, mobile WebGL.
**Related modules root:** `~/workspace/gta6mapx/web/src/modules/map/`
**Stack facts (locked):** Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · MapLibre GL JS (keyless, no API key).

## 0. Constraints this spec must honor

1. **AGPL-3.0 hard legal line.** Competitor `map.stateofleonida.net` (observed: Leaflet, 2D-only) — NEVER copy their code or assets. Our 3D implementation, camera logic, and tile pipeline are 100% our own original work. Ideas absorbed from observation (progress-bar splash, per-pin URLs, persisted settings) are concepts, not code — re-implemented from scratch.
2. **Coordinates are approximate-grade.** GTADB transform LOOCV RMSE = 5.41 km. Deep links must never imply false precision: lat/lng rounded to 4 decimals (~11 m) max, and UI copy must never say "exact".
3. **3D is our differentiator — keep it sharp.** Competitor is 2D-only (Leaflet). The 58° pitch perspective, extruded buildings, and smooth camera work are the moat. Every degradation path below must aim to return to full 3D when the device allows it, never settle silently into 2D.
4. **Next.js 16 doc rule.** Before ANY application code is written against this spec, the implementing agent must read the bundled docs at `~/workspace/gta6mapx/web/node_modules/next/dist/docs/` (see `~/workspace/gta6mapx/web/AGENTS.md`). This is a house rule, not optional.
5. **Modularity.** One responsibility per module under `src/modules/map/`. See §6.

---

## 1. 3D Behavior Spec

### 1.1 Pitch curve vs zoom

Fixed 58° everywhere looks broken at low zoom (horizon crushes). Spec: pitch follows a zoom-driven ramp.

| Zoom range | Target pitch | Rationale |
|---|---|---|
| < 11 | 0° (flat 2D) | Continental view; buildings off anyway |
| 11 → 13.5 | 0° → 45° linear | Gentle reveal of depth while navigating the region |
| 13.5 → 15 | 45° → 58° | 3D buildings fade in here (see §1.2); pitch converges with them |
| ≥ 15 | 58° (max cap) | Full street-level perspective |

- **MAX_PITCH = 58°** (hard cap everywhere: toggle, flyTo, gesture, deep-link parse). Below MapLibre's own max so we never fight the library's clamp.
- The pitch curve applies to: initial load, pin-select flyTo, reset view, deep-link restore, and `zoomend`-driven drift-back (see below).
- **Drift-back on manual zoom:** after a user zooms manually (wheel/pinch/buttons), ease pitch toward the curve's target over 600 ms **only if** the gap exceeds 10° — avoids fighting the user's deliberate tilt (see §1.5) while preventing stuck-at-58° low-zoom views. User-initiated tilt (right-drag / two-finger) sets a `userTilt` flag that suppresses drift-back until the next 2D/3D toggle, reset, or pin select.

### 1.2 3D building extrusion gating

- **Gating source:** OSM vector tiles, `source-layer: "building"`, `filter: ["==", "extrude", "true"]`. Layer id `"3d-buildings"`, inserted below the first symbol layer with a text field (labels stay readable).
- **minzoom: 13.5** on the layer. Height interpolation:
  - `fill-extrusion-height`: `interpolate(zoom, 13.5 → 0, 15 → render_height)`
  - `fill-extrusion-base`: `interpolate(zoom, 13.5 → 0, 15 → render_min_height)`
  - So buildings grow smoothly 13.5→15 in lockstep with the pitch ramp in §1.1.
- **Color ramp (our neon palette, dark base):**
  - 0 m → `#2a3444` (shadow slate)
  - 60 m → `#3b4a63` (steel blue)
  - 150 m → `#57406b` (muted violet — the Vice City neon nod, kept dark)
  - `fill-extrusion-opacity: 0.9`
- **Decorative-failure rule:** extrusion is pure decoration. Any exception during layer creation, any missing `building` source-layer in a future style, or any tile-fetch failure on that layer → catch, skip the layer, **map stays fully usable**. Log a one-line warn to the console; no user-facing error for this case (buildings are not data).

### 1.3 2D/3D toggle animation

- **Current behavior (keep):** `map.easeTo({ pitch: next ? PITCH_3D : 0, duration: 900 })`.
- **Spec:** duration 900 ms, easing = MapLibre's default ease (or explicit cubic in-out if porting to a shared camera util — decision for implementer). The toggle changes **pitch only**: center, zoom, and bearing are preserved.
- **Selected pin:** if a pin is selected, the toggle does NOT re-fly; the detail panel stays open and the camera stays on the pin. Toggle is a view-mode change, not a navigation event.
- **Bearing:** preserved as-is (a tilted-rotated view just flattens/returns in place).
- **State source of truth:** `is3D` boolean in `camera3d.ts`, persisted per §5. On load, restore persisted mode before first render of the map.

### 1.4 Reduced-motion support

- Detect `window.matchMedia("(prefers-reduced-motion: reduce)")`.
- When set: **all camera animations become instant** — `flyTo` → `jumpTo`, `easeTo` → direct `setPitch`/`setCenter`/`setZoom` (or `easeTo` with `duration: 0`). No 900 ms pitch sweep, no 1200 ms pin fly.
- Pin selection still moves the camera and opens the panel — just instantly.
- The splash loader (§3.4) must not play looping progress animations under reduced motion; show a static loading indicator instead.
- This is an accessibility requirement, not a preference toggle — no UI switch needed.

### 1.5 Bearing / rotation UX

- **Gestures (MapLibre defaults, keep enabled):** right-drag (mouse) rotates bearing + tilts; two-finger rotate/tilt on touch (part of `touchZoomRotate` / `touchPitch`).
- **Compass / north-up snap:** add a small compass button (top-right, below the share button, or inside NavigationControl area) that:
  - appears / highlights only when `|bearing| > 2°` (otherwise hidden — reduces chrome),
  - shows current bearing rotated,
  - on click: `easeTo({ bearing: 0, duration: 600 })` (instant if reduced-motion).
- `resetView` already zeroes bearing — keep.
- **Bearing in deep links:** supported (§2.2) but share links only include bearing when `|bearing| > 2°` (keeps the common case clean).

---

## 2. Camera State + Deep Links

Current state: `?lat=&lng=&zoom=` is read on load; share button writes the same three. This section extends it.

### 2.1 Extended URL schema

```
/map?lat=25.7617&lng=-80.1918&zoom=15&pitch=58&bearing=0&pin=malibu-club
```

| Param | Required | Format | Notes |
|---|---|---|---|
| `lat`, `lng` | yes (for camera links) | decimal, ≤4 dp | Parse; reject NaN → ignore link, use default view |
| `zoom` | no | integer 0–22 | Default 11; clamp out-of-range |
| `pitch` | no | integer 0–58 | Clamp to MAX_PITCH; default = curve target for the zoom (§1.1) |
| `bearing` | no | integer −180–180 | Default 0; normalized |
| `pin` | no | entity slug | Our per-pin design, §2.3 |

**Validation rules:** unknown params ignored; malformed numbers ignored individually (never throw, never blank the map). Lat clamped to −90…90, lng to −180…180.

### 2.2 Share-link fidelity rules

- **Captured state:** center (lat/lng), zoom, pitch, bearing, selected pin slug (if any).
- **Rounding (anti-false-precision):** lat/lng → 4 decimals; zoom → integer; pitch → integer; bearing → integer.
- **Omissions for cleanliness:** drop `pitch` if it equals the curve target for that zoom within ±1° (it's derivable); drop `bearing` if `|bearing| ≤ 2°`; drop `pin` if no pin selected. A plain pan/zoom share stays `?lat=&lng=&zoom=` exactly like today.
- **Pin selected → pin-first URL:** `?pin=<slug>&lat=&lng=&zoom=` (pin param first — canonical per-pin URL, human-readable, SEO-friendly). Camera params remain so the link works even if the pin id ever changes.

### 2.3 Per-pin `?pin=<slug>` links (our design, not their code)

- Opening `/map?pin=<slug>`:
  1. resolves the slug to the entity record (vehicles/locations/weapons/characters all have map pins where applicable),
  2. flies the camera to it (zoom = max(current, 15), pitch per curve → 58, or instant under reduced motion),
  3. opens the detail panel (desktop) / bottom sheet (mobile),
  4. updates `document.title` (§2.5).
- Unknown slug → ignore the param, load default view, do not 404 the map route (the map must never die on a bad link).
- **Canonical ordering:** if both pin and camera params are present, pin wins for the camera target; camera params are then replaced via `replaceState` on settle (§2.4).

### 2.4 URL updates: moveend vs explicit share

- **Decision: both.**
  - **Explicit share** (share button / pin select): writes the canonical URL immediately (share button copies it to clipboard too).
  - **Camera settle** (`moveend` + pin select): `history.replaceState` with the fidelity rules of §2.2, **debounced 400 ms** after the last `moveend`. `replaceState` — never `pushState` — so panning doesn't spam the back button.
- **Guards:** skip the replace when the resulting query string is identical to the current one (prevents churn loops); skip while a programmatic fly is in flight (write once on settle, not per-frame).
- **No route change needed:** `/map` stays a single client route; all of this is query-string state. This keeps our SSG story untouched (126+ static entity pages unaffected).

### 2.5 Title/meta update per selected pin (SEO-friendly)

- On pin select: `document.title = "{Pin name} — GTA 6 Interactive Map | gta6mapx.com"`.
- On deselect/close: restore `"Interactive Map — GTA 6 Map | gta6mapx.com"` (match whatever the map page's real default title is at implementation time).
- Meta description: update the `<meta name="description">` tag content to the pin's short description (first ~150 chars) — cheap, no route change, and makes shared per-pin URLs unfurl sensibly.
- Do NOT touch canonical link or JSON-LD here — those belong to the SSG entity pages (`seo/jsonld.ts`), not the client map.

---

## 3. Tile Loading + Fallback Strategy

The tile style is a **placeholder** until the final Leonida tile pipeline exists. This is a staged plan; only Stage 0 ships now.

### 3.1 Stage 0 — OpenFreeMap placeholder (NOW)

- **Source:** `https://tiles.openfreemap.org/styles/dark` (keyless, free).
- **Attribution (exact, always visible, compact control):** `© OpenMapTiles © OpenStreetMap contributors`. When we later swap stages, attribution swaps with it — attribution is a property of the stage config, not hardcoded copy.
- **Why placeholder:** Miami/OSM geography ≠ Leonida game world. The map is a *preview shell* showing our engine, UI, and pins. A persistent, dismissible-once notice near the map ("Preview tiles — final Leonida map art arrives at launch") already exists as microcopy; keep it until Stage 2.

### 3.2 Stage 1 — Our own staged tiles (future)

- **Source:** vector or raster tiles produced by our own pipeline, self-hosted (or R2/S3-compatible object storage + CDN).
- **Spec contract for the stage:** config must declare `styleUrl`, `attributionText`, `attributionHtml`, `minzoom/maxzoom`, and a `healthUrl` (a cheap HEAD-able endpoint for the preflight check in §3.3).
- **Attribution:** OSM-derived data keeps `© OpenStreetMap contributors` plus our own credit line; game-art-derived tiles carry whatever the license review at that time requires. Attribution text lives in the stage config — swapping stages never requires a code change to the attribution control.

### 3.3 Stage 2 — Final Leonida art (future)

- Same config contract as Stage 1. The map code must not know which stage is live — it reads one `TILE_STAGE` config object (env-selectable) and behaves identically. Stage promotion is a config + deploy, not a code change.

### 3.4 Failure handling (all stages — never a blank map)

Ordered ladder, each step only if the previous fails:

1. **Tile error detection:** listen to MapLibre `error` events filtered to tile/source errors (not the fatal WebGL path — that's §4).
2. **Retry with backoff:** per-source retry queue — 3 attempts, delays 1 s → 3 s → 9 s, jittered. Only retries the failed tile range, not the whole style.
3. **Degraded raster fallback:** if the vector style still fails after retries, swap to a bundled minimal raster/fallback style (solid dark background `#0a0e14` + pins + labels layer if available). Pins and search must keep working — the map is never blank, never dead.
4. **User-visible notice:** a small non-blocking banner ("Map tiles are having trouble loading — showing simplified view. Pins still work.") with a **Retry** button. Auto-dismiss on successful reload. Never a modal, never blocks the list/search.
5. **Stage preflight:** on `GameMap` init, HEAD the stage's `healthUrl` (Stage 1+; Stage 0 skips — OpenFreeMap has no health contract with us). If the preflight fails, go straight to step 3 and show the notice — don't make the user watch tiles time out.

### 3.5 Offline / poor-network behavior

- **Offline at load:** show the degraded view immediately (step 3 above) with an "You're offline — showing saved view" notice; pins + list + search work from the local bundle.
- **Offline mid-session:** keep the last rendered frame; banner "Connection lost — map may be stale". Do not tear down the map instance.
- **Poor network (slow tiles, not failed):** the splash loader (§3.6) stays until first meaningful paint or a 12 s timeout, whichever comes first — after 12 s, render what we have and let tiles stream in. Never infinite-spinner.
- **No tile caching in v1** (skip service-worker tile cache — scope control; revisit in Phase 3/scale if metrics justify it).

### 3.6 Loading progress UI (our original version)

Their splash loader with progress bar was good — ours must be original, on-brand, and honest:

- **Full-screen splash** over the map viewport on first load: Vice City neon-on-dark identity (dark `#0a0e14` base, neon accent — reuse the site's palette, not a spinner clone).
- **Progress bar** driven by real events: `sourcedata`/`data` loading counts per tile source → `map.loaded()`/`idle` = 100%. If real progress events stall, the bar may advance on a timer to 90% max — **never fake 100%**; 100% only on actual idle.
- **Stage label** under the bar: "Loading preview tiles…" (Stage 0) — text comes from the stage config so it stays true in Stages 1–2.
- **Reduced motion:** static "Loading map…" text, no animated bar.
- **Timeout:** 12 s → dismiss splash, render degraded-but-usable map (pins + list work), show the retry notice from §3.4. The splash must never trap the user.

---

## 4. Mobile WebGL Considerations

### 4.1 Device capability detection (`deviceCaps.ts`)

Run once at map init, before constructing the MapLibre instance:

1. **WebGL support (hard gate):** `canvas.getContext("webgl2") || canvas.getContext("webgl")` in try/catch. Failure → §4.3 static fallback. (MapLibre itself throws on missing WebGL — our check runs first so we control the UX.)
2. **Low-end heuristics:**
   - `navigator.deviceMemory` ≤ 2 (GB) → low-end. (Absent on iOS Safari/Firefox — treat absent as *unknown*, not as high-end.)
   - `navigator.hardwareConcurrency` ≤ 4 → low-end signal.
   - UA contains iPhone / older iPad → conservative tier (see iOS quirks below).
3. **iOS Safari quirks (documented, must-haves):**
   - No WebGL2 on older iOS — MapLibre runs on WebGL1 path; fine, but expect lower shader headroom.
   - Aggressive tab memory eviction: large tile caches get the tab killed — keep `maxTileCacheSize` modest on iOS (spec: 50 vs desktop 200 — implementer tunes).
   - Canvas pixel-ratio memory: iPhone DPR 3 + large canvas = GPU memory cliff — pixel-ratio cap (§4.2) is mandatory, not cosmetic.
   - `deviceMemory`/`hardwareConcurrency` are undefined on iOS Safari — the UA + conservative-default rule covers this.
4. Result is a **capability tier**: `full` | `reduced` | `minimal` | `none`. Computed once, stored in module state, exposed for UI (e.g. a subtle "2D mode — device" hint when degraded, so it doesn't look like a bug).

### 4.2 Adaptive degradation ladder

| Tier | Pitch | Buildings | Pixel ratio | Behavior |
|---|---|---|---|---|
| `full` | curve to 58° (§1.1) | on | `min(devicePixelRatio, 2)` | Everything |
| `reduced` | max 30° | **off** | `min(devicePixelRatio, 1.5)` | Low-end phones, older iPads — still tilts, no extrusion cost |
| `minimal` | 0° (2D) | off | 1 | Very old devices — flat map, pins fully work |
| `none` | — | — | — | §4.3 static fallback |

- **Ladder is one-way down automatically, up manually:** if frames drop (measure: avg frame time > 50 ms over 120 frames), step down one tier and show a transient toast ("Switched to lighter map mode for smoothness — tap to retry 3D"). A "Retry 3D" action steps back up. Never oscillate: 60 s cooldown between automatic step-downs.
- **2D/3D toggle respects the tier:** on `reduced`, the "3D" end of the toggle means 30°; on `minimal`, the toggle is disabled with an explanatory tooltip (not hidden — hidden controls look broken).
- Pixel-ratio caps are hard: **max 2 overall, 1.5 on `reduced`, 1 on `minimal`**. Set via MapLibre `pixelRatio` option at construction; changing tiers re-creates the ratio without a full map rebuild if the API allows, else rebuild is acceptable (rare path).

### 4.3 WebGL-unavailable fallback (keep + extend)

- **Keep the existing message** ("3D map could not start on this device (WebGL unavailable).") — extend it:
  - List/search/filters/category chips keep working 100% (they already do — they're React, not WebGL).
  - Add a **static list mode**: the sidebar becomes the primary surface — pins render as a scrollable card list with name, certainty badge, and "copy link" per pin. Selecting a card opens the same detail panel.
  - Pin coordinates shown as text (4-dp, per §2.2) with a "copy coordinates" action — useful on devices where the map can't render.
- This fallback must be reachable in tests by forcing `tier: "none"` (a query param `?forcemap=none` for QA — stripped from share links).

### 4.4 Touch gesture spec

- **One finger:** pan (`dragPan`). Must not fight the page — the map viewport is fixed (`h-dvh`, no page scroll) so one-finger pan is safe.
- **Pinch:** zoom (`touchZoomRotate` — rotation part of this gesture is fine).
- **Two fingers:** tilt + rotate (`touchPitch` enabled). Discoverability: the existing hint microcopy ("Drag with right mouse / two fingers to tilt") stays; on touch devices render "Pinch to zoom · Two fingers to tilt & rotate".
- **Bottom-sheet conflict (solved already, keep the contract):** only the sheet's **drag handle** has `touch-none` + pointer capture; the sheet body keeps native scroll. Map gestures and sheet gestures never share a touch target. Regression rule: any future change to the sheet must keep the handle as the sole gesture-capture zone.
- **Tap vs drag disambiguation:** pin tap targets ≥ 44×44 px effective (CSS transform scale on small screens if needed); `click` after a drag must not select a pin (MapLibre handles this via drag tolerance — keep default, do not set `clickTolerance` to 0).

### 4.5 Battery / memory notes

- **Tab hidden:** `document.visibilitychange` → when hidden, stop any camera animations and let rAF pause naturally; on visible, resume. Do not destroy/recreate the map on tab switches (that's the expensive path).
- **Map offscreen:** an `IntersectionObserver` on the map container — when the `/map` viewport is not visible (e.g. user switched to a different in-app tab in future layouts), pause tile loading via `map.showTileBoundaries`? No — correct mechanism: skip `map.triggerRepaint()` loops and rely on MapLibre's render-on-demand; document the chosen mechanism at implementation time. Goal: zero GPU work when the map isn't visible.
- **Memory ceiling:** cap `maxTileCacheSize` per tier (§4.1); on `reduced`/`minimal`, also disable the `3d-buildings` layer entirely (not just minzoom-gated) to avoid holding extrusion buffers.
- **No background geolocation, no wake locks** — out of scope, explicitly not wanted.

---

## 5. Settings Persistence (fixing their weakness)

Competitor shows "Your settings are not being saved" — we persist what matters, version the schema, and are explicit about what's session-only.

### 5.1 Persisted (localStorage)

- **Key:** `gta6mapx:map-settings` · **value:** JSON `{ "v": 1, "mode3d": true, "pitchMax": 58, "baseLayer": "dark", "bearingSnap": true }`
- **Fields:**
  - `mode3d: boolean` — the 2D/3D toggle state. Restored before map construction.
  - `pitchMax: number` — user cap on pitch (default 58; a future slider could lower it; the toggle's 3D end uses `min(pitchMax, tierCap)`).
  - `baseLayer: "dark" | <future ids>` — which base style; today only `"dark"` exists, the field exists so Stage 1/2 additions don't need a migration.
  - `bearingSnap: boolean` — whether the compass snap button is enabled (default true).
- **Write policy:** debounced 500 ms after any change; try/catch around every read/write (private-mode Safari throws — map must work with in-memory fallback, silently).

### 5.2 Session-only (never persisted)

- Selected pin, search query, active category filters, filters-drawer open state, bottom-sheet open state, camera position itself (the URL owns that — §2.4).
- Rationale: camera lives in the shareable URL; UI chrome is per-visit. Persisting the pin would fight deep links.

### 5.3 Schema versioning

- `v` integer, starts at 1. Reader: if `v` missing or newer than the reader knows → discard and use defaults (never crash on a future schema). Migration functions `migrate(v1→v2)` live in `settings.ts` when v2 ever exists. Document the current version in this spec when it changes.

### 5.4 Privacy note

- localStorage only, no cookies, no server round-trip. The existing "Progress saves on this device — no account needed" microcopy covers the philosophy; settings piggyback on the same promise.

---

## 6. Module Inventory (this slice only)

All under `src/modules/map/`. One file, one job. No application code in this spec — names and responsibilities are the contract.

| File | Responsibility |
|---|---|
| `camera3d.ts` | Pitch curve (§1.1), MAX_PITCH cap, 2D/3D toggle animation (§1.3), drift-back logic, reduced-motion branching (§1.4), bearing helpers + compass snap (§1.5). Owns the `is3D` state. |
| `deepLink.ts` | URL schema parse/validate (§2.1), share-URL builder with fidelity + rounding rules (§2.2), `?pin=` resolution (§2.3), debounced `moveend` → `replaceState` sync (§2.4). |
| `tileFallback.ts` | Stage config type + `TILE_STAGE` selection (Stage 0/1/2, §3.1–3.3), preflight check, retry-with-backoff queue, degraded-style swap, user notice + retry action (§3.4), offline behavior (§3.5). |
| `deviceCaps.ts` | WebGL probe, deviceMemory/hardwareConcurrency heuristics, iOS Safari rules, capability tier computation (`full`/`reduced`/`minimal`/`none`), pixel-ratio caps, auto step-down monitor (§4.1–4.2). |
| `settings.ts` | localStorage schema, versioned read/write with migrations, persisted-vs-session split, private-mode-safe fallbacks (§5). |
| `mapLoader.ts` (exists as `MapLoader.tsx` — refactor target) | Splash loader UI: real event-driven progress bar, stage label, 12 s timeout, reduced-motion static variant (§3.6). Keep as the single loading-surface owner. |
| `GameMap.tsx` (exists — orchestration only) | Wires the six modules above together; owns React state for pins/filters/sheet. **Rule:** no camera math, no URL math, no tile logic inline — everything delegates. Target: the file shrinks as logic moves out. |

**Explicit non-goals for this slice:** entity SEO pages, submissions/moderation, Supabase wiring, the actual Leonida tile art (Stage 2), service-worker tile caching.

---

## 7. Implementation Checklist (this slice)

**Pre-work**
- [ ] Implementing agent reads `~/workspace/gta6mapx/web/node_modules/next/dist/docs/` per the house rule (§0.4) before writing any Next.js code.
- [ ] Confirm no competitor code/assets are referenced anywhere — original implementation only (§0.1).

**1 — 3D behavior**
- [ ] `camera3d.ts`: pitch curve (§1.1) with MAX_PITCH=58, applied to init / flyTo / reset / deep-link restore.
- [ ] `camera3d.ts`: `zoomend` drift-back (>10° gap, 600 ms), suppressed by `userTilt` flag.
- [ ] 3D buildings layer: minzoom 13.5, height interpolation 13.5→15, neon color ramp, try/catch decorative-failure rule (§1.2).
- [ ] 2D/3D toggle: pitch-only easeTo 900 ms, preserves center/zoom/bearing/selected pin (§1.3).
- [ ] `prefers-reduced-motion`: all camera moves instant, no flyTo, static loader (§1.4).
- [ ] Compass/north-up snap button: shows when |bearing|>2°, 600 ms snap (§1.5).

**2 — Camera + deep links**
- [ ] `deepLink.ts`: parse `lat/lng/zoom/pitch/bearing/pin` with validation + clamping (§2.1).
- [ ] Share builder: fidelity rules, 4-dp rounding, omission rules, pin-first canonical URL (§2.2).
- [ ] `?pin=<slug>` restore: fly + open panel + title update; unknown slug ignored gracefully (§2.3).
- [ ] `moveend` → debounced 400 ms `replaceState` (never `pushState`); skip identical/no-op writes; pause during programmatic flights (§2.4).
- [ ] `document.title` + meta description update on pin select/deselect (§2.5).

**3 — Tiles + fallback**
- [ ] `TILE_STAGE` config with Stage 0 = OpenFreeMap dark, exact attribution `© OpenMapTiles © OpenStreetMap contributors` (§3.1).
- [ ] Stage config contract (`styleUrl`, attribution, min/max zoom, `healthUrl`) ready for Stage 1/2 with zero code changes on promotion (§3.2–3.3).
- [ ] Failure ladder: tile-error detect → 3× backoff retry (1s/3s/9s+jitter) → degraded style swap → user notice with Retry button; never blank map (§3.4).
- [ ] Stage preflight (Stage 1+); offline-at-load and offline-mid-session behavior (§3.5).
- [ ] `mapLoader`: honest event-driven splash progress bar (never fake 100%), stage label, 12 s timeout → degraded usable map (§3.6).

**4 — Mobile WebGL**
- [ ] `deviceCaps.ts`: WebGL probe first, heuristics, iOS Safari rules, tier `full|reduced|minimal|none` (§4.1).
- [ ] Degradation ladder per tier: pitch caps, buildings on/off, pixel-ratio caps (2 / 1.5 / 1) (§4.2).
- [ ] Auto step-down on sustained slow frames with cooldown + "Retry 3D" toast; toggle disabled (not hidden) on `minimal`.
- [ ] Extended WebGL-unavailable fallback: list/search work + static card list + per-pin copy-link/coords; `?forcemap=none` QA hook (stripped from shares) (§4.3).
- [ ] Touch gestures per §4.4; bottom-sheet handle stays the sole gesture-capture zone; ≥44px pin targets.
- [ ] visibilitychange + IntersectionObserver render pausing; per-tier `maxTileCacheSize` (§4.5).

**5 — Settings**
- [ ] `settings.ts`: `gta6mapx:map-settings` v1 schema, persisted fields (§5.1), debounced writes, private-mode-safe.
- [ ] Session-only list enforced (§5.2); schema migration path documented (§5.3).

**6 — Modularity**
- [ ] Logic extracted from `GameMap.tsx` into the §6 modules; `GameMap.tsx` left as orchestration only.
- [ ] Build passes; `/map` smoke test (200) on desktop + mobile viewport widths.

---

*Spec version 1.0 — 2026-09-24. Stage 0 (OpenFreeMap placeholder) is the only tile stage in scope for implementation now; Stages 1–2 are config contracts, not work items.*
