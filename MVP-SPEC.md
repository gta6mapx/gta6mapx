# GTA6mapx.com — MVP Specification

**Version:** 1.0 | **Date:** September 24, 2026
**Basis:** `research/competitor-and-demand-research.md` (pain points, feature demands, competitor intel)
**Target:** Pre-launch MVP live ASAP; launch-week verification sprint Nov 19, 2026.

---

## 1. Product thesis (one line)

> The trust-first GTA 6 interactive map: every pin carries proof (Confirmed / Likely / Speculation + source timestamp), progress tracking is free with no surprise paywalls, and the mobile web experience is the primary product — not an app.

## 2. Tech stack (locked)

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript** | One language across stack; fewer bugs at speed |
| Framework | **Next.js (React)** | SSR for SEO pages + API routes for backend; huge ecosystem |
| Map library | **react-leaflet (Leaflet)** | Free, no per-view billing (Mapbox/Google would explode at scale) |
| Map tiles | Pre-rendered tile pyramid (gdal2tiles) on **Cloudflare R2** | CDN-cheap, fast; same pattern as MapGenie's cdn.mapgenie.io |
| Database | **Supabase (Postgres)** | Auth + Postgres + free tier; progress/submissions/votes |
| Hosting | **Vercel** | Free tier sufficient to launch; Next.js native |
| Starting data | Fork **Leonida Atlas** (GitHub, open-source, 2,204 places) — check license | Saves weeks of pre-launch data work |

**Cost at start:** ~$0–20/month (domain owned; everything else free tiers).

## 3. MVP v1 feature list (pre-launch → Nov 19)

### 3.1 Interactive map (core)
- [ ] Full-screen Leaflet map, dark theme, custom tile layer (Leonida reconstruction)
- [ ] **Category filters** — hierarchical toggles (Collectibles, Stores, Services, Missions, Vehicles, Secrets…)
- [ ] **Instant search** with fly-to-result
- [ ] **Certainty badge on every pin:** Confirmed (green) / Likely (yellow) / Speculation (grey) + source label e.g. "Spotted in Trailer 2 @ 1:47"
- [ ] Click pin → **detail panel**: name, description, screenshots, embedded video guide, coordinates, related pins
- [ ] **Pin clustering** at low zoom levels
- [ ] **Shareable deep-links:** `/map?lat=X&lng=Y&zoom=Z&layers=…` + "Copy Link" button
- [ ] **Mobile-first:** bottom-sheet detail panel, touch gestures, fast tile loading (<3s on mobile)

### 3.2 Progress tracking (FREE — the trust moat)
- [ ] "Mark as found" on any pin — fades/changes color
- [ ] **No login required:** localStorage-first; optional account sync across devices
- [ ] Per-category counters (e.g. "32/50 collectibles") + overall % bar
- [ ] Personal notes on pins (free, unlimited)
- [ ] **No surprise caps. Ever.** (The #1 resentment driver in the niche.)

### 3.3 Community submissions (zero-cost data engine)
- [ ] "Add Location" flow: click map → drop pin → category → screenshot upload → description (2-minute flow)
- [ ] Submission → **moderation queue** → editor approve/reject
- [ ] **Community voting:** "Confirm location" button; 5 confirmations → auto-publish; 3 reports → auto-hide
- [ ] **Trust ranks:** new users → review queue; 50+ approved → "Trusted Mapper" (auto-publish)
- [ ] "Community Verified" badge on crowdsourced pins
- [ ] Leaderboard + contributor badges (non-monetary incentives)
- [ ] Top contributors earn free Pro (when Pro launches)

### 3.4 Programmatic SEO pages (the traffic moat)
- [ ] URL structure:
  - `/map` — the interactive map
  - `/cars/[slug]` — every vehicle: stats, spawn locations, mini-map, video
  - `/locations/[slug]` — every store/landmark: description, map embed, related
  - `/missions/[slug]` — every mission
  - `/collectibles/[slug]` — every collectible
  - `/cars`, `/locations`, `/missions`, `/collectibles` — hub pages ("GTA 6 all cars" etc.)
  - `/guides/[slug]` — editorial guides (money, 100% checklist, cheats)
- [ ] Every entity page: unique content (description, stats table, location, video, related items) — **no thin pages**
- [ ] Bidirectional linking: map pin ↔ entity page ↔ hub page ↔ guide
- [ ] Schema markup: FAQ, HowTo, VideoObject
- [ ] Pre-launch pages tagged "based on trailers"; updated post-launch

### 3.5 Launch-week verification pipeline
- [ ] "Verify mode": editor checklist per pin, timestamped ("verified 2h after launch")
- [ ] Rapid-publish flow: submission → verify → live in minutes
- [ ] Public "verification progress" counter (marketing asset: "1,204/1,600 locations verified")

### 3.6 Growth & monetization (v1)
- [ ] Landing hero + **launch countdown + email capture** ("notify me when the full map drops")
- [ ] Light display ads (AdSense) — non-intrusive, never blocking map interaction
- [ ] Affiliate links on entity pages (pre-orders, hardware) — disclosed
- [ ] Disclaimer: "Not affiliated with Rockstar Games / Take-Two Interactive"

## 4. Explicitly OUT of MVP scope

- Mobile apps (research: companion apps are actively hated; mobile web first)
- Route planner (v2 / Pro feature)
- Pro tier ($29/yr — build after traction; price above the $9.99/yr anchor)
- Multilingual UI (v2 — demand confirmed: ES/PT volunteers exist)
- Multiplayer / GTA Online 2027 content (v2)
- Embeddable widgets (v2 — gtatracker.gg proves the backlink value)

## 5. Database schema (v1)

- `categories` — id, name, slug, icon, parent_id (hierarchy), sort_order
- `locations` (pins) — id, category_id, name, slug, lat, lng, certainty (confirmed/likely/speculation), source_label, source_timestamp, description, screenshots[], video_url, verified_at, status (draft/live/hidden), created_by
- `entities` — id, type (car/store/mission/collectible), slug, name, stats (JSONB), description, location_ids[], video_url, affiliate_links[]
- `submissions` — id, user_id, payload (JSONB), screenshots[], status (pending/approved/rejected), reviewed_by, reviewed_at
- `confirmations` — id, location_id, user_id, created_at (drives auto-publish threshold)
- `reports` — id, location_id, user_id, reason, created_at (drives auto-hide threshold)
- `users` — id (Supabase auth), display_name, trust_score, approved_count, role (user/trusted_mapper/editor/admin), pro_until
- `progress` — user_id (nullable for guests → device_id), location_id, found_at, note
- `articles` — id, slug, title, type (guide/news), body, faq (JSONB), published_at, updated_at
- `email_subscribers` — id, email, source, subscribed_at, confirmed

## 6. Build order (8 weeks to Nov 19)

| Week | Focus | Deliverable |
|---|---|---|
| 1 | Foundation | Next.js+TS scaffold, Supabase schema, tile pipeline from Leonida Atlas fork, dark theme shell |
| 2 | Map core | Filters, search, detail panel, certainty badges, clustering, deep-links, mobile bottom-sheet |
| 3 | Tracking + submissions | localStorage progress, account sync, submission flow, moderation queue, voting thresholds |
| 4 | SEO pages | Entity templates (car/location/mission/collectible), hub pages, sitemap, schema markup, blog |
| 5 | Growth layer | Email capture, countdown, AdSense, affiliate slots, disclaimer, performance pass |
| 6 | Content sprint | Region guides, money guide, car list, 100% checklist template (team writes; templates ready) |
| 7 | QA + speed | <3s mobile loads, SEO audit, moderation dry-run, verification pipeline rehearsal |
| 8 | Launch prep | Verification sprint runbook, YouTuber/press outreach list, launch-day checklist |

## 7. Success metrics (v1)

- Pre-launch: 10,000 email subscribers; 200+ entity pages indexed; trailer-based map live
- Launch week: verification counter public; <24h median pin verification time
- 90 days post-launch: 500K monthly visits; 5,000 registered users; 1,000+ community submissions
- Revenue: ads from day 1; affiliate from week 1; Pro tier decision at 90 days based on data


---

## 8. Phased roadmap (updated Sep 24, 2026)

Work is split into phases — never everything at once. Each phase ships before the next starts.

### Phase 1 — MVP (weeks 1–8, → Nov 19 launch)
Map core, free progress tracking, community submissions, programmatic SEO pages, email capture, light ads, basic admin (moderation queue + user list). See sections 3–7.

### Phase 2 — Powerful admin panel (weeks 9–12)
Full admin control center (spec in section 9). Includes user management, ads management, Pro pricing setup, leaderboard management, broadcasts/push notifications, analytics.

### Phase 3 — Master agent team (weeks 13–16)
Automated content discovery (spec in section 10). Scout agents find new locations/guides daily from authorized sources → drafts land in the admin moderation queue → human approves. Never auto-publishes.

### Phase 4 — Scale (2027)
Route planner, Pro $29/yr launch, multilingual UI, GTA Online content, PWA, embeddable widgets for backlinks.

---

## 9. Admin panel — full specification (Phase 2)

Role-based access: `admin` (everything) · `editor` (content + moderation) · `moderator` (queue only).

### 9.1 Dashboard (home)
- Live stats cards: visitors today, registered users, pending submissions, pins verified this week, revenue MTD
- Charts: traffic trend, signup funnel, top categories
- Action-needed feed: oldest pending submissions, spikes in reports

### 9.2 User management
- User table: search/filter/sort (name, email, trust score, role, Pro status, joined date)
- User detail page: profile, trust score history, submissions (approved/rejected), confirmations given, progress stats, notes
- Actions: change role, grant/revoke Pro, ban/unban, reset progress, impersonate-view (see what the user sees)
- Bulk actions: export user list (CSV), bulk role changes

### 9.3 Content management
- Pins/locations: full CRUD, bulk edit (category, certainty), bulk verify (verification sprint tools), map-based bulk select
- Entities (cars/stores/missions): CRUD + stats editor + affiliate link manager
- Articles/guides: rich editor, SEO fields (title, meta, slug), FAQ blocks, publish scheduling
- Media library: screenshots/video embeds with usage tracking

### 9.4 Moderation queue
- Submissions inbox: approve/reject with one click, edit-before-approve, rejection reasons
- Reports inbox: user-reported pins with evidence, quick hide/restore
- Voting overview: confirmations per pin, auto-publish threshold config (default 5), auto-hide threshold config (default 3)
- Full audit trail: who approved what, when (every action logged)

### 9.5 Ads management
- Ad slots per page type (map page, entity page, guide, homepage) — drag/position config
- Network settings: AdSense / Ezoic / Mediavine keys, per-network on/off
- Frequency caps: max ads per page, no ads for Pro users, no ads on map interaction layer
- A/B slot testing: run two layouts, compare RPM

### 9.6 Pricing & payments (Pro)
- Plan builder: name, price, billing interval, feature list per tier, trial days
- Coupon codes: create, limit uses, track redemptions
- Payment provider keys: Stripe (test/live mode toggle)
- Transactions table: charges, refunds, failed payments; manual refund button
- Subscriber list: who is Pro, since when, renewals, churned

### 9.7 Leaderboard management
- Scoring rules config: points per approved submission, per confirmation, per guide contribution
- Boards: weekly / monthly / all-time; reset cycles configurable
- Feature controls: pin top contributors on homepage, award badges, grant free Pro to top N
- Manual adjustments: add/remove points, disqualify for spam

### 9.8 Broadcasts & notifications
- **Push notifications (Web Push):** topic-based (new locations, new guides, news). Users opt in via browser "Allow" prompt — never silent. Compose + target (all / Pro / by topic) + schedule.
- **Email newsletter:** subscriber list, composer with templates, send/queue, open-rate stats
- **In-site announcements:** banner bar config (e.g. "Launch-day verification in progress: 1,204/1,600")
- Delivery logs: sent, delivered, clicked per broadcast

### 9.9 Analytics
- Pageviews, top pages, top search terms on site, signup funnel, retention cohorts
- Revenue dashboard: ads RPM by page type, affiliate clicks/conversions, Pro MRR
- Content performance: which pins/guides drive most traffic

### 9.10 Settings & security
- Site config: name, taglines, SEO defaults, social links
- Feature flags: enable/disable modules without deploys
- Certainty/voting thresholds, trust-rank rules
- **Security logs:** login attempts, moderation audit trail, IP-based rate limiting & spam detection (see privacy note 9.11)

### 9.11 Privacy note (important)
- **IP addresses are collected for security/abuse-prevention only** (rate limiting, spam/bot detection, ban enforcement). They appear in admin security logs, are never sold or shared, and need a published privacy policy disclosing this.
- **Push notifications do NOT use IPs.** They use the browser Web Push standard: the user explicitly taps "Allow", creating an encrypted subscription. No permission = no pushes, ever.

---

## 10. Master agent team — specification (Phase 3)

### 10.1 Architecture
- **MasterAgent (orchestrator):** schedules scout runs (default: daily 06:00 UTC + on-demand), dedupes findings, prioritizes by signal strength, pushes drafts into the moderation queue. Has a kill-switch and per-source on/off.
- **Scout agents (workers):**
  - `NewsScout` — Rockstar Newswire RSS + gaming-press RSS feeds (official/authorized feeds only)
  - `VideoScout` — YouTube Data API: new GTA 6 guide videos from whitelisted creators
  - `CommunityScout` — Reddit public API (r/GTA6 etc.), own Discord server, GTAForums public threads: trending location discussions
  - `DataScout` — open-source repos (Leonida Atlas & similar, license-checked first), public datasets
- **Pipeline:** discover → extract (title, coords if stated, source URL, evidence snippet) → dedupe vs existing pins (fuzzy name + coordinate radius match) → create **draft submission** with public source citation → moderation queue → **human approves** (agents never publish directly)

### 10.2 Admin UI for the agent team
- Agent dashboard: last run time, items found today, success/error per scout
- Draft review inbox: bulk approve/reject, edit-before-approve
- Source manager: enable/disable each source, add new RSS/API/creator (whitelist with permission notes)
- Schedule config: run frequency per scout, quiet hours
- Duplicate detector tuning: match radius, name-similarity threshold

### 10.3 Hard rules (non-negotiable)
- Only authorized sources: official RSS, public APIs, open licenses, creators with explicit permission. **Never scrape competitors' proprietary databases** (mapgenie, gtalens, gtabase data).
- Every agent-added pin publicly cites its source ("via Rockstar Newswire, Sep 24").
- Human approval gate stays forever — automation proposes, humans dispose.
- Full run logs retained for audit.
