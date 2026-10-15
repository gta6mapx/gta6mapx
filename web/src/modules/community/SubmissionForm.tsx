"use client";

// ─── modules/community/SubmissionForm.tsx ───────────────────────────────────
// WORKER C — "Suggest a location" 5-step wizard (community-spec.md §3.1).
// Guest-local: submissions land in the device outbox honestly labeled
// "not yet received by moderators". Gates: 5/day rate limit, duplicate
// *warning* (never a block), attestation required, draft auto-save.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CATEGORIES, PINS } from "@/data/pins";
import type { ProposedStatus, SourceType } from "./types";
import { getRepositories } from "./communityClient";
import {
  EMPTY_WIZARD,
  canSubmit,
  deleteDraft,
  findDuplicateWarnings,
  isOfficialRockstarUrl,
  loadDrafts,
  newDraftId,
  rateLimitStatus,
  recordSubmission,
  saveDraft,
  validateLatitude,
  validateLongitude,
  inLeonida,
  type DuplicateWarning,
  type GateError,
  type SubmissionDraft,
  type WizardData,
} from "./submissionLogic";

const STEPS = ["Location", "Category", "Details", "Evidence", "Review"] as const;

const SOURCE_TYPES: { value: SourceType; label: string; hint: string }[] = [
  { value: "trailer", label: "Trailer", hint: "A moment in an official trailer" },
  { value: "leak_report", label: "Leak report", hint: "A public article about the leak — never a file dump" },
  { value: "rockstar_official", label: "Rockstar official", hint: "Newswire or official site post" },
  { value: "other_public", label: "Other public source", hint: "Stream, interview, or public post" },
];

const PROPOSED_STATUSES: { value: ProposedStatus; label: string; hint: string }[] = [
  { value: "trailer-confirmed", label: "Trailer-confirmed", hint: "Visible in an official trailer" },
  { value: "leak-reported", label: "Leak-reported", hint: "Reported by public coverage of a leak" },
  { value: "disputed", label: "Disputed", hint: "Contested or unclear — needs more evidence" },
];

const ATTESTATION_COPY =
  "I captured any screenshots myself from public trailers/streams. This contains no leaked game files or datamined content.";

const inputCls =
  "w-full rounded-lg border border-[#232c3b] bg-[#0d1117] px-3 py-2.5 text-sm text-white placeholder-[#5b6472] focus:border-cyan-400 focus:outline-none";
const labelCls = "mb-1 block text-sm font-semibold text-[#c8d0dc]";

export default function SubmissionForm() {
  const [data, setData] = useState<WizardData>(EMPTY_WIZARD);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<GateError[]>([]);
  const [drafts, setDrafts] = useState<SubmissionDraft[]>(() => loadDrafts());
  const [draftId, setDraftId] = useState<string | null>(null);
  const [rate, setRate] = useState(() => rateLimitStatus());
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [dupDismissed, setDupDismissed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const validCategories = useMemo(() => CATEGORIES.map((c) => c.slug), []);
  const pins = useMemo(
    () =>
      PINS.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        categorySlug: p.categorySlug,
        lat: p.lat,
        lng: p.lng,
      })),
    [],
  );

  // ─── Drafts + rate limit load lazily in their useState initializers ────────

  // ─── Debounced draft auto-save ────────────────────────────────────────────
  const dirty = useMemo(
    () => JSON.stringify(data) !== JSON.stringify(EMPTY_WIZARD),
    [data],
  );
  useEffect(() => {
    if (draftTimer.current) clearTimeout(draftTimer.current);
    if (!dirty || submittedId) return;
    draftTimer.current = setTimeout(() => {
      const id = draftId ?? newDraftId();
      if (saveDraft({ id, updatedAt: new Date().toISOString(), data })) {
        setDraftId(id);
        setDrafts(loadDrafts());
      }
    }, 900);
    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
  }, [data, dirty, draftId, submittedId]);

  const set = useCallback(
    <K extends keyof WizardData>(k: K, v: WizardData[K]) => {
      setData((d) => ({ ...d, [k]: v }));
      setErrors((es) => es.filter((e) => e.field !== k));
    },
    [],
  );

  const resumeDraft = useCallback((draft: SubmissionDraft) => {
    setData({ ...EMPTY_WIZARD, ...draft.data });
    setDraftId(draft.id);
    setStep(0);
    setErrors([]);
    setDupDismissed(false);
  }, []);

  const discardDraft = useCallback((id: string) => {
    deleteDraft(id);
    setDrafts(loadDrafts());
    if (draftId === id) {
      setDraftId(null);
      setData(EMPTY_WIZARD);
      setStep(0);
    }
  }, [draftId]);

  // ─── Duplicate warnings (step 5) — warning only, never a block ────────────
  const dupWarnings: DuplicateWarning[] = useMemo(() => {
    const lat = Number(data.lat);
    const lng = Number(data.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    if (!data.categorySlug || data.name.trim().length < 3) return [];
    return findDuplicateWarnings(lat, lng, data.categorySlug, data.name, pins);
  }, [data.lat, data.lng, data.categorySlug, data.name, pins]);

  const goNext = () => {
    const errs = canSubmit(data, validCategories).filter((e) => e.step === step + 1);
    if (errs.length > 0) {
      setErrors(errs);
      return;
    }
    setErrors([]);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    setErrors([]);
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleSubmit = async () => {
    const errs = canSubmit(data, validCategories);
    if (errs.length > 0) {
      setErrors(errs);
      setStep(errs[0].step - 1);
      return;
    }
    const rl = rateLimitStatus();
    setRate(rl);
    if (!rl.allowed) return;
    setSubmitting(true);
    try {
      const repos = getRepositories();
      const created = await repos.submissions.create({
        name: data.name.trim(),
        description: data.description.trim(),
        lat: Number(data.lat),
        lng: Number(data.lng),
        categorySlug: data.categorySlug,
        proposedStatus: data.proposedStatus,
        evidence: {
          sourceType: data.sourceType,
          trailerName: data.sourceType === "trailer" ? data.trailerName.trim() : undefined,
          trailerTimestamp:
            data.sourceType === "trailer" ? data.trailerTimestamp.trim() : undefined,
          sourceUrl:
            data.sourceType === "leak_report" || data.sourceType === "rockstar_official"
              ? data.sourceUrl.trim()
              : undefined,
          sourceDescription:
            data.sourceType === "other_public" ? data.sourceDescription.trim() : undefined,
        },
        attestation: true,
      });
      recordSubmission();
      if (draftId) deleteDraft(draftId);
      setDrafts(loadDrafts());
      setRate(rateLimitStatus());
      setSubmittedId(created.id);
      setErrors([]);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Success state ────────────────────────────────────────────────────────
  if (submittedId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-400/10 text-3xl">
          ✓
        </div>
        <h2 className="mt-4 text-2xl font-extrabold text-white">Suggestion saved</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-[#8b94a3]">
          <b className="text-cyan-300">Saved on this device — not yet received by moderators.</b>
          {" "}Guest suggestions stay in your device outbox until the moderation queue goes live
          with accounts. Nothing was sent anywhere.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              setData(EMPTY_WIZARD);
              setDraftId(null);
              setSubmittedId(null);
              setStep(0);
              setDupDismissed(false);
            }}
            className="rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-bold text-black hover:bg-cyan-400"
          >
            Suggest another location
          </button>
          <Link
            href="/map"
            className="rounded-lg border border-[#232c3b] bg-[#11161f] px-5 py-2.5 text-sm font-bold text-white hover:border-cyan-400/50"
          >
            View the map
          </Link>
        </div>
      </div>
    );
  }

  const errFor = (field: string) => errors.find((e) => e.field === field)?.message;
  const fieldErr = (field: string) =>
    errFor(field) ? (
      <p className="mt-1 text-xs font-semibold text-red-400">{errFor(field)}</p>
    ) : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Rate-limit banner */}
      {!rate.allowed && (
        <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          <b>Daily limit reached.</b> {rate.message}
        </div>
      )}
      {rate.allowed && rate.used > 0 && (
        <p className="mb-4 text-xs text-[#8b94a3]">
          {rate.remaining} of 5 suggestions left today.
        </p>
      )}

      {/* Draft resume / discard chips */}
      {drafts.length > 0 && !draftId && (
        <div className="mb-4 rounded-xl border border-[#1f2632] bg-[#11161f] p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-[#8b94a3]">
            Unfinished drafts
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {drafts.map((d) => (
              <span
                key={d.id}
                className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 py-1 pl-3 pr-1 text-xs text-cyan-200"
              >
                <button onClick={() => resumeDraft(d)} className="font-semibold hover:underline">
                  Resume — {d.data.name?.trim() || "untitled"} ·{" "}
                  {new Date(d.updatedAt).toLocaleString()}
                </button>
                <button
                  onClick={() => discardDraft(d.id)}
                  aria-label="Discard draft"
                  className="rounded-full px-1.5 text-cyan-400 hover:bg-cyan-500/20 hover:text-white"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Step indicator */}
      <ol className="mb-6 flex items-center gap-1 sm:gap-2" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center">
            <button
              type="button"
              onClick={() => i <= step && setStep(i)}
              disabled={i > step}
              className={`flex w-full flex-col items-center gap-1 rounded-lg py-2 text-[11px] font-bold uppercase tracking-wide ${
                i === step
                  ? "text-cyan-300"
                  : i < step
                    ? "text-[#8b94a3] hover:text-white"
                    : "text-[#4b5462]"
              }`}
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs ${
                  i === step
                    ? "border-cyan-400 bg-cyan-400/15 text-cyan-300"
                    : i < step
                      ? "border-green-500/50 bg-green-500/10 text-green-400"
                      : "border-[#232c3b] bg-[#11161f] text-[#4b5462]"
                }`}
              >
                {i < step ? "✓" : i + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </button>
            {i < STEPS.length - 1 && <span className="mx-1 h-px flex-1 bg-[#232c3b]" />}
          </li>
        ))}
      </ol>

      <div className="rounded-xl border border-[#1f2632] bg-[#11161f] p-4 sm:p-6">
        {/* ── Step 1: coordinates ── */}
        {step === 0 && (
          <div>
            <h2 className="text-xl font-extrabold text-white">Where is it?</h2>
            <p className="mt-1 text-sm text-[#8b94a3]">
              Tip: open <Link href="/map" className="text-cyan-300 underline">/map</Link>,
              hover the HUD and copy the coordinates shown there.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="lat" className={labelCls}>Latitude</label>
                <input
                  id="lat"
                  inputMode="decimal"
                  placeholder="25.7743"
                  value={data.lat}
                  onChange={(e) => set("lat", e.target.value)}
                  className={inputCls}
                />
                {fieldErr("lat")}
              </div>
              <div>
                <label htmlFor="lng" className={labelCls}>Longitude</label>
                <input
                  id="lng"
                  inputMode="decimal"
                  placeholder="-80.1937"
                  value={data.lng}
                  onChange={(e) => set("lng", e.target.value)}
                  className={inputCls}
                />
                {fieldErr("lng")}
              </div>
            </div>
            {fieldErr("bounds")}
            {(() => {
              const la = validateLatitude(data.lat);
              const ln = validateLongitude(data.lng);
              if (!la.ok || !ln.ok) return null;
              const inside = inLeonida(la.value, ln.value);
              return (
                <p
                  className={`mt-2 text-xs font-semibold ${
                    inside ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {inside
                    ? "✓ Inside the Leonida region."
                    : "✕ Outside the Leonida region — check the coordinates."}
                </p>
              );
            })()}
          </div>
        )}

        {/* ── Step 2: category ── */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-extrabold text-white">What kind of place is it?</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {CATEGORIES.map((c) => {
                const active = data.categorySlug === c.slug;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => set("categorySlug", c.slug)}
                    aria-pressed={active}
                    className={`rounded-xl border p-4 text-left transition ${
                      active
                        ? "border-cyan-400 bg-cyan-400/10 shadow-[0_0_18px_rgba(34,211,238,0.25)]"
                        : "border-[#232c3b] bg-[#0d1117] hover:border-cyan-400/40"
                    }`}
                  >
                    <span className="text-2xl">{c.icon}</span>
                    <span className="mt-1 block text-sm font-bold text-white">{c.name}</span>
                  </button>
                );
              })}
            </div>
            {fieldErr("categorySlug")}
          </div>
        )}

        {/* ── Step 3: name + description ── */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-extrabold text-white">Name it</h2>
            <div className="mt-4">
              <label htmlFor="name" className={labelCls}>Name</label>
              <input
                id="name"
                maxLength={60}
                placeholder="e.g. Ammu-Nation — Downtown Vice City"
                value={data.name}
                onChange={(e) => set("name", e.target.value)}
                className={inputCls}
              />
              <p className="mt-1 text-right text-xs text-[#5b6472]">
                {data.name.trim().length}/60
              </p>
              {fieldErr("name")}
            </div>
            <div className="mt-4">
              <label htmlFor="description" className={labelCls}>Description</label>
              <textarea
                id="description"
                rows={4}
                maxLength={500}
                placeholder="Say what's visible and why it matters…"
                value={data.description}
                onChange={(e) => set("description", e.target.value)}
                className={inputCls}
              />
              <p className="mt-1 text-right text-xs text-[#5b6472]">
                {data.description.trim().length}/500
              </p>
              <p className="mt-1 text-xs text-[#8b94a3]">
                Say what&apos;s visible and why it matters — thin descriptions get rejected.
              </p>
              {fieldErr("description")}
            </div>
          </div>
        )}
        {/* ── Step 4: evidence ── */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-extrabold text-white">Show your proof</h2>
            <p className="mt-1 text-sm text-[#8b94a3]">
              Every pin carries an evidence chain. Pick where your proof comes from —
              moderators check it before anything is published.
            </p>

            <div className="mt-4">
              <label htmlFor="sourceType" className={labelCls}>Source type</label>
              <select
                id="sourceType"
                value={data.sourceType}
                onChange={(e) => set("sourceType", e.target.value as SourceType)}
                className={inputCls}
              >
                {SOURCE_TYPES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label} — {s.hint}
                  </option>
                ))}
              </select>
            </div>

            {data.sourceType === "trailer" && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="trailerName" className={labelCls}>Trailer name</label>
                  <input
                    id="trailerName"
                    placeholder="Trailer 2"
                    value={data.trailerName}
                    onChange={(e) => set("trailerName", e.target.value)}
                    className={inputCls}
                  />
                  {fieldErr("trailerName")}
                </div>
                <div>
                  <label htmlFor="trailerTimestamp" className={labelCls}>
                    Timestamp (m:ss)
                  </label>
                  <input
                    id="trailerTimestamp"
                    placeholder="0:42"
                    value={data.trailerTimestamp}
                    onChange={(e) => set("trailerTimestamp", e.target.value)}
                    className={inputCls}
                  />
                  {fieldErr("trailerTimestamp")}
                </div>
              </div>
            )}

            {(data.sourceType === "leak_report" || data.sourceType === "rockstar_official") && (
              <div className="mt-4">
                <label htmlFor="sourceUrl" className={labelCls}>
                  {data.sourceType === "leak_report" ? "Public article URL" : "Official URL"}
                </label>
                <input
                  id="sourceUrl"
                  inputMode="url"
                  placeholder="https://…"
                  value={data.sourceUrl}
                  onChange={(e) => set("sourceUrl", e.target.value)}
                  className={inputCls}
                />
                {data.sourceType === "leak_report" && (
                  <p className="mt-1 text-xs text-[#8b94a3]">
                    Link news coverage <i>about</i> the leak — never a file dump or download link.
                  </p>
                )}
                {data.sourceType === "rockstar_official" &&
                  data.sourceUrl.trim() &&
                  !isOfficialRockstarUrl(data.sourceUrl) && (
                    <p className="mt-1 text-xs font-semibold text-amber-300">
                      Advisory: that domain doesn&apos;t look like an official Rockstar site.
                      Double-check before submitting.
                    </p>
                  )}
                {fieldErr("sourceUrl")}
              </div>
            )}

            {data.sourceType === "other_public" && (
              <div className="mt-4">
                <label htmlFor="sourceDescription" className={labelCls}>
                  Describe the public source
                </label>
                <textarea
                  id="sourceDescription"
                  rows={3}
                  placeholder="e.g. Mentioned in the post-Trailer 2 developer stream on the official channel…"
                  value={data.sourceDescription}
                  onChange={(e) => set("sourceDescription", e.target.value)}
                  className={inputCls}
                />
                <p className="mt-1 text-right text-xs text-[#5b6472]">
                  {data.sourceDescription.trim().length} chars (min 20)
                </p>
                {fieldErr("sourceDescription")}
              </div>
            )}

            <div className="mt-5">
              <label htmlFor="proposedStatus" className={labelCls}>
                Suggested evidence status
              </label>
              <select
                id="proposedStatus"
                value={data.proposedStatus}
                onChange={(e) => set("proposedStatus", e.target.value as ProposedStatus)}
                className={inputCls}
              >
                {PROPOSED_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label} — {s.hint}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[#8b94a3]">
                Your pick is a suggestion only. <b>Rockstar-confirmed can&apos;t be proposed</b> —
                it needs an editor with a Rockstar citation. No amount of community votes can
                change a status either; votes and evidence are separate.
              </p>
            </div>

            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-[#232c3b] bg-[#0d1117] p-4">
              <input
                type="checkbox"
                checked={data.attestation}
                onChange={(e) => set("attestation", e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 accent-cyan-400"
              />
              <span className="text-sm text-[#c8d0dc]">{ATTESTATION_COPY}</span>
            </label>
            {fieldErr("attestation")}
          </div>
        )}
        {/* ── Step 5: review ── */}
        {step === 4 && (
          <div>
            <h2 className="text-xl font-extrabold text-white">Review your suggestion</h2>

            {/* Duplicate warning — never a block */}
            {!dupDismissed && dupWarnings.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
                <p className="text-sm font-bold text-amber-200">
                  Possible duplicate — this is a warning, not a block.
                </p>
                <ul className="mt-2 space-y-1 text-sm text-amber-100/90">
                  {dupWarnings.map((w) => (
                    <li key={w.pinId}>
                      “{w.pinName}” — {w.distanceM} m away,{" "}
                      {Math.round(w.similarity * 100)}% name match
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => setDupDismissed(true)}
                    className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-400"
                  >
                    Submit anyway
                  </button>
                  {dupWarnings[0].pinSlug && (
                    <Link
                      href={`/map?pin=${dupWarnings[0].pinSlug}`}
                      className="rounded-lg border border-amber-500/40 px-4 py-2 text-sm font-bold text-amber-200 hover:bg-amber-500/10"
                    >
                      View existing
                    </Link>
                  )}
                  <button
                    onClick={() => setStep(0)}
                    className="rounded-lg border border-[#232c3b] px-4 py-2 text-sm font-bold text-white hover:border-cyan-400/50"
                  >
                    Back to edit
                  </button>
                </div>
              </div>
            )}

            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4 border-b border-[#1f2632] pb-2">
                <dt className="text-[#8b94a3]">Coordinates</dt>
                <dd className="font-mono text-white">{data.lat}, {data.lng}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-[#1f2632] pb-2">
                <dt className="text-[#8b94a3]">Category</dt>
                <dd className="text-white">
                  {CATEGORIES.find((c) => c.slug === data.categorySlug)?.name ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-[#1f2632] pb-2">
                <dt className="text-[#8b94a3]">Name</dt>
                <dd className="text-right text-white">{data.name}</dd>
              </div>
              <div className="border-b border-[#1f2632] pb-2">
                <dt className="text-[#8b94a3]">Description</dt>
                <dd className="mt-1 text-white">{data.description}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-[#1f2632] pb-2">
                <dt className="text-[#8b94a3]">Evidence</dt>
                <dd className="text-right text-white">
                  {SOURCE_TYPES.find((s) => s.value === data.sourceType)?.label}
                  {data.sourceType === "trailer" &&
                    ` — ${data.trailerName} @ ${data.trailerTimestamp}`}
                  {(data.sourceType === "leak_report" ||
                    data.sourceType === "rockstar_official") &&
                    ` — ${data.sourceUrl}`}
                  {data.sourceType === "other_public" && " — described above"}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-[#1f2632] pb-2">
                <dt className="text-[#8b94a3]">Suggested status</dt>
                <dd className="text-white">{data.proposedStatus}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#8b94a3]">Attestation</dt>
                <dd className={data.attestation ? "text-green-400" : "text-red-400"}>
                  {data.attestation ? "Confirmed" : "Missing"}
                </dd>
              </div>
            </dl>

            {errors.length > 0 && (
              <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4">
                <p className="text-sm font-bold text-red-300">
                  Fix these before submitting:
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-200">
                  {errors.map((e, i) => (
                    <li key={i}>{e.message}</li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting || !rate.allowed || (!dupDismissed && dupWarnings.length > 0)}
              className="mt-6 w-full rounded-xl bg-cyan-500 py-3 text-base font-extrabold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Saving…" : "Submit suggestion"}
            </button>
            <p className="mt-2 text-center text-xs text-[#8b94a3]">
              Saved to your device outbox — labeled “not yet received by moderators”.
              Comes with accounts: automatic sync to the real moderation queue.
            </p>
          </div>
        )}

        {/* ── Nav buttons ── */}
        <div className="mt-6 flex items-center justify-between">
          {step > 0 ? (
            <button
              onClick={goBack}
              className="rounded-lg border border-[#232c3b] bg-[#0d1117] px-5 py-2.5 text-sm font-bold text-white hover:border-cyan-400/50"
            >
              ← Back
            </button>
          ) : (
            <span />
          )}
          {step < STEPS.length - 1 ? (
            <button
              onClick={goNext}
              className="rounded-lg bg-cyan-500 px-6 py-2.5 text-sm font-extrabold text-black hover:bg-cyan-400"
            >
              Continue →
            </button>
          ) : (
            <button
              onClick={goBack}
              className="rounded-lg border border-[#232c3b] bg-[#0d1117] px-5 py-2.5 text-sm font-bold text-white hover:border-cyan-400/50"
            >
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
