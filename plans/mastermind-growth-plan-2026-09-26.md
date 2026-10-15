# GTA6mapx — Mastermind Growth Plan (26 Sept 2026)

## Executive Summary (10 lines)

1. Hamari map already reference-level features rakhti hai (filters, clusters, deep links, mini-game, found-tracking) — ab humein **copy nahi, lead** karna hai.
2. Phase 1 ke 3 quick wins: **SEO basics** (sitemap.xml + robots.txt jo missing hain), **6 region hub pages** (Vice City, Leonida Keys, Grassrivers, Port Gellhorn, Ambrosia, Mount Kalaga), aur **location pages par "nearby locations" internal linking**.
3. Naye features original design honge: route/trip planner, trailer scene locator (sirf official media), curated checklists, embed widget.
4. SEO mein koi guarantee nahi — honest timeline: naye pages 2–4 hafton mein index, competitive keywords par 3–6 mahine mehnat.
5. Data sirf **official sources** (trailers, screenshots, Rockstar announcements) se barhega — 517 named se 750+ ka target, leak material kabhi nahi.
6. GTADB CC BY 4.0 ka visible credit **launch se pehle lazmi** hai — yeh Husnain ka pending kaam hai, plan mein skip nahi hoga.
7. 2D canvas map default rahega — 3D par kaam alag feature flag ke peeche hoga, working map kabhi nahi tootega.
8. Har phase ke baad **testing checkpoint** (Husnain ki requirement), phir commit → push → Vercel deploy → production verify.
9. Codebase modular rahega: har naya feature `web/src/modules/` mein apne folder ke saath, single responsibility.
10. Authority backlinks ke liye: embed widget + Reddit/GTAForums mein genuine participation (spam nahi) + social clips.

---

## PLAN 1 — Naye Features (prioritized, phased)

> Note: Neeche sirf woh features hain jo **already nahi bane**. Category/evidence filters, shareable deep links (`modules/map/deepLink.ts`), mini-game (`/game/find-the-location`), found/not-found tracking (`FoundToggle` + `ProgressMeter`), mobile bottom sheet (`MobileSheet`), aur location detail pages (`/locations/[slug]`) — yeh sab maujood hain, inhein dobara nahi banayenge, sirf improve karenge.

### PHASE 1 — Abhi (aglay 2–3 haftay)

**QUICK WIN #1 — SEO basics fix (effort: small)**
- Kya hai: `sitemap.xml` aur `robots.txt` is waqt project mein **missing** hain (verify ho chuka). Inhein add karna, har location page par canonical URL, aur OG/Twitter card images.
- Faida: Google ko 147 pages dhoondhne mein aasani — bina iske ranking ki baat bekaar hai.
- Files: `web/src/app/sitemap.ts` (naya), `web/public/robots.txt` (naya), `web/src/modules/seo/jsonld.ts` (extend).

**QUICK WIN #2 — 6 region hub pages (effort: small–medium)**
- Kya hai: Rockstar ke 6 officially confirmed regions ke dedicated pages: Vice City, Leonida Keys, Grassrivers, Port Gellhorn, Ambrosia, Mount Kalaga National Park. Har page par: region ka intro (sirf official wording se), us region ke locations ki list (map se linked), chhota map embed.
- Faida: Yeh woh keywords hain jo log search karte hain ("gta 6 vice city map") — aur content 100% official sources se, safe.
- Files: `web/src/app/regions/[slug]/page.tsx` (naya), data `web/src/modules/entities/data/regions.ts` (naya).

**QUICK WIN #3 — "Nearby locations" internal linking (effort: small)**
- Kya hai: Har `/locations/[slug]` page ke neeche "Aas-paas ki jaghein" section — `relatedEntities` helper already hai, sirf UI section add karna hai.
- Faida: User zyada pages dekhta hai + Google pages ko aapas mein jorta hai (internal linking SEO ka fuel hai).
- Files: `web/src/app/locations/[slug]/page.tsx` (extend).

**Feature 4 — Trailer Scene Locator, v1 (effort: medium)**
- Kya hai: Official trailers (T1/T2) ke key scenes ki list — har scene par click karo to map us approximate location par fly kare, saath citation ("Trailer 2, 1:08"). Video host nahi karenge — Rockstar ke YouTube se link hoga. Koi footage rip nahi, koi leak nahi.
- Faida: Reference site ke "trailer markers" jaisa faida, lekin hamara original design aur sirf official media.
- Files: `web/src/modules/map/features/sceneLocator/` (naya folder: `SceneLocatorPanel.tsx`, `scenes.ts` data, `useSceneFlyTo.ts`).

### PHASE 2 — Next (1–2 mahine)

**Feature 5 — Route / Trip Planner (effort: medium)**
- Kya hai: User 2+ pins select kare ("Add to trip") → map par route line bane, total distance nikle, trip ka shareable link bane. LocalStorage mein save ho.
- Faida: Koi fan map yeh nahi deta — hamara differentiator banega. Social par share hone wali cheez.
- Files: `web/src/modules/map/features/tripPlanner/` (naya: `TripPlannerPanel.tsx`, `routeMath.ts`, `tripShare.ts`).

**Feature 6 — Curated Checklists / Collections (effort: small–medium)**
- Kya hai: Ready-made lists jaise "Vice City Beach Tour — 12 spots", "Har region ki 1 must-see jagah". User checklist tick kare, progress save ho (FoundToggle wale system se jorenge).
- Faida: Wapas aane ki wajah (retention) + shareable content.
- Files: `web/src/modules/engagement/collections/` (naya), data file `collections.ts`.

**Feature 7 — Embed Widget (effort: medium)**
- Kya hai: Doosri sites hamara map embed kar saken (`gta6mapx.vercel.app/embed?pin=...`) — chhota attribution badge lazmi ke saath.
- Faida: Har embed = hamari taraf backlink = SEO authority. Gaming blogs khud lagayenge.
- Files: `web/src/app/embed/page.tsx` (naya), `web/src/modules/map/components/EmbedChrome.tsx` (halka chrome).

**Feature 8 — Mini-game modes (effort: medium)**
- Kya hai: `/game/find-the-location` already hai — is mein 2 naye original modes: "Time Attack" (60 second mein zyada se zyada pins pehchano) aur "Region Quiz" (tasveer dikhao, region guess karo — sirf official screenshots se).
- Faida: Engagement + social sharing ("maine 8/10 score kiya").
- Files: `web/src/app/game/` ke neeche naye routes, `web/src/modules/engagement/game/` extend.

### PHASE 3 — Later (3+ mahine, launch ke baad)

**Feature 9 — Compare Overlay Tool (effort: large)**
- Kya hai: "Leonida vs Real Florida" outline overlay, ya "Vice City 2002 vs 2026" slider — hamare **khud ke banaye** simplified outlines se, kisi ka artwork uthaye baghair.
- Faida: Viral hone wali visual cheez; YouTubers khud cover karenge.
- Files: `web/src/modules/map/features/compare/` (naya).

**Feature 10 — Community submissions (effort: large)**
- Kya hai: `/submit` route already hai — isay moderation queue ke saath poora karo: user location suggest kare, evidence link de, admin approve kare tabhi pin bane. Launch ke baad jab players ke paas game hogi, yeh data ka engine banega.
- Files: `web/src/app/submit/` extend + `web/src/modules/community/` extend.

**Feature 11 — Public read API (effort: medium)**
- Kya hai: `/api/locations` — doosre developers hamara data (attribution ke saath) use kar saken.
- Faida: Authority + ecosystem; CC BY 4.0 ki spirit ke mutabiq.
- Note: Sirf tab jab GTADB attribution site par visible ho — us se pehle nahi.

---

## PLAN 2 — SEO & Ranking Plan (honest, koi guarantee nahi)

> Seedhi baat: koi bhi "fast rank" ka wada jhoot hai. Neeche woh kaam hai jo **asal mein** ranking banata hai, aur uska honest timeline.

### A. Technical SEO (pehle 2 haftay — bunyaad)

1. **sitemap.xml + robots.txt** — missing hain, foran add karo (Quick Win #1). Saare 147+ pages sitemap mein hon.
2. **Metadata templates** — har location page ka title/description already dynamic hai (`/locations/[slug]` mein `generateMetadata`) — isay regions aur guides par bhi lagao. Koi fake claim nahi ("official map" mat likho — hum fan project hain, disclaimer rahe).
3. **Structured data** — `articleJsonLd` + `breadcrumbJsonLd` already hain. Add karo: `WebSite` (+ `SearchAction`), location index pages par `ItemList`. Koi jhoota rating/review schema nahi.
4. **Core Web Vitals** — map page bhaari hai (canvas + 2,098 records). Lazy-load karo: 3D bundle sirf `?map=3d` par load ho, images `webp`, lists virtualized hon. Target: LCP < 2.5s mobile par.
5. **Internal linking mesh** — 147 pages aapas mein jurre hon: location → region → nearby locations → guides. Koi page "orphan" (bina link ke) na rahe.

### B. Content Strategy (small team ke liye realistic)

**Naye page types (official sources se hi):**
- 6 region hub pages (Phase 1) — sab se qeemti keywords.
- Guides (haftay mein 1, zyada nahi): "GTA 6 Map Size — What Rockstar Confirmed", "Every Confirmed Region in Leonida Explained", "GTA 6 Release Date & Editions Guide". Har guide mein map ka embed + location links.
- FAQ page: "Is there an official GTA 6 map?" — honest jawab (nahi hai; Rockstar ne collector box mein poster diya hai) — yeh sawal log poochte hain, hum sach bol kar rank karenge.
- Update log / changelog page: "Map updates" — Google fresh content pasand karta hai.

**Publishing cadence:** Haftay mein 1–2 pages. Zyada ka wada mat karo — quality > quantity. Har page: 800+ words original, apne map ke screenshots, official citations.

**Kya NAHI karna (yeh sab site maar dete hain):**
- Keyword stuffing ("gta 6 map gta 6 map" repeat karna).
- Kisi aur site ka content copy-paste.
- Leak-bait titles ("GTA 6 LEAKED MAP INSIDE!!") — Take-Two takedown + trust khatam.
- Kharide hue backlinks ya link schemes.
- AI-generated bekaar pages ki bharmar — har page mein asal mehnat dikhe.

### C. Authority Building (backlinks, sahi tareeqe se)

1. **Embed widget** (Phase 2) — gaming blogs hamara map lagayenge, backlink khud aayega.
2. **Reddit** — r/GTA6, r/GTA: genuinely participate karo, apna map sirf tab share karo jab sawal relevant ho. Spam = ban = ulta nuqsan.
3. **GTAForums** — mapping threads mein honest contribution (apna data, apne findings).
4. **Social clips** — X/TikTok/YouTube Shorts: "POV: tum Leonida ka map explore kar rahe ho" — 15-second map fly-through clips, watermark ke saath. Yeh backlinks nahi, lekin branded searches banate hain (log "gta6mapx" search karenge — yeh ranking ka strong signal hai).
5. **Press kit page** — `/press`: journalists ke liye facts, screenshots, contact. Launch ke qareeb kaam aayega.

### D. Honest Timeline (yeh yaad rakho)

- **Hafta 1–2:** Technical fixes (sitemap, robots, metadata) → Google Search Console mein submit.
- **Hafta 2–4:** Naye pages index hona shuru (koi guarantee nahi — Google apni marzi se index karta hai).
- **Mahina 2–3:** Long-tail keywords ("port gellhorn gta 6 location") par impressions aana shuru.
- **Mahina 3–6:** Competitive keywords ("gta 6 interactive map") par mehnat — yahan reference sites se muqabla hai, jeet backlinks + content depth se hogi.
- **Kabhi guarantee nahi:** ranking, traffic, ya revenue ka wada mat karo — na khud se, na kisi aur se.

### E. Measurement (bina iske andhera hai)

- Google Search Console: clicks, impressions, kaunsa page kis keyword par.
- Plausible/Umami (free, privacy-friendly): kaunsa feature use hota hai.
- Mahine mein 1 review: jo kaam kar raha hai usay double karo, jo nahi kar raha usay band karo.

---

## PLAN 3 — Extend & Modify Roadmap

### A. Codebase — Modular Growth (existing structure par)

Hamari `web/src/modules/` structure already sahi hai (`map`, `entities`, `seo`, `site`, `discovery`, `engagement`, `community`, `progress`). Naya kaam is usool par:

1. **Har naya feature = apna folder.** Map features ke liye: `web/src/modules/map/features/<feature-name>/` — andar apne components, hooks, types. Example: `features/tripPlanner/TripPlannerPanel.tsx`, `features/tripPlanner/routeMath.ts`.
2. **Renderer ko haath mat lagao.** `SimpleMap.tsx` (2D canvas) hamara khazana hai — naye features is se **adapter** ke zariye baat karenge (`pinAdapter.ts` jaisa pattern), renderer ke andar ghus kar nahi.
3. **Single responsibility:** ek file, ek kaam. Agar file 300+ lines ho rahi hai to toro. Har module ke top par JSDoc comment lazmi (jaise `deepLink.ts` mein hai — wahi style).
4. **Cross-module imports sirf barrel se:** doosre module ki andaruni file seedha import mat karo — `index.ts` barrel banao aur wahi se lo.
5. **State ka usool:** map UI state (filters, selection) `modules/map/` mein rahe; user progress (found, trips) `modules/progress/` mein; dono ka sync ek jagah (`progressSync.ts` jaisa single bridge).

### B. Data Pipeline — 517 se 750+ (sirf official sources)

**Allowed sources (sakhti se):** Rockstar trailers (T1/T2), official screenshots, Rockstar Newswire announcements, official GTA VI website text. **Banned:** 2022 leak, CYBERLEEK, kisi fan map ka data/artwork.

**Workflow (har naye location ke liye):**
1. **Intake:** `data/intake/` mein entry — naam, source (e.g. "Trailer 2 @ 1:08"), proposed coords, evidence status (confirmed / community-mapped / rumored).
2. **2-person rule:** Ek banda add kare, doosra (Husnain) approve kare. Bina approval production mein nahi jayega.
3. **Quality checks (script):** `scripts-local/validate-pins.ts` extend karo — coordinate bounds check (Leonida range ke andar?), duplicate-name detection, evidence label lazmi, `≈` flag approximate coords par.
4. **Versioned transform:** `transform.v1.json` ka pattern rakho — naya transform aaye to `v2`, purana regenerate ho sake.
5. **Target:** Launch (19 Nov 2026) se pehle 750+ named locations — sirf official material se jo nikal sake.

**GTADB attribution (PRE-LAUNCH BLOCKER):** CC BY 4.0 ka visible credit Husnain khud lagayega — yeh kisi phase ka "optional" kaam nahi. Jab tak yeh nahi lagta, public API (Feature 11) aur "full launch" ka dawa nahi hoga.

### C. 3D Path — Bina 2D Toray (options)

2D default **kabhi nahi tootega** — yeh path alag feature flag (`?map=3d`) ke peeche rahega, aur dead-render auto-fallback hamesha on rahega.

- **Option A — MapLibre WebGL ko sahi fix karo (recommended):** Asal masla context-loss / dead canvas hai. Kaam: `webglcontextlost` handler + manual repaint retry, software-renderer (SwiftShader) detection par graceful message, kamzor GPUs par auto-2D. Testing: no-GPU VM + Husnain ka device + ek mid-range Android — teeno par pass lazmi.
- **Option B — 2.5D tilt (cheap aur reliable):** Canvas 2D par hi slight perspective tilt — "3D feel" bina WebGL ke. Agar Option A 2 hafton mein stable na ho to yeh backup hai.
- **Option C — 3D ko experiment hi rehne do:** Agar dono mushkil hon to 3D button rehne do "beta" label ke saath, focus 2D par.

**Testing checkpoints (har option ke liye):** (1) no-GPU VM par load, (2) Husnain ke device par video proof, (3) 25s fallback test — teeno pass hon to hi merge.

### D. Mobile + Performance Roadmap

1. **Abhi:** `MobileSheet` hai — isay har naye panel (trip planner, scene locator) mein reuse karo, naya mat banao.
2. **Code-split:** 3D/MapLibre bundle lazy ho (sirf `?map=3d` par), route-level splitting Next.js se.
3. **Images:** saari artwork `webp`, `next/image` ya manual `srcset`, tiles lazy-load.
4. **Lists:** 2,000+ records wali lists virtualized hon (render sirf visible rows).
5. **PWA (Phase 3):** installable map + offline tile cache — launch ke baad jab users zyada hon.

### E. Phase-wise Execution + Testing (Husnain ka workflow)

**Har phase ka fixed cycle:**
1. Plan approve (Husnain se 1-line).
2. Build (modular, JSDoc comments).
3. **Local test:** `tsc` + `eslint` clean, dev mein click-through.
4. **Visual approval:** Husnain ko screenshots — visual phase uski approval ke baghair aage nahi barhega.
5. Commit → GitHub push → Vercel deploy.
6. **Production verify:** live URL par check (Ctrl+Shift+R yaad dilao agar change na dikhe).
7. Agla phase tabhi shuru jab pichla verify ho jaye.

**Phase order:**
- **Phase 1 (abhi):** Quick Wins #1–3 + Scene Locator v1 → test → deploy.
- **Phase 2:** Trip Planner + Collections + Embed Widget → test → deploy.
- **Phase 3:** Compare Tool + Community submissions + API → test → deploy.
- **Parallel track (kabhi bhi):** Data pipeline (517 → 750+), SEO content (haftay mein 1–2 pages).
- **3D track (alag):** Option A/B/C — 2D ko chhue baghair, apne checkpoints ke saath.

---

*Constraints reminder: original implementation only; no leaked materials; no ranking guarantees; 2D default intact; GTADB attribution pre-launch mandatory.*
