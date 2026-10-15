# Spec D+E+F — Leaderboard, Community Hub & Extras

**Section:** Leaderboard + community hub + extras
**Status:** Draft spec (Phase 1 spec pass)
**Supabase status:** schema.sql EXISTS but Supabase is NOT connected yet.
Every item below is marked **[NO-SUPABASE]** (implementable with existing stack, guest-local-first, no DB needed) or **[NEEDS-SUPABASE]** (requires the Postgres/Auth backend to be live). Nothing here is deploy-ready before its tag allows.

---

## D — Persistent global leaderboard for the guessing game (with seasons)

The guessing game itself ("Find the Marker": guess a trailer-still location on the map, scored on accuracy) is specced by a sibling team. This section covers only the **leaderboard system** that consumes its score events.

### D.1 Score event contract (consumed from the game) **[NEEDS-SUPABASE]**

The game emits one score event per completed round. The leaderboard ingests these events; the game never writes ranks directly.

Event fields (prose):

- **event id** — unique per round attempt (idempotency key; replays of the same submission must not double-count).
- **player identity** — one of: registered account id (Supabase auth UUID), or guest device id (persistent, generated client-side, stored in localStorage; rotatable by the user on request). The event must declare which kind it is.
- **game still id** — which trailer still was guessed (for replay-detection and diminishing-returns logic).
- **round accuracy** — normalized 0–100: e.g. distance between guess and true marker mapped to a curve (exact pin ≈ 100, within a small radius ≈ 90–99, decaying to 0 beyond a cap). The sibling game team owns the exact distance→accuracy curve; this spec only requires that the emitted value be a normalized 0–100 number.
- **round duration** — seconds from still reveal to guess submit (for speed bonus).
- **attempt number for that still** — 1st attempt vs replay (for diminishing returns).
- **timestamp** — server-side timestamp recorded at ingestion (client timestamps are untrusted).
- **season id** — the active season at ingestion time; assigned by the leaderboard service, not the game.

The leaderboard service computes and stores a **round score** from the event; it does not trust a client-supplied score.

### D.2 Scoring formula **[NEEDS-SUPABASE]**

```
round_score = base_accuracy + speed_bonus, then multiplied by replay_decay, capped
```

- **base_accuracy** = the 0–100 accuracy value from the event.
- **speed_bonus** = up to +10 points, linear decay: full bonus for guesses under ~5 seconds, decaying to 0 by ~60 seconds. Rationale: rewards genuine map knowledge (fast recognition), but capped small so speed can never outweigh accuracy.
- **replay_decay** = 1.0 on first attempt at a still; 0.5 on the 2nd; 0.25 on the 3rd; 0 afterwards (no points for 4th+ attempts on the same still). Rationale: prevents farming one memorized still to the top; rewards breadth of map knowledge instead.
- **cap**: round_score capped at 110.
- **season total** = sum of a player's best round_score per still (one best entry per still per player), not the sum of all attempts. This makes the board a measure of breadth + precision, and makes replay-farming worthless by construction.

Worked example: player guesses still #7 at 92 accuracy in 12s on first attempt → base 92 + speed ~7 = 99. Replays same still at 98 accuracy → (98 + ~8) × 0.5 = 53 — kept only if higher than their previous best for that still.

### D.3 Seasons **[NEEDS-SUPABASE]**

- **Cadence: monthly.** Justification: the game is a pre-launch engagement loop (Nov 19, 2026 launch is the real event); monthly seasons give repeated fresh-start excitement and a monthly content/newsletter beat ("October champions") without the churn of weekly resets or the staleness of quarterly ones. Monthly also keeps the season total small enough that a mid-month newcomer can still compete, which weekly would over-favor and quarterly would kill.
- **Season identity**: `YYYY-MM` string (e.g. `2026-10`). Season boundaries at 00:00 UTC on the 1st.
- **Season lifecycle**:
  - New season: all season totals reset to zero; previous season's final board is **archived and frozen** (read-only, still browsable: "/leaderboard/seasons/2026-10").
  - A short **results window** (first 48h of the month): previous season shows a "final standings" banner; winner spotlight assigned (see E.2).
  - **All-time board** runs alongside: lifetime best-per-still sums, never reset (see D.4).
- Season config (cadence length, speed bonus params, replay decay factors) must be **data-driven** (a config record), not hardcoded, so admins can tune without a deploy — but any mid-season change applies only from the next season.

### D.4 Boards **[NEEDS-SUPABASE]**

Three boards, one page:

| Board | Scope | Reset | Description |
|---|---|---|---|
| **Season** | Current season | Monthly | Default view. Sum of best-per-still round scores this season. |
| **All-time** | Lifetime | Never | Sum of best-per-still across all seasons (a player's all-time best per still counts once). |
| **Friends** (opt-in, later) | Mutual opt-in only | Follows season | Only after accounts + friend/mutual-follow system exist; out of Phase 1 scope, noted for later. |

Board columns (privacy-safe): rank, display name (or "Guest #XXXX" — see D.5), role badge/flair earned, season score, rounds played, best accuracy, trend arrow (▲/▼/– vs last week, computed not stored). No emails, no IPs, no device ids, no timestamps of individual rounds — aggregates only.

**Pagination**: top 100 browsable; rank lookup by player ("find me") without paging through.

### D.5 Guest entries **[NO-SUPABASE for local display] / [NEEDS-SUPABASE for persistence]**

Guests are first-class players (the game must be fun without signup — trust moat), but flagged honestly:

- **Identity**: a persistent device id generated client-side on first play, stored in localStorage. Pre-Supabase: the leaderboard is computed from localStorage-only history and shows "your best on this device" — no global board possible without a backend.
- **Display**: guests appear on the global board ranked normally but with a visually distinct **"Guest" tag** (grey, not a role badge) and a generated label like "Guest #4821" (derived from device id hash; never the raw id). This is honest about provenance without shaming.
- **Claiming**: when a guest creates an account, they can **claim** their guest history: device id → account id merge (one-time, server-verified, requires the device to present its id). After claiming, historical rows are re-attributed to the account and the guest label is dropped. Unclaimed guest rows expire after 90 days of inactivity (data minimization).
- **Ranked-account requirement**: to appear on the *season top-100* (the visible prestige board), an account must be **email-verified**. Unverified accounts and guests still rank and can see their own rank, but are excluded from the public top-100 and from season rewards. This is the primary anti-farming control (see D.6). Rationale: verification is cheap for real users, expensive at scale for farmers.

### D.6 Anti-cheat **[NEEDS-SUPABASE]** (partial client pieces [NO-SUPABASE])

Cheating here = fabricated scores, botted rounds, or farmed accounts. Layers:

1. **Server-authoritative scoring** — the client submits only (still id, guess lat/lng, round start time). Accuracy, speed bonus, decay, and totals are computed server-side from the true marker coordinates, which are **never sent to the client before submission**. This single rule kills the entire class of "tamper the score in devtools" cheats.
2. **Attempt rate limits** — per account/device: max ~30 rounds/hour, ~200/day (generous for humans, throttling for scripts). Exceeding returns a cooldown, not a ban. Config-driven. [NO-SUPABASE for client-side soft throttle; NEEDS-SUPABASE for enforced server limit]
3. **Impossible-accuracy anomaly detection** — flags, not auto-bans:
   - Sustained >99.5 average accuracy over 20+ rounds in a season (beyond human plausibility for trailer stills with ambiguous framing).
   - Guess submitted faster than humanly possible *with* near-perfect accuracy (e.g. <1.5s + 100 twice in a row).
   - Statistically impossible improvement curve on a single still without intervening map exploration.
   - Flagged accounts enter a **review queue**; moderators see round-level evidence (timestamps, accuracy series, still ids). Confirmed cheating → scores for the season invalidated (rows marked `invalidated`, excluded from totals, audit-logged) + account warned/banned per policy.
4. **No bot/account farming** — email verification required for top-100 and rewards (D.5); one account per email; disposable-email domain blocklist; signups rate-limited per IP (abuse-prevention only, per the project's IP privacy policy: IPs in security logs, never public, disclosed in privacy policy).
5. **Replay/de-dup** — event id idempotency: duplicate submissions of the same round are ignored.
6. **Appeal** — invalidated players get an in-app notice with reason category ("anomalous accuracy pattern") and a **one-click appeal** that reopens human review. Appeals must be resolved within 7 days; the notice says so. No silent bans.

Anti-abuse note: anti-cheat evidence (round timestamps, accuracy series) is visible **only to moderators** in the review queue — never public, never on profiles. Public boards show aggregates only.

### D.7 Leaderboard page (/leaderboard) **[NEEDS-SUPABASE for global; NO-SUPABASE for personal-device view]**

- Tabs: Season / All-time / Past seasons (archive dropdown).
- Season header: season id, days remaining, your rank (if playing), rules summary link ("How scoring works" — plain-language explanation of D.2, builds trust).
- Row click → mini profile card: display name, role badges, season stats, badges earned (opt-in public — see E). No round history exposed.
- Empty state for new players: "Play your first round" CTA linking to the game.
- Pre-Supabase fallback: page shows personal bests from localStorage + a notice that the global board unlocks with accounts.

---

## E — Rewards (non-monetary)

**Principle: no cash, no prizes, no monetary value.** Stated reasons: (1) legal simplicity — cash prizes trigger sweepstakes/gambling-adjacent regulation that varies by jurisdiction and would require legal review we cannot afford pre-launch; (2) simplicity — monetary rewards attract farmers and bots, directly undermining D.6; (3) brand — a fan community runs on status and recognition, which is cheaper, safer, and more durable than payouts.

### E.1 Profile badges & flair **[NEEDS-SUPABASE]** (badge *definitions* can ship [NO-SUPABASE] as static content)

Badge catalog (non-monetary, permanent once earned unless revoked for cheating):

| Badge | Earned by |
|---|---|
| Season Champion | 1st place, season board, email-verified account |
| Top 10 Finisher | Season board top 10 |
| Sharpshooter | 10 rounds at ≥95 accuracy (all-time) |
| Marathon Mapper | 100 rounds played in a season |
| Early Explorer | Played during pre-launch (before Nov 19, 2026) |
| Comeback | Biggest rank improvement in a season's final week |
| Expeditionist | Complete 5 expeditions (see §H) |
| Compare Contributor | 3 approved compare pairs (see §G) |

- Badges render as small flair next to display names on the leaderboard, hub directory, and comments (when comments exist).
- Badge awarding is **automatic** (computed at season close + on thresholds) with an audit log; admins can revoke for cheating.
- Contributors directory shows earned badges (opt-in profiles only — see F.1).

### E.2 "Mapper of the Month" spotlight **[NEEDS-SUPABASE]**

- Each season's champion (email-verified, **opted in** — see privacy) gets a spotlight card on the community hub (/community): display name, badges, season stats, and a one-line quote they write themselves (moderated).
- **Opt-in is mandatory**: champions are asked, never auto-featured. Declining keeps the title/badge but skips the spotlight; the hub then shows "This month's champion chose to stay anonymous" — which itself signals a privacy-respecting culture.
- Spotlight archive browsable by season.
- Pre-Supabase: this section of the hub is hidden with no placeholder promises.

### E.3 Tie-in with existing trust ranks **[NEEDS-SUPABASE]**

Leaderboard participation feeds the existing trust system (profiles.trust_score), not a parallel currency: approved compare pairs, expedition completions, and sustained fair play add trust score; invalidated cheating subtracts. One reputation, many sources — simpler to understand than separate point systems.

Anti-abuse note: badges have no monetary value and cannot be transferred, sold, or gifted — state this on the badge page to preempt gray markets. Farming badges triggers D.6 controls.

Privacy note: no real names, no emails, no locations, no ages anywhere in rewards surfaces. Display names are user-chosen at signup; guests get generated labels.

---

## F — Community hub page (/community)

A single public page that makes the community visible and the project trustworthy. Everything on it is **opt-in and aggregate** — no personal data, ever.

### F.1 Contributors directory **[NEEDS-SUPABASE]**

- **Opt-in display only**: a profile appears in the directory only if the user toggles "Show me in the community directory" (default OFF). Toggling off removes the listing within 24h.
- **Fields shown**: display_name, role badge (user / trusted_mapper / editor / moderator — from existing profiles.role), approved submission count, badges earned (E.1), "member since" month/year only. Nothing else.
- **Sort/filter**: by role, by approved count, by badges. Search by display name (exact/prefix, no fuzzy email-style lookup).
- **What is never shown**: email, IP, device id, exact join date, round-level game history, submission contents under review, report history.
- Pre-Supabase: route returns a "community features need accounts" notice — no fake directory.

### F.2 Recent activity feed **[NEEDS-SUPABASE]**

Privacy-safe event types only — a fixed allowlist, nothing else may render:

| Event type | Rendered as | Privacy handling |
|---|---|---|
| Pin approved | "New location approved: {pin name}" | Links to public pin; no submitter name unless they are directory-opted-in |
| Milestone reached | "{N} locations now on the map" | Pure aggregate |
| Season closed | "Season {id} final standings are in" | Links to archived board |
| Badge earned | "{display name} earned {badge}" | Only for directory-opted-in users; otherwise "A mapper earned {badge}" |
| Expedition published | "New expedition: {title}" | Links to expedition |
| Compare pair approved | "New before/after: {location}" | Links to pair |

- **Excluded by design**: rejections, reports, bans, invalidations, appeals, moderation actions against users — moderation is never entertainment.
- Feed is **paginated, newest-first**, with a 30-day retention window on the public feed (older events remain as aggregates/stats, not as a scrollable history — limits profiling).
- **No personal activity stalking**: there is no "view all activity by user X" page.

### F.3 Submission stats dashboard **[NEEDS-SUPABASE]** (static explanatory copy [NO-SUPABASE])

Transparency builds trust — publish the pipeline's health as aggregates:

- Pending submissions count (live), approved this week, rejected this week (count only, no reasons publicly).
- **Median review time** (hours, rolling 7 days) — the headline trust metric: "most submissions reviewed within X hours."
- Auto-publish / auto-hide threshold config values shown ("5 confirmations auto-publishes a pin") so the rules are public.
- Queue health sparkline (7-day pending counts) — honest even when the queue is backlogged.
- These numbers are computed from the submissions table; no per-user breakdowns.

### F.4 Hub page composition (/community) **[NEEDS-SUPABASE]** (layout shell [NO-SUPABASE])

Order: (1) Mapper of the Month spotlight (E.2, if opted-in champion exists), (2) submission stats dashboard (F.3), (3) activity feed (F.2), (4) contributors directory (F.1), (5) "how to contribute" CTA (submission flow, guessing game, expeditions). One page, anchor-linked sections.

Anti-abuse note: directory and feed are read-mostly; rate-limit listing endpoints like any public API. Display names go through the existing profanity/moderation filter at signup; reported names can be hidden by moderators without banning the account.

---

## G — EXTRA: Compare-mode screenshots (before/after slider)

### G.1 Concept **[NO-SUPABASE for UI component; NEEDS-SUPABASE for contribution/moderation flow]**

A **before/after slider**: left side shows a trailer still (or official artwork frame), right side shows the in-map location view of the same spot, draggable divider. It answers the fan question "is that place from the trailer actually in the game?" with visual proof — the project's trust thesis made tangible.

Why it differentiates: the analyzed competitor has leaderboards and credits but **no visual verification content** — no before/after, no slider, no user-contributed visual proof pairs. This turns their gap (trust = "wrong locations are the #1 trust killer") into our signature content format, and every pair is SEO-indexable content ("Is X from Trailer 2 a real location?").

### G.2 Data model (prose) **[NEEDS-SUPABASE]**

A **compare pair** record contains:

- **before image**: a trailer still — but **we never host leaked media** (hard rule). Allowed sources: official Rockstar trailer frames (fair-use news-style reporting with source citation, e.g. "Trailer 2 @ 1:47"), or user-captured screenshots from their own game copy post-launch. The record stores the *source citation*, not just the file.
- **after image**: a screenshot of the map location view (our map render or user's in-game capture post-launch), pinned to a location id + camera coordinates (lat/lng/zoom/pitch) so the view is reproducible — "click to open this exact view on the map."
- **rights declaration**: every contributed pair requires the contributor to tick a declaration: "I captured this myself / this is an official trailer frame used for commentary, and I have the right to share it." Same concept as the screenshot-upload declaration in the submission flow — one consistent rights pattern across the product.
- **status**: pending → approved/rejected (moderation queue, same tooling as submissions); approved pairs are public.
- **attribution**: contributor display name only if directory-opted-in (F.1); otherwise "community contributor."

### G.3 Moderation **[NEEDS-SUPABASE]**

- Same moderation queue as pin submissions (one queue, typed items) — moderators approve/reject with one click, edit-before-approve for captions.
- **Auto-reject signals**: image hash match against a blocklist (known leaked-media hashes — we refuse to host leaks even user-uploaded), mismatched location (before/after clearly different places), missing rights declaration.
- Rejected pairs show the contributor a reason; repeat leak-uploaders lose contribution privileges (feeds trust_score negatively).

### G.4 Presentation **[NO-SUPABASE for component; NEEDS-SUPABASE for data]**

- Slider component: accessible (keyboard-draggable divider, aria labels), mobile-friendly (touch drag), lazy-loaded images.
- Embedded on: the linked location's detail panel ("see the trailer comparison"), entity pages, and a `/compare` gallery hub (grid of approved pairs, filterable by trailer/source).
- Each pair shows: caption, source citation ("Trailer 2 @ 1:47"), certainty alignment (the pair inherits the pin's certainty badge — a Speculation pin's pair is labeled speculation, never presented as proof).

Anti-abuse note: upload rate limits per account/device; image hash dedupe prevents the same pair being spammed; the leak-hash blocklist is the hard legal guardrail. Report button on every pair ("wrong location" / "copyright concern") → 3 reports auto-hides pending review (mirrors the pin report threshold).

Privacy note: contributors are credited by display name only, opt-in. No EXIF data is stored or displayed — strip EXIF on upload.

**GTADB attribution blocker note**: if any compare pair references GTADB-derived coordinates or data, the pre-launch GTADB attribution (which the user adds himself) must be live first — same blocker as the map itself. Do not write credit text in this spec.

---

## H — EXTRA: Expeditions (guided tours)

### H.1 Concept **[NO-SUPABASE for static authored tours; NEEDS-SUPABASE for progress/proposals]**

**Expeditions** are curated, ordered pin lists — guided tours like "Vice Beach neon tour" or "Trailer 2 filming locations, in order." They turn the map from a reference tool into an *experience*: follow the route, check off stops, finish the tour. Competitor gap: nobody in the analyzed set offers guided tours; it's a content format that is cheap to author and highly shareable ("I finished the neon tour").

### H.2 Authoring **[NEEDS-SUPABASE]**

Two lanes:

- **Editor-created**: editors/moderators author expeditions in the admin panel — title, description, ordered stop list (pin ids + per-stop narration text, 1–2 sentences each), cover image (original or official-artwork-with-citation; never leaked media), estimated stops/time, difficulty/theme tags.
- **Community-proposed**: any verified account can propose an expedition (same fields, draft status). Proposals enter the moderation queue; editors approve/edit/reject. Approved community expeditions credit the proposer (display name, opt-in per F.1) as "proposed by."
- **Quality bar for approval**: every stop must be a live pin; narration must be original text (no copied guide content); no speculation presented as fact (stops inherit pin certainty).

### H.3 Expedition experience **[NEEDS-SUPABASE for progress; NO-SUPABASE for static tour rendering]**

- **Expedition page** (`/expeditions/[slug]`): cover, description, stop list with per-stop "jump to map" deep link (reuses the map `?lat=&lng=&zoom=` deep-link pattern), progress bar.
- **Progress within an expedition**: checking off stops — stored per account (or per device id for guests, localStorage-first per the project's guest-local-first rule). Progress = "visited X of Y stops" (manual check-off; post-launch could optionally auto-check via mark-as-found, but manual is the honest v1).
- **Shareable deep links**: `/expeditions/[slug]?stop=3` opens the tour focused on stop 3; plus a "share my progress" link showing X/Y (no personal data in the URL).
- **Completion badge**: finishing all stops awards the "Expeditionist" progress toward badge (E.1: complete 5 expeditions). Completion is recorded with a timestamp; re-completing doesn't double-award.
- **Expedition hub** (`/expeditions`): cards sorted by completions, filterable by theme tag.

Anti-abuse note: community proposals go through the same moderation queue as submissions (spam/troll tours get rejected fast); proposal rate limit (e.g. 3 pending proposals max per account); reported expeditions follow the 3-reports-auto-hide rule.

Privacy note: expedition progress is private by default; the share-progress link is explicitly user-initiated. Leaderboard-style "who finished fastest" is deliberately excluded — tours are not races (avoids cheating incentives entirely).

---

## I — EXTRA: Embed widget for streamers

### I.1 Concept **[NEEDS-SUPABASE for config/persistence; NO-SUPABASE for the static iframe renderer]**

An **iframe/oEmbed-style widget** streamers and guide writers embed on their sites: a mini-map centered on a pin (or pin set), with attribution built in. Purpose: backlinks + brand presence on the exact pages where GTA 6 audiences already are (stream overlays, guide blogs). The MVP spec already notes embeddable widgets as Phase 4 for backlink value — this spec defines the shape early so the map architecture doesn't paint it into a corner.

### I.2 Widget spec **[NO-SUPABASE for v0 static; NEEDS-SUPABASE for customization persistence]**

- **Embed code**: `<iframe src="https://gta6mapx.com/embed?pin={slug}&theme=neon" width="100%" height="480">` — copy-paste from any pin's detail panel ("Embed this pin").
- **oEmbed**: an oEmbed endpoint (`/api/oembed?url=...`) returning title/author/html so WordPress/Medium-style embeds render rich previews.
- **What renders**: mini-map (read-only, pan/zoom enabled, no editing), the pin with its certainty badge, pin name + one-line description, and a **built-in attribution line** ("Map by GTA6mapx.com" linking home) that cannot be removed via params — attribution is structural, not cosmetic.
- **Customization params** (URL query, allowlisted): `theme` (neon | dark | light), `pin` (single slug) or `pins` (comma-separated slugs, max 10), `zoom`, `show_badge` (default true; may hide only the *description*, never the attribution). Unknown params are ignored, never error.
- **No API key needed** — frictionless embedding is the point; abuse is handled by rate limits + domain controls, not keys.

### I.3 Rate limits & abuse **[NEEDS-SUPABASE for enforcement; NO-SUPABASE for documented policy]**

- **Rate limits**: per-IP/per-domain token bucket on the embed endpoint (generous: embeds are meant to be viewed; the limit targets scrapers hammering the endpoint, e.g. thousands of requests/min from one source).
- **Hotlink protection concept**: the tile/image layer serving the widget should validate the `Referer`/`Origin` against abuse patterns; a documented **domain allowlist** is available as an *optional* per-pin setting ("only allow embeds on these domains") for creators who want it — default is open.
- **Abuse response**: offending domains/IPs get the widget replaced with a static "embed disabled for this domain" card (graceful, no broken layout for the embedder's visitors) + admin notice. No silent breakage.
- **Content guardrails**: the widget inherits pin certainty — speculation pins render with their grey badge inside the widget too. No special "clean" mode that hides uncertainty.

Anti-abuse note: because no API key is required, the widget must never expose write actions (no voting, no submissions, no progress marking inside the iframe) — read-only by construction. Clicking through ("open full map") goes to the main site.

Privacy note: the widget sets no tracking cookies; view counts are aggregated server-side only. Embedder domains are logged in aggregate for the allowlist/abuse features, not sold or shared.

**GTADB attribution blocker note**: embedded tiles/pins derived from GTADB data fall under the same pre-launch attribution requirement — the user-added credit must be live before any public embed goes out.

---

## J — Cross-cutting: privacy & anti-abuse summary

| Area | Privacy rule | Anti-abuse rule |
|---|---|---|
| Leaderboard | Aggregates only; guests labeled not shamed; email-verified for top-100 | Server-side scoring; rate limits; anomaly review + appeal |
| Rewards | Opt-in spotlight; no personal data | No monetary value; non-transferable badges |
| Hub directory | Opt-in, default off; 24h removal | Name moderation; rate-limited listings |
| Activity feed | Allowlisted event types; 30-day public window | No moderation-drama content |
| Stats dashboard | Counts only | Computed from source tables, not hand-edited |
| Compare pairs | Display-name-only credit; EXIF stripped | Rights declaration; leak-hash blocklist; report auto-hide |
| Expeditions | Private progress; explicit share links | Moderated proposals; proposal rate limits |
| Embed widget | No tracking cookies; aggregate logs | Read-only; rate limits; optional domain allowlist |

**Global rules**: opt-in everywhere a user becomes visible; no personal data (email, IP, device id, exact dates) on any public surface; IPs exist only in security logs for abuse prevention (disclosed in the privacy policy, per MVP spec §9.11); no Discord scraping anywhere; never host leaked media — report on leaks like a news outlet with transparency labels, never host the files.

---

## K — Build order within this slice (suggested)

1. **[NO-SUPABASE]** Score event contract doc + scoring formula reference implementation (pure functions, unit-testable) + "How scoring works" explainer copy.
2. **[NO-SUPABASE]** Compare slider UI component + expedition static page template + embed iframe renderer skeleton (all with mock data).
3. **[NEEDS-SUPABASE]** Supabase connection → leaderboard tables + season job + boards API + guest claim flow.
4. **[NEEDS-SUPABASE]** Anti-cheat: server-side scoring, rate limits, anomaly review queue, appeal flow.
5. **[NEEDS-SUPABASE]** Badges engine + Mapper of the Month + trust_score wiring.
6. **[NEEDS-SUPABASE]** /community page (stats → feed → directory), compare moderation queue, expedition proposals, embed config/oEmbed.

Nothing in steps 3–6 starts until Supabase is connected; steps 1–2 are shippable now and de-risk the later work.
