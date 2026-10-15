"use client";

import Link from "next/link";
import { openAboutModal } from "@/modules/engagement/credits/AboutModal";

/**
 * Shared site footer. MUST keep the fan-project disclaimer on every render —
 * this site is unaffiliated with Rockstar Games / Take-Two Interactive.
 */
export default function SiteFooter() {
  return (
    <footer className="border-t border-[#1f2632] bg-[#0a0e14] px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <nav className="mb-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm" aria-label="Footer">
          <Link href="/map" className="text-[#8b94a3] hover:text-white">Map</Link>
          <Link href="/vehicles" className="text-[#8b94a3] hover:text-white">Vehicles</Link>
          <Link href="/weapons" className="text-[#8b94a3] hover:text-white">Weapons</Link>
          <Link href="/characters" className="text-[#8b94a3] hover:text-white">Characters</Link>
          <Link href="/library" className="text-[#8b94a3] hover:text-white">Library</Link>
          <Link href="/locations" className="text-[#8b94a3] hover:text-white">Locations</Link>
          <Link href="/cheats" className="text-[#8b94a3] hover:text-white">Cheats</Link>
          <Link href="/community" className="text-[#8b94a3] hover:text-white">Community</Link>
          <Link href="/leaderboard" className="text-[#8b94a3] hover:text-white">Leaderboard</Link>
          <button
            type="button"
            onClick={openAboutModal}
            className="text-[#8b94a3] hover:text-white"
          >
            About / Credits
          </button>
        </nav>
        <p className="text-center text-xs text-[#8b94a3] leading-relaxed">
          Independent fan project. Not affiliated with or endorsed by Rockstar Games or Take-Two Interactive.
        </p>
        <p className="mt-1 text-center text-xs text-[#8b94a3] leading-relaxed">
          Map data ©{" "}
          <a href="https://map.gtadb.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
            gtadb.org
          </a>{" "}
          contributors, adapted for this map and licensed under{" "}
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
            CC BY 4.0
          </a>.
        </p>
        <p className="mt-1 text-center text-xs text-[#8b94a3]">© 2026 GTA6mapx.com</p>
      </div>
    </footer>
  );
}
