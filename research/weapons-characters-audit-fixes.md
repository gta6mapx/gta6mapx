# Weapons & Characters Audit — Fix List

**Auditor:** Subagent B (Content Team)
**Date:** September 24, 2026
**Scope:** all 37 entity records — 30 weapons + 7 characters — in
`web/src/modules/entities/data/weapons.ts` and `web/src/modules/entities/data/characters.ts`.
Verification used public web reporting only (outlet articles, wiki pages, edition roundups,
Extended Look breakdowns). No Discord scraped; no leaked files downloaded or hosted.
Claims that could not be verified are marked "unverifiable" below rather than corrected.
**Status: fixes APPLIED** (see commit notes in report).

## Tally

- **Total records audited:** 37 (30 weapons, 7 characters)
- **Records with substantive problems:** 18 (13 weapons, 5 characters)
- **Records with minor polish applied:** 4 (3 weapons, 1 character)
- **Fully clean records:** 15 (14 weapons + 2 protagonists… minus overlap: 15 total)

**Clean weapons (14):** pistol, polymer-pistol, mustang-357, nipper-38, pump-action-shotgun,
double-barrel-shotgun, mp5-smg, micro-smg-uzi, ak-rifle, bolt-action-sniper, hammer, crowbar,
golf-club, grenade, stun-gun — wait, recount: that list is 15. **Clean weapons (15):** the 15
above. All check out against gamesradar/screenrant/theGamer/allthings.how/arynews trailer
coverage (names, classes, sightings all match public reporting).

**Clean characters (2):** lucia-caminos, jason-duval — summaries verified line-by-line against
Rockstar's official bios (livemint/VGC reporting of official copy): "fresh out of Leonida
Penitentiary", "taught to fight by her father", "fighting for her family", Army stint,
"working for local drug runners" in the Keys — all match.

## Cross-record notes (applied everywhere relevant)

### A. Two official in-game weapon names confirmed in the Extended Look
The Aug 2026 Extended Look shows weapon-pickup prompts reading **"L1 — Duke 556 Assault
Rifle"** and **"L1 — Moreland 850 Shotgun"** (mapheist.com frame-by-frame breakdown;
allthings.how: "Only one weapon has a fully confirmed in-game name so far" — these two).
These are the first two GTA 6 guns with Rockstar-confirmed in-game names. Both records were
under-labeled `trailer-confirmed` → corrected to `rockstar-confirmed`.

### B. Analyst-assigned names vs confirmed in-game names
Most weapon names in the dataset come from trailer analysts reading in-world branding —
not from Rockstar. Records now say so explicitly where the name is analyst-assigned:
capo-pistol ("Capo" read off the slide, theGamer), duke-carbine / duke-assault-sniper
("Duke Arms Company" branding read off the gun, gamesradar; no in-game name confirmed).

### C. The two revolver records were ONE weapon
`hawk-little-revolver` + `morgan-revolver` have been **merged into one record**
`hawk-little-morgan-revolver` ("Hawk & Little Morgan Revolver"). Rockstar's official UE copy
(thesixthaxis quoting Rockstar): "his and hers versions of the powerful Hawk & Little
Morgan Revolver… sourced exclusively from the Vercetti Estate". Every edition roundup
(insider-gaming, consequence.net, beebom, gamereactor) lists it as a single item. The split
was a mis-parse; "Morgan" is the model, "Hawk & Little" the manufacturer.

### D. UE personalized variants of the named pistols
UE copy (verified across thesixthaxis, insider-gaming, beebom, gamereactor, latestly)
bundles "personalized looks/variants for Jason's Girardi ES9 pistol and Lucia's Klose K17
pistol" — engraved, customized — while the base pistols remain standard-game weapons.
Summaries of both pistols now note this. No exclusivity flags were added (the UE versions
are cosmetic variants, not locked weapons).

### E. Supporting-character evidence status (consistency with locations audit)
The entity audit (vehicles/locations) treated Rockstar's official site copy as
`rockstar-confirmed` (ocean-beach, kelly-county, washington-beach…). The five supporting
characters were all **named in Rockstar's official character bios** (May 2026, reported by
VGC, livemint, pcgamer) — the same evidence tier. All five upgraded
`trailer-confirmed` → `rockstar-confirmed`.

### F. Melee wieldability is unconfirmed pre-launch
screenrant (Aug 2026, updated): "no melee weapons have been officially confirmed as
instruments that players can wield and strike with" — seen items (pool cue in the Cal
Hampton billiards scene, bat-wielding figure in the Port Gellhorn screenshot) may be
cutscene props. The two summaries that most implied wieldability (baseball-bat, pool-cue)
now carry the caveat; others say only "spotted in trailer footage" and were left as-is.

---

## Weapon records

### hawk-little-revolver + morgan-revolver → MERGED (weapons)
- Problem: Two records for one weapon. "Hawk & Little Revolver" and "Morgan Revolver"
  were split from a single official item.
- Evidence: Rockstar's UE copy (thesixthaxis): "his and hers versions of the powerful
  Hawk & Little Morgan Revolver… Sourced exclusively from the Vercetti Estate and found
  at Ammu-Nation stores as Jason and Lucia's story progresses… palm-tree-etched grips,
  engraved detailing, high-performance scope, and personalized finishes."
  insider-gaming table: "Hawk & Little Morgan Revolvers | Weapon | Ultimate Edition".
  screenrant: "Smith & Wesson 629-inspired Hawk & Little Morgan revolvers".
- Correction: replaced both records with one:
  - `slug: "hawk-little-morgan-revolver"`, `name: "Hawk & Little Morgan Revolver"`
  - `ultimateEditionExclusive: true` (kept)
  - `evidence.status` → `"rockstar-confirmed"`, `evidence.detail` →
    `"Officially announced as Ultimate Edition content — his-and-hers versions sourced from the Vercetti Estate (June 2026)"`
  - `summary` → `"His-and-hers revolver set from the Ultimate Edition — palm-tree-etched grips and Vice City styling sourced from the Vercetti Estate, per Rockstar's edition announcement."`
  - tags: `["handgun", "revolver", "ultimate-edition"]`

### duke-556 (weapons)
- Problem: Under-labeled. The in-game name is Rockstar-confirmed.
- Evidence: mapheist.com interface breakdown: "A body prompts 'L1 — Duke 556 Assault
  Rifle'… Those are the first two GTA 6 guns whose names we know." thedailygame.news
  (99 Extended Look details): "Identified weapons include the Moreland 850 shotgun and
  Duke 556 assault rifle."
- Correction: `evidence.status` → `"rockstar-confirmed"`, `evidence.detail` →
  `"In-game name confirmed in the Extended Look's weapon-pickup prompts (public reporting)"`.
  `summary` → `"M4-pattern assault rifle whose official in-game name appears on the Extended Look's pickup prompt — the mid-range workhorse of the confirmed arsenal."`

### moreland-850 (weapons)
- Problem: Under-labeled. The in-game name is Rockstar-confirmed.
- Evidence: mapheist.com: "another scene 'L1 — Moreland 850 Shotgun'". allthings.how:
  "Moreland 850 Shotgun | Pump-action shotgun | Named on its ground pickup prompt".
- Correction: `evidence.status` → `"rockstar-confirmed"`, `evidence.detail` →
  `"In-game name confirmed in the Extended Look's weapon-pickup prompts (public reporting)"`.
  `summary` → `"Short-barreled pump shotgun whose official in-game name appears on the Extended Look's pickup prompt — one of the clearest weapon reveals, built for close-quarters fights."`

### duke-carbine (weapons)
- Problem: Name presented without provenance; "Duke Carbine" is analyst-assigned.
- Evidence: gamesradar lists "Duke Arms Company carbine" and "Duke Arms Company special
  ops carbine" — branding read off the gun, no in-game name confirmed. noobfeed: "a
  fictional company called Duke Arms… styled after Colt". theGamer: Raul Bautista holds
  "what appears to be the Carbine from GTA 5" in a trailer.
- Correction: `evidence.detail` → `"Duke Arms Company branding spotted in trailer footage; 'Carbine' is an analyst label, not a confirmed in-game name (public reporting)"`.
  `summary` → `"Duke Arms carbine variant from trailer reporting — an analyst-assigned label for the branding read off the gun; a second Duke Arms rifle line alongside the 556."`

### duke-assault-sniper (weapons)
- Problem: Name presented without provenance; analyst-assigned.
- Evidence: gamesradar: "Duke Arms Company assault sniper rifle". theGamer: "One
  screenshot shows a man with what seems to be an Assault Sniper leaning on his leg."
- Correction: `evidence.detail` → `"Duke Arms branding spotted in official screenshots; analyst-labeled as an assault sniper (public reporting)"`.
  `summary` → `"Duke Arms semi-auto sniper platform reported from trailers — analyst-labeled; faster follow-ups than the bolt-action."`

### capo-pistol (weapons)
- Problem: Name presented as fact; it is analyst-assigned from a marking on the gun.
- Evidence: theGamer: "There is a pistol that features a few times in trailers and in
  a screenshot. It looks a bit like the Colt M911 with the word 'Capo' written on it."
- Correction: `evidence.detail` → `"'Capo' marking read off a Colt-style pistol in trailer footage; the name is analyst-assigned (public reporting)"`.
  `summary` → `"Colt-style pistol with a 'Capo' marking spotted in trailer coverage — the name is analyst-assigned, not a confirmed in-game title."`

### klose-k17 (weapons)
- Problem: Summary was thin; outlets disagree on the real-world basis; UE variant unnoted.
- Evidence: theGamer: "the Klose K-17 pistol… held by Lucia since it's her preferred
  handgun. It looks a lot like the Bersa Thunder 380." beebom: "Klose K17… based on
  the Glock… With the Ultimate Edition, you get the Lucia personalized variant."
  noobfeed: "Lucia each get their own custom handgun as part of the Ultimate Edition
  content, the Klose K17".
- Correction: `summary` → `"Lucia's preferred handgun, per public reporting on trailers and promo material — the Ultimate Edition adds a personalized variant for her. (Outlets differ on the real-world basis: Glock 17 vs Bersa Thunder 380.)"`

### girardi-es9 (weapons)
- Problem: UE personalized variant unnoted.
- Evidence: theGamer: "Jason's signature handgun in the game seems to be the Girardi
  ES9… inspired by the Beretta 92FS." beebom: "Pre-ordering the GTA 6 Ultimate Edition
  gets you a personalized variant of this firearm for Jason."
- Correction: `summary` → `"Jason's signature handgun in promo material — Beretta-style, in-world branded. The Ultimate Edition adds a personalized engraved variant for Jason."`

### grenade-launcher (weapons)
- Problem: Detail generic; the launcher is specifically a revolving type per reporting.
- Evidence: Dexerto GTA 6 wiki: "there is a revolving grenade launcher that players can
  get their hands on… going by this brief clip".
- Correction: `evidence.detail` → `"Revolving grenade launcher seen in official footage (public reporting)"`. Summary unchanged.

### rpg (weapons)
- Problem: Detail vague about what "reported from trailer analysis" means; keep
  `leak-reported` but be precise.
- Evidence: Dexerto GTA 6 wiki: "Though an RPG hasn't been shown just yet, there is a
  revolving grenade launcher". arynews lists "Grenade Launcher, RPG" among heavies
  (single-outlet claim, low rigor). The Sept 2022 dev-footage leak item lists included
  "RPG (Rocket Launcher)" — an early-build list, subject to change.
- Correction: keep `evidence.status` → `"leak-reported"`, `evidence.detail` →
  `"Reported by some trailer analysts but not clearly shown in any official trailer — Dexerto's GTA 6 wiki notes it 'hasn't been shown just yet' (public reporting)"`.
  Summary unchanged (already hedged as rumor).

### baseball-bat (weapons)
- Problem: Summary implied player wieldability ("the definitive close-range statement").
- Evidence: screenrant: "one of the GTA 6 Port Gellhorn screenshots features a baseball
  bat-wielding man, and it's anyone's guess as to whether or not Jason and/or Lucia
  will be able to wield one, too."
- Correction: `summary` → `"The timeless Vice City classic — a bat-wielding figure appears in the Port Gellhorn screenshot, though whether players can wield one is unconfirmed pre-launch."`

### pool-cue (weapons)
- Problem: Summary implied availability ("Leonida's nightlife supplies its own arsenal").
- Evidence: screenrant: "a screenshot of GTA 6's Cal Hampton depicts him and Jason
  playing billiards, and it's unknown if the pool cue will be a potential weapon or
  merely a cutscene prop."
- Correction: `summary` → `"Bar-room classic from the billiards scene with Cal Hampton — possibly a cutscene prop; wieldability unconfirmed pre-launch."`

---

## Character records

### cal-hampton / boobie-ike / drequan-priest / real-dimez / raul-bautista (characters)
- Problem: Under-labeled `trailer-confirmed`; all five were named in Rockstar's official
  character bios — primary Rockstar material, same tier as official site copy that the
  locations audit treated as rockstar-confirmed.
- Evidence: VGC (May 2026): full official-bio quotes for Cal, Boobie, Dre'Quan,
  Real Dimez, Raul, and Brian Heder. PC Gamer: "His official bio describes him…".
  livemint: "the description by Rockstar says…". aram1990 trailer-2 breakdown:
  "Rockstar has published official profiles for its core supporting cast, including
  Jason, Lucia, Cal, Boobie, Dre'Quan, Real Dimez, Raul and Brian."
- Correction: all five → `evidence.status` `"rockstar-confirmed"`, `evidence.detail` →
  `"Named in Rockstar's official character bios (May 2026); seen in Trailer 2 (public reporting)"`.
  The shared `T2` constant was removed (no longer used).

### raul-bautista (characters)
- Problem: Summary contained an unverified speculative claim — "may be the reason
  Jason and Lucia's paths crossed" appears in no official bio or reputable reporting.
- Evidence: VGC quoting the official bio: Raul is "a seasoned bank robber 'always on
  the hunt for talent ready to take the risks that bring the biggest rewards'" and
  "Raul's recklessness raises the stakes with every score." No source ties him to how
  Jason and Lucia met.
- Correction: `summary` → `"A veteran bank robber always hunting for new talent — and getting more reckless with every score, per his official bio."`

### real-dimez (characters)
- Problem: Summary omitted the members' names and label — basic facts from the bio.
- Evidence: VGC: "Bae-Luxe and Roxy aka Real Dimez have been friends since high school…
  signed to Only Raw Records". Medium roundup: "Bae-Luxe and Roxy — Known together as
  'Real Dimez,' a rap duo signed to Only Raw Records."
- Correction: `summary` → `"Bae-Luxe and Roxy — a rap duo chasing viral fame in Leonida's music scene, signed to Only Raw Records after an early hit with DWNPLY."`

---

## Minor polish (applied)

- **molotov** (weapons): detail → `"Seen on the Extended Look's weapon wheel (public reporting)"`
  (allthings.how: "Occupies the explosives slot on the weapon wheel at a count of 1").
- **knife** (weapons): summary → `"Switchblade-style knife from trailer coverage — the quiet option. A switchblade also appears in the Ultimate Edition revolvers promo art; unclear whether it is UE-linked (public reporting)."`
  (screenrant: "The GTA 6 Ultimate edition Morgan & Little Hawk revolvers image also features a switchblade knife… undetermined if this knife is also paywalled by the Ultimate edition.")
- **cal-hampton** (characters): summary → `"Conspiracy theorist, Jason's friend, and fellow associate of Brian Heder — the guy who sees patterns in everything, including, probably, your last three missions."`
  (livemint: "Cal is introduced as Jason's friend and a fellow associate of Brian Heder.")

## Coverage gaps noticed (not errors — candidates for new records later)

**Weapons** (all from multi-outlet trailer/Extended Look reporting):
- **Speargun** — allthings.how + arynews list it for underwater combat (arynews: "Speargun for underwater combat").
- **Gold-plated AK-style rifle** — allthings.how: "Held during the lab cutscene" in the Extended Look; eldorado.gg: "Mini Draco (AK)… A short golden AK".
- **M249-inspired LMG / Combat MG** — screenrant "M249-inspired LMG"; allthings.how "Combat MG"; arynews "M249 SAW light machine gun also confirmed".
- **Benelli M4-style semi-auto shotgun** — screenrant "Benelli M4-inspired shotgun".
- **MAC-10-style SMG** — screenrant "MAC-10-inspired SMG".
- **Compact SMG** — allthings.how; also "Compact SMG" in the Sept 2022 leak item lists.
- **M1A-style marksman rifle / Hunter Sniper** — screenrant "M1A-inspired sniper rifle"; allthings.how "Hunter Sniper".
- **Heavy Pistol (M1911-style)** — beebom + arynews list a Heavy Pistol / M1911 variant.
- **Flashbang / Smoke Grenade** — allthings.how + arynews list both as throwables.
- **S&M DW9 SMG** — noobfeed only, from a leaked screenshot; single-source → unverifiable, do NOT add without corroboration.
- **Flashlight (melee)** — allthings.how lists it; weak as a standalone entity.

**Characters** (all named in Rockstar's official bios / Extended Look reporting):
- **Brian Heder** — official site bio ("classic drug runner from the golden age of smuggling in the Keys"; Brian's Boat Works & Marina; voiced by Stephen Root per AP News via iGrandTheftAuto, Sep 14, 2026). Jason's landlord/mentor — the most-wanted missing character.
- **Lori Heder** — named in Brian's official bio (third wife, co-runs the marina).
- **Stefanie** — Lucia's probation/correctional social worker (official materials).
- **Wyman** — eccentric collector/fixer behind the UE Classic Car Collection commission.
- **Phil** — Ammu-Nation shop owner (Extended Look).
- **Andrés de León** — media bigshot from the Extended Look bodyguard mission (thedailygame.news 99-details).

## GTADB staging spot-check (READ-ONLY — Track A owns these files)

Checked `web/src/modules/entities/data/gtadb/{locations,stores,others}.json` (510 named records).
No writes made.

1. **"Y Vice City" (locations, `gtadb-6-L16`, Vice Beach hotel)** — single odd-prefix name;
   looks like a source-dataset artifact ("Y " prefix). Recommend Track A verify against the
   source landmark name; likely should be "Vice City" or the name is truncated.
2. **Duplicate generic names across distinct pins** — different ids, same name, different
   districts. If these ever become pages they need district disambiguation:
   - locations: Construction Site, Water Tower, Parking Lot, Radio Mast, Cell Tower, Radio Tower, Tank, Bridge
   - stores: Gas Station (×n), Xero Gas Station (×n), Fleeca (×n)
   - others: Park, Lombank, Parking Garage, Repair & Salvage, Parking Lot, Pier, "84", Runway
   - "84" (others) and "Tank" (locations) are cryptic as standalone names.
3. **Healthy:** zero empty/"?" names in the named sets, zero duplicate slugs, all 510 records
   have coords, evidenceStatus↔confidence mapping is consistent (supported→leak-reported,
   unknown→disputed). needsCoordVerification already flagged on 181/300 locations,
   34/66 stores, 79/144 others — consistent with the transform report's far-region note.

## Method note

Verification used public web reporting only (outlet articles, wiki pages, edition roundups,
Extended Look breakdowns). No Discord content scraped; no leaked files downloaded or hosted.
Outlet disagreements are noted, not resolved by fiat (Klose K17 Glock vs Bersa basis).
Claims that could not be verified are marked "unverifiable" rather than corrected.
No stats, prices, spawn points, or gameplay facts were invented; none appear in the records.
