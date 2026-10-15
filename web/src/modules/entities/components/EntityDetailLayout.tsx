import Link from "next/link";
import type { ReactNode } from "react";
import type { Entity, Vehicle, GameLocation, Weapon, Character } from "../types";
import { EVIDENCE_META } from "../types";
import EvidenceBadge from "./EvidenceBadge";
import EntityCard from "./EntityCard";

/**
 * EntityDetailLayout — the shared body for every entity detail page
 * (/vehicles/[slug], /locations/[slug], /weapons/[slug], /characters/[slug]).
 *
 * One module, one job: breadcrumb → badges → title → the evidence chain as
 * the page's signature element → summary → launch-sprint note → related.
 * The evidence badge must stay visible and honest on every entity page —
 * this layout guarantees it by construction.
 */
export default function EntityDetailLayout({
  entity,
  hubHref,
  hubLabel,
  subLine,
  badgeExtras,
  sprintNote,
  related,
  relatedTitle,
}: {
  entity: Entity;
  hubHref: string;
  hubLabel: string;
  subLine: string;
  badgeExtras?: ReactNode;
  sprintNote?: ReactNode;
  related: Entity[];
  relatedTitle: string;
}) {
  const meta = EVIDENCE_META[entity.evidence.status];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* single breadcrumb trail — no duplicated back-link */}
      <nav className="text-xs text-[#8b94a3] mb-5" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-white">Home</Link> /{" "}
        <Link href={hubHref} className="hover:text-white">{hubLabel}</Link> /{" "}
        <span className="text-[#c3cad4]">{entity.name}</span>
      </nav>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <EvidenceBadge evidence={entity.evidence} />
        {badgeExtras}
      </div>

      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">{entity.name}</h1>
      <p className="mt-1.5 text-[#8b94a3]">{subLine}</p>

      {/* evidence chain — the signature element of the product */}
      <section
        aria-label="Evidence chain"
        className="mt-6 rounded-2xl border border-green-500/30 bg-gradient-to-b from-green-500/[0.07] to-transparent p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-green-300">
            🛡️ Evidence chain
          </h2>
          <EvidenceBadge evidence={entity.evidence} />
        </div>
        <p className="text-sm leading-relaxed">
          <b className="text-white">{meta.label}:</b>{" "}
          <span className="text-[#c3cad4]">{meta.blurb}</span>
        </p>
        <p className="mt-2 text-sm text-[#8b94a3]">📍 {entity.evidence.detail}</p>
        {entity.evidence.sourceUrl && (
          <a
            href={entity.evidence.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-sm text-green-400 hover:underline"
          >
            View source reporting →
          </a>
        )}
      </section>

      <p className="mt-6 text-[#c3cad4] leading-relaxed text-[15px]">{entity.summary}</p>

      {sprintNote && <div className="mt-6">{sprintNote}</div>}

      <div className="mt-10">
        <h2 className="text-lg font-bold mb-3">{relatedTitle}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {related.map((r) => (
            <EntityCard key={r.slug} entity={r as Vehicle | GameLocation | Weapon | Character} />
          ))}
        </div>
      </div>

      <p className="mt-8 text-xs text-[#8b94a3] leading-relaxed">
        Spotted something wrong? Evidence changes fast pre-launch —{" "}
        <span className="text-green-400">correction submissions open at launch.</span>
      </p>
    </div>
  );
}

/** Standard "unlocks at launch" status strip used by vehicle/weapon/location pages. */
export function SprintNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm text-yellow-200/90 leading-relaxed">
      ⏳ {children}
    </div>
  );
}

/** The purple Ultimate Edition exclusivity flag (vehicles + weapons). */
export function UltimateEditionBadge() {
  return (
    <span
      className="badge"
      style={{ borderColor: "#a855f7", color: "#c084fc", background: "rgba(168,85,247,.12)" }}
    >
      Ultimate Edition exclusive
    </span>
  );
}
