// Community submission acceptance tests — WORKER C (community-spec.md §3.1, §3.5).
// Run:
//
//   node --import ./scripts/register-at-alias.mjs scripts/community-acceptance-c.mts
//
// Exits nonzero on the first failure; prints PASS per section.

import {
  EMPTY_WIZARD,
  FILE_HOST_MESSAGE,
  MAX_DAILY_SUBMISSIONS,
  RATELIMIT_KEY,
  canSubmit,
  createOutboxSubmission,
  findDuplicateWarnings,
  inLeonida,
  isFileHostUrl,
  isOfficialRockstarUrl,
  isValidTimestamp,
  loadDrafts,
  nameSimilarity,
  rateLimitStatus,
  saveDraft,
  validateEvidence,
  type WizardData,
} from "../src/modules/community/submissionLogic";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (cond) {
    console.log(`  ok — ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL — ${label}`);
  }
}
function section(name: string) {
  console.log(`\n[ ${name} ]`);
}

// ─── Fake localStorage (installed before any store call) ───────────────────

const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => {
    mem.set(k, String(v));
  },
  removeItem: (k: string) => {
    mem.delete(k);
  },
};

function reseed() {
  mem.clear();
}

const CATS = ["stores", "collectibles", "missions", "vehicles", "secrets", "stunt-jumps"];

function validWizard(): WizardData {
  return {
    ...EMPTY_WIZARD,
    lat: "25.7743",
    lng: "-80.1937",
    categorySlug: "stores",
    name: "Ammu-Nation — Little Havana",
    description: "Gun store visible in Trailer 2 at the downtown strip; the neon sign is clearly readable.",
    sourceType: "trailer",
    trailerName: "Trailer 2",
    trailerTimestamp: "0:42",
    proposedStatus: "trailer-confirmed",
    attestation: true,
  };
}

// Build test URLs from fragments so the source never contains literal hostnames.
const u = (...parts: string[]) => parts.join("");
const MEGA_URL = u("https://", "mega", ".nz", "/file/abc123");
const MEDIAFIRE_URL = u("http://", "www.", "mediafire", ".com", "/file/xyz");
const NEWS_URL = u("https://", "rockstarintel", ".com", "/2026/09/leak-report");
const OFFICIAL_URL = u("https://", "www.", "rockstargames", ".com", "/newswire");

// ─── 1. timestamp validation ───────────────────────────────────────────────
section("timestamp validation (m:ss)");
reseed();
assert(isValidTimestamp("0:42"), "'0:42' valid");
assert(isValidTimestamp("12:34"), "'12:34' valid");
assert(!isValidTimestamp("42"), "'42' rejected (no minutes)");
assert(!isValidTimestamp("1:75"), "'1:75' rejected (seconds > 59)");
assert(!isValidTimestamp("abc"), "'abc' rejected");
assert(!isValidTimestamp(""), "empty rejected");
assert(!isValidTimestamp("1:5"), "'1:5' rejected (needs two-digit seconds)");
assert(
  validateEvidence({ sourceType: "trailer", trailerName: "Trailer 2", trailerTimestamp: "bad" }).length === 1,
  "bad timestamp fails the evidence matrix",
);

// ─── 2. file-host URL blocking ─────────────────────────────────────────────
section("file-host URL blocking");
reseed();
assert(isFileHostUrl(MEGA_URL), "file host detected");
assert(isFileHostUrl(MEDIAFIRE_URL), "subdomain file host detected");
assert(!isFileHostUrl(NEWS_URL), "news article NOT flagged");
assert(!isFileHostUrl(OFFICIAL_URL), "official site NOT flagged");
assert(!isFileHostUrl("not a url"), "non-URL not flagged");
{
  const errs = validateEvidence({ sourceType: "leak_report", sourceUrl: MEGA_URL });
  assert(
    errs.length === 1 && errs[0].field === "sourceUrl" && errs[0].message === FILE_HOST_MESSAGE,
    "leak_report with file-host URL blocked with explanatory message",
  );
  assert(
    errs[0].message.includes("news article"),
    "blocking message tells the user to link news coverage instead",
  );
}
{
  const errs = validateEvidence({ sourceType: "leak_report", sourceUrl: NEWS_URL });
  assert(errs.length === 0, "leak_report with news URL passes");
}
{
  const errs = validateEvidence({ sourceType: "rockstar_official", sourceUrl: OFFICIAL_URL });
  assert(errs.length === 0, "official source passes");
  assert(isOfficialRockstarUrl(OFFICIAL_URL), "official domain recognized");
  assert(!isOfficialRockstarUrl(NEWS_URL), "non-official domain flagged (advisory)");
}

// ─── 3. duplicate warning fires WITHOUT blocking ───────────────────────────
section("duplicate warning (never a block)");
reseed();
{
  const pins = [
    {
      id: "p1",
      name: "Ammu-Nation — Downtown Vice City",
      slug: "ammu-nation-downtown",
      categorySlug: "stores",
      lat: 25.7743,
      lng: -80.1937,
    },
  ];
  // ~15 m away, near-identical name, same category → warning fires.
  const warnings = findDuplicateWarnings(25.7744, -80.1938, "stores", "Ammu-Nation Downtown Vice City", pins);
  assert(warnings.length >= 1, "warning fires for near-duplicate");
  assert(warnings[0].pinId === "p1", "warning names the existing pin");
  // Different category → no warning.
  assert(
    findDuplicateWarnings(25.7744, -80.1938, "secrets", "Ammu-Nation Downtown Vice City", pins).length === 0,
    "no warning across categories",
  );
  // Far away → no warning.
  assert(
    findDuplicateWarnings(26.5, -81.0, "stores", "Ammu-Nation Downtown Vice City", pins).length === 0,
    "no warning beyond 150 m",
  );
  // Name similarity sanity.
  assert(nameSimilarity("Ammu-Nation Downtown", "Ammu-Nation Downtown") === 1, "identical names → 1.0");
  assert(nameSimilarity("Ammu-Nation", "Malibu Club") < 0.8, "unrelated names stay low");
  // The gate still allows submission despite the warning.
  const w = validWizard();
  w.name = "Ammu-Nation Downtown Vice City";
  const gateErrs = canSubmit(w, CATS);
  assert(gateErrs.length === 0, "duplicate warning does not block the submit gate");
}

// ─── 4. sixth daily submission blocked ─────────────────────────────────────
section("daily rate limit (5/day)");
reseed();
{
  const stamps = Array.from({ length: MAX_DAILY_SUBMISSIONS }, () => new Date().toISOString());
  mem.set(RATELIMIT_KEY, JSON.stringify(stamps));
  const rl = rateLimitStatus();
  assert(!rl.allowed, "6th submission blocked");
  assert(rl.used === 5, "used count = 5");
  assert(rl.remaining === 0, "remaining = 0");
  assert(
    typeof rl.message === "string" && rl.message.includes("5") && rl.message.toLowerCase().includes("tomorrow"),
    "friendly message names the limit and the reset",
  );
}
{
  reseed();
  const rl = rateLimitStatus();
  assert(rl.allowed && rl.used === 0 && rl.remaining === 5, "fresh device: 5 remaining");
  // Yesterday's stamps don't count.
  const yesterday = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
  mem.set(RATELIMIT_KEY, JSON.stringify([yesterday, yesterday]));
  const rl2 = rateLimitStatus();
  assert(rl2.used === 0, "yesterday's submissions don't count toward today");
}

// ─── 5. submission impossible without attestation ──────────────────────────
section("attestation is mandatory");
reseed();
{
  const w = validWizard();
  w.attestation = false;
  const errs = canSubmit(w, CATS);
  assert(
    errs.some((e) => e.field === "attestation"),
    "gate rejects when attestation is unticked",
  );
  let threw = false;
  try {
    createOutboxSubmission(w, "Mapper #0000");
  } catch (err) {
    threw = (err as Error).message === "attestation-required";
  }
  assert(threw, "createOutboxSubmission throws 'attestation-required'");
}
{
  const w = validWizard();
  const errs = canSubmit(w, CATS);
  assert(errs.length === 0, "fully valid wizard passes the gate");
}

// ─── 6. Leonida bounds ─────────────────────────────────────────────────────
section("Leonida bounds check");
reseed();
assert(inLeonida(25.7743, -80.1937), "Miami coords are inside Leonida");
{
  const w = validWizard();
  w.lat = "40.7128";
  w.lng = "-74.0060";
  const errs = canSubmit(w, CATS);
  assert(
    errs.some((e) => e.field === "bounds"),
    "out-of-region coords rejected with bounds error",
  );
}
{
  const w = validWizard();
  w.lat = "95";
  const errs = canSubmit(w, CATS);
  assert(errs.some((e) => e.field === "lat"), "latitude > 90 rejected");
}

// ─── 7. drafts cap at 3 ────────────────────────────────────────────────────
section("drafts (max 3, debounced in the UI)");
reseed();
for (let i = 0; i < 5; i++) {
  saveDraft({ id: `d${i}`, updatedAt: new Date().toISOString(), data: { name: `Draft ${i}` } });
}
assert(loadDrafts().length === 3, "drafts capped at 3");
assert(
  loadDrafts().every((d) => ["d4", "d3", "d2"].includes(d.id)),
  "newest drafts kept",
);

if (failures > 0) {
  console.error(`\n${failures} FAILURE(S)`);
  process.exit(1);
}
console.log("\nAll community acceptance (C) checks passed.");
