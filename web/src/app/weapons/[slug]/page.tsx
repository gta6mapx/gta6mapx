import Link from "next/link";
import { notFound } from "next/navigation";
import { WEAPONS } from "@/modules/entities/data/weapons";
import { getWeapon, relatedEntities } from "@/modules/entities/lib/entity";
import SiteHeader from "@/modules/site/SiteHeader";
import SiteFooter from "@/modules/site/SiteFooter";
import EntityDetailLayout, {
  SprintNote,
  UltimateEditionBadge,
} from "@/modules/entities/components/EntityDetailLayout";
import { EVIDENCE_META } from "@/modules/entities/types";
import { articleJsonLd, breadcrumbJsonLd } from "@/modules/seo/jsonld";

export function generateStaticParams() {
  return WEAPONS.map((w) => ({ slug: w.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const w = getWeapon(slug);
  if (!w) return {};
  return {
    title: `${w.name} — GTA 6 Weapon | GTA6mapx`,
    description: `${w.name} (${w.wclass}) in GTA 6: ${w.summary} Evidence: ${EVIDENCE_META[w.evidence.status].label}.`,
  };
}

export default async function WeaponPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const w = getWeapon(slug);
  if (!w) notFound();
  const related = relatedEntities(w);

  return (
    <main className="min-h-screen bg-[#0a0e14] text-[#e8ecf1]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleJsonLd(w, `/weapons/${w.slug}`)),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: "Home", url: "/" },
              { name: "Weapons", url: "/weapons" },
              { name: w.name, url: `/weapons/${w.slug}` },
            ])
          ),
        }}
      />

      <SiteHeader />

      <EntityDetailLayout
        entity={w}
        hubHref="/weapons"
        hubLabel="Weapons"
        subLine={w.wclass}
        badgeExtras={w.ultimateEditionExclusive ? <UltimateEditionBadge /> : undefined}
        sprintNote={
          <SprintNote>
            Damage, fire-rate and price stats unlock after our launch-week
            verification sprint — we never invent numbers.{" "}
            <Link href="/map" className="underline">Track it on the map →</Link>
          </SprintNote>
        }
        related={related}
        relatedTitle="Related weapons"
      />

      <SiteFooter />
    </main>
  );
}
