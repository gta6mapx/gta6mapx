-- GTA6mapx.com — Database schema v1 (Supabase / PostgreSQL)
-- Run this in the Supabase SQL editor. Safe to re-run (uses IF NOT EXISTS).

-- ─── Categories (hierarchical) ──────────────────────────────────────────────
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  icon text,                       -- icon key for the frontend (e.g. "car", "store")
  parent_id uuid references categories(id) on delete set null,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- ─── Locations (map pins) ───────────────────────────────────────────────────
create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  lat double precision not null,
  lng double precision not null,
  certainty text not null default 'speculation'
    check (certainty in ('confirmed','likely','speculation')),
  source_label text,               -- e.g. "Spotted in Trailer 2 @ 1:47"
  source_url text,
  description text,
  screenshots text[] default '{}',
  video_url text,
  verified_at timestamptz,         -- set during launch-week verification sprint
  status text not null default 'live'
    check (status in ('draft','live','hidden')),
  confirmations int default 0,
  reports int default 0,
  created_by uuid,                 -- references auth.users
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists locations_slug_idx on locations(slug);
create index if not exists locations_cat_idx on locations(category_id);
create index if not exists locations_status_idx on locations(status);

-- ─── Entities (cars / stores / missions / collectibles — programmatic SEO) ──
create table if not exists entities (
  id uuid primary key default gen_random_uuid(),
  type text not null
    check (type in ('car','store','mission','collectible','weapon','character')),
  slug text not null unique,
  name text not null,
  stats jsonb default '{}',        -- e.g. {"price": 1850000, "top_speed": 187}
  description text,
  location_ids uuid[] default '{}',
  video_url text,
  affiliate_links jsonb default '[]',
  published boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists entities_slug_idx on entities(slug);
create index if not exists entities_type_idx on entities(type);

-- ─── Community submissions ──────────────────────────────────────────────────
create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,                    -- references auth.users (nullable for guests)
  device_id text,                  -- for guest submissions
  payload jsonb not null,          -- {name, category_slug, lat, lng, description, ...}
  screenshots text[] default '{}',
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz default now()
);
create index if not exists submissions_status_idx on submissions(status);

-- ─── Confirmations & reports (voting) ───────────────────────────────────────
create table if not exists confirmations (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  user_id uuid,
  device_id text,
  created_at timestamptz default now(),
  unique(location_id, user_id),
  unique(location_id, device_id)
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  user_id uuid,
  device_id text,
  reason text,
  created_at timestamptz default now()
);

-- ─── User profiles (extends Supabase auth.users) ────────────────────────────
create table if not exists profiles (
  id uuid primary key,             -- = auth.users.id
  display_name text,
  trust_score int default 0,
  approved_count int default 0,
  role text not null default 'user'
    check (role in ('user','trusted_mapper','editor','moderator','admin')),
  pro_until timestamptz,
  created_at timestamptz default now()
);

-- ─── Progress tracking ──────────────────────────────────────────────────────
create table if not exists progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,                    -- null for guests
  device_id text,                  -- for guest (localStorage id)
  location_id uuid not null references locations(id) on delete cascade,
  note text,
  found_at timestamptz default now(),
  unique(user_id, location_id),
  unique(device_id, location_id)
);
create index if not exists progress_user_idx on progress(user_id);
create index if not exists progress_device_idx on progress(device_id);

-- ─── Articles / guides ──────────────────────────────────────────────────────
create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  type text not null default 'guide'
    check (type in ('guide','news')),
  body text,
  faq jsonb default '[]',          -- [{q, a}] for schema markup
  published boolean default false,
  published_at timestamptz,
  updated_at timestamptz default now()
);

-- ─── Email subscribers ──────────────────────────────────────────────────────
create table if not exists email_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text default 'landing',
  confirmed boolean default false,
  subscribed_at timestamptz default now()
);

-- ─── Seed: top-level categories ─────────────────────────────────────────────
insert into categories (name, slug, icon, sort_order) values
  ('Collectibles', 'collectibles', 'gem', 1),
  ('Stores & Services', 'stores', 'store', 2),
  ('Missions', 'missions', 'target', 3),
  ('Vehicles', 'vehicles', 'car', 4),
  ('Secrets & Easter Eggs', 'secrets', 'sparkles', 5),
  ('Stunt Jumps', 'stunt-jumps', 'zap', 6)
on conflict (slug) do nothing;
