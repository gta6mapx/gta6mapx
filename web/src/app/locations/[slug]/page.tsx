import Link from "next/link";
import { notFound } from "next/navigation";
import { LOCATIONS } from "@/modules/entities/data/locations";
import { getLocation, relatedEntities } from "@/modules/entities/lib/entity";
import SiteHeader from "@/modules/site/SiteHeader";
import SiteFooter from "@/modules/site/SiteFooter";
import EntityDetailLayout, {
  SprintNote,
} from "@/modules/entities/components/EntityDetailLayout";
import { EVIDENCE_META } from "@/modules/entities/types";
import { articleJsonLd, breadcrumbJsonLd } from "@/modules/seo/jsonld";

export function generateStaticParams() {
  return LOCATIONS.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const l = getLocation(slug);
  if (!l) return {};
  return {
    title: `${l.name} — GTA 6 Location | GTA6mapx`,
    description: `${l.name} in GTA 6 (Leonida): ${l.summary} Evidence: ${EVIDENCE_META[l.evidence.status].label}.`,
  };
}

export default async function LocationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const l = getLocation(slug);
  if (!l) notFound();
  const related = relatedEntities(l);

  return (
    <main className="min-h-screen bg-[#0a0e14] text-[#e8ecf1]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleJsonLd(l, `/locations/${l.slug}`)),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: "Home", url: "/" },
              { name: "Locations", url: "/locations" },
              { name: l.name, url: `/locations/${l.slug}` },
            ])
          ),
        }}
      />

      <SiteHeader />

      <EntityDetailLayout
        entity={l}
        hubHref="/locations"
        hubLabel="Locations"
        subLine={
          l.realWorldInspiration
            ? `${l.region} · inspired by ${l.realWorldInspiration}`
            : l.region
        }
        sprintNote={
          <SprintNote>
            Exact in-game position, screenshots and collectibles unlock after our
            launch-week verification sprint.{" "}
            <Link href="/map" className="underline">See it on the map →</Link>
          </SprintNote>
        }
        related={related}
        relatedTitle="Related locations"
      />

      <SiteFooter />
    </main>
  );
}
