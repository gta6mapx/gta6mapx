import { useId } from "react";
import { EVIDENCE_META, type EvidenceStatus } from "../../entities/types";
import { KIND_EYEBROW } from "./library";
import type { SearchHit } from "./filtering";
import DossierPlate from "./DossierPlate";
import styles from "./library.module.css";

/**
 * DossierCard — one library entry. The whole card is a single native <a>
 * to the entity route. Card anatomy (spec §2.2):
 * plate → kind eyebrow + evidence badge → name → summary excerpt →
 * tag chips → kind microline.
 */

function EvidenceIcon({ status }: { status: EvidenceStatus }) {
  const common = {
    width: 10,
    height: 10,
    viewBox: "0 0 10 10",
    "aria-hidden": true,
    focusable: "false",
  } as const;
  switch (status) {
    case "rockstar-confirmed":
      return (
        <svg {...common}>
          <polygon
            points="5,0.5 6.4,3.6 9.7,3.9 7.1,6.1 7.9,9.4 5,7.6 2.1,9.4 2.9,6.1 0.3,3.9 3.6,3.6"
            fill="currentColor"
          />
        </svg>
      );
    case "trailer-confirmed":
      return (
        <svg {...common}>
          <rect
            x="0.8"
            y="0.8"
            width="8.4"
            height="8.4"
            rx="2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <polygon points="4,3 7,5 4,7" fill="currentColor" />
        </svg>
      );
    case "leak-reported":
      return (
        <svg {...common}>
          <circle
            cx="5"
            cy="5"
            r="4.1"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <text
            x="5"
            y="7.6"
            textAnchor="middle"
            fontSize="6.6"
            fontWeight="800"
            fill="currentColor"
          >
            ?
          </text>
        </svg>
      );
    case "disputed":
      return (
        <svg {...common}>
          <polygon
            points="5,0.7 9.4,8.8 0.6,8.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <text
            x="5"
            y="7.6"
            textAnchor="middle"
            fontSize="6"
            fontWeight="800"
            fill="currentColor"
          >
            !
          </text>
        </svg>
      );
  }
}

function WarningIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 10 10"
      aria-hidden="true"
      focusable="false"
    >
      <polygon
        points="5,0.7 9.4,8.8 0.6,8.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <text
        x="5"
        y="7.6"
        textAnchor="middle"
        fontSize="6"
        fontWeight="800"
        fill="currentColor"
      >
        !
      </text>
    </svg>
  );
}

export default function DossierCard({
  hit,
  showMatch,
}: {
  hit: SearchHit;
  showMatch: boolean;
}) {
  const d = hit.dossier;
  const meta = EVIDENCE_META[d.evidence.status];
  const tipId = useId();
  const visibleTags = d.tags.slice(0, 3);
  const overflow = d.tags.length - visibleTags.length;
  const hasMatch = showMatch && (hit.matchedName || hit.matchedTags.length > 0);

  return (
    <a href={d.href} className={styles.card} aria-describedby={tipId}>
      <DossierPlate kind={d.kind} name={d.name} status={d.evidence.status} />
      <div className={styles.body}>
        <div className={styles.toprow}>
          <span className={styles.eyebrow}>{KIND_EYEBROW[d.kind]}</span>
          <span className={styles.badgeZone}>
            <span className={`badge ${meta.className}`}>
              <EvidenceIcon status={d.evidence.status} />
              {meta.label}
            </span>
            <span id={tipId} role="tooltip" className={styles.tip}>
              {meta.blurb}
            </span>
          </span>
        </div>
        <h3
          className={`font-display text-xl leading-tight tracking-wide line-clamp-2 ${styles.name}`}
        >
          {d.name}
        </h3>
        {d.evidence.status === "disputed" && (
          <span className={styles.ribbon}>
            <WarningIcon />
            Authenticity questioned
          </span>
        )}
        <p className={`${styles.excerpt} text-sm leading-relaxed line-clamp-2`}>
          {d.summary}
        </p>
        <div className={styles.chips}>
          {visibleTags.map((t) => (
            <span
              key={t}
              className={`${styles.chip}${
                hit.matchedTags.includes(t) ? ` ${styles.chipMatch}` : ""
              }`}
            >
              {t}
            </span>
          ))}
          {overflow > 0 && <span className={styles.chip}>+{overflow}</span>}
        </div>
        <p className={styles.microline}>{d.microline}</p>
        {hasMatch && (
          <p className={styles.matched}>
            {hit.matchedName ? "Matched name" : null}
            {hit.matchedName && hit.matchedTags.length > 0 ? " · " : null}
            {hit.matchedTags.length > 0
              ? `Matched tag${hit.matchedTags.length > 1 ? "s" : ""}: ${hit.matchedTags.join(", ")}`
              : null}
          </p>
        )}
      </div>
    </a>
  );
}
