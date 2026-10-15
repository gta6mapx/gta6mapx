import type { Weapon } from "../types";

// ─── modules/entities/data/weapons.ts ───────────────────────────────────────
// Pre-launch weapon roster compiled from PUBLIC reporting on the official
// trailers and the Extended Look (see source notes per entry). In-world names
// are used where reporting gives them; lookalike descriptions otherwise.
// NEVER invent damage/RPM/price stats — those unlock at launch verification.

export const WEAPON_CLASSES = [
  "Handguns",
  "Shotguns",
  "SMGs",
  "Assault Rifles",
  "Sniper Rifles",
  "Heavy",
  "Melee",
  "Throwables",
  "Non-Lethal",
] as const;

const T = "Spotted in official trailers / Extended Look (public reporting)";

export const WEAPONS: Weapon[] = [
  // ── Handguns ──
  {
    slug: "pistol", name: "Pistol", kind: "weapon", wclass: "Handguns",
    evidence: { status: "trailer-confirmed", detail: T },
    summary: "The standard Beretta-style sidearm seen across both trailers — the baseline handgun Lucia and Jason fall back on.",
    tags: ["handgun", "sidearm"],
  },
  {
    slug: "polymer-pistol", name: "Polymer Pistol", kind: "weapon", wclass: "Handguns",
    evidence: { status: "trailer-confirmed", detail: T },
    summary: "Glock-style polymer-frame pistol spotted in trailer footage, reportedly with quick-draw handling.",
    tags: ["handgun", "sidearm"],
  },
  {
    slug: "mustang-357", name: "Mustang .357", kind: "weapon", wclass: "Handguns",
    evidence: { status: "trailer-confirmed", detail: T },
    summary: "Heavy .357 revolver with an in-world brand name — the hard-hitting hand cannon of the confirmed roster.",
    tags: ["handgun", "revolver"],
  },
  {
    slug: "girardi-es9", name: "Girardi ES9", kind: "weapon", wclass: "Handguns",
    evidence: { status: "trailer-confirmed", detail: T },
    summary: "Jason's signature handgun in promo material — Beretta-style, in-world branded. The Ultimate Edition adds a personalized engraved variant for Jason.",
    tags: ["handgun", "sidearm"],
  },
  {
    slug: "klose-k17", name: "Klose K17", kind: "weapon", wclass: "Handguns",
    evidence: { status: "trailer-confirmed", detail: T },
    summary: "Lucia's preferred handgun, per public reporting on trailers and promo material — the Ultimate Edition adds a personalized variant for her. (Outlets differ on the real-world basis: Glock 17 vs Bersa Thunder 380.)",
    tags: ["handgun", "sidearm"],
  },
  {
    slug: "nipper-38", name: "Nipper .38", kind: "weapon", wclass: "Handguns",
    evidence: { status: "trailer-confirmed", detail: T },
    summary: "Compact .38 snub-nose style revolver reported from trailer footage — likely the concealable backup option.",
    tags: ["handgun", "revolver"],
  },
  {
    slug: "capo-pistol", name: "Capo Pistol", kind: "weapon", wclass: "Handguns",
    evidence: { status: "trailer-confirmed", detail: "'Capo' marking read off a Colt-style pistol in trailer footage; the name is analyst-assigned (public reporting)" },
    summary: "Colt-style pistol with a 'Capo' marking spotted in trailer coverage — the name is analyst-assigned, not a confirmed in-game title.",
    tags: ["handgun", "sidearm"],
  },
  // ── Shotguns ──
  {
    slug: "moreland-850", name: "Moreland 850", kind: "weapon", wclass: "Shotguns",
    evidence: { status: "rockstar-confirmed", detail: "In-game name confirmed in the Extended Look's weapon-pickup prompts (public reporting)" },
    summary: "Short-barreled pump shotgun whose official in-game name appears on the Extended Look's pickup prompt — one of the clearest weapon reveals, built for close-quarters fights.",
    tags: ["shotgun", "close-quarters"],
  },
  {
    slug: "pump-action-shotgun", name: "Pump-Action Shotgun", kind: "weapon", wclass: "Shotguns",
    evidence: { status: "trailer-confirmed", detail: T },
    summary: "Classic pump shotgun spotted in trailer footage — the familiar workhorse of the shotgun class.",
    tags: ["shotgun", "close-quarters"],
  },
  {
    slug: "double-barrel-shotgun", name: "Double-Barrel Shotgun", kind: "weapon", wclass: "Shotguns",
    evidence: { status: "trailer-confirmed", detail: T },
    summary: "Sawn-off style double barrel seen in trailers — brutal up close, slow to reload, exactly as tradition demands.",
    tags: ["shotgun", "close-quarters"],
  },
  // ── SMGs ──
  {
    slug: "mp5-smg", name: "MP5 SMG", kind: "weapon", wclass: "SMGs",
    evidence: { status: "trailer-confirmed", detail: T },
    summary: "MP5-inspired submachine gun from trailer coverage — the likely drive-by and indoor-clearing pick.",
    tags: ["smg", "automatic"],
  },
  {
    slug: "micro-smg-uzi", name: "Micro SMG", kind: "weapon", wclass: "SMGs",
    evidence: { status: "trailer-confirmed", detail: T },
    summary: "Uzi-style micro SMG spotted in trailers — compact automatic fire for tight spaces.",
    tags: ["smg", "automatic"],
  },
  // ── Assault Rifles ──
  {
    slug: "duke-556", name: "Duke 556", kind: "weapon", wclass: "Assault Rifles",
    evidence: { status: "rockstar-confirmed", detail: "In-game name confirmed in the Extended Look's weapon-pickup prompts (public reporting)" },
    summary: "M4-pattern assault rifle whose official in-game name appears on the Extended Look's pickup prompt — the mid-range workhorse of the confirmed arsenal.",
    tags: ["rifle", "automatic"],
  },
  {
    slug: "duke-carbine", name: "Duke Carbine", kind: "weapon", wclass: "Assault Rifles",
    evidence: { status: "trailer-confirmed", detail: "Duke Arms Company branding spotted in trailer footage; 'Carbine' is an analyst label, not a confirmed in-game name (public reporting)" },
    summary: "Duke Arms carbine variant from trailer reporting — an analyst-assigned label for the branding read off the gun; a second Duke Arms rifle line alongside the 556.",
    tags: ["rifle", "automatic"],
  },
  {
    slug: "ak-rifle", name: "AK-Style Rifle", kind: "weapon", wclass: "Assault Rifles",
    evidence: { status: "trailer-confirmed", detail: T },
    summary: "AK-pattern rifle spotted in trailer footage — the franchise staple returns for Leonida.",
    tags: ["rifle", "automatic"],
  },
  // ── Sniper Rifles ──
  {
    slug: "bolt-action-sniper", name: "Bolt-Action Sniper", kind: "weapon", wclass: "Sniper Rifles",
    evidence: { status: "trailer-confirmed", detail: T },
    summary: "Remington 700-style bolt-action sniper from trailer coverage — slow, precise, long-range.",
    tags: ["sniper", "long-range"],
  },
  {
    slug: "duke-assault-sniper", name: "Duke Assault Sniper", kind: "weapon", wclass: "Sniper Rifles",
    evidence: { status: "trailer-confirmed", detail: "Duke Arms branding spotted in official screenshots; analyst-labeled as an assault sniper (public reporting)" },
    summary: "Duke Arms semi-auto sniper platform reported from trailers — analyst-labeled; faster follow-ups than the bolt-action.",
    tags: ["sniper", "long-range"],
  },
  // ── Heavy ──
  {
    slug: "grenade-launcher", name: "Grenade Launcher", kind: "weapon", wclass: "Heavy",
    evidence: { status: "trailer-confirmed", detail: "Revolving grenade launcher seen in official footage (public reporting)" },
    summary: "The heavy option spotted in trailers — for when subtlety is no longer on the table.",
    tags: ["heavy", "explosive"],
  },
  {
    slug: "rpg", name: "RPG", kind: "weapon", wclass: "Heavy",
    evidence: { status: "leak-reported", detail: "Reported by some trailer analysts but not clearly shown in any official trailer — Dexerto's GTA 6 wiki notes it 'hasn't been shown just yet' (public reporting)" },
    summary: "Rocket-propelled grenade launcher reported by trailer analysts — plausible given the series, but not clearly seen. Treated as rumor.",
    tags: ["heavy", "explosive"],
  },
  // ── Melee ──
  {
    slug: "baseball-bat", name: "Baseball Bat", kind: "weapon", wclass: "Melee",
    evidence: { status: "trailer-confirmed", detail: T },
    summary: "The timeless Vice City classic — a bat-wielding figure appears in the Port Gellhorn screenshot, though whether players can wield one is unconfirmed pre-launch.",
    tags: ["melee"],
  },
  {
    slug: "hammer", name: "Hammer", kind: "weapon", wclass: "Melee",
    evidence: { status: "trailer-confirmed", detail: T },
    summary: "Claw hammer carried by a trailer character — melee with personality.",
    tags: ["melee"],
  },
  {
    slug: "pool-cue", name: "Pool Cue", kind: "weapon", wclass: "Melee",
    evidence: { status: "trailer-confirmed", detail: T },
    summary: "Bar-room classic from the billiards scene with Cal Hampton — possibly a cutscene prop; wieldability unconfirmed pre-launch.",
    tags: ["melee"],
  },
  {
    slug: "knife", name: "Knife", kind: "weapon", wclass: "Melee",
    evidence: { status: "trailer-confirmed", detail: T },
    summary: "Switchblade-style knife from trailer coverage — the quiet option. A switchblade also appears in the Ultimate Edition revolvers promo art; unclear whether it is UE-linked (public reporting).",
    tags: ["melee", "stealth"],
  },
  {
    slug: "crowbar", name: "Crowbar", kind: "weapon", wclass: "Melee",
    evidence: { status: "trailer-confirmed", detail: T },
    summary: "Crowbar spotted in trailer footage — doubles as a statement about how heists start in Leonida.",
    tags: ["melee"],
  },
  {
    slug: "golf-club", name: "Golf Club", kind: "weapon", wclass: "Melee",
    evidence: { status: "trailer-confirmed", detail: T },
    summary: "Minigolf club from the trailers — Leonida's country clubs arm you whether you like it or not.",
    tags: ["melee"],
  },
  // ── Throwables ──
  {
    slug: "molotov", name: "Molotov", kind: "weapon", wclass: "Throwables",
    evidence: { status: "trailer-confirmed", detail: "Seen on the Extended Look's weapon wheel (public reporting)" },
    summary: "The arson classic, confirmed via trailer coverage — area denial, Leonida style.",
    tags: ["throwable", "explosive"],
  },
  {
    slug: "grenade", name: "Grenade", kind: "weapon", wclass: "Throwables",
    evidence: { status: "trailer-confirmed", detail: T },
    summary: "Standard frag grenade reported from trailer analysis — the room-clearer.",
    tags: ["throwable", "explosive"],
  },
  // ── Non-Lethal ──
  {
    slug: "stun-gun", name: "Stun Gun", kind: "weapon", wclass: "Non-Lethal",
    evidence: { status: "trailer-confirmed", detail: T },
    summary: "Taser-style non-lethal option reported from trailers — takedowns without the body count.",
    tags: ["non-lethal"],
  },
  // ── Ultimate Edition ──
  {
    slug: "hawk-little-morgan-revolver", name: "Hawk & Little Morgan Revolver", kind: "weapon", wclass: "Handguns",
    ultimateEditionExclusive: true,
    evidence: { status: "rockstar-confirmed", detail: "Officially announced as Ultimate Edition content — his-and-hers versions sourced from the Vercetti Estate (June 2026)" },
    summary: "His-and-hers revolver set from the Ultimate Edition — palm-tree-etched grips and Vice City styling sourced from the Vercetti Estate, per Rockstar's edition announcement.",
    tags: ["handgun", "revolver", "ultimate-edition"],
  },
];
