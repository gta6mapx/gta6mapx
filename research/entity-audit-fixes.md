# GTA6mapx Entity Audit — Fix List

**Auditor:** Subagent A (Entity Auditor)
**Date:** September 24, 2026
**Scope:** all 76 entity records — 48 vehicles + 28 locations — in
`web/src/modules/entities/data/vehicles.ts` and `web/src/modules/entities/data/locations.ts`.
Files were NOT edited (read-only task). This file lists exact corrections to apply.

## Tally

- **Total records audited:** 76 (48 vehicles, 28 locations)
- **Records with substantive problems:** 42 (23 vehicles, 19 locations)
- **Records with wording-similarity notes only:** 7 (vehicles, see cross-record note)
- **Fully clean records:** 27 (18 vehicles, 9 locations)

**Clean vehicles (18):** declasse-granger-3600lx, pfister-growler, annis-hellion, pegassi-infernus-classic, karin-intruder, grotti-itali-gto, enus-jubilee, ocelot-jugular, dundreary-landstalker-xl, bravado-bison, declasse-burrito, ubermacht-cypher, gallivanter-baller-st-d, albany-cavalcade-xl, brute-ambulance, vapid-minivan, karin-kuruma, declasse-granger

**Clean locations (9):** vice-city, leonida-keys, grassrivers, port-gellhorn, ambrosia, mount-kalaga-national-park, vice-beach, ocean-drive, vice-city-port

## Cross-record notes (apply everywhere relevant)

### A. Stale file-header comment in locations.ts
The comment block at the top of `locations.ts` says the five counties and offshore keys "come from the Aug 2026 CYBERLEEK map leak whose authenticity was disputed." That is now stale: four of the five counties plus the four named keys/islands have since been corroborated by official material (see per-record evidence below). Only Lummox County remains leak-only. **Correction:** rewrite the comment to say the counties/keys were first surfaced in the Aug 2026 CYBERLEEK map leak and all but Lummox have since been corroborated by official trailers, screenshots, road signs, or site copy — Lummox stays disputed.

### B. Evidence-detail wording closely mirrors theGamer's "Confirmed Via" column
The following records' `evidence.detail` strings are near-verbatim paraphrases of the "Confirmed Via" column in theGamer's "Every Vehicle Revealed So Far For GTA 6" list (e.g. "Promotional Screenshots on GTA 6's website", "Promotional Screenshots for Vice City, Leonida Keys, and Grassrivers", "Has its own designated promotional screenshot for GTA 6's Ultimate Edition"). The underlying facts check out, but the wording should be rewritten in the site's own voice to avoid copy-similarity. Affected slugs: `jobuilt-hauler`, `declasse-impaler-sz`, `zirconium-journey-ii`, `canis-kamacho`, `declasse-mamba-gt`, `albany-manana`, `albany-manana-custom`, `canis-mesa`, `mtl-packer`, `enus-paragon-r`, `jobuilt-phantom`, `obey-tailgater-s` (detail only). **Correction (blanket):** rephrase each detail in original words, e.g. "Promotional screenshots on GTA 6 website" → "Seen in official promo screenshots on the GTA 6 website". The same applies to the leak-section details ("Gameplay leak — highway traffic", "Gameplay leak — parking lot scene"), which mirror the "Where it shows up" column of allthings.how's gameplay-leak vehicle breakdown — rephrase to original wording such as "Identified in leaked gameplay footage of highway traffic (public reporting)".

### C. "JoBuilt" vs "Jobuilt" spelling
Three records use manufacturer "JoBuilt" (jobuilt-hauler, jobuilt-phantom, jobuilt-phantom-custom). Series canon (GTA V) spells it "Jobuilt"; the detailed allthings.how leak breakdown also uses "Jobuilt". theGamer uses "JoBuilt" for its GTA 6 list, so either could reflect new GTA 6 branding. **Correction:** verify against a trailer screenshot showing the truck branding; until then prefer series-canon "Jobuilt" — i.e. change `manufacturer: "JoBuilt"` → `manufacturer: "Jobuilt"` in all three records unless the GTA 6 logo is confirmed as "JoBuilt".

---

## Vehicle records

### schyster-pmp-700 (vehicles)
- Problem: Wrong trailer attribution; name presented as fact while summary says unconfirmed.
- Evidence: GTA Wiki and theGamesWiki both place the green PMP 700 lowrider in **Trailer 1** (Stockyard car meet); theGamer lists "First Trailer and Promotional Screenshots for Port Gellhorn". No outlet puts it in Trailer 2. The name "PMP 700" is analyst-assigned (successor to GTA IV's PMP 600), never used by Rockstar.
- Correction: `evidence.detail` → `"Spotted in Trailer 1 — green lowrider at the Stockyard car meet (public reporting)"`. `summary` → `"Two-door sports coupe — a Mamba for the modern era."` is the wrong record; for this record use: `"All-new Schyster sedan identified by analysts in Trailer 1's car-meet scenes. The PMP 700 name is analyst-assigned, unconfirmed by Rockstar."`

### vapid-ganado (vehicles)
- Problem: Under-labeled. Marked `leak-reported`, but Rockstar has confirmed it.
- Evidence: Multiple outlets (allthings.how, sportskeeda) report Rockstar has confirmed the Vapid Ganado as Jason's main vehicle; Rockstar's official Ultimate Edition product copy names "Jason's Vapid Ganado pickup" (exclusive mods offered for it). The Aug 2026 leaked gameplay clips corroborate.
- Correction: `evidence.status` → `"rockstar-confirmed"`, `evidence.detail` → `"Rockstar-confirmed as Jason's main vehicle; also seen in Aug 2026 leaked gameplay"`. `summary` → `"Jason Duvall's personal ride — a new Vapid muscle pickup confirmed by Rockstar as his main vehicle, also seen in leaked gameplay footage."` Remove "unverified".

### karin-woodlander (vehicles)
- Problem: `isNewModel: true` is wrong — it is a returning model.
- Evidence: GTA Wiki documents the Karin Woodlander as a GTA Online vehicle (Money Fronts update), based on the Subaru Forester. It is not new to the series.
- Correction: `isNewModel` → `false`. `summary` → `"Karin SUV identified in leaked highway-traffic footage. Returning model from GTA Online. Unverified."`

### vapid-police-cruiser-interceptor (vehicles)
- Problem: `isNewModel: true` is unverifiable; no outlet confirms an "Interceptor" variant is new.
- Evidence: Leak breakdowns list a "Police Cruiser (Interceptor)" among ambient traffic in the Aug 2026 footage, alongside mostly returning GTA 5/Online vehicles. No source confirms it is a new model vs a variant of existing police cruisers.
- Correction: `isNewModel` → `false`, and append to summary: `"Whether the Interceptor variant is new is unconfirmed."` Suggested summary: `"Police interceptor variant seen pursuing in leaked footage. Expect it at higher wanted levels — unverified; whether the variant is new is unconfirmed."`

### vapid-caracara (vehicles)
- Problem: Under-labeled as `leak-reported`; it is visible in Trailer 1.
- Evidence: fdaytalk's Trailer 1 breakdown lists "Vapid Caracara 4×4 (spotted near the lifeguard area on Vice Beach)". It also appears in the Aug 2026 leak's ambient traffic.
- Correction: `evidence.status` → `"trailer-confirmed"`, `evidence.detail` → `"Trailer 1 opening traffic, near the Vice Beach lifeguard area (publicly reported); also in Aug 2026 leaked gameplay"`. `summary` → `"Off-road pickup spotted in Trailer 1's beachfront traffic."`

### obey-tailgater-s (vehicles)
- Problem: Under-labeled as `leak-reported`; it appears in official promo screenshots.
- Evidence: theGamer's confirmed list: "Tailgater S | Obey | Sedans | 4-Door Sedan | Promotional Screenshots on GTA 6's website". Also identified in the Aug 2026 leak's ambient traffic (allthings.how).
- Correction: `evidence.status` → `"trailer-confirmed"`, `evidence.detail` → `"Official promo screenshots on the GTA 6 website (public reporting); also in Aug 2026 leaked gameplay"`. `summary` → `"Sport sedan variant seen in official website screenshots."`

### vapid-dominator-gt (vehicles)
- Problem: Under-labeled as `leak-reported`; it appears in official Extended Look footage.
- Evidence: GTAForums' GTA VI vehicle database logs the Vapid Dominator GT in the official Extended Look (multiple timestamps) and an Ambrosia screenshot. allthings.how also lists it in the Aug 2026 leak's highway traffic.
- Correction: `evidence.status` → `"trailer-confirmed"`, `evidence.detail` → `"Visible in the official Extended Look and an Ambrosia screenshot (public reporting)"`. `summary` → `"Track-focused Dominator variant seen in official Extended Look footage."`

### grotti-cheetah-95 (vehicles)
- Problem: Wrong status — marked `trailer-confirmed`, but this is officially announced Ultimate Edition content.
- Evidence: Rockstar officially announced the Ultimate Edition (June 24–25, 2026; $99.99): the '95 Grotti Cheetah is listed across invenglobal, consequence.net, thesource.com, sirusgaming, newswav as UE content.
- Correction: `evidence.status` → `"rockstar-confirmed"`, `evidence.detail` → `"Officially announced as Ultimate Edition content (June 2026)"`. `summary` → `"Classic Cheetah locked behind the Ultimate Edition, per Rockstar's official edition announcement. A '90s icon returns."` Keep `ultimateEditionExclusive: true`.

### schyster-deviant (vehicles)
- Problem: Wrong status — marked `trailer-confirmed` with vague detail; it is officially announced UE content.
- Evidence: gta6bible, gtabase, and gtabites all confirm the Schyster Deviant is part of the Ultimate Edition's Classic Car Collection (a Wyman commission to track down and restore project cars; the UE-specific version carries an American-flag livery). GTAForums logs it in official UE screenshots.
- Correction: `evidence.status` → `"rockstar-confirmed"`, `evidence.detail` → `"Officially announced as Ultimate Edition content — Wyman's Classic Car Collection (June 2026)"`. `summary` → `"Modern muscle coupe in the Ultimate Edition's Classic Car Collection, restored via Wyman's commission. The base model may also appear in the standard game."` Keep `ultimateEditionExclusive: true` (for the UE version).

### vapid-dominator-buggy-67 (vehicles)
- Problem: Wrong status — marked `trailer-confirmed`; officially announced UE content.
- Evidence: Every edition roundup (consequence.net via IGN, newswav, thesource.com) lists the '67 Vapid Dominator Buggy as Ultimate Edition content.
- Correction: `evidence.status` → `"rockstar-confirmed"`, `evidence.detail` → `"Officially announced as Ultimate Edition content (June 2026)"`. `summary` → `"Vintage dune buggy exclusive to the Ultimate Edition, per Rockstar's official edition announcement."` Keep `ultimateEditionExclusive: true`.

### dinka-enduro (vehicles)
- Problem: Wrong status — marked `trailer-confirmed`; officially announced UE content.
- Evidence: newswav and the aaronshenny edition roundup list the Dinka Enduro motorcycle among officially announced Ultimate Edition vehicles.
- Correction: `evidence.status` → `"rockstar-confirmed"`, `evidence.detail` → `"Officially announced as Ultimate Edition content (June 2026)"`. `summary` → `"Dirt bike exclusive to the Ultimate Edition, per Rockstar's official edition announcement."` Keep `ultimateEditionExclusive: true`.

### shitzu-squalo (vehicles)
- Problem: Wrong status — marked `trailer-confirmed`; officially announced UE content.
- Evidence: consequence.net, thesource.com, newswav all list the Shitzu Squalo speedboat as officially announced Ultimate Edition content.
- Correction: `evidence.status` → `"rockstar-confirmed"`, `evidence.detail` → `"Officially announced as Ultimate Edition content (June 2026)"`. `summary` → `"Speedboat exclusive to the Ultimate Edition, per Rockstar's official edition announcement — Leonida Keys ready."` Keep `ultimateEditionExclusive: true`.

### vapid-stanier-55 (vehicles)
- Problem: Two errors — (1) `ultimateEditionExclusive: true` is wrong; (2) status should be rockstar-confirmed.
- Evidence: The '55 Vapid Stanier is the **Vintage Vice City Pack pre-order bonus** (all pre-orders before Nov 20, 2026, any edition), not an Ultimate Edition exclusive — reported by invenglobal, consequence.net, thesource.com, sirusgaming, newswav.
- Correction: remove `ultimateEditionExclusive: true`. `evidence.status` → `"rockstar-confirmed"`, `evidence.detail` → `"Vintage Vice City Pack pre-order bonus, officially announced (June 2026)"`. `summary` → `"'50s sedan from the Vintage Vice City Pack pre-order bonus — available with any pre-ordered edition, not Ultimate Edition exclusive."` Tags: replace `"ultimate-edition"` with `"pre-order-bonus"`.

### unknown-mustang-style-muscle (vehicles)
- Problem: Under-labeled — `leak-reported`, but the detail itself says it is from Trailer 2 scenes.
- Evidence: GTA Wiki's trailer vehicle catalog lists a "Ford Mustang-inspired car" among new muscle cars; fdaytalk lists an "Unknown Ford Mustang variant (new)" in trailer night-city footage.
- Correction: `evidence.status` → `"trailer-confirmed"`, `evidence.detail` → `"Trailer night-city scenes — unidentified by analysts (public reporting)"`. Summary is fine ("No official name").

### unknown-aventador-style-supercar (vehicles)
- Problem: Under-labeled — `leak-reported`, but the detail itself says it is from Trailer 2.
- Evidence: allthings.how's new-vehicle table lists an "Unnamed Pegassi supercar" (Lamborghini Aventador basis) among new GTA 6 models.
- Correction: `evidence.status` → `"trailer-confirmed"`, `evidence.detail` → `"Trailer 2 Oceanview Road scene — unidentified by analysts (public reporting)"`. Add honesty note to summary: `"Unidentified Lamborghini-style supercar crossing the bridge in Trailer 2. No official name; analysts have not ruled out overlap with the bridge-scene Zorrusso/Furia."`

### maibatsu-penumbra (vehicles)
- Problem: Trailer number disputed between outlets; record states Trailer 1 as fact.
- Evidence: theGamer lists Penumbra under "First Trailer"; theGamesWiki's vehicle table lists it under "Trailer 2".
- Correction: `evidence.detail` → `"Spotted in official trailer footage (public reporting; outlets differ on Trailer 1 vs 2)"`.

### karin-vivanite (vehicles)
- Problem: `vclass: "SUV"` conflicts with outlet classification.
- Evidence: allthings.how's leak breakdown lists the Karin Vivanite as a **Sedan** in highway traffic. (Note: that table also loosely labels the Kuruma a sedan, so it is not authoritative.)
- Correction: unverifiable pre-launch — keep `"SUV"` but flag: no change required, or add to summary `"(class unconfirmed pre-launch)"`. Recommended: leave vclass, no summary change; revisit after launch.

### brute-boxville (vehicles)
- Problem: Summary undersells a verified detail — it is specifically a postal/mail van.
- Evidence: allthings.how: "the van used as the Post OP delivery vehicle in GTA Online"; the confrontation in the Aug 2026 clip is with a mail truck that rams Jason's Ganado.
- Correction: `summary` → `"Postal delivery van from the leaks — its driver reportedly picks a fight with Jason in leaked footage. Unverified."` Also note provenance: the clip was CYBERLEEK-branded (crypto ads) but DMCA-claimed by Take-Two.

### canis-kamacho (vehicles)
- Problem: Detail wording (see cross-record note B); detail can also be more informative.
- Evidence: theGamer notes its dedicated UE promo screenshot; gtabites lists the Kamacho in Wyman's Classic Car Collection (Ultimate Edition content).
- Correction: `evidence.detail` → `"Dedicated promotional screenshot for the Ultimate Edition (public reporting); listed in Wyman's Classic Car Collection"`. Summary: remove "Kelly County" only if counties edit is pending — Kelly County is now confirmed, so the summary is fine as-is.

### declasse-mamba-gt (vehicles)
- Problem: Detail wording (see cross-record note B); detail can be more informative.
- Evidence: gtabites lists the Mamba GT in Wyman's Classic Car Collection (Ultimate Edition); GTA Wiki's trailer catalog lists "Mamba GT" as a new sports car.
- Correction: `evidence.detail` → `"Ultimate Edition promotional screenshots (public reporting); listed in Wyman's Classic Car Collection"`. Do NOT set `ultimateEditionExclusive` — outlets note the base model may appear in the standard game.

---

## Location records

### ocean-beach (locations)
- Problem: Under-labeled as `trailer-confirmed`; Rockstar names it in official copy.
- Evidence: gtabase's GTA 6 map page (descriptions "released directly by Rockstar Games") quotes the official Vice City description: "the pastel art deco hotels and bright white sands of Ocean Beach". Beebom and theGamesWiki list it as confirmed.
- Correction: `evidence.status` → `"rockstar-confirmed"`, `evidence.detail` → `"Named in Rockstar's official Vice City description"`.

### vice-city-international-airport (locations)
- Problem: Summary contains an unverifiable claim: "public reporting suggests Rockstar scaled planes close to real life."
- Evidence: The only source found is a single Reddit user's observation (Lucia fitting in a landing-gear compartment, May 2026). That is not "public reporting" at a reliable level.
- Correction: `summary` → `"Enormous international airport — one of Leonida's signature locations."` (drop the plane-scaling claim; re-add after launch with a real source).

### malibu-club (locations)
- Problem: Wrong status — marked `trailer-confirmed` ("Visible in Trailer 1 — returning location"), but it is not in any trailer.
- Evidence: theGamesWiki (updated ~27 days ago) states explicitly: the Malibu Club "has not been confirmed to appear in Grand Theft Auto VI. Rockstar has never named the venue in an official announcement, it does not appear in any published screenshot gallery, and it was not shown or mentioned in the August 2026 Extended Look. Claims that the club returns trace back to a list of world locations taken from the September 2022 leak." (Older outlets like Beebom did claim a Trailer 1 sighting, but the newer rigorous wiki refutes it.)
- Correction: `evidence.status` → `"leak-reported"`, `evidence.detail` → `"September 2022 leak location list; not shown in any official trailer or screenshot (public reporting)"`. `summary` → `"The legendary Vice City nightclub — rumored to return based on the September 2022 leak lists. Not spotted in any official material; unconfirmed."` Tags: replace `"landmark"` keep, add `"rumor"`; consider removing `"returning"` or keep with the rumor tag.

### monument-of-leonida (locations)
- Problem: Wrong status — marked `trailer-confirmed` ("Promotional material") with no verifiable sighting.
- Evidence: RockstarINTEL lists "Monument Of Leonida" under "Older Locations revealed in 2022 leaks" (road-sign/menu text). No outlet documents it in any trailer, screenshot, or promo. (Beebom marks it "Confirmed" but cites no sighting; the leak-document trail is the verifiable provenance.)
- Correction: `evidence.status` → `"leak-reported"`, `evidence.detail` → `"September 2022 leak location lists (road sign/menu); not seen in official material"`. `summary` → `"Grand state monument named in September 2022 leak materials. No trailer or screenshot sighting — unconfirmed."`

### little-haiti (locations)
- Problem: Under-labeled as `leak-reported` ("Rumored"); it is in official location lists.
- Evidence: gtabase's GTA 6 map page includes Little Haiti among confirmed Vice-Dale County locations (descriptions released directly by Rockstar); theGamesWiki lists "La Perle / Little Haiti" as a Vice City district; allthings.how lists it with Haitian-themed murals seen in official material.
- Correction: `evidence.status` → `"trailer-confirmed"`, `evidence.detail` → `"Named in official location descriptions and screenshots (public reporting)"`. `summary` → `"Neighborhood with Caribbean flavor — Haitian-themed murals and street-level detail seen in official material."` Tags: drop `"rumor"`.

### leaf-links (locations)
- Problem: Under-labeled as `leak-reported` ("Rumored"); publicly reported from official material.
- Evidence: allthings.how lists Leaf Links among Vice-Dale place names that have surfaced (official screenshots/gameplay); wikigtavi lists it as a landmark confirmed through trailers and official artwork; theGamesWiki includes it in the Vice-Dale County district table.
- Correction: `evidence.status` → `"trailer-confirmed"`, `evidence.detail` → `"Named in official screenshots and location lists (public reporting)"`. `summary` → `"Golf-course islands returning from Vice City, per official location lists."` Tags: drop `"rumor"`, keep `"returning"`, `"golf"`, `"islands"`.

### washington-beach (locations)
- Problem: Under-labeled as `leak-reported` ("Rumored"); named in official product copy.
- Evidence: theGamesWiki: "named in the Ultimate Edition copy as the docking point for the edition's Shitzu Squalo boat"; allthings.how: "Beachfront district named on screen during gameplay".
- Correction: `evidence.status` → `"rockstar-confirmed"`, `evidence.detail` → `"Named in official Ultimate Edition product copy (Shitzu Squalo docking point) and on-screen in gameplay"`. `summary` → `"Beach district north of Ocean Beach — named in Rockstar's official Ultimate Edition copy as the Shitzu Squalo's docking point."` Tags: drop `"rumor"`.

### vercetti-estate (locations)
- Problem: Under-labeled as `leak-reported` ("Rumored return"); named in official product copy.
- Evidence: theGamesWiki: "Named in Official Edition Descriptions — Vercetti Estate: a property described as the source of the classic Vice City styling on the Hawk & Little Morgan Revolvers" (Ultimate Edition copy).
- Correction: `evidence.status` → `"rockstar-confirmed"`, `evidence.detail` → `"Named in official Ultimate Edition product copy (revolver styling description); location not shown"`. `summary` → `"Tommy Vercetti's mansion — named in Rockstar's official Ultimate Edition copy as the inspiration for the Hawk & Little Morgan revolvers' styling. Not shown on-screen; enterability unconfirmed."` Tags: drop `"rumor"`, keep `"returning"`, `"landmark"`.

### starlet-motel (locations)
- Problem: Under-labeled as `leak-reported`; it appears across both trailers and official art.
- Evidence: GTA Wiki: first seen in Sept 2022 leak clips, then officially in Trailer 1 (1:12), Trailer 2 (1:54 and 2:25), an official Port Gellhorn screenshot, and official artwork. gtabase lists it among confirmed safehouses; theGamesWiki Port Gellhorn page confirms both-trailer appearances.
- Correction: `evidence.status` → `"trailer-confirmed"`, `evidence.detail` → `"Trailers 1 & 2, official Port Gellhorn screenshot and official artwork (public reporting)"`. `summary` → `"Run-down motel complex in Port Gellhorn — Jason and Lucia's 'Trust? — Trust' scene. Functions as an early safehouse/meeting point per public reporting."` Tags: drop `"rumor"`, add `"safehouse"`. Note: the "Abandoned" framing is fine ("run-down" per outlets); also the record's region Port Gellhorn is corroborated (Kelly County).

### jasons-safehouse (locations)
- Problem: Under-labeled as `leak-reported`; the house is in Trailer 2 and named in official edition copy.
- Evidence: Trailer 2 opens on the waterfront stilt house (gamerant, timesofindia); gtabase's property page documents it as the Leonida Keys safehouse in Key Lento, belonging to Brian Heder; Rockstar's official UE copy references "Jason's safehouse" (Crest Kayak, Ganado mods). The basketball-hoop/Focus-stat detail comes from the Aug 2026 CYBERLEEK-branded leaked clips (digitaltrends, thedrive).
- Correction: `evidence.status` → `"trailer-confirmed"`, `evidence.detail` → `"Trailer 2 waterfront house; named 'Jason's safehouse' in official Ultimate Edition copy"`. `summary` → `"Waterfront stilt house in the Leonida Keys — Jason's starting safehouse, seen in Trailer 2 and named in Rockstar's official edition copy. (Balcony, jetski, basketball hoop reported across trailers and leaked clips.)"` Tags: keep `"safehouse"`, `"jason"`; drop any rumor framing.

### vice-dale-county → rename to vice-dale-county (locations)
- Problem: Wrong name spelling AND wrong status. Record is "Vice Dale County" / `disputed`; official name is "Vice-Dale County" and it is officially confirmed.
- Evidence: "Vice-Dale County" was spotted on an official police seal in Trailer 1 (0:28, news broadcast scene) — documented by the GTA VI mapping-project research; official site copy places "Vice City (Vice-Dale County)" (grownewsus); gtabase lists "Vice-Dale County: Confirmed". (Slug becomes `vice-dale-county` via existing slugify.)
- Correction: `name` → `"Vice-Dale County"`. `evidence.status` → `"rockstar-confirmed"`, `evidence.detail` → `"Official county name — seen on a police seal in Trailer 1 (0:28) and in Rockstar's official site copy"`. `summary` → `"The county around Vice City — Miami-Dade's in-universe counterpart, confirmed by name in Trailer 1's police seal and official site copy."` Tags: replace `"disputed-leak"` with `"county"`.

### leonard-county (locations)
- Problem: Wrong status — `disputed`; confirmed via official footage road signs.
- Evidence: theGamesWiki: "confirmed from the in-game road signs"; gtabase lists "Leonard County: Confirmed"; allthings.how: "confirmed from in-game road signs". (Note: the name also appeared in 2022-leak road signs, but the confirmation is from official gameplay footage.)
- Correction: `evidence.status` → `"trailer-confirmed"`, `evidence.detail` → `"Confirmed via in-game road signs in official footage (public reporting)"`. `summary` → `"Eastern county — confirmed by name on road signs in official gameplay footage. Details still thin."` Tags: replace `"disputed-leak"` with `"county"`. Keep or drop sourceUrl (thegamepost leak article is now a secondary source; consider dropping).

### kelly-county (locations)
- Problem: Wrong status — `disputed`; named in official site copy.
- Evidence: grownewsus (sourcing official setting materials): "Port Gellhorn (Kelly County)". gtabase: "Kelly County: Confirmed". Beebom: "Kelly County | Confirmed | County".
- Correction: `evidence.status` → `"rockstar-confirmed"`, `evidence.detail` → `"Named in Rockstar's official region copy — Port Gellhorn (Kelly County)"`. `summary` → `"Western county of open land — named in official site copy as Port Gellhorn's county. High-speed chase territory."` Tags: replace `"disputed-leak"` with `"county"`.

### mariana-county (locations)
- Problem: Wrong status — `disputed`; confirmed via road signs per public reporting.
- Evidence: gtabase lists "Mariana County: Confirmed"; grownewsus: "Road signs confirm counties like Leonard, Mariana". (First surfaced as a new name in the CYBERLEEK map leak; since corroborated.)
- Correction: `evidence.status` → `"trailer-confirmed"`, `evidence.detail` → `"First surfaced in the Aug 2026 map leak; since confirmed via in-game road signs (public reporting)"`. `summary` → `"Southern wetlands county with an isolated airstrip — confirmed by road signs in official footage after first surfacing in the map leak."` Tags: replace `"disputed-leak"` with `"county"`, `"wetlands"`.

### lummox-county (locations)
- Problem: Status `disputed` is still defensible, but the detail/summary are stale — sibling counties from the same leak are now confirmed, which changes the picture.
- Evidence: Lummox was one of five counties in the CYBERLEEK map image; Vice-Dale, Kelly, Leonard, and Mariana have since been corroborated by official material, but Lummox has "not surfaced in any prior trailer or in the work of the fan-run mapping project" (godisageek) and gtabase lists it as "Leaked" (not confirmed). The leak file was technically found edited with crypto branding (godisageek; locations.ts comment).
- Correction: keep `evidence.status` → `"disputed"`, but update `evidence.detail` → `"CYBERLEEK map leak, Aug 2026 — the only named county from that leak still unconfirmed in official material; file was found edited with crypto branding"`. `summary` → `"Alleged northern forest county — the one county from the disputed map leak that never appeared in any official material or the fan mapping project. Highly questionable."` (Keep the crypto-branding note; it is verified reporting.)

### catalan-key (locations)
- Problem: Wrong status — `disputed`; publicly reported from official material.
- Evidence: thegamepost's close-up reporting describes Catalan Key from the leak, but theGamesWiki's Vice-Dale County district table and allthings.how's Vice-Dale place-name list include Catalan Key among names surfaced via official screenshots/gameplay. (Also "Catalan Bay" was named in the same close-ups — not in our dataset; see gaps.)
- Correction: `evidence.status` → `"trailer-confirmed"`, `evidence.detail` → `"Named in official screenshots and location lists (public reporting)"`. `summary` → `"Key with a large complex and circular structures, per public reporting on official close-up material."` Tags: replace `"disputed-leak"` with `"island"`.

### gloriana-key (locations)
- Problem: Wrong status — `disputed`; publicly reported from official material.
- Evidence: theGamesWiki lists Gloriana Key as a Vice-Dale district (Virginia Key analogue); allthings.how includes it among surfaced Vice-Dale place names; thegamepost describes the industrial key with storage tanks.
- Correction: `evidence.status` → `"trailer-confirmed"`, `evidence.detail` → `"Named in official screenshots and location lists (public reporting)"`. `summary` → `"Industrial key with storage tanks, per public reporting on official material."` Tags: replace `"disputed-leak"` with `"island"`, `"industrial"`.

### dalton-island (locations)
- Problem: Wrong status — `disputed`; publicly reported from official material.
- Evidence: theGamesWiki lists Dalton Island as a Vice-Dale district; community research reads it as the Fisher Island analogue; thegamepost describes the residential island with marina from close-ups.
- Correction: `evidence.status` → `"trailer-confirmed"`, `evidence.detail` → `"Named in official screenshots and location lists (public reporting)"`. `summary` → `"Residential island with a marina — read by the mapping community as the Fisher Island analogue."` Tags: replace `"disputed-leak"` with `"island"`.

### tequesta-retreat (locations)
- Problem: Wrong status — `disputed`; publicly reported from official material.
- Evidence: theGamesWiki includes Tequesta Retreat in its Vice-Dale County district table; allthings.how lists it among surfaced Vice-Dale place names.
- Correction: `evidence.status` → `"trailer-confirmed"`, `evidence.detail` → `"Named in official screenshots and location lists (public reporting)"`. `summary` → `"Retreat location in the Keys island chain, named in official location lists."` Tags: replace `"disputed-leak"` with `"island"`.

---

## Minor polish (not problems — optional)

- `vice-beach` (locations): detail could add "name established via Vice Beach Police Department livery in official screenshots (public reporting)" — currently just "Visible in Trailer 1".
- `vice-city-port` (locations): record says Trailer 2; playhub's breakdown shows port cranes in Trailer 1. Consider neutral "Spotted in official trailer footage (public reporting)".
- `ocean-drive` (locations): fine as-is.
- The six rockstar-confirmed regions (vice-city, leonida-keys, grassrivers, port-gellhorn, ambrosia, mount-kalaga-national-park) are all corroborated by Rockstar's official site copy — no changes needed. Note Port Gellhorn's real-world inspiration "Panama City, Florida" and Ambrosia's "Clewiston, Florida" check out against official setting write-ups.

## Coverage gaps noticed (not errors — candidates for new records later)

- UE/Classic-Car-Collection vehicles absent from the dataset: **Vapid Riata / Riata Classic** (UE promo screenshot), the teal **Sirius** coupe (Wyman's Classic Car Collection), **Crest Kayak** (UE, at Jason's safehouse). Also **Gallivanter Baller** (non-ST-D) and **Fire Truck** from the Aug 2026 leak breakdown.
- Confirmed locations absent: **Key Lento** (Leonida Keys district, Jason's safehouse), **Lake Leonida**, **NINE1NINE** club, **Ocean View Hotel**, **Catalan Bay**, **South Beach**, **Little Cuba**, **Stockyard**, **Hamlet**, **Ekanfinaka**, **Leonida Penitentiary**.
- Provenance note for all leak-section vehicle records: the Aug 2026 gameplay clips they derive from were released under the **CYBERLEEK** name with crypto ads/branding, but were DMCA-claimed by Take-Two (thedrive.com, digitaltrends) — "leak-reported" remains the right label; consider adding this provenance to the section comment in vehicles.ts.

## Method note

Verification used public web reporting only (outlet articles, wiki pages, edition roundups). No Discord content scraped; no leaked files downloaded or hosted. Claims that could not be verified are marked "unverifiable" above rather than corrected. Outlet disagreements (e.g. Penumbra Trailer 1 vs 2, theGamer vs theGamesWiki) are noted instead of resolved by fiat.
