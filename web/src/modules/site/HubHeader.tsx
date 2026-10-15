import Link from "next/link";
import type { ReactNode } from "react";
import EvidenceLegend from "@/modules/entities/components/EvidenceLegend";

/**
 * HubHeader — the shared header for all database hubs
 * (/vehicles, /locations, /weapons, /characters, /cheats).
 *
 * One module, one job: breadcrumb + icon + title + blurb + entry count +
 * calls-to-action + the evidence legend, so every hub explains the honesty
 * system before the user browses badges.
 */
export default function HubHeader({
  crumb,
  icon,
  title,
  blurb,
  count,
  countUnit,
  showLegend = true,
  actions,
}: {
  crumb: string;
  icon: string;
  title: string;
  blurb: string;
  count: number;
  countUnit: string;
  showLegend?: boolean;
  actions?: ReactNode;
}) {
  return (
    <header className="border-b border-[#1f2632] bg-[#11161f]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        <nav className="text-xs text-[#8b94a3] mb-3" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-white">Home</Link> / {crumb}
        </nav>
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="text-3xl sm:text-4xl">{icon}</span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">{title}</h1>
        </div>
        <p className="mt-3 max-w-2xl text-[#8b94a3] leading-relaxed">{blurb}</p>
        <p className="mt-2 text-sm">
          <b className="text-white">{count}</b>{" "}
          <span className="text-[#8b94a3]">{countUnit} publicly reported so far</span>
        </p>
        {actions && <div className="mt-4 flex flex-wrap gap-2 text-sm">{actions}</div>}
        {showLegend && <EvidenceLegend />}
      </div>
    </header>
  );
}

/** The two standard hub actions: primary map CTA + one secondary link. */
export function HubActions({ secondary }: { secondary: { href: string; label: string } }) {
  return (
    <>
      <Link href="/map" className="rounded-lg bg-green-600 px-4 py-2 font-semibold hover:bg-green-500">
        Open interactive map
      </Link>
      <Link href={secondary.href} className="rounded-lg border border-[#1f2632] px-4 py-2 hover:border-green-500">
        {secondary.label}
      </Link>
    </>
  );
}
