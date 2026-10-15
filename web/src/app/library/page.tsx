import type { Metadata } from "next";
import SiteHeader from "@/modules/site/SiteHeader";
import SiteFooter from "@/modules/site/SiteFooter";
import LibraryBrowser from "@/modules/engagement/library/LibraryBrowser";
import { buildFacets } from "@/modules/engagement/library/library";
import { parseLibraryParams } from "@/modules/engagement/library/urlState";

export const metadata: Metadata = {
  title: "Intel Library — Every GTA 6 Entity, Honestly Labeled | GTA6mapx",
  description:
    "Browse every vehicle, location, weapon and character reported for GTA 6 — each labeled by how we know it. No leaked footage, no trailer rips, just verified, honest intel.",
};

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Deep-link state is resolved on the server so the page server-renders the
  // requested view (and invalid params are dropped before first paint).
  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") params.set(k, v);
    else if (Array.isArray(v)) v.forEach((x) => params.append(k, x));
  }
  const initialState = parseLibraryParams(params, buildFacets());

  return (
    <main className="min-h-screen bg-[#0a0e14] text-[#e8ecf1]">
      <SiteHeader />
      <LibraryBrowser initialState={initialState} />
      <SiteFooter />
    </main>
  );
}
