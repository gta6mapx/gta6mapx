# GTA6mapx Engagement — Build Spec

**Status:** Phase 1 spec (specification only — no application code).
**Scope:** "Find the Location" guessing game, Intel Library, settings panel, launch countdown, credits/about modal.
**Date:** 2026-09-24
**Author:** Engagement coordinator (3 worker slices synthesized)

---

## 0. Source notes and competitor lessons

Informed by a read-only browser analysis of map.stateofleonida.net (State of Leonida). All original design; nothing copied — their code is AGPL-3.0 and their text/assets are theirs. What we learned and what we fix:

| Observed there | Our answer |
|---|---|
| "Find the Marker" game: trailer/screenshot shown, click the map, scored on accuracy, persistent leaderboard | "Find the Location" — same genre, but rounds restricted to **rockstar-confirmed / trailer-confirmed** locations only (§1.2 honesty rules); 3D click-to-guess |
| Media library with media search | **Intel Library** (§2): dossier archive of our 128 curated entities with evidence badges — deliberately **no captured media** (no trailer stills, no leak screenshots, no Rockstar art) per our legal rules |
| Settings: theme variants, accent colors, panel styles, grid, clustering, FOV readout, heatmap, marker colors, km/miles, language (DE/EN) | Our own option set (§3): neon-noir theme variants, accent swatches, units, panel style, clustering, grid, 3D buildings/pitch, FOV readout — English only, no mixed-language labels |
| **Bug: "Your settings are not being saved" (session-only)** | Guaranteed persistence: versioned localStorage schema, write-through, validation + defaults fallback, cross-tab sync (§3.2) |
| **Bug: German labels leaking into English UI** ("Zur Position", "Koordinatensuche") | English-first single string source; language selector hidden at launch (§3.1, option L1) |
| Countdown to launch (theirs read "56 Days to go – November 19, 2026") | Reusable countdown component, full + compact variants, SSR-safe, "OUT NOW" post-launch state (§4) |
| Credits modal, login/community "coming soon" (dead buttons) | Credits/about modal with real content + reserved GTADB attribution slot (§5); we ship no dead buttons — future features are not rendered |
| Per-marker color customization, heatmap, page backgrounds | Deliberately excluded: marker color encodes evidence status (semantic, not cosmetic); no user-density data to heatmap; our identity is fixed neon-noir |

**Global constraints for all engagement features:**
- Honesty: never present leak-reported or disputed content as fact. No invented locations, stats, or specs.
- Legal: never host or repost leaked media/files. No unauthorized Rockstar artwork. Fan visuals are original CSS/SVG.
- Persistence today = localStorage (pattern: `src/modules/progress/useFound.ts` — lazy JSON read/write, try/catch). Supabase not connected; account-synced features are Phase 2+.
- Design language: Vice City neon-noir, Anton display type, HUD-style panels, film grain/scanlines, reduced-motion support.

---

## 1. "Find the Location" — guessing game

### 1.1 Concept

**Name:** *Find the Location* — tagline: "Pinpoint Leonida."

The player is shown a clue dossier for a real in-game location and drops a pin where they believe it sits on our 3D MapLibre map of Leonida. **5 rounds per game.** Scored on pin accuracy, speed, and hint frugality. Styled in the site's neon-noir language: clue as HUD dossier card, result screen with a neon line from guess to true pin.

Lives at a dedicated route (`/game/find-the-location`) and reuses the 3D map component in a special **game mode**: no filter drawers, no entity pins visible, no search — a clean map so the challenge is knowledge, not UI.

### 1.2 Honesty rules (HARD — enforce in logic)

1. **Eligibility is a live filter, not curation.** Round pool = entities where `evidence.status ∈ ("rockstar-confirmed", "trailer-confirmed")` AND `kind === "location"`. Current data yields **30 eligible locations** (14 rockstar-confirmed + 16 trailer-confirmed). The 1 disputed + 2 leak-reported locations are excluded by the filter itself — a future status change automatically removes a location with no code change.
2. **Evidence always visible.** Every clue card shows the evidence badge AND evidence detail string (e.g. "Trailer 1 @ 1:12"). The player always knows *how we know*.
3. **Never invent.** Only locations existing as entities in `modules/entities/data/locations.ts`. No synthesized spots, no "mystery pins."
4. **Clue text is leak-free.** Clues derive from our own summaries with the name masked (e.g. "A tourist beachfront strip — hotels, neon and the classic Vice City vibe, rebuilt bigger."). Never smuggle leak content into hints.
5. **Pins are approximate-grade, stated as such.** Game pins carry an internal `approximate: true` flag; results copy says "Our pin placement is approximate — scored generously." Scoring tiers are wide enough that honest pin error never punishes the player.

### 1.3 Round design

**Clue dossier card** (per round, in order): evidence badge + detail (always free) → primary written clue (summary with name masked, 1–2 sentences) → difficulty tier label. Never shows the answer, region name, or a photo (no photos — this tests map knowledge, not visual memory).

**Answering (3D interaction):**
- Click/tap the 3D map → point projected to ground plane via map `unproject` → neon preview pin drops. City/label layers stay visible.
- Free repositioning: click elsewhere moves the pin; pin is draggable. No limit before confirming.
- Sticky HUD "Lock it in" button confirms — no second-guessing after lock.
- **Timer:** 90 seconds per round, countdown ring in HUD. Timeout = 0 points, streak resets; true location still revealed.
- **Camera:** each round starts from a neutral Leonida-wide overview (~45° pitch) so the previous reveal doesn't anchor the player. Rotation enabled; preview pin always ground-anchored.

**Difficulty modes** (start screen, default Medium):

| Mode | Label | Pool |
|---|---|---|
| Easy | Vice City Tour | rockstar-confirmed only (14) — famous, region-scale |
| Medium | Leonida Explorer | all 30 eligible — mixed famous + obscure |
| Hard | Deep Cuts | trailer-confirmed only (16) — trailer-study districts |

**Hints** (2 per round, −100 pts each, max −200): Hint 1 "Region intel" reveals the `region` field; Hint 2 "Real-world echo" reveals `realWorldInspiration`. Used hints shown in the result breakdown.

**Content dependency:** every eligible location needs an authored `gamePin` (`{ locationSlug, lng, lat }`, approximate-grade, reviewed once). Locations without a pin are silently skipped — the game never breaks if the pool is smaller than 30 on day one.

### 1.4 Scoring (original formula)

Per-round max before streak: **1,200 pts** (1,000 distance + 200 time).

```
distanceScore = tier(errorKm)              // table below
timeBonus     = bracket(elapsedSec)        // table below
streakMult    = 1 + 0.05 × min(streak, 10) // 1.05 … 1.50
roundScore    = max(0, round((distanceScore + timeBonus) × streakMult) − 100 × hintsUsed)
```

**Distance tiers (haversine km):** ≤2 km Bullseye 1,000 · ≤5 km On the block 800 · ≤15 km In the neighborhood 600 · ≤40 km Right county 400 · ≤100 km Same corner of Leonida 200 · >100 km Lost at sea 50.

**Time bonus:** ≤15 s +200 · ≤30 s +150 · ≤45 s +100 · ≤60 s +50 · >60 s/timeout +0.

**Streak:** increments when a round's pre-multiplier subtotal (`distanceScore + timeBonus`) ≥ 600. Below 600 or a timeout resets to 0. The streak count *before* the current round sets this round's multiplier, then the streak updates.

**Worked example:** Round 3, streak 2, 4 km off, 28 s, 1 hint → `(800 + 150) × 1.10 = 1045 − 100 = 945 pts`. Streak becomes 3 (950 ≥ 600).

### 1.5 Game flow

1. **Start screen:** title, one-line how-to-play, 3 difficulty mode cards (with pool sizes), first-run name entry (stored locally), "Start game." Returning players see best score + games played.
2. **Round loop (×5):** clue dossier card (left panel desktop / collapsible sheet mobile) + 3D game-mode map + HUD (round x/5, timer ring, streak indicator, confirm button). Clue → place/reposition → lock (or timeout) → result overlay.
3. **Round result overlay:** true pin drops with neon pulse, line connects guess → truth; breakdown card: tier name, error km (1 decimal), distance points, time bonus, streak multiplier, hint deductions, round total, running game total. "Next round" advances (auto-advances after final round).
4. **Final score screen:** game total (theoretical max 9,000), best round, average error km, hints used, final streak; "New best!" badge; buttons: Play again (same difficulty), Change difficulty, View leaderboard. The game record is written to the local leaderboard automatically on completion — no extra click.
5. **Replay + share:** one tap restarts with a fresh 5-location draw (no repeats within a game). Share button copies a text summary: "I scored 4,210 on Find the Location — Leonida Explorer. Can you beat it? gta6mapx.com/game/find-the-location" (text-only in Phase 1; image share cards deferred to Phase 2).

### 1.6 Leaderboard

**Phase 1 — localStorage, personal-bests only** (no accounts exist; a shared local board is meaningless):
- `gta6mapx_guessgame_player_v1`: `{ name, createdAt, gamesPlayed, bestScore, bestStreak, totalScore }` — name entered once, inline rename control.
- `gta6mapx_guessgame_games_v1`: array of game records, newest first, capped at 50 (FIFO evict): `{ id, date, difficulty, rounds: [{ locationSlug, guessLngLat, truthLngLat, errorKm, elapsedSec, hintsUsed, distanceScore, timeBonus, roundScore }], totalScore, bestStreak, avgErrorKm, hintsUsed }`.
- Leaderboard view: player's top 10 games + lifetime stats (games played, best score, best streak, average error).

**Phase 2 — Supabase global leaderboard (migration path):** same record shape + `userId`; table mirrors localStorage columns 1:1 plus `validated` and `created_at`. One-time local→cloud import of top 10 on first sign-in (user-confirmed, `imported: true`). Global board ranks by bestScore per user; secondary boards for best streak / games played.

**Anti-abuse (light):** Phase 1 is trust-based and personal-only — UI says "Your personal records — stored on this device"; no anti-cheat code. Phase 2 requires: (a) server-side score recomputation from submitted per-round payloads (client totals never trusted); (b) per-account/IP rate limiting (e.g. 50 games/day).

### 1.7 Accessibility + mobile (game)

- All controls ≥ 44×44 px; confirm button sticky and reachable on small screens.
- **Keyboard:** map canvas focusable (`tabindex=0`); "Place pin" drops one at map center; **arrow keys nudge** (0.01°/press, 0.1° with Shift); **Enter** confirms; **Esc** clears preview; **H** uses next hint. Listed in a "Keyboard controls" disclosure on the start screen.
- `aria-live` announces "Guess placed," "Guess moved," "Round locked," and full round results.
- `prefers-reduced-motion`: camera fly-to becomes instant cut; pulse/ring animations disabled.
- **Timer fairness:** visible pause button freezes timer and map (interruptions, screen-reader users, mobile app-switching). Unlimited pauses, clearly indicated.

### 1.8 Game — phased checklist

**Phase 1 — local-only game:**
- [ ] Author `gamePin` records (approximate-grade, reviewed; selector skips pin-less locations)
- [ ] `/game/find-the-location` route: start screen, 3 difficulty modes, first-run name entry
- [ ] Game-mode 3D map: clean map, click/tap place, drag reposition, confirm lock
- [ ] Round engine: 5-round draw without replacement, 90 s timer with pause, 2 hints/round (−100 each)
- [ ] Scoring per §1.4; result overlay with guess→truth line
- [ ] Final score screen: stats, replay, text share
- [ ] localStorage player profile + game records, personal-bests leaderboard view
- [ ] Keyboard controls + aria-live + reduced-motion + ≥44px targets

**Phase 2 — accounts + global board (after Supabase connected):**
- [ ] Auth-gated global leaderboard, same record shape + `userId`
- [ ] One-time local→cloud import on first sign-in
- [ ] Server-side score recomputation + rate limiting
- [ ] Per-user stat boards; image share cards

**Explicitly out of scope:** multiplayer/versus, daily challenges, photo rounds, achievements, any accounts-dependent feature in Phase 1.

---
## 2. Intel Library

### 2.1 Concept

A browsable, searchable **dossier gallery of our curated entity collection** — all 128 entities (58 vehicles, 33 locations, 30 weapons, 7 characters) as a Vice City neon-noir "case-file archive." Every item: name, kind, evidence-status badge, original summary excerpt, tags. It is deliberately **not a photo gallery** — per our legal hard rules (no hosted leaks, no reposted trailer stills, no unauthorized Rockstar artwork) the library contains **zero captured media**.

**What we show:** entity data (name, kind, evidence status, 1–2 line summary excerpt, tags, kind-specific fields) plus an original **CSS/SVG "dossier plate"** per card — abstract neon-noir art authored by our rules (kind-keyed gradient in our sunset palette, a large generic glyph/letterform, scanline/HUD texture, evidence-status strip). Decorative signifiers, never depictions — they never imply what a vehicle looks like or show a location.

**What we NEVER show:** trailer stills/frames/GIFs; leaked screenshots or footage; reposted Rockstar key art or logos; real-world reference photos of the Miami/Florida analogs; any AI-generated image rendering an entity likeness (an AI "render of the car" would be an invented spec — violates honesty).

**Framing copy:** "Every entry is labeled by how we know it. We show no leaked footage, no trailer rips — just verified, honest intel." Transparency *is* the brand.

**Page title decision:** page is titled **"Intel Library"** (route `/library`; nav label "Library"). "Media Library" would mis-set expectations for a no-photos library.

### 2.2 Structure and navigation

- **Route:** `/library`; SiteHeader nav entry after Characters; landing page teaser card added.
- **Header block:** title, one-line honesty statement, result count ("128 dossiers").
- **Category tabs:** All | Vehicles | Locations | Weapons | Characters, each with a count badge. Tablist semantics, arrow-key navigation, neon underline + `aria-selected` on active.
- **Grid:** 1 col mobile → 2 sm → 3 lg → 4 xl. Equal-height cards.
- **Card anatomy (fixed, all kinds):** (1) dossier plate: kind-keyed SVG/gradient art + evidence-status strip on the bottom edge; (2) kind eyebrow (VEHICLE / LOCATION / WEAPON / CHARACTER) + evidence badge; (3) name (Anton, 2-line max); (4) summary excerpt (1–2 lines); (5) tag chips (max 3 visible, "+n" overflow); (6) kind-specific microline ("Benefactor · Sports" / "Vice City · Miami-inspired" / "Handguns" / "Protagonist").
- **Click-through:** whole card is one native `<a>` to `/{kind-plural}/{slug}` (reuses existing routes). Hover: plate brightens, card lifts (reduced-motion disables). Focus-visible: 2px neon outline.

### 2.3 Search

- **One input covers name + tags:** substring, case-insensitive, diacritic-insensitive name search; typing a tag name matches entities carrying it (matched tag chips highlight on cards). Result rows note which field matched.
- **Filters:** evidence status checkboxes — all 4 statuses, all on by default (Rockstar-confirmed / Trailer-confirmed / Leak-reported / Disputed); kind-specific facets: region (locations), manufacturer + vclass (vehicles), wclass (weapons), role (characters). Tabs remain the primary kind selector.
- **Sort:** Name A–Z | Name Z–A | Evidence strength (rockstar-confirmed → trailer-confirmed → leak-reported → disputed). **Default: Evidence strength** — our differentiator leads.
- **Behavior:** all client-side, instant over ~128 entities; input debounced ~150ms; live result count ("24 of 128 dossiers"). **Empty state:** "No dossiers match. Check spelling, or clear filters." + "Clear all" button. Never a dead blank grid.

### 2.4 Honesty in presentation

- Evidence badges use `EVIDENCE_META` labels verbatim — no softer wording.
- Visual distinction (never hidden, clearly labeled): `leak-reported` = amber/orange badge + subtle diagonal "UNVERIFIED" watermark texture on the plate; `disputed` = red badge + plate desaturated (~40% grayscale) + "authenticity questioned" ribbon under the name; confirmed statuses = standard neon, no warnings.
- Badge hover/focus shows the `EVIDENCE_META.blurb` as a keyboard-accessible tooltip.
- No generated stats, top speeds, or flavor text not in the data. Footer honesty line: "Leak-reported and disputed entries are included for transparency — never as fact."

### 2.5 Deep linking

URL-encoded filter state (shareable views):
- `q` search string · `kind` (vehicles|locations|weapons|characters; `all` or omitted = all) · `evidence` comma list of the 4 statuses · facets `region`, `manufacturer`, `vclass`, `wclass`, `role` · `sort` name-asc|name-desc|evidence.
- Example: `/library?kind=vehicles&q=vigero&evidence=rockstar-confirmed,trailer-confirmed&sort=evidence`
- State syncs via `replace` on change (no history spam); page initializes from URL on load; invalid param values are ignored, never error.

### 2.6 Performance

Dataset is trivial (~128 entities, client-side). Dossier plates are one shared component with CSS variations (not per-card unique assets). Growth path: past ~500 entities (submissions tie-in, Phase 3), move filtering server-side backed by Supabase — the URL-param state contract stays unchanged, only the data source swaps.

### 2.7 Accessibility + mobile (library)

- Filter panel becomes a collapsible drawer on mobile with a floating "Filters" toggle (same pattern as the map's mobile filters drawer).
- Cards are native links — keyboard navigable, neon focus ring; badges/tooltips focus-reachable.
- Search input has an accessible label; result-count changes announced via `aria-live="polite"` (debounced).
- Color is never the only signal: evidence status pairs color with text label + icon/ribbon; kind has a text eyebrow. Badge text meets 4.5:1 contrast; watermark textures must not reduce name/summary contrast.
- `prefers-reduced-motion`: no card lift, plate shimmer, or grid re-layout transitions.

### 2.8 Library — phased checklist

**Phase 1 — static curated library:**
- [ ] `/library` route: header, honesty line, result count
- [ ] Category tabs with counts; card component (dossier plate, badge, excerpt, tags, kind microline)
- [ ] Search (name + tag), evidence-status filter, kind-specific facet filters
- [ ] Sort name A–Z / Z–A / evidence strength (default)
- [ ] Empty state + clear-all; deep-link URL scheme, init-from-URL, invalid-param tolerance
- [ ] Nav + landing teaser entries; reduced-motion, keyboard, focus, aria-live, contrast checks

**Phase 2 — richer:**
- [ ] Multi-tag filtering ("has all these tags")
- [ ] Favorites (localStorage bookmark per entity, "Favorites only" filter, syncs with /map mark-as-found where sensible)
- [ ] "Surprise me" random dossier (weighted toward stronger evidence)
- [ ] Saved views (named client-side shortcuts to filtered URLs)

**Phase 3 — submissions tie-in:** library becomes the review surface for user-submitted entities ("Pending review" tab, admin/moderator only, approve→publish / reject). Public library shows published entities only. Requires auth + Supabase + moderation queue — not Phase 1–2.

---
## 3. Settings panel

### 3.1 Option list

Entry points: gear control in `/map` chrome (floating button group desktop; inside filters drawer mobile) opens the panel as a map overlay (map state never lost); gear in `SiteHeader` opens the same panel as a modal on all other surfaces. Map-only options shown in the global modal are disabled with a "Available on the map" hint.

| # | Option | Type | What it changes | Default |
|---|---|---|---|---|
| S1 | Theme — **"Neon Mirage"** | select | Canonical Vice City neon-noir: deep navy/black base, pink→orange sunset gradients, standard HUD chrome | **default** |
| S2 | Theme — **"Midnight Outrun"** | select | Darker, bluer: near-black blue base, restrained neon, dimmer glows for night use | — |
| S3 | Theme — **"Sunset Boulevard"** | select | Warm-leaning: warmer base tones, stronger orange/magenta, higher luminance | — |
| — | Theme behavior | — | All three are dark-neon variants — never a light theme. Sets CSS custom properties (`--neon-*`, `--surface-*`) at root; applies to landing, map, hubs, entity pages, modals | — |
| A1 | **Accent color** | swatch select | Recolors interactive accents (links, active filters, CTAs, countdown digits, focus rings, marker highlight). Options: Neon Pink, Sunset Orange, Electric Cyan, Vice Purple, Lime | Neon Pink |
| U1 | **Units** | km / miles toggle | Distance labels everywhere (map scale, entity readouts, progress stats) | km |
| P1 | **Panel style** | Floating HUD / Docked | Floating HUD: translucent, backdrop blur, neon border, slight gap from edges. Docked: flush, more opaque, squarer — for users who find floating glass distracting | Floating HUD |
| M1 | **Marker clustering** | on/off | Cluster dense pins into count badges at low zoom (MapLibre); off = every marker individually | On |
| M2 | **Map grid overlay** | on/off | Subtle HUD-style lat/lng grid lines, low opacity | Off |
| M3 | **3D buildings + pitch** | on/off | Extruded buildings (zoom 13.5+) + default 58° perspective; off = flat 2D top-down | On |
| F1 | **Camera FOV readout** | on/off | Small HUD readout of camera bearing/pitch/zoom | Off |
| L1 | **Language** | English only at launch | Selector **hidden** at launch (comment-marked for future i18n). Explicit rule: NO mixed-language labels anywhere — all strings authored in English from a single source | English (only) |

**Deliberately excluded at launch:** page backgrounds (fixed neon-noir identity); per-marker color customization (conflicts with semantic evidence-status colors); heatmap (no user-density data yet).

**Behavior:** instant apply, no reload. Write-through persistence on every change (debounced ≤300ms for rapid inputs; effectively instant for discrete controls). Map options apply to the live instance or take effect next map load.

**Reset:** "Reset to defaults" footer button, two-tap inline confirm ("Reset?" → "Confirm"), instant apply, clears the settings key.

### 3.2 Persistence guarantees (anti-bug section)

- **Key:** versioned schema `gta6mapx:settings:v1`. Follows the `useFound.ts` pattern (lazy JSON read/write, try/catch on all storage access).
- **Schema:** single JSON object `{ version: 1, theme, accent, units, panelStyle, clustering, grid, buildings3d, fovReadout, language }`. `version` is mandatory.
- **Validation on load:** read → JSON.parse → whitelist-validate every field. On any failure (missing key, corrupt JSON, unknown version, out-of-range value) discard and fall back to full defaults. Never half-apply a corrupt object.
- **Migration map:** per-version migrations (add new keys with defaults, drop removed keys) — specified now so Phase 2 account sync doesn't redesign it. Phase 1 ships v1 only.
- **Survival:** reload, browser restart, new tabs (same origin). `storage` event listener syncs open tabs live.
- **SSR safety:** client-only lazy load; first paint uses defaults; CSS vars set before paint — no flash-of-wrong-theme, no hydration mismatch.
- **Storage unavailable:** settings still work in-memory for the session; one-time subtle notice "Settings won't be saved in this browser session" — no spam.
- **Phase 2 path (Supabase, later):** the same validated object is the sync payload. On sign-in, server copy wins (local fallback); on change, write-through to localStorage + user profile row. No unserializable values in the object — Phase 1 must not hardcode anything blocking this.

### 3.3 Settings — phased checklist

- [ ] Settings panel UI, all §3.1 options, instant apply, write-through to `gta6mapx:settings:v1`
- [ ] Validation + defaults fallback + mandatory version field
- [ ] Reset-to-defaults (two-tap); cross-tab sync via `storage` event
- [ ] Mobile: bottom-sheet presentation, close button, ≥44px targets
- [ ] English-only: no language selector visible; regression check against mixed-language labels
- [ ] Phase 2: Supabase user-profile sync (server wins on conflict), migration map, offline-first local read path
- [ ] Phase 3: full i18n behind the hidden selector (only if ever needed; one string source, no mixed leaks)

---

## 4. Launch countdown (reusable component)

Target: **November 19, 2026** (GTA VI launch). Single source of truth constant (`LAUNCH_DATE_ISO`) consumed by all placements.

**Variants:** `variant: "full" | "compact"`. Full (landing): large HUD readout `DAYS : HRS : MIN : SEC`, Anton digits, neon glow, grain/scanline treatment; units labeled "DAYS/HOURS/MINUTES/SECONDS". Compact (header pill): "56d 04h 12m" / "LAUNCH IN 56D", links to landing anchor. Ship compact on desktop header; hide on mobile (space).

**Behavior:**
- Live ticking every second, client-side only. **SSR-safe:** server renders a static placeholder (`--` digits); live value hydrates on client — never compute "time remaining" during server render.
- **Timezone-proof:** absolute target instant in UTC; never shifts with the visitor's timezone.
- **Post-launch state:** when `now >= launchDate`, one-way switch to **"OUT NOW"** — full variant becomes celebratory "GTA VI IS OUT NOW" banner (neon, subtle pulse; pulse disabled under reduced-motion); compact shows "OUT NOW". No negative numbers, ever.

**Accessibility:** ticking digits `aria-hidden`; visually-hidden live region announces remaining time at most once per minute (`aria-live="polite"`); accessible name "Countdown to GTA VI launch."

**Checklist:** [ ] reusable component (full + compact), SSR-safe placeholder, [ ] full variant on landing, [ ] compact in desktop header, [ ] OUT NOW state, [ ] aria treatment.

---

## 5. Credits / About modal

### 5.1 Sections (in order)

1. **About the project** — fan-made interactive map + guides for GTA VI; mission: pre-launch intel, honest and transparent. Short explainer of the **Leak Transparency Engine** (every entry carries Rockstar-confirmed / Trailer-confirmed / Leak-reported / Disputed status). Wording original.
2. **Team / roles** — generic role list only ("Map data", "Design", "Research"). **No invented names** — owner adds names if ever wanted.
3. **Data sources** — official Rockstar Games announcements and published materials; trailer/promo analysis via public reporting (original summaries, no hosted leaked files); community mapping contributions; **GTADB / map.gtadb.org — CC BY 4.0 attribution slot: a clearly-marked USER-OWNED PRE-LAUNCH BLOCKER** (dashed-border "Attribution — owner to add before public deploy" panel describing what must go in it per CC BY 4.0). The final attribution text is NOT written by us — slot reserved only. Same placeholder appears in the footer "Data" section so the blocker is visible wherever credits live. **The site must not publicly deploy without this slot filled.**
4. **Fan-project disclaimer** (fixed meaning, on every credits surface): *"This is an unofficial fan project. Not affiliated with, endorsed by, or connected to Rockstar Games or Take-Two Interactive. Grand Theft Auto and all related marks are trademarks of Take-Two Interactive."*
5. **Contact** — contact email placeholder (owner to supply). No invented addresses.

### 5.2 Behavior

Opens from header "About" and footer "About / Credits". Focus trap (focus in on open, Tab cycles, returns to trigger on close). ESC closes; backdrop click closes; visible "Close" button. Reduced-motion: no open/close animation. Scrollable body on small screens; disclaimer as a visually separated band above the fold.

### 5.3 Checklist

- [ ] Modal with all §5.1 sections, focus trap, ESC, backdrop close, reduced-motion
- [ ] **Attribution placeholder slot** in modal + footer link section — visibly marked OWNER-ADDS-BEFORE-DEPLOY
- [ ] Fan-project disclaimer on every credits surface
- [ ] Contact placeholder (owner supplies)

---

## 6. Shared accessibility + mobile rules (all engagement features)

- **Keyboard:** every control reachable and operable (native inputs; radios for theme/accent/units/panel-style; switches for toggles). Visible accent-colored focus indicator, never removed. Modals: focus trap + ESC.
- **ARIA:** settings `role="dialog"` + `aria-label="Settings"`; control groups `fieldset`/`legend` or `role="radiogroup"`; toggles expose `aria-checked`. Credits modal `role="dialog"` `aria-modal="true"` labelled by heading. Countdown ticking digits `aria-hidden` with a throttled live region.
- **Contrast:** neon-on-dark text meets WCAG AA (4.5:1) — glow is decorative, base text color itself must pass. Status/evidence never conveyed by color alone.
- **Reduced motion:** honor `prefers-reduced-motion` everywhere — no panel slides, no countdown pulse, no modal transitions, no pin-pulse/parallax; instant state changes.
- **Mobile:** settings = bottom sheet (close button mandatory; backdrop tap closes); library filters = collapsible drawer with floating "Filters" toggle; game clue card = collapsible sheet; touch targets ≥ 44px; full countdown scales to fluid 2×2 grid; credits modal = near-full-screen sheet with sticky close.

---

## 7. Phased implementation checklist (combined)

### Phase 1 — local + static (this build)
- [ ] Game: author `gamePin` records (approximate, reviewed); `/game/find-the-location` route; game-mode 3D map (place/drag/lock); 5-round engine, 90 s timer with pause, 2 hints/round; §1.4 scoring; result overlay; final screen + text share; localStorage profile + personal-bests leaderboard; keyboard + aria + reduced-motion
- [ ] Library: `/library` route; tabs with counts; dossier card component; search (name+tag); evidence + facet filters; sort (default evidence strength); empty state + clear-all; deep-link URL scheme; nav + landing teaser entries
- [ ] Settings: panel UI, all §3.1 options, instant apply, write-through `gta6mapx:settings:v1`, validation + defaults fallback, reset (two-tap), cross-tab sync, mobile bottom sheet, English-only
- [ ] Countdown: reusable full + compact variants, SSR-safe, full on landing, compact on desktop header, OUT NOW state
- [ ] Credits modal: all §5.1 sections, focus trap, ESC, reduced-motion; attribution placeholder slot (modal + footer); fan-project disclaimer everywhere; contact placeholder
- [ ] Accessibility + mobile pass per §6 across all five features

### Phase 2 — accounts + cloud (after Supabase connected)
- [ ] Game: auth-gated global leaderboard (same record shape + `userId`), one-time local import, server-side score recomputation + rate limiting, per-user stat boards, image share cards
- [ ] Library: multi-tag filtering, favorites (localStorage, syncs with /map mark-as-found), "Surprise me", saved views
- [ ] Settings: Supabase user-profile sync (server wins on conflict), migration map, offline-first local read path

### Phase 3 — community + scale
- [ ] Library: "Pending review" tab as the user-submission review surface (admin/moderator only; approve→publish / reject). Requires auth + Supabase + moderation queue.
- [ ] Settings: full i18n behind the hidden language selector (only if ever needed; one string source, no mixed leaks)

### Explicitly out of scope (all phases)
Multiplayer/versus, daily challenges, photo-based game rounds, achievements system, per-marker color customization (conflicts with evidence semantics), heatmap, page-background options, light themes, any accounts-dependent feature in Phase 1.

---

## 8. Coordinator decisions + open questions for Husnain

**Decisions (locked by coordinator):**
1. Game eligibility is a **live status filter**, not curation — future evidence-status changes auto-update the round pool.
2. Local leaderboard is **personal-bests only** — no cross-player board without accounts (a shared local board is meaningless).
3. Library is the **"Intel Library"** (`/library`, nav "Library") — "Media Library" mis-sets expectations for a no-photos archive; dossier plates are original abstract SVG, never depictions.
4. Default sort in the library is **evidence strength** — our differentiator leads.
5. Settings persistence = versioned `gta6mapx:settings:v1` localStorage object with validation/fallback and cross-tab sync; the same shape syncs to Supabase in Phase 2.
6. GTADB CC BY 4.0 attribution slot is **reserved-but-empty, user-owned pre-launch blocker** — the site must not deploy publicly without it filled (owner adds it himself, per his decision).

**Open questions for Husnain:**
1. Game defaults: 5 rounds / 90 s timer / 3 difficulty modes — keep, or prefer a 3-round "quick play" option too?
2. Game route `/game/find-the-location` — ok, or shorter `/game`?
3. Library title "Intel Library" vs plain "Library" in the header block — preference?
