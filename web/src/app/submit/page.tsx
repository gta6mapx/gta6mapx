import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/modules/site/SiteHeader";
import SiteFooter from "@/modules/site/SiteFooter";
import SubmissionForm from "@/modules/community/SubmissionForm";

export const metadata: Metadata = {
  title: "Suggest a Location | GTA6mapx",
  description:
    "Suggest a GTA 6 map location with your evidence — trailer timestamps, public reports, or Rockstar sources. Every suggestion is human-reviewed before anything is published.",
};

export default function SubmitPage() {
  return (
    <main className="min-h-screen bg-[#0a0e14] text-[#e8ecf1]">
      <SiteHeader />
      <header className="border-b border-[#1f2632] bg-[#11161f]">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
          <nav className="mb-3 text-xs text-[#8b94a3]" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-white">Home</Link> / Submit
          </nav>
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="text-3xl sm:text-4xl">📍</span>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Suggest a location
            </h1>
          </div>
          <p className="mt-3 max-w-2xl leading-relaxed text-[#8b94a3]">
            Know a spot we missed? Send it with your evidence. Every suggestion is
            human-reviewed before anything is published — and your submission stays
            on this device (labeled “not yet received by moderators”) until the
            moderation queue goes live with accounts.
          </p>
          <p className="mt-2 text-xs text-[#8b94a3]">
            Independent fan project. Not affiliated with or endorsed by Rockstar
            Games or Take-Two Interactive.
          </p>
        </div>
      </header>
      <SubmissionForm />
      <SiteFooter />
    </main>
  );
}
