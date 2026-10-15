# UI Audit — GTA6mapx.com (Track C, Sep 24, 2026)

Baseline: 141 static pages. Next.js 16 + Tailwind, dark theme, no heavy deps.
Checked by reading every route's source (landing, hubs, detail pages, /map, cheats, 404).

## 1. Landing page (`/`)
- **Hero is text-only and flat.** Countdown + email form are fine, but there is no
  visual identity: no map preview, no gradient/glow treatment, no brand mark beyond
  the wordmark. First impression is "dark template", not "the GTA 6 map you can trust".
- **Landing nav and entity pages use different headers.** `/` has its own inline
  header (no fan disclaimer link, no nav links); every other page uses `SiteHeader`.
  Inconsistent chrome.
- **Database teaser cards lack counts.** Cards say "Browse →" with no entity count —
  a missed trust/SEO signal ("58 vehicles" is more clickable).
- **Features grid = 6 equal cards.** No hierarchy; the #1 differentiator (evidence
  chain / honesty) is card #1 with the same weight as everything else.
- Footer disclaimer present ✓ (keep).

## 2. Shared header/footer (`SiteHeader`, `SiteFooter`)
- **No mobile nav.** On narrow screens the 6 nav links wrap into 2 rows and eat
  vertical space; `Map / Vehicles / Weapons / Characters / Locations / Cheats`
  in a wrapped flex looks cramped. Needs a compact mobile menu.
- **No "current page" indication.** The user can't tell which section they're in.
- Footer is bare: disclaimer + © only. Fine for now, but could carry hub links.

## 3. Entity hubs (`/vehicles`, `/locations`, `/weapons`, `/characters`)
- **Hub header is bland.** Gray band, breadcrumb + H1 + blurb; no section icon,
  no entity count callout, no evidence-legend explanation ("what do these badges mean?").
  Users see badges on cards before ever learning what they mean.
- **Section subheads repeat the pattern verbatim** across 4 hubs (title + count).
  No per-section visual identity.
- **No badge legend on hubs.** The differentiator of the whole site (honest labels)
  is unexplained at the point of browsing.
- **No search/filter on hubs.** 58 vehicles in grouped sections — acceptable today,
  but a text filter would help. (Not a Phase-1 ask; noted as later.)
- Cards themselves are decent: title, sub-line, badge, 2-line summary. Weaknesses:
  badge + title can crowd on mobile; card hover is only a border color change.

## 4. Entity detail pages (`/[slug]`)
- **Evidence chain is present but under-designed.** It's a gray-bordered box that
  reads like a footnote, not the product's signature feature. The differentiator
  should be the most designed element on the page.
- **Order issue:** badge → H1 → evidence box → summary. The summary (why the
  entity matters) sits below the fold-ish evidence box on mobile.
- **Duplicated chrome:** back-link ("← All vehicles") + breadcrumb trail show the
  same navigation twice within ~40px.
- **Related section has no badges visible?** — cards show badges ✓, fine.
- **"Verification sprint" callout is a yellow alert on every page** — repetitive
  but honest; keep, maybe restyle as a status strip.

## 5. Evidence badges
- **The 5 badge classes live in `globals.css` as global `.badge*` classes** —
  fine, but the legend for them doesn't exist anywhere on the site.
- Labels: `Rockstar-confirmed / Trailer-confirmed / Leak-reported / Disputed leak`.
  Honest ✓. Legend must repeat these exact meanings.

## 6. /map chrome (`GameMap.tsx`)
- **Header is map-specific** (its own inline header, third variant — landing and
  SiteHeader are the others). Three header variants total = inconsistency.
- **Control cluster (top-left) is functional but plain.** 3D toggle / Reset /
  Filters are okay; the "Share map view" button duplicates the detail panel's copy
  button.
- **Search dropdown has no certainty badges** on results — a missed trust signal.
- **Empty/loading states:** `MapLoader` shows skeleton ✓; if WebGL fails there's
  a fallback message ✓. Search no-results text exists ✓.
- **Detail panel (desktop):** solid. Pin name, badge, source label, description,
  mark-as-found, copy link, coords. Good density.
- **Mobile bottom sheet:** swipe-to-dismiss ✓, drag handle ✓. The 3D/pitch hint
  text at bottom-left can overlap the attribution control on small screens.

## 7. Typography / spacing / hierarchy (global)
- **No type scale system.** Sizes are ad-hoc (`text-3xl sm:text-4xl` etc.).
  Body copy gray (`#8b94a3` / `#c3cad4`) has decent contrast on `#0a0e14`.
- **Section rhythm is inconsistent:** hub sections use `mt-10`, landing features
  use `py-14 sm:py-20`, detail page uses ad-hoc `mt-6/mt-8`. Not broken, just
  un-systematic.
- **Emoji as iconography everywhere** (🚗 🗺️ 🔫 …). Cheap and zero-cost (no deps,
  no images) — keep, but standardize sizes/alignment.

## 8. Mobile
- SiteHeader nav wrap (see §2).
- Entity cards: badge sits top-right next to H3 — on 320px screens the badge can
  push the title into a narrow column. Stack order should flip: badge under title
  on small screens.
- Landing teaser grid is 1-col on mobile ✓; countdown boxes are 4× `w-16` ✓.
- Map: sidebar becomes 38vh drawer ✓; filter buttons have 40px+ targets ✓.

## Priorities for this track (visual-only, no URL/IA changes)
1. Unify header: one `SiteHeader` everywhere (landing included), mobile menu,
   active-section highlight.
2. Landing hero: visual identity (gradient glow + map preview cue), counts on
   teaser cards, hierarchy in features (lead with honesty differentiator).
3. Hub polish: shared polished `HubHeader` module (count callout + badge legend),
   section identity, better card design with mobile-safe badge placement.
4. Detail pages: evidence chain as the signature designed element; remove
   duplicated back-link/breadcrumb; keep all badges honest and visible.
5. Map chrome: keep 3D/bottom-sheet behavior; polish controls, add badges to
  search results, fix hint/attribution overlap.
