# Competitor Gap Analysis — map.stateofleonida.net vs GTA6mapx.com

Date: 2026-09-24. Source: live interactive browser audit of map.stateofleonida.net (research only; no text/code/assets copied — functionality described in own words).
Rule: feature breadth inspire karegi, design/copy nahi. Unki kamzorian (mixed DE/EN, stale counts, exposed dev tags, session-only settings, dead Community Hub) hum nahi dohrainge.

## GAP LIST — unke paas hai, hamare paas nahi (baad main add karne ke liye)

### Content depth (sab se bara gap)
1. **Named marker database (~3,000)** — unke paas har marker ka naam, real-world Florida address/plus-code, category, source aur edit provenance hai. Hamare paas 7 hand-reviewed sample pins + 1,581 unnamed GTADB density pins.
   → Path: GTADB 510 named review-queue import (pre-existing plan), har pin par 4-status evidence review ke saath.
2. **Per-marker detail pages ("Full View")** — har marker ka dedicated page: ID, last-edited date, coordinates, tags, share links. Hamare paas `?pin=` case-file panel hai, per-pin pages nahi.
3. **Rich tag taxonomy** — ~25 place categories (NATURAL, INDUSTRIAL, RETAIL, HOTEL, TRANSPORTATION…), game-feature tags (#BAR, #GAS, #SAFEHOUSE, #PAY'N'SPRAY), status tags (ENTERABLE, DEMOLISHED, CLOSED), leak-version tags (L1–L6). Hamare paas categories + tags + 4-status hain, itni depth nahi. (Unke internal dev tags `//TODO` waghera copy nahi karne.)
4. **Real-world address per marker** — Florida addresses/plus-codes. Hamare paas sirf approximate game coordinates. (Legal/honesty: addresses sirf jahan source reliable ho.)

### Marker popups & media
5. **Trailer markers par embedded video player** — popup ke andar video play hota hai. (Sirf official Rockstar embeds par ghor karna; leak hosting kabhi nahi.)
6. **FOV camera cones with animated playback** — trailer marker ka camera view-cone, Play/Pause + scrubber ke saath. Hamare paas FOV HUD toggle hai, per-marker animated cones nahi.
7. **Media library (166 entries)** — searchable, category tabs, har card par "Zur Position" map deep-link. Hamari Intel Library 127 dossiers rakhti hai magar trailer-screenshot style media + per-item map links nahi. (Sirf original abstract plates — legal line hold rahegi.)

### Map tools
8. **Map-version comparison overlays** — YANIS v16.0 / RickRick V3 / Rockstar maps (GTA V, IV, Vice City, SA, RDR2), opacity sliders ke saath. Hamare paas sirf apne 2 base styles ka swipe compare hai. (Teesre-fareeq ka map art host/hotlink nahi karenge — user-imported overlays hi legal rasta hai.)
9. **Hide-UI-chrome mode** — ek tap par saara UI fade, clean screenshots ke liye. Hamare paas PNG export hai, chrome-fade nahi.
10. **Coordinate search → temporary marker** — `?search=X,Y` map par removable "Searched Position" marker drop karta hai. Hamara go-to-position crosshair reticle dikhata hai, persistent marker nahi.

### Customization & discovery
11. **Custom cluster color schemes** — user cluster palettes (size buckets <10/10–50/50–100/100+). Hamare clusters certainty-aware hain magar user customization nahi.
12. **Marker color customization** — user markers recolor kar sakta hai.
13. **Dense browsable marker list** — hazaaron rows wali full database list, per-row jump button. Hamare paas search + filters hain, "browse all" list view nahi.

### Game & community surface
14. **Guessing game: trailer screenshot + global leaderboard** — unka game screenshot dikhata hai aur role-based (MAPPER+/ADMIN/TRUSTED…) global leaderboard rakhta hai. Hamara "Find the Location" clean-map hai, device-local leaderboard. (Global ke liye accounts chahiye — Phase 6 Supabase ke baad.)
15. **Credits/contributors page** — mapper roles ke saath searchable contributor list. Hamare paas About/Credits modal hai, full page nahi.
16. **Donation link** — monetization ka halka rasta. (Low priority.)

### Jaan-boojh kar NAHI lene wale (unki kamzorian)
- Mixed German/English UI → hum English-only rahenge.
- Stale/inconsistent counts (2973 vs 2749 vs 182) → hamare honest counters hi rahenge.
- Exposed internal dev tags (`//TODO`, `//MAY-NOT-EXIST`) → kabhi nahi.
- Cookie-consent-gated settings → hamari settings persistent hain.
- "COMMING SOON" (typo) dead Community Hub → hum real submissions/moderation la rahe hain.

## OUR EDGE — hamare paas hai, unke paas nahi
1. **True 3D map** — building extrusion, pitch control, 2D/3D toggle. Woh 2D Leaflet only.
2. **Leak Transparency Engine** — har cheez par 4 honest evidence statuses.
3. **Area measurement** — woh sirf distance napte hain; hum distance + area.
4. **GeoJSON export/import** — unke drawings export nahi hote.
5. **Annotation share-links** (`#a=` payload) — drawing/measurement state ka link.
6. **Entity SEO layer** — 128 dossiers + cheats, JSON-LD ke saath. Unke paas content/SEO layer nahi.
7. **Community asal main ship ho rahi** — submissions + moderation + guest merge Supabase-ready; unka hub "COMMING SOON" placeholder hai.
8. **User-image overlay import** (legal-safe) + swipe compare apne styles ka.
9. **Accessibility** — keyboard shortcuts, aria-live, reduced motion, focus traps.
10. **Mark-as-found progress tracking** — unke paas progress system nahi.
11. **Approximate-coordinate honesty** — anti-false-precision HUD aur disclaimers; woh real addresses ke saath false precision imply karte hain (user pain point #1: wrong locations).
12. **Persistent settings** — unki settings save nahi hotin (cookie gate); hamari versioned localStorage main hain.

## Suggested build order (jab waqt aaye)
1. GTADB named import (510) — content gap band karega, SEO pages barhenge.
2. Per-marker detail pages + rich taxonomy/tags.
3. Browsable marker list + temporary search marker.
4. FOV cones + trailer embeds (official only) + media↔map deep links.
5. Cluster/marker color customization + hide-chrome mode.
6. Third-party map overlays — LEGAL REVIEW ke baad hi (user-import path pehle).
