import { EVIDENCE_META, type EvidenceStatus } from "../types";

/**
 * EvidenceLegend — explains the site's honesty system at the point of
 * browsing. Uses the exact labels + blurbs from EVIDENCE_META so the legend
 * can never drift from what badges on entity pages say.
 */
const ORDER: EvidenceStatus[] = [
  "rockstar-confirmed",
  "trailer-confirmed",
  "leak-reported",
  "disputed",
];

export default function EvidenceLegend() {
  return (
    <div className="mt-6 rounded-xl border border-[#1f2632] bg-[#0d1219] p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-[#8b94a3] mb-3">
        How we label evidence
      </p>
      <dl className="grid gap-2.5 sm:grid-cols-2">
        {ORDER.map((status) => {
          const meta = EVIDENCE_META[status];
          return (
            <div key={status} className="flex items-start gap-2.5">
              <span className={`badge ${meta.className} shrink-0 mt-0.5`}>{meta.label}</span>
              <dd className="text-xs text-[#8b94a3] leading-relaxed">{meta.blurb}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
