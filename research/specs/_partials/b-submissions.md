# Spec (b) — User submissions pipeline

**Scope:** the "Suggest a location" community pipeline — submission flow, evidence/honesty rules,
moderation queue, reputation scoring, quality gates, anti-abuse. This is the project's single
biggest community differentiator vs map.stateofleonida.net (which has no submissions at all).

**Relationship to other specs:** the voting team owns confirmation/report counters and vote UX;
this slice *consumes* aggregate counts for thresholds (§6). The guessing game consumes
approved pins as game content; it does not write to this pipeline.

**Status terminology (locked, Leak Transparency Engine):** every entity carries one honesty
status — `rockstar-confirmed` | `trailer-confirmed` | `leak-reported` | `disputed`.
Submissions feed into this system and can never bypass it (§2). (This supersedes the older
`confirmed/likely/speculation` wording in early drafts of the certainty badges.)

**Pre-launch blocker (noted, not written):** dedup in §5 matches against GTADB-derived staging
data. GTADB attribution credit must be live on the site before any public deploy that exposes
GTADB-derived pins — Husnain adds this himself. No credit text is written in this spec.

**Every item below is marked `[NO-SUPABASE]` (shippable now: guest-local + client-side only)
or `[NEEDS-SUPABASE]` (requires the Supabase connection).** Nothing server-side ships without it.

---

## 1. "Suggest a location" flow

### 1.1 Entry and 2-minute target [NO-SUPABASE]

Entry point: a persistent **"Suggest a location"** button on `/map` (map header on desktop,
floating action button on mobile). Flow target: **under 2 minutes** from click to submit,
measured from button tap to successful submission.

Steps (linear, one screen per step on mobile, single panel with sections on desktop):

| Step | What happens | Time budget |
|---|---|---|
| 1. Pin | User taps/clicks map → draft pin drops. Draggable to fine-tune. | ~15 s |
| 2. Category | Category picker (the 6 top-level categories from seed data; subcategories later) | ~10 s |
| 3. Name + description | Name field (required), description (required, min length) | ~45 s |
| 4. Evidence | Evidence fields (see §1.3) — the honesty core of this product | ~30 s |
| 5. Review + submit | Summary card + draft auto-saved → submit | ~10 s |

### 1.2 Field table — required vs optional

| Field | Type | Required? | Rules |
|---|---|---|---|
| `lat`, `lng` | coordinates from pin | **Required** | Set by map tap/drag. Must fall inside Leonida world bounds (§5). Decimal precision 5 (≈1 m equivalent in game-world units). |
| `category_slug` | picker | **Required** | One of the seeded top-level categories. No custom categories in Phase 1. |
| `name` | text | **Required** | 3–60 chars. No ALL-CAPS names, no emoji in name, no profanity (see §5). |
| `description` | textarea | **Required** | 20–500 chars. Must describe *what is visible at this spot and why it matters* — "it's here" is not a description. |
| `source_type` | enum | **Required** | One of: `trailer` · `rockstar_official` · `leak_report` · `other_public`. Drives which evidence fields are mandatory. |
| `trailer_name` + `timestamp` | text + `m:ss` | **Required when `source_type=trailer`** | e.g. "Trailer 2 @ 1:47". Timestamp must be a valid `m:ss` under the trailer's known runtime. [NO-SUPABASE] |
| `source_url` | URL | **Required when `source_type=leak_report`**; optional otherwise | Must be a real public URL (news article, forum thread, video). [NEEDS-SUPABASE] for blocklist lookup; client-side format check [NO-SUPABASE]. |
| `screenshot` | image upload | **Optional** | **User-captured stills only** (they watched the trailer and screenshotted it). Max 2, ≤5 MB each, JPEG/PNG/WebP. Never leaked game files (§2). [NEEDS-SUPABASE] for hosting (Supabase Storage). |
| `proposed_status` | enum | **Required** | Submitter picks one of `trailer-confirmed` · `leak-reported` · `disputed`. **`rockstar-confirmed` is not offered** — editor-only (§2). Defaults to `leak-reported` when `source_type=leak_report`. |
| `display_name` | text | **Optional, opt-in** | First-submission prompt: "Show your name on this pin?" Default = anonymous handle `Mapper #a3f9` (deterministic from device id, non-reversible publicly). [NO-SUPABASE] for the prompt; [NEEDS-SUPABASE] for persistence. |
| attestation checkbox | boolean | **Required** | "I captured any screenshots myself from public trailers/streams. This submission contains no leaked game files or datamined content." Must be checked to submit. [NO-SUPABASE] |

Phase 1 submissions create **location pins only** — no entity-page (vehicle/weapon/character)
submissions yet. Entity submissions are a Phase 2 extension.

### 1.3 Draft auto-save (guest-local) [NO-SUPABASE]

- Draft autosaves to `localStorage` on every field change (key `gta6mapx:draft:submissions:<n>`).
- Up to **3 concurrent drafts**; oldest evicted when a 4th starts.
- Drafts survive browser restarts; a "Resume draft" chip appears on `/map` when drafts exist.
- Drafts contain no PII — only the fields in §1.2. Submitting a draft re-runs all quality gates (§5).
- **No draft sync across devices** in Phase 1 ([NEEDS-SUPABASE]: attach draft to account on login).

### 1.4 Post-submit experience [NO-SUPABASE] / [NEEDS-SUPABASE]

- Immediate confirmation screen: "Received! Typical review time: under 48 hours" + tracking ID.
- Until Supabase ships, submissions are stored as a **guest-local outbox** (`localStorage`
  queue) and marked `QUEUED — will send when online/backend connected`. The queue UI must
  honestly say the submission has *not yet been received by moderators*.
- [NEEDS-SUPABASE]: outbox flushes on connectivity + schema connection; server returns the
  submission ID; the local copy is replaced by the server record. Duplicated flushes are
  idempotent (client-generated UUID in payload).

---

## 2. Evidence and honesty rules

### 2.1 Submitter-proposed status vs editor-set status

| Status | Submitter may propose? | Who finalizes? |
|---|---|---|
| `trailer-confirmed` | Yes — requires trailer name + timestamp + (optional) self-captured still | Moderator+ |
| `leak-reported` | Yes — requires public `source_url` | Moderator+ |
| `disputed` | Yes — requires explanation of what is contested | Moderator+ |
| `rockstar-confirmed` | **No — not shown in the form at all** | **Editor only**, requires a Rockstar-owned source (newswire post, official site, official social) cited in the evidence chain |

Rule: a submission can never *create* a `rockstar-confirmed` pin. The strongest outcome of a
user submission is `trailer-confirmed`. Editors upgrade to `rockstar-confirmed` only with an
editor-added Rockstar-owned citation. Every status change writes to the audit trail
([NEEDS-SUPABASE]).

### 2.2 Disputed handling

- Submitter may flag their own submission as `disputed` ("I saw this claimed on two forums but
  they disagree on the exact spot").
- Moderators may downgrade any submission to `disputed` instead of rejecting it when the
  evidence is real but contested — **downgrade beats rejection** when there's genuine signal.
- `disputed` pins render on the map with the disputed badge and a visible "why disputed" note;
  they are excluded from the guessing game and from "Community Verified" until resolved.

### 2.3 Never host leaked media — the rejection path

Hard rule: **no leaked game files, datamined dumps, or leaked video files are accepted or
hosted, ever.** Reporting *about* a leak (like news outlets do) is allowed; *hosting* the
leak is not.

Rejection path (three layers):

1. **Form-level attestation** [NO-SUPABASE]: the required checkbox in §1.2. Unchecked = submit
   button disabled.
2. **Automated URL check** [NEEDS-SUPABASE]: `source_url` is matched against a maintained
   blocklist of known leak-dump hosts, file mirrors, and piracy domains. Match = immediate
   rejection with reason `leak-content` (see taxonomy §3.4), no human review needed. The
   blocklist is server-side config, editable by admins.
3. **Moderator judgment** [NEEDS-SUPABASE]: screenshots/description are reviewed for
   datamine-style content (file trees, hex dumps, "leaked build" watermarks). Suspected =
   reject with `leak-content` + optional 7-day suspension for repeat offenders (§7).

`leak-content` rejections include user-facing wording explaining *why* (legal risk to the
project) and what *is* acceptable (describe what the leak *claims*, link a news article
*about* it). Resubmission of the same leaked material is a bannable offense (§7).

---

## 3. Moderation queue

### 3.1 State machine [NEEDS-SUPABASE]

```
pending ──► in-review ──► approved ──► (published as pin)
    │            │
    │            ├──► rejected ──► (resubmission path §3.5)
    │            │
    │            └──► needs-info ──► (submitter replies) ──► in-review
    │                                  │
    │                                  └── (7 days no reply) ──► rejected (reason: stale)
    └── (auto-publish thresholds, §6)
```

- `pending`: untouched, in FIFO order. Auto-assigned to a moderator on first open.
- `in-review`: a reviewer has opened it. **Lock rule:** one active reviewer per submission;
  opening it sets `reviewed_by` and a 30-minute soft lock shown to other reviewers.
- `approved`: becomes a map pin with the finalized honesty status + "Community Verified"
  badge when applicable (§6). Editable before approval ("edit-before-approve" for
  name/description/coords typos).
- `rejected`: terminal unless resubmitted (§3.5). Rejection reason is mandatory and chosen
  from the fixed taxonomy (§3.4).
- `needs-info`: returned to submitter with a specific question. One round-trip max per
  submission by default; a second `needs-info` requires editor sign-off.

The existing schema's `status` check constraint (`pending|approved|rejected`) must be
extended to `pending|in-review|approved|rejected|needs-info` — minimal schema change,
documented here as a required migration.

### 3.2 Reviewer roles — who can do what [NEEDS-SUPABASE]

Roles come from `profiles.role` (already in schema):

| Action | moderator | editor | admin |
|---|---|---|---|
| Open `pending` → `in-review` | ✅ | ✅ | ✅ |
| Approve / reject / needs-info | ✅ | ✅ | ✅ |
| Edit-before-approve (name, desc, coords) | ✅ | ✅ | ✅ |
| Set/upgrade to `rockstar-confirmed` | ❌ | ✅ | ✅ |
| Change honesty status on live pins | ❌ | ✅ | ✅ |
| Override auto-publish/auto-hide (§6) | ❌ | ✅ | ✅ |
| Ban / shadow-ban users (§7) | ❌ (can flag) | ❌ (can flag) | ✅ |
| Change role thresholds / config | ❌ | ❌ | ✅ |

`user` and `trusted_mapper` have no queue access. The review UI lives under the dev-only
`/admin` route (production returns 404 today); the Phase 2 admin panel inherits this queue
spec unchanged.

### 3.3 SLA targets

| Queue event | Target | Notes |
|---|---|---|
| `pending` → first human touch | ≤ 48 h (pre-launch; ≤ 24 h launch week) | Measured `created_at` → `in-review`. Oldest-first sort is the default queue view. |
| `needs-info` → submitter notified | immediate (in-app + email if account) | [NEEDS-SUPABASE] |
| `needs-info` → auto-close | 7 days no reply → rejected (`stale`) | One reminder at day 4. |
| Appeal decision (§7) | ≤ 14 days | Admin only. |
| Public queue-health stat | published weekly | "Median review time this week: Xh" — trust marketing asset. [NEEDS-SUPABASE] |

### 3.4 Rejection reason taxonomy (fixed list, user-facing wording)

Reviewers **must** pick one; free-text is an optional supplement, never the whole reason.

| Code | User-facing wording |
|---|---|
| `duplicate` | "This location is already on the map — we've linked your submission to the existing pin." |
| `insufficient-evidence` | "We couldn't verify this from the evidence provided. Add a trailer timestamp or a public source link and resubmit." |
| `leak-content` | "We can't accept leaked game files or datamined material (legal risk). You're welcome to resubmit describing what public reporting *says* about this spot, with a news link." |
| `wrong-location` | "The evidence points to a different spot than your pin. Check the location and resubmit." |
| `low-quality` | "The description is too thin to publish — tell us what's actually visible there and why it matters." |
| `wrong-category` | "This belongs in a different category. We've noted it — please resubmit under the right one." |
| `spam` | "This looks like spam. Repeated spam leads to account suspension." |
| `abuse` | "This submission violates our content rules (profanity/harassment). Repeated violations lead to suspension." |
| `stale` | "Closed after 7 days without the requested information. You can resubmit any time with the details." |
| `out-of-scope` | "This isn't a map-able location (e.g. a general tip or opinion). Try our guides section instead." |

### 3.5 Resubmission path

- `rejected` submissions can be **edited and resubmitted** as a new submission linked to the
  original (`resubmits_id` — new nullable field on `submissions`, [NEEDS-SUPABASE]).
- Resubmission inherits the prior rejection reason shown inline ("Last time: insufficient
  evidence — here's what to fix").
- Rate limit: max **2 resubmissions per original**; further attempts require moderator contact.
- `spam`, `abuse`, and `leak-content` rejections: resubmission allowed **once**; a second
  identical offense escalates per §7.

---

## 4. Reputation scoring

### 4.1 `trust_score` formula [NEEDS-SUPABASE]

`trust_score` is an integer on `profiles` (already in schema), recomputed on every
approve/reject/vote event affecting the user. All weights are config, not code constants.

```
trust_score =
    10 × approved_count
  −  6 × rejections_last_90d          (decaying: rejections older than 90d stop counting)
  − 15 × spam_or_abuse_rejections_all_time   (never decay — abuse memory is permanent)
  +  2 × min(confirmations_received_on_my_pins, 50)   (vote-quality signal, capped)
  +  5 × helpful_flags_accepted        (reports the user filed that moderators upheld, capped at 25)
```

Floor: 0 (never negative). All inputs are derived from existing tables
(`submissions`, `confirmations`, `reports`); no new tables for the formula itself.

**Design intent:** approvals dominate, recent rejections sting but fade, spam/abuse leaves a
permanent scar, and the community's confirmations on *your* pins count toward trust
(vote-quality signal) — good mappers are rewarded by the crowd, not just moderators.

### 4.2 Role thresholds

| Transition | Rule |
|---|---|
| `user` → `trusted_mapper` | **Automatic** when ALL hold: `approved_count ≥ 50` (keeps the MVP-SPEC §3.3 bar), approval rate ≥ 85% over the last 20 submissions, zero `spam`/`abuse`/`leak-content` rejections ever, account age ≥ 14 days. |
| `trusted_mapper` → `user` (demotion) | **Automatic** when post-hoc audit rejection rate > 20% over a rolling 20 auto-published pins, OR any `spam`/`abuse` rejection. Demotion re-queues their last 20 auto-published pins for human review. |
| → `editor` / `moderator` | **Granted, never earned** — admin invitation only, after a manual review of history. No formula can promote to these. |
| → `admin` | Human decision by existing admins. Out of scope for automation. |

### 4.3 Auto-publish privilege (trusted_mapper) with post-hoc audit [NEEDS-SUPABASE]

- `trusted_mapper` submissions **skip the queue**: they publish immediately as live pins with
  the "Community Verified" badge and the submitter's proposed honesty status
  (never `rockstar-confirmed` — the form still doesn't offer it).
- **Post-hoc audit:** 10% random sample + the mapper's first 5 auto-published pins *always*
  land in the moderation queue retroactively. Audited pins keep their live status during
  review unless reported.
- If an audit rejects a pin, it is hidden, the mapper is notified with the reason, and it
  counts toward the demotion threshold in §4.2.
- Editors can revoke auto-publish for a single mapper without full demotion (probation flag).

---

## 5. Quality gates before human review

Gates run **at submit time**, before the submission reaches `pending`. Order matters —
cheap checks first.

| # | Gate | Rule | Failure behavior | Ship status |
|---|---|---|---|---|
| 1 | Rate limit | guests 3/day, `user` 5/day, `trusted_mapper` 15/day (per device id / per account id) | Block with "daily limit reached — try again tomorrow" | Client-enforced [NO-SUPABASE]; server-enforced [NEEDS-SUPABASE] |
| 2 | Velocity throttle | ≤ 1 submission per 5 min for accounts < 7 days old | Block with cooldown message | [NO-SUPABASE] client-side; server [NEEDS-SUPABASE] |
| 3 | Coordinate sanity | `lat`/`lng` inside the Leonida world bounding box (defined in the tile config; outside = impossible) | Block: "Pin is outside the known world bounds" | [NO-SUPABASE] |
| 4 | Dedup detection | Same-category existing pin within **150 m** (game-world units) AND normalized name similarity ≥ 0.8 (lowercase, strip punctuation, token-overlap) | **Warning, not a block:** "Possible duplicate: *<name>* (<distance> away). Is yours different?" with options *Submit anyway* / *View existing pin* / *Cancel* | Client-side vs cached pin list [NO-SUPABASE]; server-side authoritative check at insert [NEEDS-SUPABASE] |
| 5 | Profanity / text filter | Name + description against a maintained wordlist; also blocks ALL-CAPS names and >3 emoji | Block with specific message ("Please remove the flagged word and resubmit") — never silent | Client wordlist [NO-SUPABASE]; server wordlist [NEEDS-SUPABASE] |
| 6 | Leak-URL blocklist | `source_url` host against server blocklist (§2.3) | Immediate `leak-content` rejection | [NEEDS-SUPABASE] |
| 7 | Evidence completeness | Cross-checks §1.2 required/optional matrix (e.g. `trailer` source without timestamp) | Block with field-level error | [NO-SUPABASE] |

Dedup note: the client-side pin list used for gate #4 includes GTADB-derived staging pins —
the attribution blocker in the header applies to any public surface showing that data.

---

## 6. Handoff: submissions ↔ voting (confirmations/reports)

**Ownership boundary (locked):** the voting/guessing-game team owns the *counters and the
vote UX* — the `confirmations` and `reports` tables, one-vote-per-user/device enforcement,
and the "Confirm location" button. This spec owns the *threshold rules and their effects* on
submissions and pins.

### 6.1 Threshold rules (defined here, executed by shared config)

| Signal | Threshold | Effect |
|---|---|---|
| Confirmations on a queue submission | **≥ 5** distinct confirmers | Submission auto-publishes as a live pin with **"Community Verified"** badge at the submitter's proposed honesty status (never `rockstar-confirmed`). Enters post-hoc audit sample. |
| Reports on any live pin | **≥ 3** distinct reporters with reasons | Pin auto-hides (`status=hidden`) and enters the reports inbox for moderator review. Auto-hide is reversible; the pin is not deleted. |
| Confirmations on a live pin (re-verification) | **≥ 10** after a `disputed` flag | Eligible for moderator upgrade out of `disputed`. Votes alone never clear `disputed` — a human decides. |

Config values (`auto_publish_confirmations=5`, `auto_hide_reports=3`) live in one shared
config surface (admin settings in Phase 2; env/config file in Phase 1) so both teams read
the same numbers. **Neither team changes thresholds unilaterally** — changes are logged and
announced.

### 6.2 Counter ownership

- The voting team writes `confirmations`/`reports` rows and maintains the denormalized
  `locations.confirmations` / `locations.reports` counts (already in schema).
- This pipeline **reads** those counts (and a new `submissions.confirmations` counter for
  in-queue voting, [NEEDS-SUPABASE]) and applies §6.1 effects.
- Double-count protection, vote fraud detection (device farms), and the guessing-game's
  use of confirmations are the voting team's spec — referenced here, not duplicated.

### 6.3 "Community Verified" badge semantics

- Awarded to pins that reached the public via community signal: vote auto-publish (§6.1) or
  trusted_mapper auto-publish (§4.3).
- The badge shows a tooltip: "Published by the community — <N> confirmations" or
  "Published by Trusted Mapper <name>". It is **not** a Rockstar endorsement and the
  tooltip says so.
- The badge is removed if the pin is later hidden/rejected; re-awarded only by re-earning
  the threshold.

---

## 7. Anti-abuse

| Control | Rule | Ship status |
|---|---|---|
| Daily submission caps | 3 / 5 / 15 per day by tier (§5 gate #1); resubmissions count against the cap | [NO-SUPABASE] client; [NEEDS-SUPABASE] server |
| Velocity throttling | 1 per 5 min for accounts < 7 days old; 1 per 60 s for everyone else | [NO-SUPABASE] client; [NEEDS-SUPABASE] server |
| Duplicate-submission flood | > 3 submissions flagged `duplicate` in 24 h → 24 h cooldown + warning | [NEEDS-SUPABASE] |
| Escalation ladder | 1st offense: warning · 2nd: 7-day submission suspension · 3rd: permanent submission ban · spam farms: immediate permanent ban | [NEEDS-SUPABASE] |
| Shadow-ban | Suspected spam-farm accounts: their pins/submissions render **only for themselves**; no notification. Reviewable by admins. Prevents adversaries learning the detection rules. | [NEEDS-SUPABASE] |
| Appeal path | In-app appeal form (max 500 chars) on any ban/suspension → admin review ≤ 14 days (§3.3). One appeal per action; decision is final but the user may re-appeal after 90 days. | [NEEDS-SUPABASE] |
| No personal data in public | Public surfaces show **display name only** (or anonymous `Mapper #a3f9`). Device IDs are hashed server-side, never exposed via API. Email (if account) never shown. Submitter identity is visible to moderators+ in the queue only. | [NEEDS-SUPABASE] |
| Display-name policy | 3–24 chars, same profanity filter as §5; impersonation of Rockstar/Take-Two staff or existing mappers → forced rename + warning | [NO-SUPABASE] client check; [NEEDS-SUPABASE] enforcement |

IP addresses: collected for rate limiting, ban enforcement, and spam/bot detection only;
visible in admin security logs, never sold or shared — a published privacy policy must
disclose this (consistent with MVP-SPEC §9.11).

---

## 8. Build sequencing (what ships when)

**Ship now [NO-SUPABASE]:** full 5-step form with all field validations, evidence matrix,
draft auto-save + resume, dedup *warning* against the client pin cache, coordinate bounds,
profanity filter, rate-limit/velocity client guards, guest-local outbox with honest
"not yet received" state, attestation checkbox.

**Needs Supabase [NEEDS-SUPABASE]:** outbox flush + idempotent insert, moderation queue
(`in-review`, `needs-info` states; schema migration for the two new statuses),
reviewer roles/assignment, leak-URL blocklist, server-side dedup/rate limits,
`trust_score` computation + auto-promotion/demotion jobs, trusted_mapper auto-publish +
audit sampling, vote-threshold auto-publish/auto-hide wiring, screenshot hosting,
appeals, shadow-ban, queue-health stats.

**Explicitly not in this slice:** the vote button UX and vote-fraud detection (voting
team), entity-page submissions (Phase 2), multilingual moderation (Phase 4).

---

## 9. Open questions for the parent / other slices

1. **In-queue voting UX:** should `pending` submissions be visible on the map for voting
   (drives the 5-confirmation auto-publish), or does voting only start once published?
   Recommendation: a "Community proposals" map layer (opt-in toggle, visually distinct
   dashed pins) — needs voting-team agreement.
2. **Screenshot hosting:** Supabase Storage vs R2. Decision needed before the upload field
   goes live; the form ships with the field disabled until then.
3. **Trailer runtime table:** who maintains the `m:ss` validity data for gate #7
   (Trailer 1/2 runtimes)? Suggest a tiny config file owned by the content-data slice.
4. **Launch-week mode:** SLA drops to 24 h and a "verify mode" fast lane exists per
   MVP-SPEC §3.5 — confirm the queue UI gets a launch-week triage view (bulk-approve by
   category).
