// ─── modules/community/submissionLogic.ts ───────────────────────────────────
// WORKER C — shared submission logic for the "Suggest a location" pipeline
// (community-spec.md §3.1 / §3.5). Pure, testable functions: coordinate
// validation, Leonida bounds, evidence matrix checks, leak-host blocking,
// duplicate *warning* (never a block), daily rate limiting, draft handling.
//
// Client gates live here so the form UI and the node acceptance script share
// one implementation. No backend: outbox/drafts/rate-limit live in
// localStorage under guest-local keys.

import type { CommunitySubmission, ProposedStatus, SourceType } from "./types";
import { OUTBOX_KEY } from "./localRepos";

export const DRAFTS_KEY = "gta6mapx_submission_drafts_v1";
export const RATELIMIT_KEY = "gta6mapx_submit_ratelimit_v1";
export const ADMIN_FLAG_KEY = "gta6mapx_admin_v1";

export const MAX_DAILY_SUBMISSIONS = 5; // guest tier daily cap (spec §3.5)
export const MAX_DRAFTS = 3;
export const DUPLICATE_RADIUS_M = 150; // dedup radius (spec §3.5)
export const DUPLICATE_NAME_SIMILARITY = 0.8;
export const HIGH_INTEREST_CONFIRMS = 25; // review-suggestion threshold

// ─── Leonida region bounds (≈ Florida; Leonida ≈ Florida pre-launch) ────────
// Sample pins use Miami coords (25.77, -80.19). These bounds are generous on
// purpose — a *bounds* check, not a shape check.

export const LEONIDA_BOUNDS = {
  minLat: 24.0,
  maxLat: 31.5,
  minLng: -88.0,
  maxLng: -79.5,
} as const;

export function inLeonida(lat: number, lng: number): boolean {
  return (
    lat >= LEONIDA_BOUNDS.minLat &&
    lat <= LEONIDA_BOUNDS.maxLat &&
    lng >= LEONIDA_BOUNDS.minLng &&
    lng <= LEONIDA_BOUNDS.maxLng
  );
}

export type CoordResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

export function validateLatitude(raw: string): CoordResult {
  const v = Number(raw.trim());
  if (!Number.isFinite(v)) return { ok: false, error: "Enter a number, e.g. 25.7743." };
  if (v < -90 || v > 90) return { ok: false, error: "Latitude must be between -90 and 90." };
  return { ok: true, value: v };
}

export function validateLongitude(raw: string): CoordResult {
  const v = Number(raw.trim());
  if (!Number.isFinite(v)) return { ok: false, error: "Enter a number, e.g. -80.1937." };
  if (v < -180 || v > 180)
    return { ok: false, error: "Longitude must be between -180 and 180." };
  return { ok: true, value: v };
}

// ─── Storage accessor (browser-first, session fallback) ────────────────────

interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

const sessionFallback = new Map<string, string>();

function storage(): StorageLike {
  const g = globalThis as unknown as {
    localStorage?: StorageLike;
    window?: { localStorage?: StorageLike };
  };
  if (g.localStorage && typeof g.localStorage.getItem === "function")
    return g.localStorage;
  if (
    g.window?.localStorage &&
    typeof g.window.localStorage.getItem === "function"
  )
    return g.window.localStorage;
  // Session-scoped fallback — never throws, never pretends to persist.
  return {
    getItem: (k) => sessionFallback.get(k) ?? null,
    setItem: (k, v) => void sessionFallback.set(k, v),
    removeItem: (k) => void sessionFallback.delete(k),
  };
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = storage().getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): boolean {
  try {
    storage().setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// ─── Evidence: trailer timestamp validation ────────────────────────────────

/** `m:ss` (e.g. "0:42", "12:34"). Seconds must be 00–59. */
export function isValidTimestamp(ts: string): boolean {
  return /^\d+:[0-5]\d$/.test(ts.trim());
}

// ─── Duplicate warning (never a block — spec §3.5) ─────────────────────────

export interface PinLike {
  id: string;
  name: string;
  slug?: string;
  categorySlug: string;
  lat: number;
  lng: number;
}

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Dice coefficient over character bigrams — 1.0 for identical names. */
export function nameSimilarity(a: string, b: string): number {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const bigrams = (s: string) => {
    const t = norm(s).replace(/\s+/g, " ");
    const out: string[] = [];
    for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
    return out;
  };
  const x = bigrams(a);
  const y = bigrams(b);
  if (x.length === 0 || y.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const g of y) counts.set(g, (counts.get(g) ?? 0) + 1);
  let hits = 0;
  for (const g of x) {
    const c = counts.get(g) ?? 0;
    if (c > 0) {
      hits++;
      counts.set(g, c - 1);
    }
  }
  return (2 * hits) / (x.length + y.length);
}

// ─── Evidence: leak-host blocklist (client layer of the 3-layer defense) ───
// Blocks raw file-hosting URLs — links that could distribute leaked game
// files. Users are told to link news coverage *about* the leak instead
// (spec section 2.3 / 3.5). This is the client layer; a server blocklist
// and moderator judgment are the other two.
//
// Stored as label fragments (joined at runtime) rather than literal
// hostnames so the list cannot be scraped as a link directory.

const LEAK_HOST_PARTS: [string, string][] = [
  ["mega", "nz"],
  ["mediafire", "com"],
  ["1fichier", "com"],
  ["filebin", "net"],
  ["catbox", "moe"],
  ["pixeldrain", "com"],
  ["gofile", "io"],
  ["workupload", "com"],
  ["sendspace", "com"],
  ["rapidgator", "net"],
  ["uploaded", "net"],
  ["turbobit", "net"],
  ["usersdrive", "com"],
  ["anonfiles", "com"],
  ["zippyshare", "com"],
];

export const LEAK_HOST_BLOCKLIST: readonly string[] = LEAK_HOST_PARTS.map(
  (p) => `${p[0]}.${p[1]}`,
);

export function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isFileHostUrl(url: string): boolean {
  const host = hostnameOf(url);
  if (!host) return false;
  return LEAK_HOST_BLOCKLIST.some(
    (blocked) => host === blocked || host.endsWith(`.${blocked}`),
  );
}

/** Rockstar-owned citation labels — advisory only, never a gate. */
export function isOfficialRockstarUrl(url: string): boolean {
  const host = hostnameOf(url);
  if (!host) return false;
  const official = ["rockstargames", "com"].join(".");
  return host === official || host.endsWith(`.${official}`);
}

// ─── Evidence matrix completeness (spec section 3.1) ───────────────────────

export interface EvidenceInput {
  sourceType: SourceType;
  trailerName?: string;
  trailerTimestamp?: string;
  sourceUrl?: string;
  sourceDescription?: string;
}

export type EvidenceError =
  | { field: "trailerName"; message: string }
  | { field: "trailerTimestamp"; message: string }
  | { field: "sourceUrl"; message: string }
  | { field: "sourceDescription"; message: string };

export const FILE_HOST_MESSAGE =
  "That link points to a file-hosting service, so we can't accept it — " +
  "we never link raw downloads of leaked game files. Link a news article " +
  "or public post *about* the leak instead.";

export function validateEvidence(e: EvidenceInput): EvidenceError[] {
  const errs: EvidenceError[] = [];
  switch (e.sourceType) {
    case "trailer":
      if (!e.trailerName?.trim())
        errs.push({ field: "trailerName", message: "Name the trailer (e.g. Trailer 2)." });
      if (!isValidTimestamp(e.trailerTimestamp ?? ""))
        errs.push({
          field: "trailerTimestamp",
          message: "Use the m:ss timestamp where the spot is visible (e.g. 0:42).",
        });
      break;
    case "leak_report": {
      const url = e.sourceUrl?.trim() ?? "";
      if (!url)
        errs.push({
          field: "sourceUrl",
          message: "Paste the public article or forum thread that reported it.",
        });
      else if (!hostnameOf(url))
        errs.push({ field: "sourceUrl", message: "That doesn't look like a valid URL." });
      else if (isFileHostUrl(url))
        errs.push({ field: "sourceUrl", message: FILE_HOST_MESSAGE });
      break;
    }
    case "rockstar_official": {
      const url = e.sourceUrl?.trim() ?? "";
      if (!url)
        errs.push({
          field: "sourceUrl",
          message: "Paste the official Rockstar URL or citation.",
        });
      else if (!hostnameOf(url))
        errs.push({ field: "sourceUrl", message: "That doesn't look like a valid URL." });
      else if (isFileHostUrl(url))
        errs.push({ field: "sourceUrl", message: FILE_HOST_MESSAGE });
      // Non-official domain is advisory only (handled in the UI copy).
      break;
    }
    case "other_public":
      if ((e.sourceDescription?.trim() ?? "").length < 20)
        errs.push({
          field: "sourceDescription",
          message: "Describe the public source in at least 20 characters.",
        });
      break;
  }
  return errs;
}

export interface DuplicateWarning {
  pinId: string;
  pinName: string;
  pinSlug?: string;
  distanceM: number;
  similarity: number;
}

/**
 * Returns duplicate candidates: same-category pin within 150 m with name
 * similarity ≥ 0.8. WARNING ONLY — the caller must never block on this.
 */
export function findDuplicateWarnings(
  lat: number,
  lng: number,
  categorySlug: string,
  name: string,
  pins: PinLike[],
): DuplicateWarning[] {
  const out: DuplicateWarning[] = [];
  for (const p of pins) {
    if (p.categorySlug !== categorySlug) continue;
    const d = haversineMeters(lat, lng, p.lat, p.lng);
    if (d > DUPLICATE_RADIUS_M) continue;
    const sim = nameSimilarity(name, p.name);
    if (sim < DUPLICATE_NAME_SIMILARITY) continue;
    out.push({
      pinId: p.id,
      pinName: p.name,
      pinSlug: p.slug,
      distanceM: Math.round(d),
      similarity: sim,
    });
  }
  return out.sort(
    (a, b) => b.similarity - a.similarity || a.distanceM - b.distanceM,
  );
}

// ─── Daily rate limit (guest tier: 5/day per device) ────────────────────────

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export interface RateLimitStatus {
  allowed: boolean;
  used: number;
  remaining: number;
  /** Friendly message when blocked. */
  message: string | null;
}

export function rateLimitStatus(now: Date = new Date()): RateLimitStatus {
  const stamps = readJson<string[]>(RATELIMIT_KEY, []);
  const today = dayKey(now);
  const used = stamps.filter((s) => dayKey(new Date(s)) === today).length;
  const remaining = Math.max(0, MAX_DAILY_SUBMISSIONS - used);
  const allowed = remaining > 0;
  return {
    allowed,
    used,
    remaining,
    message: allowed
      ? null
      : `You've used all ${MAX_DAILY_SUBMISSIONS} suggestions for today — come back tomorrow. This keeps the review queue fair for everyone.`,
  };
}

export function recordSubmission(now: Date = new Date()): void {
  const stamps = readJson<string[]>(RATELIMIT_KEY, []);
  const today = dayKey(now);
  const kept = stamps
    .filter((s) => {
      const d = new Date(s);
      return !Number.isNaN(d.getTime()) && dayKey(d) === today;
    })
    .slice(-(MAX_DAILY_SUBMISSIONS * 2));
  kept.push(now.toISOString());
  writeJson(RATELIMIT_KEY, kept);
}

// ─── Drafts (max 3, debounced save in the UI) ──────────────────────────────

export interface SubmissionDraft {
  id: string;
  updatedAt: string;
  data: Partial<WizardData>;
}

export function loadDrafts(): SubmissionDraft[] {
  const drafts = readJson<SubmissionDraft[]>(DRAFTS_KEY, []);
  return drafts
    .filter((d) => d && d.id && d.updatedAt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_DRAFTS);
}

export function saveDraft(draft: SubmissionDraft): boolean {
  const rest = loadDrafts().filter((d) => d.id !== draft.id);
  rest.unshift({ ...draft, updatedAt: new Date().toISOString() });
  return writeJson(DRAFTS_KEY, rest.slice(0, MAX_DRAFTS));
}

export function deleteDraft(id: string): boolean {
  return writeJson(
    DRAFTS_KEY,
    loadDrafts().filter((d) => d.id !== id),
  );
}

export function newDraftId(): string {
  return (
    "draft-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 8)
  );
}

// ─── Wizard data + the submit gate ─────────────────────────────────────────

export interface WizardData {
  lat: string;
  lng: string;
  categorySlug: string;
  name: string;
  description: string;
  sourceType: SourceType;
  trailerName: string;
  trailerTimestamp: string;
  sourceUrl: string;
  sourceDescription: string;
  proposedStatus: ProposedStatus;
  attestation: boolean;
}

export const EMPTY_WIZARD: WizardData = {
  lat: "",
  lng: "",
  categorySlug: "",
  name: "",
  description: "",
  sourceType: "trailer",
  trailerName: "",
  trailerTimestamp: "",
  sourceUrl: "",
  sourceDescription: "",
  proposedStatus: "leak-reported",
  attestation: false,
};

export interface GateError {
  step: number;
  field: string;
  message: string;
}

/**
 * The full submit gate. Returns [] when the submission may be created.
 * attestation === false is always fatal — the checkbox is required.
 */
export function canSubmit(d: WizardData, validCategories: string[]): GateError[] {
  const errs: GateError[] = [];

  const latR = validateLatitude(d.lat);
  const lngR = validateLongitude(d.lng);
  if (!latR.ok) errs.push({ step: 1, field: "lat", message: latR.error });
  if (!lngR.ok) errs.push({ step: 1, field: "lng", message: lngR.error });
  if (latR.ok && lngR.ok && !inLeonida(latR.value, lngR.value))
    errs.push({
      step: 1,
      field: "bounds",
      message:
        "Those coordinates are outside the Leonida region. Copy coordinates from the /map HUD — GTA 6 is set in a Florida-inspired state.",
    });

  if (!validCategories.includes(d.categorySlug))
    errs.push({ step: 2, field: "categorySlug", message: "Pick a category." });

  const name = d.name.trim();
  if (name.length < 3 || name.length > 60)
    errs.push({ step: 3, field: "name", message: "Name must be 3–60 characters." });
  const desc = d.description.trim();
  if (desc.length < 20 || desc.length > 500)
    errs.push({ step: 3, field: "description", message: "Description must be 20–500 characters." });

  for (const e of validateEvidence(d))
    errs.push({ step: 4, field: e.field, message: e.message });

  if (!d.attestation)
    errs.push({
      step: 4,
      field: "attestation",
      message:
        "Tick the attestation checkbox to confirm this contains no leaked game files or datamined content.",
    });

  return errs;
}

/** Creates the outbox record. Throws when the attestation gate fails. */
export function createOutboxSubmission(
  d: WizardData,
  displayName: string,
): CommunitySubmission {
  if (!d.attestation) throw new Error("attestation-required");
  const now = new Date().toISOString();
  const submission: CommunitySubmission = {
    id:
      "sub-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 10),
    name: d.name.trim(),
    description: d.description.trim(),
    lat: Number(d.lat),
    lng: Number(d.lng),
    categorySlug: d.categorySlug,
    proposedStatus: d.proposedStatus,
    evidence: {
      sourceType: d.sourceType,
      trailerName: d.sourceType === "trailer" ? d.trailerName.trim() : undefined,
      trailerTimestamp:
        d.sourceType === "trailer" ? d.trailerTimestamp.trim() : undefined,
      sourceUrl:
        d.sourceType === "leak_report" || d.sourceType === "rockstar_official"
          ? d.sourceUrl.trim()
          : undefined,
      sourceDescription:
        d.sourceType === "other_public" ? d.sourceDescription.trim() : undefined,
    },
    attestation: true,
    attestationAt: now,
    status: "pending",
    provenance: "community-submitted",
    displayName,
    confirms: 0,
    reports: 0,
    createdAt: now,
    updatedAt: now,
  };
  const outbox = readJson<CommunitySubmission[]>(OUTBOX_KEY, []);
  outbox.push(submission);
  writeJson(OUTBOX_KEY, outbox);
  return submission;
}

export function listOutboxSubmissions(): CommunitySubmission[] {
  return readJson<CommunitySubmission[]>(OUTBOX_KEY, []);
}

/** Admin flag check — DEV-ONLY preview. Documented as such in the queue UI. */
export function isAdminFlagSet(): boolean {
  try {
    return storage().getItem(ADMIN_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSubmissionStatus(
  id: string,
  status: CommunitySubmission["status"],
  opts?: { rejectionReason?: string; reviewerNote?: string },
): boolean {
  const outbox = readJson<CommunitySubmission[]>(OUTBOX_KEY, []);
  const idx = outbox.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  outbox[idx] = {
    ...outbox[idx],
    status,
    rejectionReason: opts?.rejectionReason,
    reviewerNote: opts?.reviewerNote,
    updatedAt: new Date().toISOString(),
  };
  return writeJson(OUTBOX_KEY, outbox);
}
