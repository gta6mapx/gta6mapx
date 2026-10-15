import { useId } from "react";
import type { DossierKind } from "./library";
import type { EvidenceStatus } from "../../entities/types";
import styles from "./library.module.css";

/**
 * DossierPlate — original abstract "case file" art for one library card.
 * Kind-keyed sunset-palette gradient + a large generic letterform glyph +
 * scanline/HUD texture + an evidence-status strip on the bottom edge.
 *
 * Decorative signifiers only — never a depiction of the entity. No trailer
 * stills, no leaks, no Rockstar art, no photos, no AI likenesses.
 */

const KIND_ART: Record<DossierKind, { from: string; to: string }> = {
  vehicle: { from: "#ff2d78", to: "#ff9a3c" },
  location: { from: "#22d3ee", to: "#7c3aed" },
  weapon: { from: "#7c3aed", to: "#ff2d78" },
  character: { from: "#f5a623", to: "#ff2d78" },
};

const STRIP_COLOR: Record<EvidenceStatus, string> = {
  "rockstar-confirmed": "#22c55e",
  "trailer-confirmed": "#38bdf8",
  "leak-reported": "#eab308",
  disputed: "#ef4444",
};

export default function DossierPlate({
  kind,
  name,
  status,
}: {
  kind: DossierKind;
  name: string;
  status: EvidenceStatus;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const gradientId = `libg-${uid}`;
  const art = KIND_ART[kind];
  const letter = name.charAt(0).toUpperCase();
  const strip = STRIP_COLOR[status];

  return (
    <div className={styles.plateWrap} aria-hidden="true">
      <div className={status === "disputed" ? styles.plateDesat : undefined}>
        <svg
          viewBox="0 0 400 200"
          preserveAspectRatio="xMidYMid slice"
          className={styles.plateSvg}
          focusable="false"
        >
          <defs>
            <linearGradient
              id={gradientId}
              x1="0"
              y1="0"
              x2="1"
              y2="1"
            >
              <stop offset="0" stopColor={art.from} />
              <stop offset="1" stopColor={art.to} />
            </linearGradient>
          </defs>
          <rect width="400" height="200" fill={`url(#${gradientId})`} />
          {/* night-grade overlay so art sits in the neon-noir palette */}
          <rect width="400" height="200" fill="#000000" opacity="0.28" />
          {/* abstract sun/moon disc + orbit rings */}
          <circle cx="316" cy="44" r="64" fill="#ffffff" opacity="0.1" />
          <circle
            cx="316"
            cy="44"
            r="64"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.28"
            strokeWidth="1.5"
          />
          <circle
            cx="316"
            cy="44"
            r="82"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.12"
            strokeWidth="1"
          />
          {/* HUD sweep lines */}
          <line
            x1="-20"
            y1="150"
            x2="420"
            y2="104"
            stroke="#ffffff"
            strokeOpacity="0.16"
            strokeWidth="2"
          />
          <line
            x1="-20"
            y1="168"
            x2="420"
            y2="122"
            stroke="#ffffff"
            strokeOpacity="0.08"
            strokeWidth="6"
          />
          {/* large generic letterform glyph */}
          <text
            x="30"
            y="162"
            fontFamily="Anton, 'Arial Black', sans-serif"
            fontSize="148"
            fill="#ffffff"
            opacity="0.22"
          >
            {letter}
          </text>
          {/* HUD corner ticks + file tag */}
          <path
            d="M10 30 V10 H30"
            stroke="#ffffff"
            strokeOpacity="0.55"
            strokeWidth="2.5"
            fill="none"
          />
          <path
            d="M390 170 V190 H370"
            stroke="#ffffff"
            strokeOpacity="0.55"
            strokeWidth="2.5"
            fill="none"
          />
          <text
            x="36"
            y="30"
            fontFamily="ui-monospace, monospace"
            fontSize="11"
            letterSpacing="3"
            fill="#ffffff"
            opacity="0.5"
          >
            INTEL
          </text>
        </svg>
        <div className={styles.scanlines} />
        {status === "leak-reported" && (
          <div className={styles.unverified}>
            <span>UNVERIFIED</span>
            <span>UNVERIFIED</span>
            <span>UNVERIFIED</span>
            <span>UNVERIFIED</span>
          </div>
        )}
      </div>
      <div
        className={styles.strip}
        style={{ backgroundColor: strip, boxShadow: `0 0 12px ${strip}` }}
      />
    </div>
  );
}
