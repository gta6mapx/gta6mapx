# GTA6mapx Map Design System — Build Spec

**Status:** Phase 1 spec (design documentation only — no application code).
**Scope:** The visual and interaction language for the GTA6mapx interactive 3D map experience.
**Date:** 2026-09-24
**Author:** Design System coordinator

---

## 0. North star

One identity, two modes. The landing page is cinematic Vice City neon-noir
(Anton display type, pink/orange sunset, film grain, HUD countdown, dossier
panels). The map must feel like **stepping into the same world** — not a
different product. Think: landing = movie poster, map = mission mode.

The competitor (State of Leonida) proves the premium bar: cohesive neon
aesthetic, glassmorphism, smooth motion, high polish. We match that bar with
**our own original execution** — our palette, our type pairing, our components.
Nothing is copied: their code is AGPL-3.0 and their text is theirs. Inspired-by
is fine; clone is not.

### Deliberate differences from the competitor

| Them | Us |
|---|---|
| 2D Leaflet | 3D MapLibre (perspective, extruded buildings) |
| Neon pink single-accent | Pink **primary** + cyan **HUD secondary** + orange **sunset warmth** (richer system) |
| Informal rumor tags only | Formal 4-status Leak Transparency Engine (existing badges) |
| Montserrat everywhere | Anton (display) + Geist Sans (UI) + Geist Mono (coordinates/HUD) |
| German/English mixed labels | English-only, i18n-ready keys |
| Settings not saved | Settings persisted to localStorage |
| Confusing counters ("13 selected") | Plain-language counters ("214 of 310 locations shown") |
| Login/community "coming soon" (dead buttons) | Only ship what works; future items are not rendered as buttons |

---

## 1. Color tokens

All colors defined as CSS custom properties on `:root`. Existing base tokens
(`--bg`, `--panel`, `--border`, `--text`, `--muted`, `--accent`) are kept for
backward compatibility; the map's **interactive accent migrates from green to
neon pink** (see §1.3).

### 1.1 Base surfaces

```css
--bg-0: #07040f;   /* deepest layer: splash screen, full overlays */
--bg-1: #0a0e14;   /* map chrome background (existing --bg) */
--bg-2: #11161f;   /* panels, cards (existing --panel) */
--bg-3: #1a2230;   /* hover/raised surfaces */
--border: #1f2632; /* hairlines (existing) */
--border-soft: rgba(232, 236, 241, 0.08);
--text: #e8ecf1;
--text-dim: #c3cad4;
--muted: #8b94a3;
```

### 1.2 Brand (Vice City neon-noir)

```css
--neon-pink: #ff2d78;    /* PRIMARY interactive accent */
--neon-pink-soft: rgba(255, 45, 120, 0.14);
--neon-pink-line: rgba(255, 45, 120, 0.30);
--neon-purple: #a855f7;  /* gradient partner, decorative */
--neon-cyan: #22d3ee;    /* SECONDARY: HUD elements, info, links, focus */
--neon-cyan-soft: rgba(34, 211, 238, 0.12);
--sunset-orange: #ff9a3c; /* warmth: glows, progress, highlights */
--sunset-cream: #ffe9b8;  /* sun core, rare highlights */
```

Usage rules:
- **Pink** = brand actions (primary buttons, active pills, selected pin ring,
  brand lockup glow). Never used for certainty semantics.
- **Cyan** = informational/HUD (focus rings, coordinates, "Share map view",
  countdown chips, links).
- **Orange** = warmth/progress (progress bar, found-count glow, sunset accents).
- Green, sky-blue, amber, red, gray are **reserved exclusively** for the four
  evidence statuses (§4.1). Nothing else on the map may use those hues.

### 1.3 Evidence (Leak Transparency Engine) — unchanged semantics

```css
--ev-confirmed: #22c55e;  /* rockstar-confirmed */
--ev-trailer:   #38bdf8;  /* trailer-confirmed */
--ev-leak:      #eab308;  /* leak-reported (amber) */
--ev-disputed:  #ef4444;  /* disputed */
--ev-spec:      #9ca3af;  /* speculation/gray */
```

Badge classes (`.badge-confirmed`, etc.) already exist in `globals.css` — keep
them. Pins use filled variants of the same hues.

### 1.4 Glassmorphism panel tokens

```css
--glass-bg: linear-gradient(160deg, rgba(24, 12, 36, 0.78), rgba(10, 6, 18, 0.86));
--glass-blur: blur(14px) saturate(1.25);
--glass-border: 1px solid rgba(255, 45, 120, 0.22);
--glass-border-strong: 1px solid rgba(255, 45, 120, 0.45);
--glass-shadow: 0 12px 40px rgba(0, 0, 0, 0.55), 0 0 24px rgba(255, 45, 120, 0.10);
--glass-radius: 14px;
```

Panels float **over** the 3D map; the map is always the hero. Panels are
narrow (sidebar ≤ 320px desktop) or bottom-anchored (mobile), never full-screen
except the splash loader.

### 1.5 Map-canvas grading

Until the custom Leonida tile pipeline lands, the 3D base stays dark vector
tiles. Grade them toward our palette via CSS overlay:
- A non-interactive `::after` gradient over the canvas:
  `linear-gradient(180deg, rgba(7,4,15,0.25), transparent 30%, transparent 70%, rgba(7,4,15,0.35))`
  plus a faint pink horizon glow at the top edge (the "sunset line").
- 3D building extrusions tinted toward plum (`#3a2b52` → `#57406b`) instead of
  neutral gray — Vice City at dusk, not a corporate GIS viewer.

### 1.6 Dark variants (settings)

Three selectable themes; all keep pink/cyan/evidence semantics.

1. **Vice (default):** tokens above. Warm, neon, cinematic.
2. **Midnight:** cooler and flatter. `--bg-0: #05070d; --bg-1: #090d14;`
   glass border shifts to cyan (`rgba(34,211,238,0.22)`); sunset gradient
   muted. For users who find Vice too saturated.
3. **Neon (high contrast):** pure-black surfaces (`#000`), 1.5× glow
   intensities, `--text: #ffffff`. Accessibility-first option.

Theme is a `data-theme` attribute on `<html>`; tokens override under
`[data-theme="midnight"]` / `[data-theme="neon"]`. Persisted in localStorage.

---

## 2. Typography

Fonts already loaded in `layout.tsx`: **Anton** (display), **Geist Sans** (UI),
**Geist Mono** (mono).

### 2.1 Roles

| Role | Font | Usage |
|---|---|---|
| Display | Anton, uppercase, tight | Splash title, city quick-jump labels, big empty-state headers, "WELCOME TO LEONIDA"-style moments on the map (e.g. first-visit overlay) |
| UI | Geist Sans | Everything interactive: buttons, inputs, panel body, lists |
| HUD/Mono | Geist Mono | Coordinates, marker IDs, countdown digits, keyboard hints, version strings |

Anton is used **sparingly** on the map — display type is a spice, not the meal.
Never for body text or small labels (legibility).

### 2.2 Scale

```
--text-hero:   clamp(3rem, 8vw, 6rem)   Anton   /* splash only */
--text-h1:     1.375rem / 1.2  800      /* panel titles */
--text-h2:     1.0625rem / 1.3 700      /* section headers */
--text-body:   0.9375rem / 1.55 400     /* panel body */
--text-small:  0.8125rem / 1.45 500     /* meta, chips */
--text-micro:  0.6875rem / 1.4  600, uppercase, letter-spacing 0.08em
               /* eyebrows, badge labels, HUD tags */
--text-mono:   0.8125rem Geist Mono     /* coordinates, IDs */
```

### 2.3 Neon title treatment (map contexts)

The landing's `.vice-neon-title` gradient (cyan → purple → pink → orange →
cream) with soft glow is reused for: splash title, city quick-jump active
state, and the "case file" header of the detail panel's entity name on desktop.
Always with the reduced-motion rule (§8): no flicker animation when reduced
motion is requested.

---

## 3. Glassmorphism panel spec

Base class concept: `.glass-panel` (new; does not replace existing
`.vice-card` which stays for landing/hub contexts).

```
background: var(--glass-bg);
backdrop-filter: var(--glass-blur);
-webkit-backdrop-filter: var(--glass-blur);   /* Safari */
border: var(--glass-border);
border-radius: var(--glass-radius);
box-shadow: var(--glass-shadow);
```

- **Header strip:** 1px top highlight via `inset 0 1px 0 rgba(255,255,255,0.06)`.
- **Section dividers:** `1px solid var(--border-soft)`, never full-contrast lines.
- **Eyebrow labels:** `--text-micro` in muted, uppercase — e.g. "CATEGORIES",
  "EVIDENCE", "MAP TOOLS".
- **HUD corner ticks** (existing `.hud-corner`): used on the detail panel and
  splash loader only — signature detail, not everywhere.
- **Film grain:** landing-only. On the map, grain is too heavy over 3D; use the
  vignette + sunset-line grading (§1.5) instead. Map stays crisp.

Fallback: where `backdrop-filter` is unsupported, panels fall back to
`rgba(17,22,31,0.94)` solid — still on-brand, fully legible.

---

## 4. Markers, clusters, popups

### 4.1 Pin anatomy

- **Shape:** 30px circle (42px on coarse pointers — existing rule kept).
- **Fill:** evidence-status color at 92% opacity; `rockstar-confirmed` green,
  `trailer-confirmed` sky, `leak-reported` amber, `disputed` red, `speculation` gray.
- **Ring:** 2px `rgba(255,255,255,0.85)` outer ring (existing).
- **Glyph:** category emoji/icon centered, 14px (17px touch).
- **Shadow:** `0 2px 10px rgba(0,0,0,0.65)` + a soft status-color outer glow
  (`0 0 12px <status>@35%`) so pins read as neon, not flat GIS dots.
- **States:**
  - `hover`: scale 1.2 (existing).
  - `selected`: neon-pink double ring — `outline: 2px solid var(--neon-pink);
    outline-offset: 3px` + pulsing glow (disabled under reduced motion).
  - `found`: 35% opacity, grayscale 80% (existing), plus a small cyan check
    badge overlapping the pin's top-right (progress reads at a glance).
  - `dimmed` (filtered out by search): pins not matching the query fade to 25%
    instead of disappearing — the map keeps its geography; matching pins get
    the pink selected-style ring. This fixes the competitor's confusing
    "No markers found while matches are selected" behavior.

### 4.2 Clusters

- **Shape:** rounded pill (not a plain circle): glass background, neon-pink
  1.5px ring, white bold count in Geist Sans 700.
- **Sizing:** scales with count — `30px + min(count, 99) * 0.25px`, capped.
- **Glow:** `0 0 18px rgba(255,45,120,0.35)`.
- **Interaction:** click zooms in (existing clustering behavior); keyboard
  focusable with visible cyan focus ring.
- **Label:** screen-reader text "N locations — activate to zoom in".

### 4.3 Detail popup / panel (the "case file")

The detail panel is our **dossier** moment — it should feel like opening a case
file, consistent with the landing's dossier sections:

1. **Header:** entity name (UI 800, 1.375rem), evidence badge + source label row.
2. **Photo area:** 16:9, rounded 10px, subtle pink border; skeleton shimmer while
   loading; caption in micro type ("Trailer 2 still — 0:42" style provenance).
3. **Evidence chain:** 2–4 rows: status → source → note, each with a colored
   dot. This is our differentiator — give it visual weight, not a footnote.
4. **Meta row (mono):** coordinates `25.7617, -80.1918` + marker ID + "edited"
   date. Copy-on-click with cyan "copied" feedback.
5. **Actions:** primary pink "Mark as found" (becomes ghost "✓ Found — undo"),
   ghost icon buttons: copy link, fly-to, share.
6. **HUD corners** on desktop panel; drag handle on mobile sheet.

---

## 5. Splash loader

Full-screen, shown while the 3D engine + tiles initialize (replaces the bare
dark screen):

- **Background:** `.vice-sky` sunset gradient (existing) at 40% brightness +
  vignette; two palm silhouettes (existing SVG assets) left/right edges.
- **Center:** "GTA6MAPX" in Anton with `.vice-neon-title` treatment, subline
  "MAPPING LEONIDA…" in micro type.
- **Progress:** 220px bar, track `rgba(255,255,255,0.08)`, fill neon gradient
  (pink → purple → cyan), percentage in mono; determinate where possible
  (tile load events), indeterminate shimmer otherwise.
- **Tip line:** rotating honest tips ("Every pin carries its proof — check the
  evidence chain."). No fake loading tips.
- **Exit:** fades out (300ms) once `mapReady`; never blocks longer than needed;
  a "Skip" text button appears after 6s in case of stall.
- **Reduced motion:** static gradient, no sway/breathe/flicker; progress bar
  still updates (information, not decoration).

---

## 6. Buttons, inputs, pills

### 6.1 Buttons

- **Primary** (`.btn-neon`): gradient `linear-gradient(100deg, #ff2d78, #a855f7)`,
  white 700 text, radius 10px, glow shadow; hover: translateY(-1px) +
  brightness 1.08 (existing `.vice-btn-neon` behavior). Used for: Mark as
  found, Join/CTA on map, city quick-jump active.
- **Ghost** (`.btn-ghost`): transparent, 1px `var(--border)`, `--text-dim` text;
  hover: pink border + white text. Used for: Reset view, Share, tool toggles.
- **HUD chip** (`.btn-hud`): existing `.vice-count-chip` style — dark glass,
  cyan border, mono text. Used for: countdown, coordinate readout, "3D ON" state.
- **Icon button:** 40px minimum touch target (44px on mobile), ghost styling,
  `aria-label` required.
- **Destructive:** red-tinted ghost (unpublish/remove actions in future
  community features).

Focus: 2px cyan outline, 2px offset, on **all** interactive elements
(existing rule — keep, change color from green to cyan for brand consistency).

### 6.2 Inputs

- **Search:** glass panel, 12px radius, `var(--border)` border; focus: cyan
  1.5px border + `0 0 0 3px rgba(34,211,238,0.15)` ring. Leading search glyph,
  trailing clear (×) button. Placeholder in muted.
- **Results dropdown:** glass, max 6 rows, each row: name + evidence badge;
  footer row shows the **plain-language count**: "Showing 6 of 23 matches —
  refine your search". Empty state: "No locations match "query". Try a
  category filter." — never a bare "No markers found" while the map still shows pins.
- **Segmented control** (2D/3D, map style): pill container, sliding pink
  indicator, 200ms ease.

### 6.3 Category pills

Active state migrates from green to brand: active = pink gradient fill, white
text, soft pink glow; inactive = `--bg-1` fill, muted text, hairline border.
Include a small count per pill ("Vehicles 58") in mono micro type — this kills
the competitor's opaque-counter problem. "All / None" quick actions at the row
end.

---

## 7. Map chrome layout

Desktop (≥768px):
```
┌────────────────────────────────────────────────┐
│ TopBar: brand lockup · city quick-jump · search │
│         · countdown chip · settings · share     │
├──────────┬─────────────────────────────────────┤
│ Sidebar  │                                     │
│ 320px    │          3D MAP (hero)              │
│ glass    │                                     │
│ search   │   floating: 2D/3D · reset · tools   │
│ pills    │   bottom-left: legend (collapsible) │
│ legend   │   bottom-right: coords HUD (mono)   │
│ detail   │                                     │
│ progress │                                     │
├──────────┴─────────────────────────────────────┤
│ Disclaimer strip (existing)                     │
└────────────────────────────────────────────────┘
```

- **City quick-jump:** pill row in the TopBar (Vice City, Port Gellhorn,
  Ambrosia, …). Clicking flies the camera (1200ms ease) to the city bounds and
  sets the pill active. This is how we honor "one world, many cities" (§0).
- **Legend:** bottom-left floating glass chip, collapsible; shows the 4
  evidence colors + labels + "found" state. Never hidden by default on first
  visit (teaches the transparency system), collapsible after.
- **Coords HUD:** bottom-right mono readout of cursor position in game-friendly
  format; cyan; `pointer-events: none`.
- **Attribution:** keep MapLibre/OSM attribution; add "Fan project — not
  affiliated with Rockstar Games" in the disclaimer strip (existing).

Mobile (<768px):
- TopBar condenses: brand mark, search icon → expanding search, share icon,
  settings icon.
- Filters become a floating "Filters" button (existing) opening a bottom sheet
  with search + pills + legend.
- Detail opens in the **bottom sheet** (§9).
- 2D/3D + reset as floating action buttons, bottom-right above the sheet zone.
- Countdown chip hidden on very small screens (keeps the map the hero).

---

## 8. Motion & reduced motion

Motion tokens:
```css
--dur-instant: 120ms; --dur-fast: 200ms; --dur-base: 320ms; --dur-slow: 600ms;
--ease-out: cubic-bezier(0.22, 1, 0.36, 1);
--ease-snap: cubic-bezier(0.34, 1.3, 0.64, 1); /* pins, pills */
```

- Camera flights: 900–1200ms ease-out (existing durations kept).
- Pin hover: 150ms scale; panel enter: 200ms fade+rise 8px.
- Decorative animation budget: **one** ambient animation visible at a time on
  the map (sunset-line shimmer OR pin glow — never both competing).
- `prefers-reduced-motion: reduce`: all decorative animations off (existing
  media query extended to new classes); camera flights become instant jumps;
  progress/skeleton still update (informative); no auto-playing motion, no
  parallax.

---

## 9. Mobile bottom-sheet styling

- Container: `rounded-t-2xl`, glass panel, `max-height: 62dvh`, dynamic
  viewport units.
- **Drag handle:** 40×4px rounded bar, `--border` color, centered, 12px top
  padding hit-area; `touch-action: none` on the handle only (existing Pointer
  Events approach kept — no gesture library).
- **Detents:** peek (28%), half (55%), full (88%) — snap on release; swipe-down
  past 90px from peek dismisses.
- **Scrim:** none at peek/half (map stays interactive around it); 40% black
  scrim at full detent, tap scrim to collapse to half.
- **Content:** same case-file structure as desktop (§4.3), single column;
  sticky action bar (Mark as found + share) pinned to sheet bottom.
- Safe-area: `padding-bottom: env(safe-area-inset-bottom)`.

---

## 10. Avoid list (from competitor analysis)

1. **No mixed languages.** All labels English; strings centralized for future
   i18n — never hardcode a second language inline.
2. **No opaque counters.** Every number gets a noun: "214 of 310 locations
   shown", "6 of 23 matches", "12 found".
3. **No dead "coming soon" buttons.** Unshipped features are not rendered.
4. **No placeholder ad code.** Monetization ships only when real.
5. **Settings persist.** Theme, units, clustering, panel state → localStorage;
   never silently reset.
6. **No beta-feeling glitches.** Every async state (tiles, search, photos) gets
   a skeleton or explicit empty/error state. The word "beta" never appears in UI.
7. **No invented data styling.** Disputed/speculation pins are visually
   quieter (gray/red, no glow) — the design itself communicates uncertainty.

---

## 11. Component inventory (map UI)

Build order within Phase 2 (map rebuild). Each is one component, one
responsibility:

| # | Component | Notes |
|---|---|---|
| 1 | `MapThemeProvider` | `data-theme` + localStorage, CSS var scoping |
| 2 | `SplashLoader` | §5; progress + tips + skip |
| 3 | `MapTopBar` | brand, city quick-jump, search trigger, countdown, settings, share |
| 4 | `CityJump` | pill row; flies camera to city bounds |
| 5 | `MapSearch` | input + results dropdown + plain-language counts (§6.2) |
| 6 | `CategoryPills` | pink active states + per-pill counts (§6.3) |
| 7 | `EvidenceLegend` | 4 statuses + found state; collapsible |
| 8 | `MapPin` | §4.1; CSS class on MapLibre marker element |
| 9 | `ClusterPill` | §4.2 |
| 10 | `CaseFilePanel` | desktop detail panel, §4.3 |
| 11 | `MobileSheet` | §9; detents + swipe (extends existing) |
| 12 | `MapControls` | 2D/3D segmented, reset, share, tools entry |
| 13 | `CoordsHud` | mono cursor readout |
| 14 | `ProgressMeter` | found/total with orange gradient bar + label |
| 15 | `SettingsDrawer` | theme, units (km/mi), clustering toggle, reduced-motion override |
| 16 | `Toast` | copy confirmations, errors; cyan accent |
| 17 | `EmptyState` / `ErrorState` | map WebGL failure, no results, photo load fail |
| 18 | `CountdownChip` | HUD-style, reuses landing countdown logic |

Existing components to restyle (not rebuild): `EvidenceBadge`, `EntityCard`,
`SiteHeader`/`SiteFooter` (hub pages keep landing identity; map chrome is the
new system).

---

## 12. Phased implementation checklist

**Phase A — Tokens & foundations**
- [ ] Add CSS variables (§1) to `globals.css` under `:root` + `[data-theme]` overrides
- [ ] Add motion tokens + extend `prefers-reduced-motion` coverage (§8)
- [ ] Add `.glass-panel`, `.btn-neon`, `.btn-ghost`, `.btn-hud` classes
- [ ] Migrate map focus rings + active states from green to pink/cyan
- [ ] Build passes; visual check on `/map` (desktop + 375px mobile)

**Phase B — Pins, clusters, case file**
- [ ] Restyle `.gta-pin` per §4.1 (status glow, selected ring, found check, dimmed state)
- [ ] Build `ClusterPill` styling (custom cluster renderer in map engine)
- [ ] Build `CaseFilePanel` layout (§4.3) reusing `EvidenceBadge`
- [ ] Build passes; pin/cluster/popup states screenshotted

**Phase C — Chrome (top bar, search, pills, legend)**
- [ ] `MapTopBar` + `CityJump` (one world, camera fly-to per city)
- [ ] `MapSearch` with plain-language counts (§6.2)
- [ ] `CategoryPills` with counts (§6.3)
- [ ] `EvidenceLegend` collapsible, visible on first visit
- [ ] `CoordsHud`, `ProgressMeter`, `CountdownChip`
- [ ] Build passes; keyboard navigation audit (tab order, focus visible, Esc closes)

**Phase D — Splash, themes, settings**
- [ ] `SplashLoader` (§5) wired to real load progress
- [ ] `SettingsDrawer`: theme (Vice/Midnight/Neon), units, clustering, motion
- [ ] All settings persisted to localStorage; no silent resets
- [ ] Build passes; theme switching screenshotted in all 3 variants

**Phase E — Mobile sheet polish**
- [ ] Detents (28/55/88%), scrim behavior, sticky action bar (§9)
- [ ] Safe-area insets; 44px touch targets throughout
- [ ] Build passes; real-device-feel check at 375×812 and 390×844

**Phase F — Motion & a11y hardening**
- [ ] Reduced-motion end-to-end pass (animations off, flights instant)
- [ ] Screen-reader pass (pin labels, cluster labels, live region for search counts)
- [ ] Contrast check: muted text on glass ≥ 4.5:1 in all 3 themes
- [ ] No German/English mix, no opaque counters, no dead buttons (§10)
- [ ] Final build + lint + full route smoke test

---

## 13. Open questions for parent

1. Category glyph set: keep emoji glyphs on pins or commission a small original
   SVG icon set? (Emoji is fast and readable; SVG is more premium.)
2. Photo provenance: detail panel photo area needs an image source policy
   (original captures vs. credited press stills) — legal/design decision.
3. City quick-jump bounds: needs the city-bounds dataset before `CityJump` can
   be built (data team dependency).
