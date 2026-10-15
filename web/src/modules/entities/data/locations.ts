// ─── modules/entities/data/locations.ts ────────────────────────────────────
// Leonida locations from public reporting. The counties and offshore keys were
// first surfaced in the Aug 2026 CYBERLEEK map leak; all but Lummox County
// have since been corroborated by official trailers, screenshots, road signs,
// or Rockstar site copy. Lummox County is still labeled DISPUTED — exactly the
// transparency our competitors don't offer.
// Audit pass applied Sep 24, 2026 (research/entity-audit-fixes.md).

import { slugify, type GameLocation } from "../types";
// Published via the local /admin/gtadb-review queue only (owner approval).
// Empty until the first review session. Not staging input.
import approvedJson from "./gtadb-approved.json";

type L = Omit<GameLocation, "slug" | "kind">;

const RAW: L[] = [
  // ── Rockstar-confirmed regions ──
  { name: "Vice City", region: "Leonida", realWorldInspiration: "Miami, Florida",
    evidence: { status: "rockstar-confirmed", detail: "Officially confirmed by Rockstar Games" },
    summary: "Leonida's largest city and GTA 6's primary urban setting — a far larger, modern take on the iconic Miami-inspired Vice City with beaches, nightlife, ports and dense neighborhoods.",
    tags: ["city", "main"] },
  { name: "Leonida Keys", region: "Leonida", realWorldInspiration: "Florida Keys",
    evidence: { status: "rockstar-confirmed", detail: "Officially confirmed by Rockstar Games" },
    summary: "Island chain south of the mainland, connected by long bridges. Expect boating, smuggling runs and waterfront hideouts.",
    tags: ["islands", "boating"] },
  { name: "Grassrivers", region: "Leonida", realWorldInspiration: "Everglades",
    evidence: { status: "rockstar-confirmed", detail: "Officially confirmed by Rockstar Games" },
    summary: "Vast swamp wetlands — airboats, wildlife and muddy off-road trails. Leonida's wild frontier.",
    tags: ["swamp", "off-road", "wildlife"] },
  { name: "Port Gellhorn", region: "Leonida", realWorldInspiration: "Panama City, Florida",
    evidence: { status: "rockstar-confirmed", detail: "Officially confirmed by Rockstar Games" },
    summary: "Leonida's forgotten west coast — industrial docks, truck stops, motels and working rail lines. A working-class port town.",
    tags: ["port", "industrial", "town"] },
  { name: "Ambrosia", region: "Leonida", realWorldInspiration: "Clewiston, Florida",
    evidence: { status: "rockstar-confirmed", detail: "Officially confirmed by Rockstar Games" },
    summary: "Rural farmland heartland — backroads, fields and small-town secrets.",
    tags: ["rural", "farmland"] },
  { name: "Mount Kalaga National Park", region: "Leonida", realWorldInspiration: "Appalachian foothills",
    evidence: { status: "rockstar-confirmed", detail: "Officially confirmed by Rockstar Games" },
    summary: "Forested mountain region in the north — elevation, overlooks and hiking trails. Leonida's high ground.",
    tags: ["mountain", "forest", "park"] },

  // ── Vice City districts (officially confirmed / trailer-confirmed) ──
  { name: "Ocean Beach", region: "Vice City", realWorldInspiration: "South Beach, Miami",
    evidence: { status: "rockstar-confirmed", detail: "Named in Rockstar's official Vice City description" },
    summary: "Tourist beachfront strip — hotels, neon and the classic Vice City vibe, rebuilt bigger.",
    tags: ["beach", "tourist"] },
  { name: "Vice Beach", region: "Vice City", realWorldInspiration: "Miami Beach",
    evidence: { status: "trailer-confirmed", detail: "Visible in Trailer 1" },
    summary: "The main beach district — jet skis, boardwalks and crowds.",
    tags: ["beach"] },
  { name: "Ocean Drive", region: "Vice City", realWorldInspiration: "Ocean Drive, Miami Beach",
    evidence: { status: "trailer-confirmed", detail: "Visible in Trailer 1 @ 1:12" },
    summary: "Iconic oceanfront boulevard lined with art-deco hotels — the supercar cruising strip.",
    tags: ["street", "landmark"] },
  { name: "Vice City Port", region: "Vice City", realWorldInspiration: "Port of Miami",
    evidence: { status: "trailer-confirmed", detail: "Visible in Trailer 2" },
    summary: "Massive shipping port — cranes, containers and cargo ships. Smuggling mission potential.",
    tags: ["port", "industrial"] },
  { name: "Vice City International Airport", region: "Vice City", realWorldInspiration: "Miami International Airport",
    evidence: { status: "trailer-confirmed", detail: "Visible in Trailer 2 — reportedly huge" },
    summary: "Enormous international airport — one of Leonida's signature locations.",
    tags: ["airport"] },
  { name: "Malibu Club", region: "Vice City",
    evidence: { status: "leak-reported", detail: "September 2022 leak location list; not shown in any official trailer or screenshot (public reporting)" },
    summary: "The legendary Vice City nightclub — rumored to return based on the September 2022 leak lists. Not spotted in any official material; unconfirmed.",
    tags: ["nightlife", "landmark", "rumor"] },
  { name: "Monument of Leonida", region: "Vice City",
    evidence: { status: "leak-reported", detail: "September 2022 leak location lists (road sign/menu); not seen in official material" },
    summary: "Grand state monument named in September 2022 leak materials. No trailer or screenshot sighting — unconfirmed.",
    tags: ["landmark", "rumor"] },

  // ── Confirmed locations ──
  { name: "Little Haiti", region: "Vice City", realWorldInspiration: "Little Haiti, Miami",
    evidence: { status: "trailer-confirmed", detail: "Named in official location descriptions and screenshots (public reporting)" },
    summary: "Neighborhood with Caribbean flavor — Haitian-themed murals and street-level detail seen in official material.",
    tags: ["neighborhood"] },
  { name: "Leaf Links", region: "Vice City", realWorldInspiration: "Golf islands, Miami",
    evidence: { status: "trailer-confirmed", detail: "Named in official screenshots and location lists (public reporting)" },
    summary: "Golf-course islands returning from Vice City, per official location lists.",
    tags: ["golf", "islands", "returning"] },
  { name: "Washington Beach", region: "Vice City", realWorldInspiration: "Washington Ave, Miami Beach",
    evidence: { status: "rockstar-confirmed", detail: "Named in official Ultimate Edition product copy (Shitzu Squalo docking point) and on-screen in gameplay" },
    summary: "Beach district north of Ocean Beach — named in Rockstar's official Ultimate Edition copy as the Shitzu Squalo's docking point.",
    tags: ["beach"] },
  { name: "Vercetti Estate", region: "Vice City",
    evidence: { status: "rockstar-confirmed", detail: "Named in official Ultimate Edition product copy (revolver styling description); location not shown" },
    summary: "Tommy Vercetti's mansion — named in Rockstar's official Ultimate Edition copy as the inspiration for the Hawk & Little Morgan revolvers' styling. Not shown on-screen; enterability unconfirmed.",
    tags: ["landmark", "returning"] },
  { name: "Starlet Motel", region: "Port Gellhorn",
    evidence: { status: "trailer-confirmed", detail: "Trailers 1 & 2, official Port Gellhorn screenshot and official artwork (public reporting)" },
    summary: "Run-down motel complex in Port Gellhorn — Jason and Lucia's 'Trust? — Trust' scene. Functions as an early safehouse/meeting point per public reporting.",
    tags: ["motel", "safehouse"] },
  { name: "Jason's Safehouse", region: "Leonida Keys",
    evidence: { status: "trailer-confirmed", detail: "Trailer 2 waterfront house; named 'Jason's safehouse' in official Ultimate Edition copy" },
    summary: "Waterfront stilt house in the Leonida Keys — Jason's starting safehouse, seen in Trailer 2 and named in Rockstar's official edition copy. (Balcony, jetski, basketball hoop reported across trailers and leaked clips.)",
    tags: ["safehouse", "jason"] },

  // ── Counties & Keys (first surfaced in the CYBERLEEK map leak, Aug 2026) ──
  { name: "Vice-Dale County", region: "Leonida",
    evidence: { status: "rockstar-confirmed", detail: "Official county name — seen on a police seal in Trailer 1 (0:28) and in Rockstar's official site copy" },
    summary: "The county around Vice City — Miami-Dade's in-universe counterpart, confirmed by name in Trailer 1's police seal and official site copy.",
    tags: ["county"] },
  { name: "Leonard County", region: "Leonida",
    evidence: { status: "trailer-confirmed", detail: "Confirmed via in-game road signs in official footage (public reporting)" },
    summary: "Eastern county — confirmed by name on road signs in official gameplay footage. Details still thin.",
    tags: ["county"] },
  { name: "Kelly County", region: "Leonida",
    evidence: { status: "rockstar-confirmed", detail: "Named in Rockstar's official region copy — Port Gellhorn (Kelly County)" },
    summary: "Western county of open land — named in official site copy as Port Gellhorn's county. High-speed chase territory.",
    tags: ["county"] },
  { name: "Mariana County", region: "Leonida",
    evidence: { status: "trailer-confirmed", detail: "First surfaced in the Aug 2026 map leak; since confirmed via in-game road signs (public reporting)" },
    summary: "Southern wetlands county with an isolated airstrip — confirmed by road signs in official footage after first surfacing in the map leak.",
    tags: ["county", "wetlands"] },
  { name: "Lummox County", region: "Leonida",
    evidence: { status: "disputed", detail: "CYBERLEEK map leak, Aug 2026 — the only named county from that leak still unconfirmed in official material; file was found edited with crypto branding",
      sourceUrl: "https://thegamepost.com/gta-6-full-map-leaks-online-counties-islands-huge-unseen-areas/" },
    summary: "Alleged northern forest county — the one county from the disputed map leak that never appeared in any official material or the fan mapping project. Highly questionable.",
    tags: ["county", "forest", "disputed-leak"] },
  { name: "Catalan Key", region: "Leonida Keys",
    evidence: { status: "trailer-confirmed", detail: "Named in official screenshots and location lists (public reporting)" },
    summary: "Key with a large complex and circular structures, per public reporting on official close-up material.",
    tags: ["island"] },
  { name: "Gloriana Key", region: "Leonida Keys",
    evidence: { status: "trailer-confirmed", detail: "Named in official screenshots and location lists (public reporting)" },
    summary: "Industrial key with storage tanks, per public reporting on official material.",
    tags: ["island", "industrial"] },
  { name: "Dalton Island", region: "Leonida Keys",
    evidence: { status: "trailer-confirmed", detail: "Named in official screenshots and location lists (public reporting)" },
    summary: "Residential island with a marina — read by the mapping community as the Fisher Island analogue.",
    tags: ["island"] },
  { name: "Tequesta Retreat", region: "Leonida Keys",
    evidence: { status: "trailer-confirmed", detail: "Named in official screenshots and location lists (public reporting)" },
    summary: "Retreat location in the Keys island chain, named in official location lists.",
    tags: ["island"] },

  // ── New entity candidates (Sep 24, 2026 scout — research/new-entity-candidates.md) ──
  { name: "Little Cuba", region: "Vice City", realWorldInspiration: "Little Havana, Miami",
    evidence: { status: "rockstar-confirmed", detail: "Named on Rockstar's official GTA VI website" },
    summary: "A Vice City neighborhood of bustling panaderías and Cuban-American street life, named directly on Rockstar's official GTA VI website.",
    tags: ["neighborhood"] },
  { name: "Tisha-Wocka", region: "Vice City",
    evidence: { status: "rockstar-confirmed", detail: "Named on Rockstar's official GTA VI website" },
    summary: "A Vice City flea market known for bootleg-brand stalls, named directly on Rockstar's official GTA VI website.",
    tags: ["market", "landmark"] },
  { name: "Thrillbilly Mud Club", region: "Grassrivers",
    evidence: { status: "trailer-confirmed", detail: "Logo watermarked on Trailer 1 footage (public reporting)" },
    summary: "An open, muddy off-road motorsports park near the Grassrivers wetlands where mud-covered crowds party around monster trucks and swamp buggies; its logo is watermarked on Trailer 1 footage.",
    tags: ["activity", "off-road"] },
  { name: "Allied Crystal Sugar Refinery", region: "Ambrosia",
    evidence: { status: "rockstar-confirmed", detail: "Named on Rockstar's official GTA VI website" },
    summary: "The industrial sugar refinery that anchors Ambrosia — Rockstar's official site says it provides the region's jobs while the local biker gang provides almost everything else.",
    tags: ["industrial", "landmark"] },
  { name: "Dominion Hotel", region: "Vice City",
    evidence: { status: "trailer-confirmed", detail: "Trailer 2 — supercar lineup outside the hotel (public reporting)" },
    summary: "A Vice City luxury hotel outside which Trailer 2 lines up a row of high-end supercars, including modern Mercedes and Lamborghini-style machines.",
    tags: ["hotel", "landmark"] },
];

const GTADB_APPROVED: GameLocation[] = approvedJson as unknown as GameLocation[];

export const LOCATIONS: GameLocation[] = [
  ...RAW.map((l) => ({
    ...l,
    kind: "location" as const,
    slug: slugify(l.name),
  })),
  ...GTADB_APPROVED, // owner-approved review-queue records only — no auto-publish
];

export const LOCATION_REGIONS = [...new Set(LOCATIONS.map((l) => l.region))].sort();
