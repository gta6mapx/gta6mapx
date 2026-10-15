# Spec slice (a) — Guest mode now → Supabase auth later (progress identity & data model)

**Scope:** progress identity, local data model, sync-now-vs-later, privacy, anti-abuse.
**Non-goals of this slice:** submission flow, voting, moderation, admin panel, email capture —
covered by other spec slices. No application code in this document (spec prose/tables only).

**Status legend (applied per item):**
- **[NO-SUPABASE]** — ships guest-local now; works with zero network, zero account.
- **[NEEDS-SUPABASE]** — ships only after Supabase is connected and auth is enabled.
- **[MIXED]** — guest-local core now; server half later (behavior must be defined for both now).

**Aligns with:** MVP-SPEC.md §3.2 (progress tracking: free, localStorage-first, per-category
counters, personal notes; no surprise caps) and §5 (`progress` table).

**Blocker note (user's own action):** the gtadb.org CC BY 4.0 attribution must be live on the
site before public deploy (Vercel). Husnain adds it himself — no credit text is written in
this spec or by this slice.

---

## 1. Guest-local data model (v2) [NO-SUPABASE]

### 1.1 One consolidated store replaces the v1 set [NO-SUPABASE]

The existing `gta6mapx_found_v1` (plain array of pin ids) becomes **read-only legacy**.
The new store is a single JSON object:

| Key | Value | Notes |
|---|---|---|
| `gta6mapx_progress_v2` | Store object (see §1.2) | Primary read/write key. Versioned by `format_version`. |
| `gta6mapx_device_v1` | `{ "device_id": "<id>", "created_at": "<ISO-8601>" }` | Device identity; generated once, never rotated by app action. See §1.4. |
| `gta6mapx_found_v1` | Legacy array (migrated from) | After migration: kept as untouched archive; see §1.5. |

Rationale: one object = one atomic write, one quota check, one storage-event payload.
Category counters and overall % are **derived**, never stored (computed from pin count per
category vs found count; see §1.3).

### 1.2 Store object shape (described, not code) [NO-SUPABASE]

- `format_version`: integer `2` — the only field the loader checks first.
- `device_id`: mirrors the id in `gta6mapx_device_v1` (redundancy so exported files self-identify).
- `found`: map of pin id → record, where each record has:
  - `found_at` — ISO-8601 timestamp of when the user marked it found.
  - `note` — personal note text, empty string when none.
  - `note_updated_at` — ISO-8601 timestamp of last note edit; empty/null when no note.
- `favorites`: map of pin id → `{ saved_at: <ISO-8601> }` (bookmarks; separate from "found" because a user may favorite a pin before finding it — e.g. a collectible route to plan).
- `meta`: `{ created_at, updated_at }` — updated on every write.

**Field rules:**
- Pin ids are opaque strings (matching the id space used by the map/entities modules);
  max length 128 characters; unknown/orphan ids are kept silently (data portability > strictness),
  but flagged in the export for hygiene.
- `note` max length: **2,000 characters** (enforced at the UI + store layer; longer input is
  rejected with a visible message, never silently truncated).
- `found_at` / `saved_at` are write-once per record (first touch); a re-mark after unmark
  creates a new record with a new timestamp. Unmarking deletes the record; the note is deleted
  with it unless the pin is favorited (then the note is kept on the favorite record —
  decision: notes live on the found record only; if unmarking a favorited pin, prompt
  "keep note on favorite?" — default yes, store note on the favorite record in the same shape).

### 1.3 Derived stats [NO-SUPABASE]

- **Per-category counts:** `found-in-category / total-in-category` — computed live from the
  pin catalog (category of each pin comes from the data modules; the store never duplicates it).
- **Overall %:** `distinct found pins / total live pins × 100`, rounded to one decimal.
- **Favorites count**, **notes count** (found records with non-empty note).
- Stats must never be persisted; they are a pure function of (store, catalog). This keeps
  merges/imports correct by construction.

### 1.4 device_id — format, generation, persistence [NO-SUPABASE] (+ [MIXED] for server half)

- **Format (STABLE CONTRACT — other slices may rely on this):**
  `gta6mapx-dev-` + UUID v4 (e.g. `gta6mapx-dev-3f9a2b1c-...`). Lowercase, fixed prefix.
- **Generation:** on first app load, if `gta6mapx_device_v1` is absent, generate via
  `crypto.randomUUID()` with a fallback random generator; store `{ device_id, created_at }`.
  Generation must happen exactly once per browser profile.
- **Persistence:** the key is never written by any other flow; "reset all" (§2.3) keeps it.
  Only an explicit "forget this device" action (optional, Phase 2 UI) regenerates it.
- **Purpose:** stable guest identity for (a) the future server migration (§4), (b) the
  submissions/votes coordinator's guest attribution (see §5).
- [NEEDS-SUPABASE] After sign-in, the `device_id` is sent to the server once for the merge
  (§4.3), then the client switches to account identity; the local device_id is retained for
  traceability but no longer used as the write identity.

### 1.5 v1 → v2 migration path [NO-SUPABASE]

1. On load, if `gta6mapx_found_v1` exists and `gta6mapx_progress_v2` does not:
   - Read the v1 array; for each id create a v2 found record with `found_at` = migration time
     (v1 had no timestamps — do not invent earlier dates; honesty rule), empty note.
   - Write the v2 store, then rename the v1 key's contents to `gta6mapx_found_v1_archive`
     (single copy, never written again). The original `gta6mapx_found_v1` key is removed so
     future loads take the v2 path.
2. If both exist (e.g. v1 written by an old tab after migration): union the v1 ids into v2
   with migration timestamps, then archive — no data loss.
3. If `gta6mapx_found_v1` contains invalid JSON: ignore it, proceed as fresh, log a console
   warning; do not block the app.
4. Migration is idempotent: re-running with an existing v2 store is a no-op (except case 2).

### 1.6 Multi-tab sync via `storage` events [NO-SUPABASE]

- Every tab listens for `storage` events on `gta6mapx_progress_v2`.
- **Merge, don't overwrite:** on receiving an event, the tab unions the incoming store with
  its own in-memory store (same rules as §2.2 import merge: union of found sets, newest
  timestamp wins per record, notes newest-`note_updated_at` wins, favorites union by
  `saved_at`). Then it persists the merged result and re-renders.
- This prevents the classic "tab A unmarks a pin, tab B's stale write re-marks it" race:
  with union semantics, a delete in one tab vs. a present record in another is the one
  genuine conflict — decision: **delete wins only if the deleter's action timestamp is
  newer than the record's last update**; since deletes carry no timestamp in the store,
  tombstones are kept in `meta.tombstones: { pinId: deleted_at }` (pruned after 30 days).
  Union merge consults tombstones before resurrecting a record.
- UI must reflect the merged state within the same frame budget as a normal toggle
  (no full-page reload).

### 1.7 Storage quota handling (the 5 MB wall) [NO-SUPABASE]

localStorage is typically capped around 5 MB per origin and **shared with every other key
the app uses** (tiles config, UI prefs, etc.).

- **Before every write:** serialize the store, check `new Blob([json]).size` against a
  soft budget of **3 MB** (leaving headroom for other keys).
- **At/over budget:** the write is refused; the UI shows a persistent, dismissible banner:
  "Progress storage is full — export a backup, then delete old notes or reset." The in-memory
  state stays usable for the session but nothing is persisted until space is freed.
  Never silently drop data.
- **Prevention rules (keep the store small by design):**
  - Notes capped at 2,000 chars (already).
  - No screenshots/blobs in the store — notes are text only.
  - Tombstones pruned after 30 days (§1.6).
  - Export payload is not cached in storage.
- **Scale sanity:** ~2,200 pins × (~64-byte id + ~50-byte record) ≈ 250 KB even at 100%
  completion with notes on every pin ≈ 4.4 MB worst case — the cap is reachable only with
  maximal notes; the banner path must still exist and be tested.

---

## 2. Export / import / reset [NO-SUPABASE]

### 2.1 Export — JSON backup (user-owned data portability) [NO-SUPABASE]

- Trigger: settings/profile area button "Export my progress".
- Produces a **file download** (no server round-trip): `gta6mapx-backup-YYYYMMDD-HHmm.json`.
- Envelope (described): `{ app: "gta6mapx", format_version: 2, exported_at, device_id,
  stats_snapshot: { found_count, favorites_count, notes_count, overall_pct },
  data: { found: {...}, favorites: {...}, meta: {...} } }`.
  The `stats_snapshot` is informational only (recomputed on import; never trusted).
- Export must work fully offline. No personal data is included by design (see §3) —
  the file contains only pin ids, timestamps, notes the user wrote, and the device id.
- Users should be told in one line what the file is for: "Keep this file — it restores your
  progress on any device or browser."

### 2.2 Import — restore from backup [NO-SUPABASE]

- Trigger: file picker accepting `.json` only; drag-and-drop optional.
- **Hard caps (anti-abuse + quota safety):**
  - File size ≤ **2 MB** — larger files are rejected before parsing with a clear message.
  - After parse: `found` entries ≤ **20,000**, `favorites` ≤ **20,000**, total notes
    ≤ 20,000; note text ≤ 2,000 chars each (overlong notes are rejected, not truncated —
    tell the user which pin id failed).
  - Parse via a streaming-safe approach; a single `JSON.parse` on ≤2 MB is acceptable.
- **Schema validation (reject-with-reason, never partial-apply):**
  1. Top-level must be an object with `app === "gta6mapx"` and numeric `format_version`
     of `1` or `2` (v1 legacy shape = legacy found-id array; migrate per §1.5 rules).
     Anything else → "This doesn't look like a GTA6mapx backup."
  2. `data.found` must be an object; each key a string ≤128 chars matching
     `[A-Za-z0-9_-]+` (sanitize: keys failing this are dropped and counted in the report).
  3. Timestamps must parse as dates; unparseable timestamps are replaced with import time
     and counted.
  4. Unknown top-level or record fields are **dropped silently** (forward-compatibility).
- **Merge semantics (import merges into current state; it never wipes):**
  - Found sets: **union**.
  - Per-pin record conflicts: the record with the newer `updated_at` (found records:
    newer of `found_at`/`note_updated_at`; favorites: `saved_at`) wins wholesale —
    no field-level blending, to keep the rule explainable.
  - Tombstones (§1.6) are consulted: an imported record older than a local tombstone
    stays deleted.
  - After import, show a summary: "Added N pins, updated M notes, skipped K invalid entries."
- **Security posture:** imported content is rendered only as plain text (notes are never
  injected as HTML); pin ids are never used to construct URLs or queries without encoding.

### 2.3 Reset all [NO-SUPABASE]

- Two-step confirm: button → modal with explicit checkbox or typed confirmation
  ("Type RESET to confirm") → execute.
- Clears `gta6mapx_progress_v2` (and any legacy/archive keys). **Keeps `gta6mapx_device_v1`**
  (stable identity; see §1.4).
- Strongly recommended UX: offer "Export backup first" as the primary button in the
  confirm modal, "Reset anyway" as secondary.
- After reset, stats return to zero immediately in all open tabs (via §1.6 sync).

---

## 3. Privacy posture [NO-SUPABASE] (with [NEEDS-SUPABASE] notes)

- **100% local by default:** progress, notes, favorites, device_id live only in the
  visitor's browser. **Zero network calls** are made for progress in guest mode —
  no beacons, no analytics pings carrying progress data, no third-party SDK reads.
- **Works offline:** every feature in §§1–2 functions with no connectivity (export via
  file download; import via file picker).
- **No personal data collected:** the store contains no name, email, IP, or
  fingerprint. The `device_id` is a random string, not derived from any device
  characteristic — it identifies a browser profile, not a person.
- **User-facing copy** (settings/privacy page, one short block):
  "Your map progress is stored only in this browser. We don't see it, we don't upload it.
  Back it up with Export — clearing site data erases it."
- [NEEDS-SUPABASE] Once accounts exist: progress sync is **opt-in at sign-in** with an
  explicit merge screen (§4.3) — never silent upload. The privacy policy must then disclose:
  account-linked progress (found pins, notes) stored on Supabase, IP addresses collected
  for abuse-prevention only (per MVP-SPEC §9.11), never sold.
- [NEEDS-SUPABASE] Guest submissions/votes attributed to `device_id` must be disclosed
  the same way when that slice ships.

---

## 4. The auth-later path [NEEDS-SUPABASE] (behavior defined now, built later)

### 4.1 Auth options [NEEDS-SUPABASE]

- **Primary: magic link (email OTP / link)** — lowest friction for a map audience;
  no password to manage.
- **OAuth providers (candidates, final list at build time): Google, GitHub, Discord.**
  Decision criteria: which communities the audience already has accounts in; no provider
  is promised in this spec.
- Sessions via Supabase Auth; the client keeps a parallel local store as the offline
  source of truth and syncs deltas (see §4.4).

### 4.2 profiles row creation [NEEDS-SUPABASE]

- On first successful sign-in (any method), ensure a `profiles` row with `id = auth.users.id`:
  `display_name` defaults to a generated handle (e.g. `mapper-<short random>`, user-editable
  later), `trust_score` 0, `approved_count` 0, `role` `user`.
- Creation must be idempotent (re-sign-ins are no-ops). Enforcement point (DB trigger vs
  app-level upsert) is a build-time decision; the observable behavior is what matters:
  **no authenticated request may fail for lack of a profile row.**

### 4.3 Guest → account MERGE (first sign-in) [NEEDS-SUPABASE]

This is the moment guest-local data meets the server. It must be **explicit and reviewable**,
because silent merges are how data gets lost and trust dies.

1. **Pre-merge screen:** "We found progress in this browser (N pins, M notes, K favorites)
   from device `gta6mapx-dev-xxxx…`. Merge it into your new account?" Options:
   **Merge** (recommended) / **Start fresh** (discard guest data after offering export) /
   **Keep separate** (stay signed in but keep writing guest-local — allowed; re-prompt on
   next sign-in).
2. **Merge rules (deterministic, explainable):**
   - Found sets: **union** of guest records + any existing account records.
   - Per-pin conflicts (same pin found both as guest and on account): the record with the
     newer last-update timestamp wins wholesale (newest `note_updated_at` if a note is
     involved, else newest `found_at`).
   - Notes: **newest `note_updated_at` wins** — never concatenate (concatenation produces
     unreadable duplicates across devices).
   - Favorites: **union** by pin id; on duplicate, newer `saved_at` wins.
   - Tombstones from §1.6 apply: a pin deleted as guest after being found on the account
     stays deleted if the delete is newer.
3. **Server write mapping:** guest records become `progress` rows with `user_id` set and
   `device_id` preserved in the row for provenance; `found_at` and `note` map directly.
   Note: the current schema's `progress` table has no `note_updated_at` — the merge
   comparison needs it, so **a schema note for the auth build: add `note_updated_at`
   (nullable timestamptz) to `progress`** (described here; applied by the auth-later build).
4. **Guest device rows cleanup:** any pre-existing `progress` rows with this `device_id`
   and NULL `user_id` (e.g. from guest submissions-era writes, if that slice ever writes
   progress server-side pre-auth) are re-owned to the `user_id` under the same conflict
   rules, then the device ceases to be a write identity for this account.
5. **Post-merge:** the client switches `getIdentity()` to account mode (§5); the local
   store is rewritten from the merged server state so local and server agree byte-for-byte
   on the next load.
6. **Failure handling:** if the merge request fails (offline, server error), the user
   stays guest-local with zero data loss; a retry banner appears. Never leave the user
   in a half-merged state — the merge is all-or-nothing per pin batch, retried as a whole.

### 4.4 Ongoing sync after sign-in [NEEDS-SUPABASE]

- **Write path:** account mode writes go to the local store first (instant UI, offline-safe),
  then enqueue a delta sync (debounced ~2s, retry with backoff on failure). Last-writer-wins
  per record by timestamp — same "newest wins" rule as §4.3, so behavior is uniform.
- **Read path:** on sign-in and on app start (when online), pull server state and merge
  with local using §4.3 rules. When offline, local state is authoritative for the session.
- **Two devices, one account:** both devices sync to the same `user_id`; conflicts resolve
  by newest-timestamp-wins per record. Net effect: found sets union across devices; a note
  edited on phone yesterday and on desktop today keeps today's version. Users must be able
  to see "last synced" time in settings — silent divergence is a support ticket factory.
- **Sign-out:** local store is kept (user may re-sign-in and re-merge); offer "also clear
  local progress" as an explicit checkbox, default unchecked.

### 4.5 What "no surprise caps" means for the server [NEEDS-SUPABASE]

MVP-SPEC §3.2 promises no caps on notes/progress. The server must honor it: no row-count
limits per user on `progress`, no note-length reduction vs. the 2,000-char client rule.
Abuse is handled by rate-limiting writes (e.g. max ~60 progress writes/minute per identity)
and by the import caps in §2.2 — not by storage quotas on honest users.

---

## 5. Contract for the submissions/votes coordinator (other teams) [MIXED]

The coordinator slice may assume **exactly** the following from this slice — nothing else:

1. **Stable `device_id` format:** `gta6mapx-dev-<uuidv4>`, persisted in
   `gta6mapx_device_v1`, generated once per browser profile, never rotated by normal
   app action. [NO-SUPABASE]
2. **A `getIdentity()` concept** returning one of:
   - `{ mode: "device", deviceId }` — guest; [NO-SUPABASE] (the only mode until auth ships)
   - `{ mode: "account", userId, deviceId }` — signed in; `deviceId` still present for
     provenance but no longer the write identity. [NEEDS-SUPABASE]
3. **Nothing else.** In particular: no assumption about store internals, key names beyond
   the two listed, sync timing, or account-linkage state. If the coordinator needs more,
   it must request a contract extension — not reach into this slice's storage.

---

## 6. Anti-abuse notes [NO-SUPABASE] (+ [NEEDS-SUPABASE] where marked)

Guest-local means no server to attack, but the import path and shared storage are still
abuse surfaces:

- **Import caps** (§2.2): 2 MB file, 20k records, 2,000-char notes, pin-id charset
  `[A-Za-z0-9_-]`, length ≤128. Oversized/malformed input is rejected with a reason —
  never partially applied.
- **XSS hygiene:** notes are user-authored text rendered as text only. Imported notes get
  the same treatment — no `innerHTML`, no markdown-to-HTML without sanitization
  (decision for the build: plain-text rendering; rich text is out of scope).
- **Storage-event validation:** incoming `storage` payloads are validated against the
  store shape before merging (same validator as import); a corrupt payload from another
  tab is ignored, not merged.
- **Quota-exhaustion:** a hostile or runaway tab cannot brick the app — writes are
  budget-checked (§1.7) and refused cleanly with a user-visible banner.
- [NEEDS-SUPABASE] **Server-side:** rate-limit progress writes per identity; validate
  pin ids against the catalog on write (unknown ids rejected server-side even though
  kept locally); cap note length at the DB check level to match the client; `device_id`
  format enforced (`gta6mapx-dev-` prefix + UUID) to prevent identity spoofing collisions.
- [NEEDS-SUPABASE] Merge endpoint must be idempotent (client-generated idempotency key
  per merge attempt) so retries can't duplicate rows.

---

## 7. Acceptance checklist (what "done" means for this slice)

**Guest-local (ships now) [NO-SUPABASE]:**
- [ ] v2 store with found records (timestamps), per-pin notes (2,000-char cap), favorites,
      tombstones; derived per-category + overall stats; zero network calls (verifiable in
      DevTools with offline mode).
- [ ] v1→v2 migration runs once, archives v1, is idempotent, never invents timestamps.
- [ ] `device_id` generated once in `gta6mapx-dev-<uuidv4>` format, stable across sessions.
- [ ] Multi-tab merge via storage events: toggling in tab A reflects in tab B; delete-vs-edit
      race resolves by newest timestamp, no resurrection.
- [ ] Quota path: forced-full storage shows the banner, refuses the write, loses nothing.
- [ ] Export downloads a valid JSON file offline; import validates, caps, merges with a
      summary; reset requires typed confirmation and offers export first.
- [ ] Privacy copy present in settings; no progress data in any network request.

**Auth-later (ships after Supabase) [NEEDS-SUPABASE]:**
- [ ] Magic link + chosen OAuth providers; `profiles` row auto-created, idempotent.
- [ ] First-sign-in merge screen with Merge / Start fresh / Keep separate; deterministic
      newest-wins rules; `note_updated_at` available for comparison; all-or-nothing retry.
- [ ] Two-device convergence: edits on either device union correctly; "last synced"
      visible in settings.
- [ ] `getIdentity()` returns account mode; coordinator contract (§5) holds.
- [ ] No caps on honest users; rate limits + validation handle abuse instead.
