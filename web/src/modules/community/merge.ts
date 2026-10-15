// ─── modules/community/merge.ts ────────────────────────────────────────────
// PURE merge functions (no localStorage, no network): guest→account merge per
// community-spec §2.3 — union of pin ids; per-pin newest note_updated_at wins
// (never concatenated); tombstones honored; favorites and game records union.
//
// The same semantics power import and multi-tab merge in guestStore.ts.

import type { GameRecord } from "../engagement/game/storage";
import type { FavoriteRecord, FoundRecord, GuestStoreState, Tombstone } from "./guestStore";

/** The subset merge needs from either side of a found-set merge. */
export interface FoundView {
  found: Record<string, FoundRecord>;
  tombstones: Record<string, Tombstone>;
}

/** First-sign-in screen choice (spec §2.3): explicit, never silent. */
export type MergeChoice = "merge" | "start-fresh" | "keep-separate";

export interface MergeSource {
  found: FoundView;
  favorites: Record<string, FavoriteRecord>;
  games: GameRecord[];
}

export interface MergeData {
  found: Record<string, FoundRecord>;
  favorites: Record<string, FavoriteRecord>;
  games: GameRecord[];
}

function isoCompare(a: string, b: string): number {
  // ISO 8601 strings compare chronologically as plain strings.
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function newestTombstoneDeletedAt(view: FoundView, id: string, other: FoundView): string | null {
  const a = view.tombstones[`found:${id}`]?.deleted_at ?? null;
  const b = other.tombstones[`found:${id}`]?.deleted_at ?? null;
  if (!a) return b;
  if (!b) return a;
  return isoCompare(a, b) >= 0 ? a : b;
}

/**
 * Pick the merged record for one pin id: note from the newest note_updated_at
 * (never concatenated), found_at = earliest discovery time. The note is empty
 * unless one side actually wrote one — a later empty edit never wipes text.
 */
function pickRecord(a: FoundRecord | undefined, b: FoundRecord | undefined): FoundRecord | undefined {
  if (!a) return b ? { ...b } : undefined;
  if (!b) return { ...a };
  const noteA = a.note_updated_at ?? "";
  const noteB = b.note_updated_at ?? "";
  const winner = isoCompare(noteB, noteA) > 0 ? b : a;
  return {
    found_at: isoCompare(a.found_at, b.found_at) <= 0 ? a.found_at : b.found_at,
    note: winner.note,
    note_updated_at: winner.note_updated_at,
  };
}

/**
 * Union of pin ids. A tombstoned id stays deleted UNLESS a found record with a
 * later found_at exists (re-found after the delete).
 */
export function mergeFoundRecords(guest: FoundView, account: FoundView): Record<string, FoundRecord> {
  const out: Record<string, FoundRecord> = {};
  const ids = new Set([...Object.keys(guest.found), ...Object.keys(account.found)]);
  for (const id of ids) {
    const rec = pickRecord(guest.found[id], account.found[id]);
    const tombDeletedAt = newestTombstoneDeletedAt(guest, id, account);
    if (tombDeletedAt && rec && isoCompare(tombDeletedAt, rec.found_at) > 0) {
      continue; // deleted later than any discovery — stays deleted
    }
    if (rec) out[id] = rec;
  }
  return out;
}

/** Union of favorites; duplicate ids keep the earliest saved_at. */
export function mergeFavorites(
  guest: Record<string, FavoriteRecord>,
  account: Record<string, FavoriteRecord>,
): Record<string, FavoriteRecord> {
  const out: Record<string, FavoriteRecord> = { ...guest };
  for (const [id, acc] of Object.entries(account)) {
    const existing = out[id];
    if (!existing || isoCompare(acc.saved_at, existing.saved_at) < 0) {
      out[id] = { ...acc };
    } else {
      out[id] = { ...existing };
    }
  }
  return out;
}

/** Union by record id; duplicate ids keep the newest dated record. */
export function mergeGameRecords(guestGames: GameRecord[], accountGames: GameRecord[]): GameRecord[] {
  const byId = new Map<string, GameRecord>();
  for (const g of guestGames) byId.set(g.id, { ...g });
  for (const g of accountGames) {
    const existing = byId.get(g.id);
    if (!existing || isoCompare(g.date, existing.date) > 0) {
      byId.set(g.id, { ...g });
    }
  }
  return [...byId.values()];
}

export type ApplyMergeResult =
  | { choice: "merge" | "start-fresh"; merged: MergeData; report: string[] }
  | { choice: "keep-separate"; guestOnly: MergeData };

function describeNoteChoice(id: string, guest: FoundRecord | undefined, account: FoundRecord | undefined): string {
  if (guest && !account) return `${id}: kept guest record only`;
  if (account && !guest) return `${id}: kept account record only`;
  if (!guest || !account) return `${id}: skipped (tombstoned)`;
  const noteA = guest.note_updated_at ?? "";
  const noteB = account.note_updated_at ?? "";
  if (noteB === "" && noteA === "") return `${id}: no notes on either side`;
  if (isoCompare(noteB, noteA) > 0) return `${id}: kept account note (newer)`;
  if (isoCompare(noteA, noteB) > 0) return `${id}: kept guest note (newer)`;
  return `${id}: kept guest note (same timestamp)`;
}

/**
 * Full guest→account store merge with a per-record source report — the same
 * shape that will seed the future Supabase profiles sync.
 */
export function mergeStores(
  guest: GuestStoreState,
  account: GuestStoreState,
): { merged: MergeData & { tombstones: Record<string, Tombstone> }; report: string[] } {
  const guestView: FoundView = { found: guest.found, tombstones: guest.meta.tombstones };
  const accountView: FoundView = { found: account.found, tombstones: account.meta.tombstones };
  const merged = mergeFoundRecords(guestView, accountView);
  const report: string[] = [];

  const pinIds = new Set<string>();
  for (const key of [
    ...Object.keys(guest.found),
    ...Object.keys(account.found),
    ...Object.keys(guest.meta.tombstones),
    ...Object.keys(account.meta.tombstones),
  ]) {
    pinIds.add(key.startsWith("found:") ? key.slice("found:".length) : key);
  }
  for (const id of pinIds) {
    if (Object.prototype.hasOwnProperty.call(merged, id)) {
      report.push(describeNoteChoice(id, guest.found[id], account.found[id]));
    } else {
      report.push(`${id}: dropped — tombstoned`);
    }
  }
  report.sort();

  const favorites = mergeFavorites(guest.favorites, account.favorites);
  const tombstones: Record<string, Tombstone> = { ...account.meta.tombstones };
  for (const [key, tomb] of Object.entries(guest.meta.tombstones)) {
    const existing = tombstones[key];
    if (!existing || isoCompare(tomb.deleted_at, existing.deleted_at) > 0) {
      tombstones[key] = { ...tomb };
    }
  }
  return { merged: { found: merged, favorites, games: [], tombstones }, report };
}

/**
 * Implements the first-sign-in screen semantics (spec §2.3):
 * - merge: union per above (newest note wins, tombstones honored);
 * - start-fresh: account wins — guest data stays local-only, is not uploaded;
 * - keep-separate: guest stays local-only (returned separately for the caller
 *   to keep in the guest store untouched).
 */
export function applyMergeChoice(choice: MergeChoice, guest: MergeSource, account: MergeSource): ApplyMergeResult {
  if (choice === "start-fresh") {
    const accountCopy: MergeData = {
      found: Object.fromEntries(Object.entries(account.found.found).map(([k, v]) => [k, { ...v }])),
      favorites: Object.fromEntries(Object.entries(account.favorites).map(([k, v]) => [k, { ...v }])),
      games: account.games.map((g) => ({ ...g })),
    };
    return {
      choice,
      merged: accountCopy,
      report: ["start-fresh: account data wins; guest data stays local-only and is never uploaded"],
    };
  }
  if (choice === "keep-separate") {
    const guestCopy: MergeData = {
      found: Object.fromEntries(Object.entries(guest.found.found).map(([k, v]) => [k, { ...v }])),
      favorites: Object.fromEntries(Object.entries(guest.favorites).map(([k, v]) => [k, { ...v }])),
      games: guest.games.map((g) => ({ ...g })),
    };
    return { choice, guestOnly: guestCopy };
  }
  const found = mergeFoundRecords(guest.found, account.found);
  const favorites = mergeFavorites(guest.favorites, account.favorites);
  const games = mergeGameRecords(guest.games, account.games);
  const report: string[] = [];
  const ids = new Set([...Object.keys(guest.found.found), ...Object.keys(account.found.found)]);
  for (const id of ids) {
    if (Object.prototype.hasOwnProperty.call(found, id)) {
      report.push(describeNoteChoice(id, guest.found.found[id], account.found.found[id]));
    } else {
      report.push(`${id}: dropped — tombstoned`);
    }
  }
  report.push(
    `favorites: ${Object.keys(favorites).length} after union (${Object.keys(guest.favorites).length} guest + ${Object.keys(account.favorites).length} account)`,
  );
  report.push(
    `games: ${games.length} after union (${guest.games.length} guest + ${account.games.length} account)`,
  );
  report.sort();
  return { choice, merged: { found, favorites, games }, report };
}
