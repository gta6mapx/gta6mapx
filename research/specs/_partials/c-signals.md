# Slice C — Per-marker community signals (Phase 1 spec)

**Status:** spec only, not built. **Slice owner:** community-signals.
**Competitor gap it fills:** map.stateofleonida.net shows photos/addresses/coords per marker but zero community signals — no per-marker comments, no voting/confirm buttons, no user screenshots. This slice is pure differentiation.

**Hard boundaries (non-negotiable):**
- Original work only; no Discord scraping; never host leaked media; no invented data.
- GTADB attribution is a **pre-launch blocker the user (Husnain) adds himself** — noted where relevant; this spec contains NO credit text.
- Community votes NEVER change a pin's honesty status, silently or otherwise (§C.1.6).

Every requirement is tagged **[NO-SUPABASE]** (speccable/UI-only now) or **[NEEDS-SUPABASE]** (requires Supabase: auth, Postgres, Storage). Supabase is NOT connected yet — Phase 1 must degrade gracefully without it (§C.7).

---

## C.0 Terminology & scope

| Term | Meaning |
|---|---|
| **Honesty status** | Leak Transparency Engine label on every entity/pin: `rockstar-confirmed` / `trailer-confirmed` / `leak-reported` / `disputed`. Describes the *evidence basis*, set by editors only. |
| **Confirm** | Vote meaning "I believe this pin's placement/details are accurate." |
| **Seen** | Vote meaning "I have encountered this thing (in a trailer, screenshot, or in-game)" — weaker signal than Confirm. |
| **Mark as found** | Personal progress ("I collected this in-game"). Free, localStorage-first, belongs to the progress module — NOT a vote. |
| **Report** | Flag meaning "this pin is wrong / this content breaks rules." Distinct from votes; drives hiding, not ranking. |

Scope: signals on **live pins** (map detail panel + entity pages). Submission review voting belongs to the submissions slice; it is referenced only for threshold consistency.

> **Schema note (build decision, [NEEDS-SUPABASE]):** `supabase/schema.sql` currently constrains `locations.certainty` to `confirmed/likely/speculation`, but the site's Leak Transparency Engine uses `rockstar-confirmed/trailer-confirmed/leak-reported/disputed`. Before this slice is built, the `certainty` check constraint must be updated to the four honesty statuses (backfill map: `confirmed→trailer-confirmed`, `likely→leak-reported`, `speculation→disputed`). This spec assumes the four-status model everywhere.

---

## C.1 Confirm / "I've seen this" votes — [NEEDS-SUPABASE]

### C.1.1 The three actions, precisely distinguished

| Action | Question it answers | Stored where | Public effect |
|---|---|---|---|
| **Confirm location** | "Is this pin's placement and info accurate?" | `confirmations` table (one row per identity per location) | Increments confirm counter; feeds Community Verified badge |
| **I've seen this** | "Have you encountered this (trailer/promo/in-game)?" | `seen_votes` table (same shape as confirmations) | Increments seen counter; weak signal only |
| **Mark as found** | "Did *I* collect/visit this in *my* game?" | localStorage now, `progress` table later | Personal progress bar only; NEVER shown publicly, never aggregated |

A user may cast **one of each type per pin** (a Confirm AND a Seen on the same pin is allowed — they answer different questions). Mark-as-found never interacts with votes.

### C.1.2 One vote per identity — [NEEDS-SUPABASE]

- **Phase 1 (guest-only):** identity = a randomly generated `device_id` UUID stored in localStorage (already the pattern in `progress`/`confirmations`/`reports`).
- **Phase 2 (accounts):** identity = `auth.users.id`. One vote per `(location_id, user_id)`; one per `(location_id, device_id)`.
- **Dedup rule on device → account migration** (the exact merge algorithm):
  1. When guest device `D` signs in as user `U`, for every vote row `(location L, device D)`: if a row `(L, U)` already exists, **drop** the device row (keep the account's vote and its original timestamp); otherwise **reassign** the row to `U` (`user_id=U, device_id=NULL`).
  2. Device `D` is then marked `claimed_by=U` in a device-registry concept; future votes from that browser are written directly as `U`.
  3. `device_id` may be retained on rows as **audit metadata only** — it never identifies or groups voters publicly.
- A user may **change** their vote (Confirm → Seen) but never hold both on the same pin simultaneously; changing counts as one update, not a new vote.

### C.1.3 Undo window — [NEEDS-SUPABASE]

- **15-minute undo window** after casting/changing a vote: the voter may remove it cleanly (counter decrements, no trace kept publicly).
- After the window closes, the vote is **immutable** by the voter (prevents counter manipulation games). Only moderators can invalidate votes (e.g. brigading cleanup), and invalidation is recorded in the audit log (§C.5.4).
- UI shows "Vote recorded · undo for 14:32" countdown; after expiry the button becomes a static "Confirmed ✓" state.

### C.1.4 Aggregate display rules (anti-noise) — [NO-SUPABASE] (UI copy) + [NEEDS-SUPABASE] (counters)

- Counters are **hidden until a minimum** is reached: show public counts only when a pin has **≥ 5 total votes** (Confirms + Seens). Below that, show the CTA **"Be the first to confirm this location"** — never "1 of 1 players confirmed" (1-vote noise reads as fact).
- Displayed as: `✓ 37 confirmed · 112 seen` with a tooltip: *"Community signals. 37 players say this pin is accurate."*
- **Community Verified badge** (secondary badge, visually subordinate to the honesty badge): awarded at **≥ 10 distinct-identity Confirms**. Tooltip/copy: *"Community verified — 12 players confirmed this pin. This is a community signal, not editorial evidence."* The badge never replaces or restyles the honesty badge.

### C.1.5 Auto-publish / auto-hide thresholds — [NEEDS-SUPABASE]

These apply to **live pins** (submission auto-publish at 5 confirmations lives in the submissions slice and stays unchanged):

| Trigger | Effect |
|---|---|
| **≥ 25 distinct-identity Confirms** on a live pin | Creates a **moderator review item**: "High community confidence — re-check honesty status." Editors may then *upgrade evidence* if new official material exists. |
| **≥ 3 reports** on a live pin | **Auto-hide** pin (`status='hidden'`) + review queue item, matching the existing submissions threshold convention (MVP-SPEC §3.3). Pin returns only via editor action. |
| Report reasons split | `wrong-location`, `wrong-info`, `spam`, `leak-media`, `other`. Only `wrong-location`/`wrong-info` affect pin data review; `leak-media` routes to media takedown (§C.3.5). |

### C.1.6 THE honesty-status rule (exact) — [NO-SUPABASE] (policy) + [NEEDS-SUPABASE] (enforcement)

1. **Votes can never change an honesty status.** Not at 10 votes, not at 10,000. Upgrades require **new evidence** (official Rockstar statement, new trailer frame, verified official promo) entered by an editor with a source citation.
2. **Votes can never downgrade a status either.** 50 Seens on a `rockstar-confirmed` pin do not touch it; 200 reports on a `disputed` pin keep it `disputed` (reports may hide the pin, §C.1.5, but hiding ≠ status change).
3. The vote-triggered review item (§C.1.5, first row) is a **suggestion to a human editor**, displayed in the mod queue as "community suggests re-evaluation." The editor's decision and the evidence they cite are stored; the vote count is shown as context, never as the reason.
4. Enforcement: honesty status is editable **only via the editor/admin role**; the API endpoint that records votes has **no code path** that writes to the status column. Status changes append to the audit log with editor identity + evidence link.
5. UI guarantee: the honesty badge and its evidence chain (the "why we believe this" panel) are rendered from a separate data path than vote counters, so a vote surge cannot visually imply a status change.

---

## C.2 Comments — [NEEDS-SUPABASE] (all items; UI states [NO-SUPABASE])

### C.2.1 Threading model

- **One level only:** top-level comments + replies. A reply attaches to a top-level comment; there is no reply-to-reply (the UI offers "Reply" only on top-level comments; quoting is allowed via markdown `>`).
- Sort: top-level **newest first**; replies **chronological** under their parent. Pinned moderator comment (e.g. corrections) may sit above the list, visually marked "Moderator note."
- Data model (prose — new `comments` table): id, location_id (FK; later also entity pages via nullable `entity_id`), `parent_id` nullable (NULL = top-level), author identity (user_id or device_id), body text, `spoiler` bool, status (`pending`/`live`/`rejected`/`deleted`), `edited_at`, `reports_count`, timestamps. One `parent_id` hop enforced at write time.

### C.2.2 Pre- vs post-moderation

| Author | Rule |
|---|---|
| **New / low-trust** (fewer than 3 approved comments, or account < 7 days) | **Pre-moderation:** comment sits in `pending`, invisible publicly, enters mod queue. Shown to author as "Awaiting review." |
| **Established** (≥ 3 approved comments, no violations in 30 days) | **Post-moderation:** goes live immediately; enters the automated filters (§C.4.1); human review only if reported or flagged. |
| **trusted_mapper / editor / moderator / admin** | Post-moderation, and their reports carry double weight in review ordering. |

- The 3-approved-comments bar and the 30-day clean window are config values, not constants.

### C.2.3 Markdown-lite

- Allowed: `**bold**`, `*italic*`, `[text](https://…)` links, `>` quotes, `` `code` `` inline. Nothing else.
- **No raw HTML, ever:** input is parsed as markdown-lite then sanitized; any HTML tags are escaped, not stripped silently (so users see what happened).
- Link rules: only `http://`/`https://` schemes; `rel="nofollow ugc"` + `target="_blank"` on render; no `javascript:`/`data:` URLs (rejected at parse time).

### C.2.4 Edit window & delete

- **Edit window: 15 minutes** from posting. Edited comments show a small "edited" marker. After 15 minutes the body is immutable (prevents bait-and-switch after replies accumulate). Moderators may edit for rule violations (profanity redaction) — the "edited by moderator" marker shows.
- **Delete = soft delete:** `status='deleted'`, body replaced with *"[deleted]"*, author name retained as "deleted user" unless the author deletes their whole account (§C.6.3). Replies to a deleted comment remain visible (thread integrity).

### C.2.5 Report button per comment

- Every comment shows **Report**. Reasons: `spam`, `abusive`, `spoiler`, `leak-media`, `misinformation`, `other` (free text ≤ 200 chars).
- **2 reports** from distinct established identities → comment auto-collapsed ("hidden pending review — tap to show"), stays in mod queue. **5 reports** → auto-hidden until reviewed. Reporter identities are never shown to the comment author.
- False-report abuse (reports that moderators consistently reject) feeds the reporter's trust score downward.

### C.2.6 Spoiler convention

- Authors **must** tick "Contains story spoilers" for mission/story content; moderators can add the flag retroactively.
- Spoiler comments render **blurred with "Tap to reveal — story spoiler"** overlay. The flag is a first-class column (`spoiler bool`), not a text tag, so the UI can enforce it even if the body is edited.
- Rule text (shown in the composer): *"Mark story spoilers. Unmarked spoilers may be flagged by the community."*

---

## C.3 User screenshots — [NEEDS-SUPABASE] (upload, storage, moderation); copy/UI [NO-SUPABASE]

### C.3.1 Upload flow

1. From a pin's detail panel: **"Add screenshot"** → rights declaration step (mandatory checkbox, §C.3.2 — upload button stays disabled until ticked) → file picker → client-side checks (format, size, dimensions) → preview + caption field (optional, ≤ 140 chars) → submit.
2. On submit the image enters **`pending`** moderation state. The uploader sees it in their own "My uploads" list as "Awaiting review"; it is invisible publicly until approved.
3. On approval it appears in the pin's screenshot gallery with credit "Uploaded by {display_name}".

### C.3.2 Rights declaration (mandatory checkbox) — [NO-SUPABASE]

Exact copy to show above the checkbox (plain language, no legalese):

> **Screenshot rights declaration**
>
> "I captured this image myself from publicly released material — official trailers, official Rockstar screenshots, or my own gameplay. It is not a leak, not a re-upload of someone else's footage, and not taken from a watermarked leak compilation. I understand that leaked or stolen media will be removed, and repeat uploads may get my account restricted."

- The declaration text + timestamp + identity are stored with each upload record (proof of the user's attestation).
- If the uploader is a guest (device_id), the declaration still applies; on account creation the attestation migrates with the identity (§C.1.2).

### C.3.3 Limits & formats — [NEEDS-SUPABASE]

| Rule | Value (config, not constant) |
|---|---|
| Formats | JPEG, PNG, WebP only (validated by magic bytes server-side, not extension) |
| Max file size | 5 MB |
| Dimensions | min 640 px on the short edge (reject tiny/thumbnail rips); max 4096 px long edge |
| Per-user caps | 3 uploads per pin per day; 20 per day account-wide |
| Duplicates | perceptual-hash check on upload; exact/near duplicates rejected with "This image is already in the gallery" |

### C.3.4 Storage & thumbnails (concept) — [NEEDS-SUPABASE]

- **Supabase Storage bucket** `marker-screenshots`, **private** (no public listing); public reads go through signed/transform URLs only.
- Object lifecycle: upload → `pending/` prefix → on approve, moved to `live/` prefix; on reject, moved to `rejected/` (retained 30 days for appeals, then purged).
- **Thumbnail generation (concept):** on upload, a server-side function (Supabase Edge Function or storage trigger) renders a 320-px-wide WebP thumbnail; the gallery loads thumbnails, the lightbox loads the full image. Originals are never served directly to the page (bandwidth + EXIF hygiene — strip EXIF on ingest).
- **Never hotlink unknown third-party hosts:** the gallery renders only objects from our own bucket. Any external image URL pasted into captions/comments is rendered as a plain link, never an `<img>`.

### C.3.5 Leaked-media rejection policy — [NO-SUPABASE] (policy) + [NEEDS-SUPABASE] (enforcement)

**Explicitly rejected, no exceptions:**
- "Leaked build" gameplay footage or screenshots from unreleased builds.
- Watermarked leak compilations (e.g. re-uploads of the 2022 footage with leaker watermarks).
- Screen-recordings of someone else's stream/video presented as own capture.
- Any media the uploader cannot plausibly have captured themselves.

**Report path:** every screenshot carries a Report button; reason `leak-media` routes to the **top of the mod queue** and auto-collapses the image pending review. On moderator confirmation of leak status: image removed immediately, uploader warned; second offense → upload privilege suspended (§C.5.3). Takedown requests from rights holders are honored within 48 hours via the same queue with a `rights-holder` priority flag.

**Rationale (public-facing copy):** *"We don't host leaked media — reporting on leaks with transparency labels is journalism; hosting the files is distribution."* (Take-Two has subpoenaed platforms over leak hosting; this policy keeps the site on the reporting side of that line.)

---

## C.4 Moderation model

### C.4.1 Automated — [NEEDS-SUPABASE]

| Check | Where | Action |
|---|---|---|
| **Profanity filter** (curated blocklist + common obfuscation patterns) | comment/vote-label/caption text at write time | Blocks submission with "Please remove flagged language" for hard slurs; soft-flags for human review for edge cases |
| **Image NSFW scan** (concept) | screenshot upload ingest, via a free-tier image-moderation API | Score above threshold → auto-reject + mod-queue entry; borderline → pending with flag |
| **Velocity checks** | votes, comments, uploads, reports per identity | Exceeding caps → temporary cool-down (see §C.5.2); counters frozen during cool-down |
| **Duplicate/perceptual-hash** | screenshots | Reject re-uploads of existing gallery images |
| **Link throttling** | comments | > 2 links per comment → held for review (spam pattern) |

Automated actions are **never silent**: the user sees what happened and why ("Your comment was held for review: too many links"). Automated rejections are appealable (§C.4.3).

### C.4.2 Human — [NEEDS-SUPABASE]

- **Moderation queue** lives in a **dev-only `/admin`** route in Phase 1 (not public; no public mod tools). Queue shows: pending comments, pending screenshots, report clusters, vote-anomaly flags, appeals — each with context (pin, author history, reason).
- Actions: approve / reject (with canned + free-text reason) / escalate. Every action writes to the audit log (§C.5.4).
- Roles: `moderator` (queue only), `editor` (queue + honesty-status changes with evidence), `admin` (all + config).

### C.4.3 Appeal path — [NEEDS-SUPABASE]

1. Removed/held content shows the author: what was removed, which rule, and an **"Appeal"** button (one appeal per item).
2. Appeals enter a separate queue lane, reviewed by a **different moderator** than the original decider where staffing allows.
3. Decision within 7 days (target; shown to the user). Successful appeal restores the content and clears the strike; the original decision is annotated, not deleted (audit integrity).

---

## C.5 Anti-abuse — [NEEDS-SUPABASE]

### C.5.1 Vote-brigading detection (privacy-minimal)

- **Velocity caps per marker:** more than **20 votes on one pin within 10 minutes** (from ≥ 10 distinct identities) → counter **freezes** at the pre-spike value, public display shows the frozen count, and a mod-queue flag "vote anomaly" fires. A moderator unfreezes after review; confirmed-brigade votes are invalidated in bulk (audit-logged).
- **Cross-device heuristics — no fingerprinting:** the system may compare only **coarse, non-identifying signals**: same /24 IPv4 block **or** same ASN **plus** identical user-agent family **plus** votes within a tight time window. A cluster match **quarantines** the votes (excluded from counts, marked for review) — it never auto-bans. Explicitly banned: canvas fingerprinting, device-fingerprint libraries, evercookies, IP-based identity of individuals. IPs are stored hashed with a rotating salt and purged after 30 days.
- **Per-identity vote velocity:** > 30 votes in 5 minutes across pins → cool-down (votes rejected with "slow down" message for 10 minutes).

### C.5.2 Comment & upload rate limits

- Comments: 1 per 30 seconds, 10 per hour, 50 per day per identity. Replies count toward the same budget.
- Reports: 5 per hour per identity (prevents report-spam as a weapon).
- Screenshot uploads: §C.3.3 caps.
- Exceeding a limit returns a clear "You're posting too fast — try again in X" message, never a silent drop.

### C.5.3 Ban / shadow-ban escalation

| Step | Trigger | Effect |
|---|---|---|
| 1. Warning | 1st confirmed violation | In-app notice citing the rule |
| 2. Rate-limit | 2nd violation within 30 days | Comment/upload/vote limits halved for 7 days |
| 3. Shadow-ban | 3rd violation, or 1st severe (leak-media upload, doxxing) | User's new content visible **only to them**; they are not told they're shadow-banned (prevents evasion adaptation) — but their *old* approved content stays public |
| 4. Hard ban | Repeat severe, or ban evasion | Account/device blocked from contributing; public content remains but authorship anonymized |

All steps are recorded in the audit log with the deciding moderator and reason. Shadow-ban status is never exposed via any API response.

### C.5.4 Audit log (concept) — [NEEDS-SUPABASE]

Append-only `moderation_actions` concept: `id, actor_id, action (approve/reject/hide/unhide/warn/shadowban/ban/vote-invalidate/status-change), target_type, target_id, reason, evidence_link, created_at`. No updates, no deletes — corrections are new rows. Powers the appeals queue and a future public transparency report (counts only, no identities).

---

## C.6 Privacy

### C.6.1 Public surface — [NO-SUPABASE] (policy) + [NEEDS-SUPABASE] (enforcement)

- The **only** public identity is `display_name` — **opt-in** (chosen at first contribution or in settings), **editable anytime**, 3–24 chars, unique-ish (suffix auto-added on collision).
- Guests with no display name appear as **"Visitor"** (no generated numbers/handles that could be tracked across pins — a fixed string for all guests).
- API responses for public surfaces **never include**: email, auth username, `device_id`, IP (even hashed), trust score, or moderation history. This is enforced by a dedicated public serializer, not by hoping queries omit columns.

### C.6.2 Minimal data collection — [NO-SUPABASE] (statement)

Public statement (shown in the contribution onboarding, one screen):

> "We store: your votes, comments, and screenshots, plus a random ID on your device so your votes count once. We don't: track you across sites, fingerprint your device, or sell anything. Delete everything anytime in Settings."

### C.6.3 Delete-my-data path — [NEEDS-SUPABASE]

- Settings → **"Delete my data"** → explicit confirmation (type-to-confirm for accounts) → within 24h:
  - All votes by the identity **removed**; pin counters **recomputed** (decremented — aggregates stay honest).
  - All comments **soft-deleted** (§C.2.4); screenshots **deleted from Storage** (originals + thumbnails).
  - Profile row anonymized (display_name → "deleted user"); auth account deletion follows Supabase's flow.
  - **Anonymized aggregates are kept** (e.g. "this pin has 37 confirms" remains true — the count just no longer includes you). No per-user record survives.
- The deletion itself is audit-logged (identity hash + timestamp only).

---

## C.7 Phase 1 without Supabase (graceful degradation) — [NO-SUPABASE]

Since Supabase is not connected yet, Phase 1 ships the UI honestly disabled where persistence is impossible:

| Feature | Phase 1 (no Supabase) behavior |
|---|---|
| Vote buttons | Visible but open an honest state: **"Community votes go live with accounts — coming soon."** No fake counters; no localStorage vote counts presented as real. |
| Comments | Composer replaced with: **"Comments open after launch — the thread starts here."** (Shows the empty-state design, not a dead form.) |
| Screenshot upload | Button present → explains the rights declaration and limits, upload itself disabled until Storage is live. The declaration copy (§C.3.2) and policy ship now. |
| Mark as found (progress) | **Works fully** — localStorage-first, already live. (Not a community signal; unaffected.) |

**Rule:** never display fabricated social proof. An empty state with honest copy always beats a fake "0 comments."

---

## C.8 Tag summary (build checklist)

- **[NO-SUPABASE]:** C.1.4 UI copy + thresholds as copy, C.1.6 policy text, C.2.6 spoiler convention, C.3.2 declaration copy, C.3.5 policy copy, C.6.1/C.6.2 public statements, C.7 degradation states.
- **[NEEDS-SUPABASE]:** C.1.1–C.1.3, C.1.4 counters, C.1.5, C.2.1–C.2.5, C.3.1, C.3.3–C.3.4, C.4, C.5, C.6.3.
- **Blockers / cross-slice:** GTADB attribution must be live before public deploy (user adds; no credit text in this spec). `locations.certainty` check constraint must be migrated to the four honesty statuses before C.1.6 enforcement is meaningful (C.0 schema note). Comment/screenshot support on entity pages (`/vehicles/[slug]` etc.) needs a nullable `entity_id` on the new tables — Phase 1 scopes to map pins only.

## C.9 Open questions for the user

1. Confirm the display minimums (5 to show counts, 10 for Community Verified, 25 for review trigger) or adjust.
2. `/admin` is dev-only in Phase 1 — confirm whether Husnain wants a hosted mod queue before launch or is comfortable moderating post-launch.
3. NSFW image-scan vendor: concept specified vendor-neutral — pick a free-tier service at build time (no lock-in).
