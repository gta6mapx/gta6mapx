# SUPABASE.md — community layer wiring checklist (Worker B)

**Status:** Supabase is NOT connected. Everything below is future work. Follow
this checklist top to bottom with zero guesswork when the connection is
approved. **Do NOT invent credentials; do NOT write any secret into the repo.**

Source of truth for behavior: `research/specs/community-spec.md`
(spec §1.2 honesty-status rule is non-negotiable — it applies here too).

---

## 1. Env vars

| Variable | Scope | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client-safe | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client-safe | anon/public key — safe to expose |
| `SUPABASE_SERVICE_ROLE_KEY` | **server-only, never `NEXT_PUBLIC_`** | API routes / server actions only |

Set them in two places: (a) local `.env.local` (**gitignored**, never committed),
(b) the Vercel project environment variables for the `gta6mapx` project.

## 2. Install the client library

```
npm i @supabase/supabase-js
```

## 3. SQL migration (run in Supabase SQL editor)

Runnable as-is. Applies schema.sql deltas from spec §1.4.

```sql
-- ── profiles: extend v1 with display-name uniqueness & sign-in source ──
alter table profiles
  add column if not exists user_id uuid unique references auth.users(id),
  add column if not exists updated_at timestamptz default now();
-- NOTE: v1 profiles.id already = auth.users.id (uuid pk). Keep that; the
-- added user_id is a belt-and-braces unique link for join clarity.

-- role check already exists in v1:
-- user | trusted_mapper | moderator | editor | admin
-- trust_score, approved_count already exist in v1.

-- ── submissions: extend v1 to the full CommunitySubmission shape ──
alter table submissions
  add column if not exists device_id text,                       -- v1 may lack it
  add column if not exists display_name text,
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists category_slug text,
  add column if not exists proposed_status text
    check (proposed_status in ('trailer-confirmed','leak-reported','disputed')),
  add column if not exists evidence jsonb default '{}',
  add column if not exists attestation boolean default false,
  add column if not exists attestation_at timestamptz,
  add column if not exists reviewer_note text,
  add column if not exists resubmits_id uuid references submissions(id),
  add column if not exists confirms int default 0,
  add column if not exists reports int default 0,
  add column if not exists provenance text default 'community-submitted',
  add column if not exists updated_at timestamptz default now();
-- DELTA: status check — v1 only allows pending|approved|rejected.
-- Postgres cannot ALTER CHECK in place, so drop + re-add:
alter table submissions drop constraint if exists submissions_status_check;
alter table submissions add constraint submissions_status_check
  check (status in ('pending','in-review','approved','rejected','needs-info'));

-- ── votes: confirmations v1 exists; add seen_votes + vote identity hash ──
create table if not exists seen_votes (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  user_id uuid references auth.users(id),
  device_id text,
  created_at timestamptz default now(),
  unique (location_id, user_id),
  unique (location_id, device_id)
);
-- HARD RULE: votes tables carry NO honesty-status column, now or ever
-- (spec §1.2). Vote paths must not reference locations.certainty.
create table if not exists confirmations_v2_identity (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  identity_hash text not null,   -- sha256(user_id or device_id), server-side
  kind text not null check (kind in ('confirm','seen')),
  created_at timestamptz default now(),
  unique (location_id, identity_hash)
);

-- ── comments (needs accounts; one-level threading, spoiler flag, soft-delete) ──
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  parent_id uuid references comments(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  body text not null,
  spoiler boolean default false,
  reports int default 0,
  hidden boolean default false,
  deleted boolean default false,   -- soft-delete: renders as [deleted]
  edited_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists comments_location_idx on comments(location_id);

-- ── moderation audit log (append-only; no UPDATE/DELETE grants) ──
create table if not exists moderation_actions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references submissions(id),
  comment_id uuid references comments(id),
  actor_id uuid references auth.users(id),
  action text not null,
  note text,
  created_at timestamptz default now()
);

-- ── leaderboard: seasons + scores + badges ──
create table if not exists seasons (
  season_key text primary key,          -- YYYY-MM
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  archived boolean default false
);
create table if not exists leaderboard_scores (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,        -- client event-idempotency key
  still_id text not null,
  user_id uuid references auth.users(id),
  device_id text,
  accuracy numeric not null check (accuracy >= 0 and accuracy <= 100),
  elapsed_sec numeric not null,
  attempt_number int not null,
  round_score numeric not null,
  season_key text not null references seasons(season_key),
  created_at timestamptz default now()
);
create index if not exists leaderboard_scores_season_idx
  on leaderboard_scores(season_key);
create table if not exists badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  badge text not null,                  -- Season Champion, Top 10, …
  season_key text,
  awarded_at timestamptz default now(),
  revoked boolean default false
);

-- ── locations.certainty DELTA: v1 check is
--    confirmed|likely|speculation → migrate to the four honesty statuses ──
update locations set certainty = 'trailer-confirmed' where certainty = 'confirmed';
update locations set certainty = 'leak-reported'     where certainty = 'likely';
update locations set certainty = 'disputed'          where certainty = 'speculation';
alter table locations drop constraint if exists locations_certainty_check;
alter table locations add constraint locations_certainty_check
  check (certainty in ('rockstar-confirmed','trailer-confirmed','leak-reported','disputed'));

-- ── progress merge column (spec §1.4) ──
alter table progress add column if not exists note_updated_at timestamptz;
```

## 4. RLS — enable on every community table, sketch of policies

```sql
alter table submissions      enable row level security;
alter table confirmations    enable row level security;
alter table seen_votes       enable row level security;
alter table comments         enable row level security;
alter table leaderboard_scores enable row level security;
alter table profiles         enable row level security;
```

- **Public read:** `approved` submissions and comments are readable by anyone
  (including anon). Live pins' vote counters are public aggregates only —
  never expose `user_id` / `device_id` rows.
- **Writes own rows:** authenticated users may insert submissions/comments/
  votes for themselves (`auth.uid() = user_id`); no UPDATE/DELETE on
  `moderation_actions` for anyone except the service role.
- **Mods:** `moderator`/`editor`/`admin` roles (checked via a `profiles.role`
  helper function) may `updateStatus` and moderate comments; only `editor`+
  may write `locations.certainty` (the honesty-status column).
- **Storage buckets:** `pending-uploads` (private, insert by owner) →
  `live-uploads` (public read). **Strip EXIF on upload** (client-side canvas
  re-encode or an edge function) before moving to `live-uploads`.

## 5. Auth

1. Supabase dashboard → Authentication → enable **magic link** (primary).
   OAuth providers (Google/GitHub/Discord candidates) are a build-time decision.
2. Set **redirect URLs**: production domain + `http://localhost:3100` for dev.
3. First sign-in auto-creates a `profiles` row (idempotent trigger or
   client `getOrCreate`), handle `mapper-<random>`, editable later.
4. First-sign-in **merge screen** (Merge / Start fresh / Keep separate) per
   spec §2.3 — never merge silently.

## 6. Swap steps (UI untouched)

1. `npm i @supabase/supabase-js`
2. Create `web/src/modules/community/supabaseRepos.ts` implementing the
   **exact same five interfaces** in `repositories.ts` (plus `getIdentity`
   returning `{ mode: "account", userId, deviceId }` once signed in).
   Server-side code (status updates, threshold jobs, trust score) goes in
   API routes using the service-role key — never the anon client.
3. In `communityClient.ts`, change the single swap line:
   `return getLocalRepositories();` → `return getSupabaseRepositories();`
4. Re-run `web/scripts/community-acceptance-b.mts`; keep localRepos as the
   offline fallback path.

## 7. Explicitly NOT here

- No credentials, tokens, or keys anywhere in the repo — `.env.local` only.
- No Discord scraping, no leaked-media hosting (spec hard constraints).
- `rockstar-confirmed` remains editor-only; submitters never propose it —
  enforce in the form AND in the `proposed_status` check constraint.
