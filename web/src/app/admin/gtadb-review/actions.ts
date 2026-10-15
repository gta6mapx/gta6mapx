"use server";

// ─── admin/gtadb-review actions ─────────────────────────────────────────────
// Local admin only. Thin wrappers over review-store; the owner's click is the
// ONLY publish path. Hard rules: no auto-upgrade of evidence status,
// no bulk import, no auto-publish.

import { revalidatePath } from "next/cache";
import type { EvidenceStatus } from "@/modules/entities/types";
import {
  approveRecordCore,
  rejectRecordCore,
  reopenRecordCore,
  unpublishRecordCore,
  getReviewStatusCore,
  type ApproveForm,
} from "./review-store";

export type { ReviewDecision } from "./review-store";

export async function approveRecord(
  recordId: string,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const form: ApproveForm = {
    summary: String(formData.get("summary") ?? ""),
    region: String(formData.get("region") ?? ""),
    evidenceStatus: String(formData.get("evidenceStatus") ?? "") as EvidenceStatus,
    tags: String(formData.get("tags") ?? "").split(","),
  };
  const res = await approveRecordCore(recordId, form);
  if (res.ok) revalidatePath("/locations");
  return res;
}

export async function rejectRecord(
  recordId: string,
  reason: string
): Promise<{ ok: boolean; error?: string }> {
  return rejectRecordCore(recordId, reason);
}

export async function reopenRecord(
  recordId: string
): Promise<{ ok: boolean; error?: string }> {
  return reopenRecordCore(recordId);
}

export async function unpublishRecord(
  slug: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await unpublishRecordCore(slug);
  if (res.ok) revalidatePath("/locations");
  return res;
}

export async function getReviewStatus() {
  return getReviewStatusCore();
}
