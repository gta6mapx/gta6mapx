import { EVIDENCE_META, type Evidence } from "../types";

export default function EvidenceBadge({ evidence }: { evidence: Evidence }) {
  const meta = EVIDENCE_META[evidence.status];
  return (
    <span className={`badge ${meta.className}`} title={meta.blurb}>
      {meta.label}
    </span>
  );
}
