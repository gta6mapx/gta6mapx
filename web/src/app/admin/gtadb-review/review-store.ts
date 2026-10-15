// ─── admin/gtadb-review review-store ─────────────────────────────────────────
// Server-side file IO for the review queue. Same functions the UI's server
// actions call — so a test harness can exercise the exact publish path.

import { promises as fs } from "node:fs";
import path from "node:path";
import { EVIDENCE_META, type EvidenceStatus } from "@/modules/entities/types";
import { LOCATIONS } from "@/modules/entities/data/locations";
import type { StagedNamedRecord } from "@/modules/entities/data/gtadb/schema";

const GTADB_DIR = path.join(process.cwd(), "src/modules/entities/data/gtadb");
const DATA_DIR = path.join(process.cwd(), "src/modules/entities/data");
const STAGING_FILES = ["locations.json", "stores.json", "others.json"];

export interface ReviewDecision {
  id: string;
  at: string;
  session: string;
  reviewer: string;
  action: "approved" | "rejected" | "reopened" | "unpublished";
  recordId: string;
  name: string;
  slug: string;
  evidenceStatus?: EvidenceStatus;
  note?: string;
}

export interface ApproveForm {
  summary: string;
  region: string;
  evidenceStatus: EvidenceStatus;
  tags: string[];
}

const ALLOWED_STATUSES: EvidenceStatus[] = [
  "rockstar-confirmed",
  "trailer-confirmed",
  "leak-reported",
  "disputed",
];
const SESSION = () => `review-${new Date().toISOString().slice(0, 10)}`;

export async function readStaged(): Promise<StagedNamedRecord[]> {
  const all: StagedNamedRecord[] = [];
  for (const f of STAGING_FILES) {
    const raw = await fs.readFile(path.join(GTADB_DIR, f), "utf-8");
    all.push(...(JSON.parse(raw) as StagedNamedRecord[]));
  }
  return all;
}

export async function readDecisions(): Promise<ReviewDecision[]> {
  try {
    const raw = await fs.readFile(
      path.join(GTADB_DIR, "review-decisions.json"),
      "utf-8"
    );
    return JSON.parse(raw) as ReviewDecision[];
  } catch {
    return [];
  }
}

export async function logDecision(
  d: Omit<ReviewDecision, "id" | "at" | "session" | "reviewer">
) {
  const decisions = await readDecisions();
  decisions.push({
    ...d,
    id: `rd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    session: SESSION(),
    reviewer: "owner (local)",
  });
  await fs.writeFile(
    path.join(GTADB_DIR, "review-decisions.json"),
    JSON.stringify(decisions, null, 2) + "\n"
  );
}

export async function readApproved(): Promise<Record<string, unknown>[]> {
  try {
    const raw = await fs.readFile(
      path.join(DATA_DIR, "gtadb-approved.json"),
      "utf-8"
    );
    return JSON.parse(raw) as Record<string, unknown>[];
  } catch {
    return [];
  }
}

function toGameLocation(rec: StagedNamedRecord, form: ApproveForm) {
  return {
    slug: rec.slug,
    name: rec.name,
    kind: "location",
    region: form.region,
    evidence: {
      status: form.evidenceStatus,
      detail: rec.evidenceDetail,
      sourceUrl: "https://gtadb.org",
    },
    summary: form.summary,
    tags: form.tags,
    // provenance (not rendered as a claim):
    _gtadbRecordId: rec.id,
    _gtadbSource: rec.source,
  };
}

export async function approveRecordCore(
  recordId: string,
  form: ApproveForm
): Promise<{ ok: boolean; error?: string }> {
  const staged = await readStaged();
  const rec = staged.find((r) => r.id === recordId);
  if (!rec) return { ok: false, error: "Record not found in staging." };

  const summary = form.summary.trim();
  const region = form.region.trim();
  const tags = form.tags.map((t) => t.trim()).filter(Boolean);

  // §4.2 required-field gates — cannot approve without them
  if (!ALLOWED_STATUSES.includes(form.evidenceStatus))
    return { ok: false, error: "Pick a valid evidence status." };
  if (summary.length < 50)
    return {
      ok: false,
      error: `Summary needs ≥ 50 chars (got ${summary.length}).`,
    };
  if (!region) return { ok: false, error: "Region is required." };
  if (!tags.length) return { ok: false, error: "At least one tag is required." };
  if (typeof rec.coords?.lat !== "number" || typeof rec.coords?.lng !== "number")
    return { ok: false, error: "Record has no coordinates — cannot approve." };
  if (!rec.evidenceDetail) return { ok: false, error: "Evidence detail is missing." };

  // slug uniqueness — no collision with curated locations, no double-publish
  if (LOCATIONS.some((l) => l.slug === rec.slug))
    return {
      ok: false,
      error: `Slug "${rec.slug}" already exists in curated locations. Merge, rename, or reject.`,
    };
  const approved = await readApproved();
  if (approved.some((a) => a.slug === rec.slug || a._gtadbRecordId === rec.id))
    return { ok: false, error: "Already published." };

  approved.push(
    toGameLocation(rec, { ...form, summary, region, tags })
  );
  await fs.writeFile(
    path.join(DATA_DIR, "gtadb-approved.json"),
    JSON.stringify(approved, null, 2) + "\n"
  );
  await logDecision({
    action: "approved",
    recordId: rec.id,
    name: rec.name,
    slug: rec.slug,
    evidenceStatus: form.evidenceStatus,
    note: `Published as /locations/${rec.slug}. Evidence: ${EVIDENCE_META[form.evidenceStatus].label}.`,
  });
  return { ok: true };
}

export async function rejectRecordCore(
  recordId: string,
  reason: string
): Promise<{ ok: boolean; error?: string }> {
  const staged = await readStaged();
  const rec = staged.find((r) => r.id === recordId);
  if (!rec) return { ok: false, error: "Record not found in staging." };
  const clean = reason.trim();
  if (clean.length < 5)
    return { ok: false, error: "Give a short rejection reason (≥ 5 chars)." };
  const approved = await readApproved();
  if (approved.some((a) => a._gtadbRecordId === rec.id))
    return {
      ok: false,
      error: "Already published — unpublish instead of rejecting.",
    };
  await logDecision({
    action: "rejected",
    recordId: rec.id,
    name: rec.name,
    slug: rec.slug,
    note: clean,
  });
  return { ok: true };
}

export async function reopenRecordCore(
  recordId: string
): Promise<{ ok: boolean; error?: string }> {
  const staged = await readStaged();
  const rec = staged.find((r) => r.id === recordId);
  if (!rec) return { ok: false, error: "Record not found in staging." };
  await logDecision({
    action: "reopened",
    recordId: rec.id,
    name: rec.name,
    slug: rec.slug,
    note: "Rejection withdrawn — back in the review queue.",
  });
  return { ok: true };
}

export async function unpublishRecordCore(
  slug: string
): Promise<{ ok: boolean; error?: string }> {
  const approved = await readApproved();
  const idx = approved.findIndex((a) => a.slug === slug);
  if (idx === -1) return { ok: false, error: "Not published." };
  const [removed] = approved.splice(idx, 1);
  await fs.writeFile(
    path.join(DATA_DIR, "gtadb-approved.json"),
    JSON.stringify(approved, null, 2) + "\n"
  );
  await logDecision({
    action: "unpublished",
    recordId: String(removed._gtadbRecordId ?? "?"),
    name: String(removed.name ?? ""),
    slug,
    note: "Removed from published data.",
  });
  return { ok: true };
}

export async function getReviewStatusCore(): Promise<
  Record<
    string,
    { status: "approved" | "rejected"; at: string; note?: string; slug: string }
  >
> {
  const decisions = await readDecisions();
  const latest: Record<string, ReviewDecision> = {};
  for (const d of decisions) latest[d.recordId] = d;
  const out: Record<
    string,
    { status: "approved" | "rejected"; at: string; note?: string; slug: string }
  > = {};
  for (const [id, d] of Object.entries(latest)) {
    if (d.action === "approved")
      out[id] = { status: "approved", at: d.at, note: d.note, slug: d.slug };
    else if (d.action === "rejected")
      out[id] = { status: "rejected", at: d.at, note: d.note, slug: d.slug };
  }
  return out;
}
