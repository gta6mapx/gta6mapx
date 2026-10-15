# GTA6mapx.com — Debug Sweep Log (Track D)
**Date:** Sep 24, 2026 · **Engineer:** Debug team (subagent) · **Repo:** `~/workspace/gta6mapx/web` (Next.js 16.3.6 + React 19 + Tailwind 4, MapLibre GL)

> Note: three other teams (data, content, design) were editing the same repo live during this sweep.
> Files they were actively touching were left alone per instructions; collisions are noted below.

## 1. BASELINE (measured ~11:36 PKT, before any fix)

| Check | Result |
|---|---|
| `npm run build` | ✅ GREEN — 141/141 static pages, 0 errors |
| `npx tsc --noEmit` | ✅ clean, exit 0 |
| `npm run lint` | ❌ **17 errors + 1 warning** |
| Broken internal links | none found (all static `href`s → `/`, `/map`, `/vehicles`, `/locations`, `/weapons`, `/characters`, `/cheats`; dynamic links via `EntityCard`/`generateStaticParams` consistent) |
| Entity slugs | vehicles 58, locations 33, weapons 30, characters 7 — all unique per kind |
| Renamed slugs verified present | `/vehicles/jobuilt-hauler`, `/vehicles/jobuilt-phantom`, `/vehicles/jobuilt-phantom-custom`, `/vehicles/bermacht-sentinel-convertible` (Ü stripped by slugify → `b…`), `/locations/vice-dale-county` |
| Browser console-error risks (code review — no live browser available to subagent) | 1 real: landing countdown `useState(() => Date.now())` renders server time → hydration mismatch console error on every load |

### Lint baseline detail (17 errors + 1 warning)
- `react/no-unescaped-entities` ×3 — raw `'` in JSX: `characters/page.tsx:36`, `cheats/[platform]/page.tsx:112,132`
- `@next/next/no-html-link-for-pages` ×11 — plain `<a>` for internal nav: `map/page.tsx` ×6, `app/page.tsx` ×5
- `react-hooks` errors in `GameMap.tsx` — ref written during render (`selectRef.current = …`, line 46), `setState` in effect body (`setMapError`, line 75)
- `react-hooks/set-state-in-effect` in `useFound.ts:20` — mount effect hydrating from localStorage
- 1 warning — `markersRef.current` read in unmount cleanup (`GameMap.tsx:139`)

## 2. FIXES APPLIED (by debug team)

1. **`src/app/page.tsx`** — countdown hydration fix: `now` starts `null` (server + first client render agree on `00:00:00:00`), real clock set in mount effect; 7 internal `<a>` → `<Link>`.
2. **`src/app/map/page.tsx`** — 6 internal `<a>` → `<Link>` (+ `next/link` import).
3. **`src/app/characters/page.tsx`** — `Rockstar's` → `Rockstar&apos;s`.
4. **`src/app/cheats/[platform]/page.tsx`** — `they're` → `they&apos;re`, `we're` → `we&apos;re`.
5. **`src/modules/progress/useFound.ts`** — replaced mount-effect hydration with lazy `useState(loadFound)` (safe: hook only runs in `GameMap`, which is loaded `ssr:false`, so no SSR render exists to mismatch; also removes a double render).
6. **`src/modules/map/GameMap.tsx`** —
   - ref-write-during-render → `useCallback` selector + assignment inside `useEffect` (runs after every render);
   - `setMapError(true)` in init-effect catch → kept, with justified `eslint-disable` (one-shot failure path, not a cascade);
   - unmount cleanup keeps reading latest `markersRef.current` intentionally, with justified `eslint-disable` (capturing init-time value would be wrong);
   - `setPointerCapture` wrapped in try/catch (throws on some mobile browsers if pointer already released → console error).
7. **Mobile review (code):** `/map` is `h-dvh` app-like fixed viewport, no page scroll; filters drawer collapses on mobile; bottom sheet is `max-h-[55%]`, swipe-down-to-dismiss via Pointer Events on the handle only (body keeps native scroll), `touch-none` scoped to handle; 44px+ touch targets on controls; no horizontal-overflow risks found (`overflow-hidden` on map root). No changes needed.

Post-fix: `npm run lint` on all six touched files = **clean**; `npx tsc --noEmit` = **clean**.

## 3. PARALLEL-TEAM COLLISIONS (observed, not caused by debug team)

- **~11:36–11:39** data team dropped `src/app/admin/gtadb-review/` (new dynamic route) and edited `locations.ts`/`weapons.ts`/`characters.ts` live. Mid-edit they briefly broke `tsc` (`LOCATIONS` kind-widening, `actions.ts` import errors); they fixed it themselves within minutes. **Skipped per instructions.**
- Data team migrated `weapons.ts` (30→29 records) and `characters.ts` to **explicit `slug:` fields** (no longer `slugify(name)`); added `gtadb-approved.json` → new location `y-vice-city` ("Y Vice City") now builds as a 34th location page. Slug verification was updated to prefer explicit slugs.
- **Build-output thrash:** another team's agent ran `next build` in a loop (~11:41–11:43), repeatedly wiping `.next` (twice observed a wiped/failed state, 0 HTML files). Debug team worked around it with an **isolated snapshot build** outside the repo (bind/hardlink of `node_modules`; cleaned up afterwards).
- **Reversions by other teams (noted, not re-applied):**
  - `src/app/page.tsx` — design team's landing redesign superseded the countdown hydration fix (back to `useState(() => Date.now())`) and trimmed nav links. Countdown hydration-mismatch risk is **back** in the repo; recommend re-applying the null-init pattern once their redesign settles.
  - `src/app/characters/page.tsx` — content team's edit removed the `&apos;` fix, but the file is lint-clean (they reworded), so no action needed.

## 4. FINAL VERIFICATION

- `npm run build` (repo): ✅ GREEN twice — **141/141** static pages (~11:40) and **142/141→142/142** static pages (~11:42, +`y-vice-city`, + dynamic `/admin/gtadb-review`).
- Isolated snapshot build (all debug fixes included): ✅ **141/141** green.
- Slug→HTML resolution on final build: **vehicles 58/58, locations 33/33 (+`y-vice-city` present), weapons 29/29, characters 7/7 — 0 missing.**
- Smoke test (`next start -p 3100`, isolated build): **127/127 entity detail pages → 200, 0 failures.**

| Route | Status |
|---|---|
| `/`, `/map`, `/vehicles`, `/locations`, `/weapons`, `/characters`, `/cheats` | 200 |
| `/cheats/ps5`, `/cheats/xbox`, `/cheats/pc` | 200 |
| `/vehicles/jobuilt-hauler`, `/vehicles/jobuilt-phantom`, `/vehicles/jobuilt-phantom-custom` | 200 |
| `/vehicles/bermacht-sentinel-convertible`, `/locations/vice-dale-county` | 200 |
| samples: `/vehicles/pfister-growler`, `/vehicles/vapid-dominator-gt`, `/locations/vice-city`, `/locations/malibu-club`, `/weapons/pistol`, `/weapons/rpg`, `/weapons/micro-smg-uzi`, `/weapons/ak-rifle`, `/characters/lucia-caminos`, `/characters/raul-bautista` | 200 |
| all 127 entity slugs (58+33+29+7) | 200 |
| `/vehicles/no-such-vehicle`, `/locations/nope`, `/weapons/nope`, `/characters/nope` | 404 (correct) |

- Rendered-HTML checks: all internal `href`s resolve to real routes; JSON-LD present on entity pages; evidence badges render; map shell loads. No internal `<a>` tags remain in `app/page.tsx` / `app/map/page.tsx`.
- Test server stopped after the sweep (port 3100 freed for the other teams); isolated build dir removed.

## 5. OPEN / NEEDS OWNER

1. **Pre-launch blocker (unchanged, owner's action):** gtadb.org CC BY 4.0 attribution/credit must be added by Husnain himself before any public deploy. Debug team wrote no credit text (per rule).
2. **Countdown hydration fix needs re-applying** once the design team's landing redesign settles (`src/app/page.tsx`: initialize countdown state as `null`, set real time in mount effect — pattern was in place, reverted by their redesign).
3. **Live-browser verification not done** (subagent has no live-browser access): recommend the parent run one real-browser pass on `/map` (WebGL/map tiles, bottom-sheet swipe, filters drawer) and the landing page (countdown, no console errors) when convenient.
4. No deploy performed (per hard rule: local builds only, zero budget).
