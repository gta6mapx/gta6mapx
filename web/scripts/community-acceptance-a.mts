// Phase 6 (community, worker A) acceptance — guest continuity foundation.
// guestStore v2 (migration/honesty/tombstones/import/quota) + merge semantics
// (newest-note-wins, tombstones, choices). Pure-ish: localStorage is faked.
//
// Run:
//   node --import ./scripts/register-at-alias.mjs scripts/community-acceptance-a.mts
//
// Prints PASS/FAIL per assertion; exits nonzero on the first failure.

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── fakes ──────────────────────────────────────────────────────────────────

class FakeStorage {
  private map = new Map<string, string>();
  private byteLimit: number;
  constructor(byteLimit: number = Number.POSITIVE_INFINITY) {
    this.byteLimit = byteLimit;
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    const next = new Map(this.map);
    next.set(key, String(value));
    let total = 0;
    for (const [k, v] of next) total += k.length + v.length;
    if (total > this.byteLimit) {
      const err = new Error("QuotaExceededError");
      err.name = "QuotaExceededError";
      throw err;
    }
    this.map = next;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  clear(): void {
    this.map.clear();
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  get length(): number {
    return this.map.size;
  }
}

function makeFakeStorage(byteLimit?: number): FakeStorage {
  const fake = new FakeStorage(byteLimit);
  (globalThis as any).localStorage = fake;
  return fake;
}

// Install the shim BEFORE the modules are evaluated (dynamic import below).
makeFakeStorage();

const {
  addFound,
  removeFound,
  setNote,
  toggleFavorite,
  loadStore,
  migrateV1toV2,
  exportData,
  importData,
  resetAll,
} = await import("../src/modules/community/guestStore");

const {
  mergeFoundRecords,
  mergeFavorites,
  mergeGameRecords,
  applyMergeChoice,
} = await import("../src/modules/community/merge");

// ─── harness ────────────────────────────────────────────────────────────────

let failures = 0;

function check(name: string, cond: boolean, detail = ""): void {
  if (cond) {
    console.log(`PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
    process.exit(1);
  }
}

const T1 = "2026-01-10T00:00:00.000Z";
const T2 = "2026-05-20T00:00:00.000Z";
const T3 = "2026-08-01T00:00:00.000Z";

function foundRec(found_at: string, note: string, note_updated_at: string | null) {
  return { found_at, note, note_updated_at };
}

// ─── 1. migration: idempotent + honest timestamps ───────────────────────────

{
  const storage = makeFakeStorage();
  storage.setItem("gta6mapx_found_v1", JSON.stringify(["pin-a", "pin-b"]));
  const before = Date.now();

  const first = migrateV1toV2();
  check("migration runs on v1 ids", first.migrated === true && first.imported === 2, JSON.stringify(first));

  const state = loadStore();
  check("migration keeps both ids", state.found["pin-a"] !== undefined && state.found["pin-b"] !== undefined);
  const fa = Date.parse(state.found["pin-a"].found_at);
  const fb = Date.parse(state.found["pin-b"].found_at);
  check("migration timestamps are migration-time (not invented)", fa >= before && fb >= before);
  check("migration notes start empty", state.found["pin-a"].note === "" && state.found["pin-a"].note_updated_at === null);
  check("migration sets the flag", state.meta.migrated_from_v1 === true);

  const second = migrateV1toV2();
  check("migration is idempotent", second.migrated === false && second.imported === 0, JSON.stringify(second));
  check(
    "idempotent re-run does not rewrite timestamps",
    loadStore().found["pin-a"].found_at === state.found["pin-a"].found_at,
  );

  check(
    "v1 key left untouched",
    storage.getItem("gta6mapx_found_v1") === JSON.stringify(["pin-a", "pin-b"]),
  );
}

// ─── 2. merge: newest note wins, never concatenated ─────────────────────────

{
  const guest = {
    found: { "pin-x": foundRec(T1, "guest old note", T1) },
    tombstones: {},
  };
  const account = {
    found: { "pin-x": foundRec(T2, "account newer note", T2) },
    tombstones: {},
  };
  const merged = mergeFoundRecords(guest, account);
  check("newest note wins (account newer)", merged["pin-x"]?.note === "account newer note");
  check("found_at stays earliest (honest)", merged["pin-x"]?.found_at === T1);

  const guestNewer = {
    found: { "pin-y": foundRec(T2, "guest newer note", T2) },
    tombstones: {},
  };
  const accountOlder = {
    found: { "pin-y": foundRec(T1, "account old note", T1) },
    tombstones: {},
  };
  const merged2 = mergeFoundRecords(guestNewer, accountOlder);
  check("newest note wins (guest newer)", merged2["pin-y"]?.note === "guest newer note");
  check("notes are never concatenated", !merged2["pin-y"]?.note.includes("account"));
}

// ─── 3. tombstones prevent resurrection ─────────────────────────────────────

{
  makeFakeStorage();
  addFound("pin-t");
  removeFound("pin-t");
  check("removeFound drops the pin", !loadStore().found["pin-t"]);

  const incoming = JSON.stringify({
    version: 2,
    found: { "pin-t": foundRec(T1, "stale account note", T1) },
    favorites: {},
    meta: {
      created_at: T1,
      updated_at: T2,
      migrated_from_v1: false,
      tombstones: {},
    },
  });
  const res = importData(incoming);
  check("stale import merges ok", res.ok === true, JSON.stringify(res));
  check("tombstone blocks resurrection via import", !loadStore().found["pin-t"]);

  // Re-found later (found_at newer than the tombstone) wins over the tombstone.
  const tombLater = "2026-01-01T00:00:00.000Z"; // older than account record
  const g = { found: {}, tombstones: { "found:q": { deleted_at: tombLater } } };
  const a = { found: { q: foundRec(T3, "n", T3) }, tombstones: {} };
  check("re-find after delete is honored", mergeFoundRecords(g, a)["q"] !== undefined);

  // Tombstone newer than the found record → stays deleted.
  const g2 = { found: {}, tombstones: { "found:q": { deleted_at: T3 } } };
  const a2 = { found: { q: foundRec(T1, "n", T1) }, tombstones: {} };
  check("tombstone prevents resurrection via merge", mergeFoundRecords(g2, a2)["q"] === undefined);
}

// ─── 4. import: rejects oversize/invalid with reason, never partial ─────────

{
  makeFakeStorage();
  addFound("pin-keep");
  const beforeCount = Object.keys(loadStore().found).length;

  check("import rejects oversize", !importData(" ".repeat(2_000_001) + "{}").ok);
  const over = importData(" ".repeat(2_000_001) + "{}");
  check("oversize reason given", over.ok === false && (over as any).reason === "file-too-large");

  const badJson = importData("{not-json");
  check("import rejects invalid json with reason", badJson.ok === false && (badJson as any).reason === "invalid-json");

  const badSchema = importData(JSON.stringify({ version: 1 }));
  check("import rejects bad schema with reason", badSchema.ok === false && (badSchema as any).reason === "invalid-schema");

  // 20,001 records → too many (record count check, not size check).
  const manyFound: Record<string, unknown> = {};
  for (let i = 0; i < 20001; i += 1) {
    manyFound[`p${i}`] = { found_at: T1, note: "", note_updated_at: null };
  }
  const tooMany = importData(
    JSON.stringify({
      version: 2,
      found: manyFound,
      favorites: {},
      meta: { created_at: T1, updated_at: T1, migrated_from_v1: false, tombstones: {} },
    }),
  );
  check("import rejects too many records with reason", tooMany.ok === false && (tooMany as any).reason === "too-many-records");

  check(
    "rejected imports never partial-apply",
    Object.keys(loadStore().found).length === beforeCount && loadStore().found["pin-keep"] !== undefined,
  );
}

// ─── 5. quota guard ─────────────────────────────────────────────────────────

{
  makeFakeStorage();
  const first = addFound("pin-q1");
  check("writes succeed under quota", first.ok === true, JSON.stringify(first));

  // Replace the shim with a quota-limited one seeded at the current payload
  // size: any further write must refuse.
  const raw = (globalThis as any).localStorage.getItem("gta6mapx_progress_v2") as string;
  const seeded = new FakeStorage(raw.length + "gta6mapx_progress_v2".length + 10);
  seeded.setItem("gta6mapx_progress_v2", raw);
  (globalThis as any).localStorage = seeded;

  const refused = addFound("pin-q2");
  check("quota guard refuses the write", refused.ok === false && (refused as any).reason === "quota", JSON.stringify(refused));
  check("refused write leaves the store intact", loadStore().found["pin-q1"] !== undefined);
}

// ─── 6. note limit + favorites + reset ──────────────────────────────────────

{
  makeFakeStorage();
  addFound("pin-n");
  const tooLong = setNote("pin-n", "x".repeat(2001));
  check("over-limit note rejected, never truncated", tooLong.ok === false && (tooLong as any).reason === "note-too-long");
  const maxOk = setNote("pin-n", "x".repeat(2000));
  check("2000-char note accepted", maxOk.ok === true);
  check("accepted note stored verbatim", loadStore().found["pin-n"].note.length === 2000);

  check("toggleFavorite adds", toggleFavorite("pin-f").ok === true && loadStore().favorites["pin-f"] !== undefined);
  check("toggleFavorite removes", toggleFavorite("pin-f").ok === true && loadStore().favorites["pin-f"] === undefined);

  const wrong = resetAll("reset");
  check("reset requires exact RESET phrase", wrong.ok === false);
  const res = resetAll("RESET");
  check("reset succeeds with phrase", res.ok === true);
  check("reset offers export first", res.ok === true && (res as any).exportPayload.includes("pin-n"));
  check("reset clears records", Object.keys(loadStore().found).length === 0);
  check("export is valid JSON of the store", JSON.parse(exportData()).version === 2);
}

// ─── 7. favorites / games / merge choices ───────────────────────────────────

{
  const favs = mergeFavorites({ a: { saved_at: T2 } }, { a: { saved_at: T1 }, b: { saved_at: T2 } });
  check("favorites union keeps both", favs["a"] !== undefined && favs["b"] !== undefined);
  check("favorites dup keeps earliest saved_at", favs["a"].saved_at === T1);

  const g1: any = { id: "game-1", date: T1, totalScore: 10 };
  const g1new: any = { id: "game-1", date: T2, totalScore: 20 };
  const g2: any = { id: "game-2", date: T1, totalScore: 5 };
  const games = mergeGameRecords([g1, g2], [g1new]);
  check("games union by id", games.length === 2);
  check("games dup keeps newest dated record", games.find((g: any) => g.id === "game-1")!.totalScore === 20);

  const src = (found: Record<string, any>) => ({
    found: { found, tombstones: {} },
    favorites: {},
    games: [],
  });
  const guest = src({ "pin-x": foundRec(T1, "guest note", T1) });
  const account = src({ "pin-x": foundRec(T2, "account note", T2), "pin-z": foundRec(T2, "", null) });

  const merged = applyMergeChoice("merge", guest, account);
  check("applyMergeChoice merge", merged.choice === "merge" && (merged as any).merged.found["pin-x"].note === "account note");
  check("merge report lists records", (merged as any).report.length >= 2);

  const fresh = applyMergeChoice("start-fresh", guest, account);
  check(
    "start-fresh: account wins",
    fresh.choice === "start-fresh" &&
      (fresh as any).merged.found["pin-z"] !== undefined &&
      (fresh as any).merged.found["pin-x"].note === "account note",
  );

  const separate = applyMergeChoice("keep-separate", guest, account);
  check(
    "keep-separate: guest stays local-only",
    separate.choice === "keep-separate" &&
      (separate as any).guestOnly.found["pin-x"].note === "guest note" &&
      !("merged" in separate),
  );
}

// ─── summary ────────────────────────────────────────────────────────────────

if (failures === 0) {
  console.log("\nALL COMMUNITY-ACCEPTANCE-A ASSERTIONS PASSED");
}
process.exit(failures === 0 ? 0 : 1);
