// ─── modules/community/guestStore.ts ────────────────────────────────────────
// Consolidated guest progress store v2 (community-spec §2.1, §2.2).
//
// One atomic localStorage object `gta6mapx_progress_v2` replaces the v1 id-array:
//   found     — pin id → { found_at, note, note_updated_at }
//   favorites — pin id → { saved_at }  (separate from found: bookmark first)
//   meta      — timestamps + 30-day tombstones so a delete can't be resurrected
//              by a stale tab (or a stale import / the future account merge).
//
// Guarantees: zero network calls; all storage access try/catch; stats are
// derived, never stored; quota guard refuses writes instead of silently losing
// data (caller shows a banner); note limit is rejected, never truncated.

import { mergeFavorites, mergeFoundRecords } from "./merge";

export const GUEST_STORE_KEY = "gta6mapx_progress_v2";
const V1_KEY = "gta6mapx_found_v1";
const STORE_VERSION = 2;
const NOTE_MAX_CHARS = 2000;
const IMPORT_MAX_BYTES = 2_000_000;
const IMPORT_MAX_RECORDS = 20_000;
const QUOTA_BYTES = 3_000_000;
const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface FoundRecord {
  found_at: string;
  note: string;
  note_updated_at: string | null;
}

export interface FavoriteRecord {
  saved_at: string;
}

export interface Tombstone {
  deleted_at: string;
}

export interface GuestStoreState {
  version: 2;
  found: Record<string, FoundRecord>;
  favorites: Record<string, FavoriteRecord>;
  meta: {
    created_at: string;
    updated_at: string;
    migrated_from_v1: boolean;
    tombstones: Record<string, Tombstone>;
  };
}

export type WriteResult = { ok: true } | { ok: false; reason: string };

export type ImportResult =
  | { ok: true; imported: number }
  | { ok: false; reason: string };

export type ResetResult =
  | { ok: true; exportPayload: string }
  | { ok: false; reason: string };

// ─── storage helpers ────────────────────────────────────────────────────────

function canStore(): boolean {
  return typeof localStorage !== "undefined";
}

function nowIso(): string {
  return new Date().toISOString();
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isIsoString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && !Number.isNaN(Date.parse(v));
}

function validateFoundRecord(raw: unknown): FoundRecord | null {
  if (!isObject(raw)) return null;
  if (!isIsoString(raw.found_at)) return null;
  if (typeof raw.note !== "string") return null;
  if (raw.note.length > NOTE_MAX_CHARS) return null;
  const noteUpdatedAt =
    raw.note_updated_at === null || raw.note_updated_at === undefined
      ? null
      : isIsoString(raw.note_updated_at)
        ? raw.note_updated_at
        : null;
  if (raw.note_updated_at !== null && raw.note_updated_at !== undefined && noteUpdatedAt === null) {
    return null;
  }
  return { found_at: raw.found_at, note: raw.note, note_updated_at: noteUpdatedAt };
}

function validateFavoriteRecord(raw: unknown): FavoriteRecord | null {
  if (!isObject(raw)) return null;
  if (!isIsoString(raw.saved_at)) return null;
  return { saved_at: raw.saved_at };
}

function validateTombstone(raw: unknown): Tombstone | null {
  if (!isObject(raw)) return null;
  if (!isIsoString(raw.deleted_at)) return null;
  return { deleted_at: raw.deleted_at };
}

function freshState(): GuestStoreState {
  const now = nowIso();
  return {
    version: STORE_VERSION,
    found: {},
    favorites: {},
    meta: { created_at: now, updated_at: now, migrated_from_v1: false, tombstones: {} },
  };
}

/** Validate a parsed store object; returns null on any schema violation. */
function validateStore(raw: unknown): GuestStoreState | null {
  if (!isObject(raw)) return null;
  if (raw.version !== STORE_VERSION) return null;
  if (!isObject(raw.found) || !isObject(raw.favorites) || !isObject(raw.meta)) return null;
  const meta = raw.meta;
  if (!isIsoString(meta.created_at) || !isIsoString(meta.updated_at)) return null;
  if (typeof meta.migrated_from_v1 !== "boolean") return null;
  if (!isObject(meta.tombstones)) return null;

  const found: Record<string, FoundRecord> = {};
  for (const [id, rec] of Object.entries(raw.found)) {
    const valid = validateFoundRecord(rec);
    if (!valid) return null;
    found[id] = valid;
  }
  const favorites: Record<string, FavoriteRecord> = {};
  for (const [id, rec] of Object.entries(raw.favorites)) {
    const valid = validateFavoriteRecord(rec);
    if (!valid) return null;
    favorites[id] = valid;
  }
  const tombstones: Record<string, Tombstone> = {};
  for (const [id, rec] of Object.entries(meta.tombstones)) {
    const valid = validateTombstone(rec);
    if (!valid) return null;
    tombstones[id] = valid;
  }
  return {
    version: STORE_VERSION,
    found,
    favorites,
    meta: {
      created_at: meta.created_at,
      updated_at: meta.updated_at,
      migrated_from_v1: meta.migrated_from_v1,
      tombstones,
    },
  };
}

/**
 * Read the store. Missing, corrupt, or unavailable storage → fresh defaults
 * (never throws, never invents records).
 */
export function loadStore(): GuestStoreState {
  if (!canStore()) return freshState();
  try {
    const raw = localStorage.getItem(GUEST_STORE_KEY);
    if (!raw) return freshState();
    return validateStore(JSON.parse(raw)) ?? freshState();
  } catch {
    return freshState();
  }
}

/**
 * Persist a store state. Refuses the write (never partially) when the 3 MB
 * soft quota would be exceeded or storage throws — caller shows a banner.
 */
function saveStore(state: GuestStoreState): WriteResult {
  if (!canStore()) return { ok: false, reason: "storage-unavailable" };
  const payload = JSON.stringify(state);
  if (payload.length > QUOTA_BYTES) {
    return { ok: false, reason: "quota" };
  }
  try {
    localStorage.setItem(GUEST_STORE_KEY, payload);
    return { ok: true };
  } catch {
    return { ok: false, reason: "quota" };
  }
}

/** Load → mutate → save in one step, stamping meta.updated_at on write. */
function updateStore(mutate: (state: GuestStoreState) => void): WriteResult {
  const state = loadStore();
  mutate(state);
  state.meta.updated_at = nowIso();
  return saveStore(state);
}

// ─── reads ──────────────────────────────────────────────────────────────────

/** The set of currently-found pin ids (tombstones are already excluded on write). */
export function getFoundIds(): Set<string> {
  return new Set(Object.keys(loadStore().found));
}

/** Favorite pin ids, for parity with getFoundIds. */
export function getFavoriteIds(): Set<string> {
  return new Set(Object.keys(loadStore().favorites));
}

// ─── mutations ──────────────────────────────────────────────────────────────

/** Mark a pin found (re-find after a delete clears the tombstone). */
export function addFound(id: string): WriteResult {
  if (typeof id !== "string" || id.length === 0) return { ok: false, reason: "invalid-id" };
  return updateStore((state) => {
    if (!state.found[id]) {
      state.found[id] = { found_at: nowIso(), note: "", note_updated_at: null };
    }
    delete state.meta.tombstones[`found:${id}`];
  });
}

/**
 * Un-mark a pin as found. Writes a `found:<id>` tombstone so a stale tab (or
 * import, or future account data) cannot resurrect the deleted pin.
 */
export function removeFound(id: string): WriteResult {
  if (typeof id !== "string" || id.length === 0) return { ok: false, reason: "invalid-id" };
  return updateStore((state) => {
    delete state.found[id];
    state.meta.tombstones[`found:${id}`] = { deleted_at: nowIso() };
  });
}

/** Set a pin's note (≤2000 chars — over limit is rejected, never truncated). */
export function setNote(id: string, text: string): WriteResult {
  if (typeof id !== "string" || id.length === 0) return { ok: false, reason: "invalid-id" };
  if (typeof text !== "string") return { ok: false, reason: "invalid-note" };
  if (text.length > NOTE_MAX_CHARS) {
    return { ok: false, reason: "note-too-long" };
  }
  const now = nowIso();
  return updateStore((state) => {
    const rec = state.found[id];
    if (!rec) return;
    rec.note = text;
    rec.note_updated_at = now;
  });
}

/** Toggle a favorite (independent of found state). */
export function toggleFavorite(id: string): WriteResult {
  if (typeof id !== "string" || id.length === 0) return { ok: false, reason: "invalid-id" };
  return updateStore((state) => {
    if (state.favorites[id]) {
      delete state.favorites[id];
    } else {
      state.favorites[id] = { saved_at: nowIso() };
    }
  });
}

/** Drop tombstones older than 30 days. */
export function pruneTombstones(): WriteResult {
  return updateStore((state) => {
    const cutoff = Date.now() - TOMBSTONE_TTL_MS;
    for (const [key, tomb] of Object.entries(state.meta.tombstones)) {
      if (Date.parse(tomb.deleted_at) < cutoff) {
        delete state.meta.tombstones[key];
      }
    }
  });
}

// ─── v1 → v2 migration ──────────────────────────────────────────────────────

/**
 * Idempotent v1→v2 migration. Reads the `gta6mapx_found_v1` id-array and assigns
 * migration-time timestamps — never invented dates. The v1 key is left
 * untouched (archived, not deleted). Safe to call on every load.
 */
export function migrateV1toV2(): { migrated: boolean; imported: number } {
  const state = loadStore();
  if (state.meta.migrated_from_v1) {
    return { migrated: false, imported: 0 };
  }
  let v1Ids: string[] = [];
  if (canStore()) {
    try {
      const raw = localStorage.getItem(V1_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          v1Ids = parsed.filter((v): v is string => typeof v === "string" && v.length > 0);
        }
      }
    } catch {
      v1Ids = [];
    }
  }
  const now = nowIso();
  let imported = 0;
  for (const id of v1Ids) {
    if (!state.found[id]) {
      state.found[id] = { found_at: now, note: "", note_updated_at: null };
      imported += 1;
    }
  }
  state.meta.migrated_from_v1 = true;
  state.meta.updated_at = now;
  saveStore(state); // best-effort: migration must never break the app
  return { migrated: true, imported };
}

// ─── export / import ────────────────────────────────────────────────────────

/** JSON download payload: the full validated v2 store. */
export function exportData(): string {
  return JSON.stringify(loadStore(), null, 2);
}

/**
 * Import a payload from exportData(). Caps: ≤2 MB, ≤20k records, schema-validated.
 * Rejects with a reason — never partial-applies. On success, union-merges with
 * the current store (newest timestamps win, tombstone-checked).
 */
export function importData(json: string): ImportResult {
  if (typeof json !== "string" || json.length === 0) {
    return { ok: false, reason: "empty-file" };
  }
  const byteLength = new TextEncoder().encode(json).length;
  if (byteLength > IMPORT_MAX_BYTES) {
    return { ok: false, reason: "file-too-large" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, reason: "invalid-json" };
  }
  const incoming = validateStore(parsed);
  if (!incoming) {
    return { ok: false, reason: "invalid-schema" };
  }
  const recordCount = Object.keys(incoming.found).length + Object.keys(incoming.favorites).length;
  if (recordCount > IMPORT_MAX_RECORDS) {
    return { ok: false, reason: "too-many-records" };
  }
  const current = loadStore();
  const view = (s: GuestStoreState) => ({ found: s.found, tombstones: s.meta.tombstones });
  const mergedFound = mergeFoundRecords(view(current), view(incoming));
  const mergedFavorites = mergeFavorites(current.favorites, incoming.favorites);
  // Tombstones: union both sides so a deleted pin stays deleted after import.
  const mergedTombstones: Record<string, Tombstone> = { ...incoming.meta.tombstones };
  for (const [key, tomb] of Object.entries(current.meta.tombstones)) {
    const existing = mergedTombstones[key];
    if (!existing || Date.parse(tomb.deleted_at) > Date.parse(existing.deleted_at)) {
      mergedTombstones[key] = tomb;
    }
  }
  const next: GuestStoreState = {
    version: STORE_VERSION,
    found: mergedFound,
    favorites: mergedFavorites,
    meta: {
      created_at: current.meta.created_at,
      updated_at: nowIso(),
      migrated_from_v1: current.meta.migrated_from_v1 || incoming.meta.migrated_from_v1,
      tombstones: mergedTombstones,
    },
  };
  const result = saveStore(next);
  if (!result.ok) return { ok: false, reason: result.reason };
  return { ok: true, imported: recordCount };
}

// ─── reset ──────────────────────────────────────────────────────────────────

/**
 * Full reset. Requires the exact phrase "RESET" (typed by the caller — the UI
 * makes the user type it). Returns the current data as exportPayload so the
 * caller can offer "export first" before clearing. The device id is untouched.
 */
export function resetAll(typedText: string): ResetResult {
  if (typedText !== "RESET") {
    return { ok: false, reason: "confirmation-phrase-required" };
  }
  const exportPayload = exportData();
  const current = loadStore();
  const fresh = freshState();
  // Preserve the migration flag so a reset never resurrects archived v1 ids.
  fresh.meta.migrated_from_v1 = current.meta.migrated_from_v1;
  const result = saveStore(fresh);
  if (!result.ok) return { ok: false, reason: result.reason };
  return { ok: true, exportPayload };
}

// ─── multi-tab ──────────────────────────────────────────────────────────────

/**
 * Subscribe to cross-tab changes. On an external change to our key, reload and
 * union-merge with the last locally-seen state (newest updated_at per record,
 * tombstone-checked), write back only if the local tab held newer data, then
 * call cb. Returns an unsubscribe function.
 */
export function onStoreChange(cb: () => void): () => void {
  if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
    return () => {};
  }
  let lastSeen = canStore() ? localStorage.getItem(GUEST_STORE_KEY) : null;

  const handler = (e: StorageEvent) => {
    if (e.key !== GUEST_STORE_KEY) return;
    const externalRaw = e.newValue;
    const localRaw = lastSeen;
    lastSeen = externalRaw;
    try {
      const external = (externalRaw ? validateStore(JSON.parse(externalRaw)) : null) ?? freshState();
      const local = (localRaw ? validateStore(JSON.parse(localRaw)) : null) ?? freshState();
      const mergedFound = mergeFoundRecords(
        { found: local.found, tombstones: local.meta.tombstones },
        { found: external.found, tombstones: external.meta.tombstones },
      );
      const mergedFavorites = mergeFavorites(local.favorites, external.favorites);
      const mergedTombstones: Record<string, Tombstone> = { ...external.meta.tombstones };
      for (const [key, tomb] of Object.entries(local.meta.tombstones)) {
        const existing = mergedTombstones[key];
        if (!existing || Date.parse(tomb.deleted_at) > Date.parse(existing.deleted_at)) {
          mergedTombstones[key] = tomb;
        }
      }
      const merged: GuestStoreState = {
        version: STORE_VERSION,
        found: mergedFound,
        favorites: mergedFavorites,
        meta: {
          created_at: local.meta.created_at < external.meta.created_at ? local.meta.created_at : external.meta.created_at,
          updated_at: nowIso(),
          migrated_from_v1: local.meta.migrated_from_v1 || external.meta.migrated_from_v1,
          tombstones: mergedTombstones,
        },
      };
      // Write back only when the merge changed something (breaks write loops).
      const mergedJson = JSON.stringify(merged);
      if (mergedJson !== (externalRaw ?? "")) {
        const saved = saveStore(merged);
        if (saved.ok) lastSeen = mergedJson;
      }
    } catch {
      /* invalid payload from another context — ignore, keep working */
    }
    cb();
  };

  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
