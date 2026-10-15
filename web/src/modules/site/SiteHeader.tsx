"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Countdown } from "@/modules/engagement/countdown/Countdown";
import { SettingsPanel } from "@/modules/engagement/settings/SettingsPanel";
import { openAboutModal } from "@/modules/engagement/credits/AboutModal";

/**
 * Unified site header — the single chrome used by every content page and the
 * landing page. (The /map app shell keeps its own compact header; see Phase 4.)
 *
 * Responsibilities: brand lockup, primary nav with active-section highlight,
 * compact launch countdown (desktop), settings gear, about link,
 * and a compact mobile menu. The fan-project disclaimer lives in SiteFooter.
 */

const NAV = [
  { href: "/map", label: "Map" },
  { href: "/vehicles", label: "Vehicles" },
  { href: "/weapons", label: "Weapons" },
  { href: "/characters", label: "Characters" },
  { href: "/library", label: "Library" },
  { href: "/locations", label: "Locations" },
  { href: "/cheats", label: "Cheats" },
  { href: "/community", label: "Community" },
  { href: "/submit", label: "Suggest" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export function BrandLockup({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`font-extrabold tracking-tight ${className}`} aria-label="GTA6mapx home">
      <span className="text-green-500">GTA6</span>
      <span className="text-white">mapx</span>
    </Link>
  );
}

export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const linkClass = (href: string) =>
    `rounded-lg px-3 py-2 text-sm transition ${
      pathname === href || (href !== "/" && pathname.startsWith(href + "/"))
        ? "text-white bg-[#1a2230] font-semibold"
        : "text-[#8b94a3] hover:text-white hover:bg-[#1a2230]"
    }`;

  const aboutLinkClass =
    "rounded-lg px-3 py-2 text-sm text-[#8b94a3] hover:text-white hover:bg-[#1a2230] transition";

  return (
    <header className="border-b border-[#1f2632] bg-[#11161f]/95 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
        <BrandLockup className="text-lg" />

        {/* desktop nav */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Site">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={linkClass(n.href)}>
              {n.label}
            </Link>
          ))}
          <button type="button" onClick={openAboutModal} className={aboutLinkClass}>
            About
          </button>
        </nav>

        <div className="hidden md:flex items-center gap-2">
          {/* compact launch countdown — desktop only (space) */}
          <Link
            href="/#launch"
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 hover:border-[var(--accent-line)]"
            title="GTA VI launch countdown"
          >
            <Countdown variant="compact" />
          </Link>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Open settings"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[#c3cad4] hover:bg-[#1a2230] hover:text-white"
          >
            <span className="text-lg leading-none" aria-hidden="true">⚙</span>
          </button>
        </div>

        {/* mobile menu button */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="md:hidden flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[#c3cad4] hover:bg-[#1a2230]"
        >
          {open ? <span className="text-xl leading-none">✕</span> : <span className="text-xl leading-none">☰</span>}
        </button>
      </div>

      {/* mobile dropdown */}
      {open && (
        <nav className="md:hidden border-t border-[#1f2632] px-4 py-2" aria-label="Site">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className={`block rounded-lg px-3 py-3 text-sm ${linkClass(n.href)}`}
            >
              {n.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => { openAboutModal(); setOpen(false); }}
            className={`block w-full text-left rounded-lg px-3 py-3 text-sm ${aboutLinkClass}`}
          >
            About / Credits
          </button>
          <button
            type="button"
            onClick={() => { setSettingsOpen(true); setOpen(false); }}
            className={`block w-full text-left rounded-lg px-3 py-3 text-sm ${aboutLinkClass}`}
          >
            Settings
          </button>
        </nav>
      )}

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} surface="site" />
    </header>
  );
}
