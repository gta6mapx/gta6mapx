# GTA6mapx.com — Community Spec (Phase 1)

**Version:** 1.0 | **Date:** September 24, 2026 | **Status:** spec only — no application code
**Coordinated by:** community team (4 spec slices assembled here)
**Full slice detail:** `research/specs/_partials/` — `a-guest-mode.md`, `b-submissions.md`, `c-signals.md`, `d-leaderboard-hub-extras.md`

**How to read:** every requirement carries one tag —
- `[NO-SUPABASE]` — shippable now: guest-local, client-side, zero backend.
- `[NEEDS-SUPABASE]` — requires the Supabase connection (auth + Postgres + Storage).

Supabase schema exists (`supabase/schema.sql`) but is **not connected yet**. The entire spec is
designed to ship value *before* that connection, then upgrade cleanly after it.

**Hard constraints (all slices):** original work only · no Discord scraping · never host
leaked media (report like a news outlet, never distribute files) · no invented data · no
ranking/traffic promises. GTADB CC BY 4.0 attribution is a **pre-launch blocker that the
user adds himself** — noted wherever relevant; no credit text is written anywhere in this spec.

---

## 0. Competitor gap inventory (what State of Leonida lacks)

From the deep browser analysis of `map.stateofleonida.net` (features §4, community §7):

| # | Their state | Our answer (this spec) |
|---|---|---|
| 1 | **Login: "COMING SOON"** — disabled button, no accounts at all | Guest-local progress now (§1), magic-link + OAuth accounts later, explicit guest→account merge |
| 2 | **Community Hub: "COMING SOON"** — nothing exists | `/community` hub: opt-in contributors directory, activity feed, submission-stats dashboard (§5) |
| 3 | **Marker submissions: "coming soon"** — community input channel is a Discord invite only | Full "Suggest a location" pipeline: evidence fields, moderation queue, reputation scoring (§2) |
| 4 | **No per-marker comments or voting** — panels show photos/coords, zero community signals | Confirm/Seen votes, moderated comments, user screenshots with rights declarations (§3) |
| 5 | **Settings don't persist** — session-only, resets on reload | Persistent guest-local store + account sync (§1) |
| 6 | Leaderboard exists (guessing game) but no seasons, no anti-cheat stated, anonymous | Monthly seasons, server-authoritative scoring, replay decay, email-verified top-100 (§4) |
| 7 | No monetization (AdSense placeholder, coffee donations only) | Not our Phase-1 fight — but the embed widget (§6) builds the backlink/brand surface that makes future revenue possible |
| 8 | No visual-verification content | Compare-mode before/after slider (§6) |
| 9 | No guided experiences | Expeditions — curated tours (§6) |

They are strong on data depth (~2,973 markers) and neon polish. They are weak on **everything
social and persistent**. This spec turns that weakness into our moat.

---

## 1. Cross-slice architecture (locked decisions)

### 1.1 Identity contract [MIXED]

All slices share exactly two concepts (from slice A):

- **Device identity:** `gta6mapx-dev-<uuidv4>`, generated once per browser profile, stored
  in `gta6mapx_device_v1`. Random, not a fingerprint. Survives "reset all".
- **`getIdentity()`** returns `{ mode: "device", deviceId }` (now, the only mode) or
  `{ mode: "account", userId, deviceId }` after sign-in.

Votes, submissions, comments, and game scores all attribute to this identity. No slice may
reach into another slice's storage internals.

### 1.2 The honesty-status rule (exact, non-negotiable)

The Leak Transparency Engine statuses are `rockstar-confirmed | trailer-confirmed |
leak-reported | disputed`, set by **editors only**:

1. **Community votes can never change a status** — not at 10 votes, not at 10,000.
   ≥25 confirms on a live pin creates a *moderator review suggestion*, nothing more.
2. **Submitters can never propose `rockstar-confirmed`** — the form doesn't offer it.
   Strongest user outcome is `trailer-confirmed`; editors upgrade only with a
   Rockstar-owned citation (newswire, official site, official social).
3. Votes can't downgrade either. Reports can **hide** a pin (≥3 reports → auto-hide) but
   hiding ≠ status change.
4. Enforcement: vote endpoints have **no code path** to the status column; the honesty
   badge renders from a separate data path than vote counters, so a vote surge can never
   visually imply a status change.
5. **Disputed-downgrade beats rejection:** contested-but-real submissions become `disputed`
   pins with a visible "why" note instead of being discarded.

### 1.3 Ownership boundaries (who owns what)

| Concern | Owner | Consumes |
|---|---|---|
| Vote/confirm/report counters, vote UX, vote-fraud detection | Signals slice (§3) | — |
| Threshold *effects* (auto-publish at 5 confirms, auto-hide at 3 reports, Community Verified badge) | Submissions slice (§2) | counters from §3; shared config, **no unilateral threshold changes** |
| Reputation formula, role promotion/demotion, auto-publish privilege | Submissions slice (§2) | confirmations received on a user's pins (from §3) |
| Device→account vote/submission migration | Signals slice (§3) reuses the merge semantics from §1 | merge rules from §1 |
| Score events (game) → ranks, seasons, anti-cheat | Leaderboard slice (§4) | accuracy 0–100 events from the sibling game team |

**Open question #1 (needs a joint call):** should `pending` submissions be visible on the map
for voting (drives the 5-confirmation auto-publish)? Recommendation: an opt-in "Community
proposals" layer with dashed pins — needs the voting team's agreement.

### 1.4 Schema deltas required (for the build, not this spec)

- `submissions.status` check constraint: extend to `pending|in-review|approved|rejected|needs-info`
- `submissions.resubmits_id` (nullable, links resubmissions)
- `progress.note_updated_at` (nullable timestamptz, for merge comparisons)
- `locations.certainty` check constraint: migrate `confirmed|likely|speculation` → the four
  honesty statuses (backfill: `confirmed→trailer-confirmed`, `likely→leak-reported`,
  `speculation→disputed`)
- New tables (prose): `comments`, `seen_votes`, `moderation_actions` (append-only audit),
  leaderboard tables (scores, seasons, badges), `compare_pairs`, `expeditions` (+ proposals)

---

## 2. Slice A — Guest mode now → auth later

*(Full detail: `_partials/a-guest-mode.md`)*

### 2.1 Consolidated v2 store [NO-SUPABASE]

One atomic localStorage object `gta6mapx_progress_v2` replaces the v1 id-array:

- `found`: pin id → `{ found_at, note, note_updated_at }` (notes 2,000 chars, rejected-not-truncated)
- `favorites`: pin id → `{ saved_at }` — separate from found (bookmark a route before finding it)
- `meta`: timestamps + **tombstones** (30-day) so a delete can't be resurrected by a stale tab
- Stats (per-category counts, overall %) are **derived, never stored**

Migration is idempotent and honest: v1 ids get **migration-time** timestamps (never invented
dates); v1 key archived untouched.

### 2.2 Sync, quota, portability [NO-SUPABASE]

- **Multi-tab merge** via `storage` events — union semantics, newest-timestamp-wins per
  record, tombstone-checked. Same merge rules are reused for import and guest→account merge.
- **Quota:** soft 3 MB budget; over budget the write is refused with a visible banner —
  never silent data loss.
- **Export:** offline JSON download; **Import:** ≤2 MB, ≤20k records, schema-validated,
  reject-with-reason (never partial-apply); **Reset:** typed confirmation, "export first"
  offered.
- **Privacy:** zero network calls in guest mode, verifiable offline; device_id is random.

### 2.3 Auth-later path [NEEDS-SUPABASE]

- Magic link primary; OAuth provider list (Google/GitHub/Discord candidates) at build time.
- `profiles` row auto-created, idempotent; generated handle `mapper-<random>`, editable.
- **First-sign-in merge screen: Merge / Start fresh / Keep separate** — explicit, never
  silent. Union of found sets; newest-`note_updated_at` wins (never concatenated);
  favorites union; tombstones honored; all-or-nothing retry.
- Ongoing: local-first writes, debounced delta sync, last-writer-wins per record, "last
  synced" visible in settings. **No caps on honest users** — abuse handled by rate limits,
  not storage quotas.

**Anti-abuse:** import caps + charset validation, XSS-safe text-only note rendering,
storage-event payload validation, server-side pin-id validation + write rate limits later.

---

## 3. Slice B — Submissions pipeline

*(Full detail: `_partials/b-submissions.md`)*

### 3.1 "Suggest a location" flow [NO-SUPABASE] (form, drafts, client gates)

5 steps, ~2-minute target: map tap → pin drop (draggable) → category picker → name
(3–60 chars) + description (20–500 chars, must say *what's visible and why it matters*) →
**evidence fields** → review + submit.

Evidence matrix (the honesty core):

| `source_type` | Mandatory evidence |
|---|---|
| `trailer` | trailer name + `m:ss` timestamp (valid format) |
| `leak_report` | public `source_url` (news article/forum thread — never a dump host) |
| `rockstar_official` | official URL/citation |
| `other_public` | description of the public source |

Submitter proposes `trailer-confirmed | leak-reported | disputed` only. Required attestation
checkbox: *"I captured any screenshots myself from public trailers/streams. This contains no
leaked game files or datamined content."*

Drafts auto-save guest-local (3 concurrent, resume chip). Pre-Supabase, submissions sit in a
**guest-local outbox** honestly labeled *"not yet received by moderators"* — never fake a
received state.

### 3.2 Moderation queue [NEEDS-SUPABASE]

State machine: `pending → in-review → approved | rejected | needs-info` (one round-trip
default; 7-day auto-close to `rejected(stale)` with a day-4 reminder). One active reviewer
per submission (30-min soft lock). Edit-before-approve for typos. SLA: first human touch
≤48 h (≤24 h launch week); **median review time published weekly** as a trust metric.

Role powers (`user`/`trusted_mapper`: no queue access; `moderator`: review actions;
`editor`: + status changes and `rockstar-confirmed`; `admin`: + bans and config).

Rejection taxonomy is a **fixed list with user-facing wording** (`duplicate`,
`insufficient-evidence`, `leak-content`, `wrong-location`, `low-quality`,
`wrong-category`, `spam`, `abuse`, `stale`, `out-of-scope`). Resubmission links via
`resubmits_id` (max 2 per original; 1 for spam/abuse/leak).

### 3.3 Reputation scoring [NEEDS-SUPABASE]

```
trust_score = 10×approved − 6×rejections_90d (decaying) − 15×spam/abuse (permanent)
              + 2×min(confirmations_received, 50) + 5×helpful_reports (capped 25)
```

Floor 0. `user → trusted_mapper` is **automatic** at: ≥50 approvals, ≥85% approval rate
(last 20), zero spam/abuse/leak rejections ever, account age ≥14 days. `editor`/`moderator`
are **granted, never earned**.

`trusted_mapper` submissions **skip the queue** (immediate publish, Community Verified
badge) with **post-hoc audit**: 10% random sample + first 5 always audited. Demotion at
>20% audit rejection (rolling 20) **re-queues their last 20 pins**.

### 3.4 Threshold rules (owned here, executed via shared config)

| Signal | Effect |
|---|---|
| ≥5 confirms on a queued submission | auto-publish as live pin + Community Verified badge |
| ≥3 reports on a live pin | auto-hide + review item (reversible, not deletion) |
| ≥10 confirms after a `disputed` flag | eligible for moderator upgrade — human decides, votes alone never clear `disputed` |

"Community Verified" tooltip always says: *"Published by the community — not a Rockstar
endorsement."*

### 3.5 Quality gates (at submit time, cheap first) [NO-SUPABASE]→[NEEDS-SUPABASE]

Rate limits (3/5/15 per day by tier) → velocity throttle → coordinate bounds check →
**dedup warning** (same-category pin within 150 m + name similarity ≥0.8 → *"Possible
duplicate — submit anyway / view existing / cancel"*; warning, **never a block**) →
profanity filter → leak-URL blocklist (server) → evidence completeness.

**Leak rejection is 3-layered:** attestation checkbox → server URL blocklist → moderator
judgment. `leak-content` rejections explain *why* and what *is* acceptable (describe what
reporting *says*, link a news article *about* it). Resubmitting the same leaked material is
bannable.

**Anti-abuse:** tiered daily caps, velocity throttles, escalation ladder (warning → 7-day
suspension → permanent submission ban; spam farms immediate), **shadow-ban** (content
visible only to the author — never exposed via API), in-app appeals (≤14 days, one per
action). Public surfaces show **display name only** (or anonymous `Mapper #a3f9`); device
IDs hashed server-side, never exposed; IPs for rate-limiting only, disclosed in privacy
policy.

---

## 4. Slice C — Per-marker community signals

*(Full detail: `_partials/c-signals.md`)*

### 4.1 Three actions, precisely distinguished

| Action | Answers | Storage | Public? |
|---|---|---|---|
| **Confirm location** | "Is this pin accurate?" | `confirmations` (one per identity per pin) | yes — counter |
| **I've seen this** | "Have you encountered this?" | `seen_votes` | yes — weak signal |
| **Mark as found** | "Did *I* collect it?" | progress store | **never** — personal only |

A user may hold one Confirm *and* one Seen per pin (different questions), and may change
Confirm↔Seen, but never both simultaneously. **15-minute undo window**; after that the vote
is immutable to the voter (moderators can invalidate with audit).

**Anti-noise display [NO-SUPABASE copy]:** counters hidden below 5 total votes — show
*"Be the first to confirm this location"*, never "1 of 1". Community Verified badge at
≥10 distinct confirms, visually subordinate to the honesty badge with tooltip:
*"Community signal, not editorial evidence."*

Device→account migration: device vote rows reassign to the account unless the account
already voted there (account wins, keeps its timestamp); device marked claimed; device_id
kept as audit metadata only.

### 4.2 Comments [NEEDS-SUPABASE] (empty-state copy [NO-SUPABASE])

- One-level threading (replies on top-level only), newest-first tops, chronological replies,
  optional pinned moderator note.
- **Pre-moderation** for new/low-trust (<3 approved comments or account <7 days);
  **post-moderation** for established; trusted roles' reports carry double weight.
- Markdown-lite only (bold/italic/links/quotes/inline code); **no raw HTML ever**;
  `rel="nofollow ugc"`.
- 15-minute edit window, then immutable; soft delete (`[deleted]`, replies stay).
- Report per comment: 2 reports → auto-collapse, 5 → auto-hidden. False reporters lose
  trust score.
- **Spoiler convention:** "Contains story spoilers" checkbox → blurred with tap-to-reveal;
  first-class `spoiler` column, moderators can flag retroactively.

### 4.3 User screenshots [NEEDS-SUPABASE] (declaration copy [NO-SUPABASE])

Upload flow: rights-declaration checkbox (upload disabled until ticked) → client checks →
pending moderation → gallery on approval with "Uploaded by {display_name}" credit.

Declaration copy (plain language): *"I captured this image myself from publicly released
material — official trailers, official Rockstar screenshots, or my own gameplay. It is not
a leak, not a re-upload of someone else's footage, and not taken from a watermarked leak
compilation."* Declaration text + timestamp stored per upload.

Limits: JPEG/PNG/WebP (magic-byte validated), ≤5 MB, ≥640 px short edge, 3/day/pin,
20/day/account, perceptual-hash dedupe. Supabase Storage private bucket
(`pending/` → `live/` → `rejected/` 30-day purge); 320-px WebP thumbnails; **EXIF stripped**;
gallery renders only our own bucket objects — never hotlink third-party hosts.

**Leak policy (hard):** leaked-build media, watermarked leak compilations, and
someone-else's stream recordings are rejected, no exceptions. `leak-media` reports go to
the **top of the mod queue**; confirmed → immediate removal, second offense → upload
privilege suspended. Rights-holder takedowns honored within 48 h.

### 4.4 Anti-abuse (privacy-minimal) [NEEDS-SUPABASE]

- **Brigading:** >20 votes on one pin in 10 min → counter **freezes** at pre-spike value +
  mod flag (never auto-ban). Cross-device clustering uses only coarse signals (/24 IPv4 or
  ASN + UA family + time window) → quarantines votes, never bans. **Explicitly banned:**
  canvas fingerprinting, fingerprint libraries, IP-as-identity. Hashed IPs purged after
  30 days.
- Rate limits: comments 1/30 s, 10/h, 50/day; reports 5/h; clear "slow down" messages,
  never silent drops.
- Escalation: warning → 7-day halved limits → shadow-ban → hard ban; all audit-logged in
  append-only `moderation_actions`.
- **Privacy:** public identity = opt-in `display_name` only; guests appear as "Visitor"
  (fixed string, not trackable); public serializers exclude email, device_id, IP, trust
  score. **Delete-my-data** path: votes removed + counters recomputed, comments
  soft-deleted, screenshots purged, profile anonymized; anonymized aggregates kept.

### 4.5 Graceful degradation [NO-SUPABASE]

No Supabase = honest empty states, never fake social proof: vote buttons → *"Community
votes go live with accounts — coming soon"*; comments → *"Comments open after launch"*;
upload → declaration shown, upload disabled. Mark-as-found keeps working (unaffected).

---

## 5. Slice D/E/F — Leaderboard, hub, extras

*(Full detail: `_partials/d-leaderboard-hub-extras.md`)*

### 5.1 Seasonal leaderboard [NEEDS-SUPABASE] (contract + formula [NO-SUPABASE])

The game emits score events; the leaderboard computes ranks — the game never writes ranks.

```
round_score = min(110, (accuracy_0–100 + speed_bonus≤10, decaying by 60s) × replay_decay)
replay_decay = 1.0 / 0.5 / 0.25 / 0 (4th+ attempt scores nothing)
season total = Σ best round_score per still  → replay-farming worthless by construction
```

- **Monthly seasons** (`YYYY-MM`): fresh-start excitement + monthly content beat; archived
  frozen boards browsable (`/leaderboard/seasons/2026-10`); all-time board alongside.
- Guests rank normally with a grey **"Guest"** tag; **email verification required for the
  public top-100** and rewards (primary anti-farming control). One-time device→account
  claim; unclaimed guest rows expire after 90 days.
- **Server-authoritative scoring is the core anti-cheat:** client submits only (still id,
  guess coords, start time); true coordinates never reach the client pre-submit. Layers:
  attempt rate limits (~30/h, ~200/day), impossible-accuracy anomaly flags (**human review,
  never auto-ban**), disposable-email blocklist, event-id idempotency, 7-day appeal SLA.

### 5.2 Rewards — non-monetary, forever

**No cash, no prizes, ever** (sweepstakes legal complexity + farmer magnet + fan communities
run on recognition). Badge catalog: Season Champion, Top 10, Sharpshooter (10 rounds ≥95),
Marathon Mapper, **Early Explorer** (pre-launch players — our launch asset), Comeback,
Expeditionist, Compare Contributor. Badges non-transferable, auto-awarded with audit log,
revocable for cheating. **"Mapper of the Month"** spotlight: strictly opt-in; declining
shows *"chose to stay anonymous"*. Rewards feed the single `trust_score` — one reputation,
not parallel currencies.

### 5.3 Community hub (`/community`) [NEEDS-SUPABASE]

Order: spotlight → stats dashboard → activity feed → contributors directory → how-to-contribute.

- **Directory:** opt-in (default OFF, 24 h removal), display_name + role badge + approved
  count + badges + member-since month/year. Never: email, IP, device id, exact dates.
- **Activity feed:** fixed allowlist only (pin approved, milestone, season closed, badge
  earned, expedition published, compare pair approved); 30-day public retention; **no
  "view all activity by user X" page**; moderation events are never entertainment.
- **Stats dashboard:** live pending count, approved/rejected this week (counts only),
  **median review time** (headline trust metric), public threshold config, 7-day queue
  sparkline.

### 5.4 Extras they never had

**Compare-mode slider** [NO-SUPABASE component / NEEDS-SUPABASE contributions]: before
(trailer still w/ source citation) / after (map view, reproducible camera coords) draggable
slider. User pairs need the same rights declaration; leak-hash blocklist; inherits the
pin's honesty badge. `/compare` gallery. *Why it wins:* answers "is that trailer place
real?" with visual proof — trust thesis made tangible, SEO-indexable per location.

**Expeditions** [NO-SUPABASE static / NEEDS-SUPABASE progress+proposals]: curated ordered
tours ("Vice Beach neon tour", "Trailer 2 filming locations"). Editor-authored +
community-proposed (moderated). Manual stop check-off, `/expeditions/[slug]?stop=3` deep
links, private-by-default progress, completion feeds the Expeditionist badge.
**Deliberately no speed leaderboard** — tours aren't races, removing cheating incentives.

**Streamer embed widget** [NO-SUPABASE skeleton / NEEDS-SUPABASE production]: iframe +
oEmbed endpoint, no API key (frictionless), **read-only by construction**, structural
attribution line (not removable via params), allowlisted customization params,
rate limits + optional domain allowlist, graceful "embed disabled" card for abusers,
no tracking cookies.

---

## 6. Phased implementation checklist (ordered by value/effort)

### Phase 0 — NOW, no Supabase

| # | Item | Value | Effort | Slice |
|---|---|---|---|---|
| 1 | Guest v2 store + v1→v2 migration + stable `device_id` + export/import/reset | Unblocks every slice; fixes "settings don't persist" gap | M | A |
| 2 | "Suggest a location" form UI: 5 steps, evidence matrix, client-side gates (bounds, dedup *warning*, profanity, evidence completeness), draft auto-save + resume, guest outbox with honest "not yet received" state | Biggest differentiator starts collecting intent now | M | B |
| 3 | Honest degradation states + rights-declaration/policy copy (votes, comments, screenshots, leaderboard personal-bests view) | Trust; ships the words before the backend | S | C/D |
| 4 | Compare slider component + expedition static template + embed iframe skeleton (mock data) | Differentiation content formats, de-risked early | S–M | D |
| 5 | Score event contract + scoring formula as pure functions + "How scoring works" explainer copy | De-risks the later leaderboard build | S | D |

### Phase 1 — after Supabase connects (in order)

| # | Item | Value | Effort | Slice |
|---|---|---|---|---|
| 6 | Auth (magic link) + `profiles` auto-create + first-sign-in Merge/Start-fresh/Keep-separate screen | Enabler for everything server-side | M | A |
| 7 | Submissions flush + moderation queue (states, roles, SLA timers, rejection taxonomy) in `/admin` | The community data engine goes live | M | B |
| 8 | Votes + reports counters, one-per-identity, undo window, threshold wiring (auto-publish 5 / auto-hide 3) | Closes the loop on §6 | M | B/C |
| 9 | `trust_score` computation + auto-promotion/demotion jobs + trusted_mapper auto-publish with post-hoc audit | Scales moderation without scaling staff | M | B |
| 10 | Comments (pre/post moderation, markdown-lite, spoilers, reports) | Core social surface | M | C |
| 11 | Screenshot Storage + thumbnails + moderation lane | Visual trust content | M | C |
| 12 | Leaderboard + monthly seasons + server-authoritative scoring + anti-cheat + appeals | Engagement loop for pre-launch months | L | D |
| 13 | `/community` hub (stats → feed → directory) + badges engine + Mapper of the Month | Makes the community visible | M | D |
| 14 | Expedition proposals + compare-pair moderation + `/compare` gallery | Content formats go community-powered | M | D |
| 15 | Embed production + oEmbed endpoint + domain controls | Backlink/brand surface | S–M | D |
| 16 | Appeals UI, shadow-ban tooling, append-only audit log, public transparency counts | Fairness infrastructure | M | B/C/D |

**Explicitly deferred:** entity-page (vehicle/weapon/character) submissions (Phase 2),
Friends board (needs mutual-follow), multilingual moderation (Phase 4), any cash/prize
rewards (never).

---

## 7. Open questions & blockers

1. **In-queue voting visibility** (§1.3): map layer for pending proposals? (recommendation: yes, opt-in dashed layer)
2. **Anonymous display convention:** slice B defaults to `Mapper #a3f9`, slice C to fixed `"Visitor"` — unify at build (recommendation: `Mapper #a3f9` everywhere, it's friendlier and non-trackable).
3. **Screenshot hosting:** Supabase Storage vs R2 — decide before upload field goes live.
4. **Trailer runtime table** for `m:ss` validation — tiny config owned by the content-data slice.
5. **Mod-queue hosting:** `/admin` is dev-only (production 404) — confirm whether a hosted mod queue is needed before launch.
6. **NSFW scan vendor:** vendor-neutral in spec; pick a free-tier service at build time.
7. **Threshold numbers** (5/10/25 votes, 150 m dedup, 20-vote freeze): config-driven starting values; tune from real data.
8. **Pre-launch blockers:** GTADB CC BY 4.0 attribution must be live before public deploy of any GTADB-derived records (user adds himself); `locations.certainty` constraint must migrate to the four honesty statuses before enforcement code ships.

---

*End of community spec v1.0 — Phase 1. No application code was written; all behavior is
specified as prose/tables for the build phase.*
