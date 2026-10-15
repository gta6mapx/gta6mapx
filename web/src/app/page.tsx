"use client";

import { useState } from "react";
import Link from "next/link";
import { VEHICLES } from "@/modules/entities/data/vehicles";
import { LOCATIONS } from "@/modules/entities/data/locations";
import { WEAPONS } from "@/modules/entities/data/weapons";
import { CHARACTERS } from "@/modules/entities/data/characters";
import { Countdown } from "@/modules/engagement/countdown/Countdown";
import SiteHeader from "@/modules/site/SiteHeader";
import SiteFooter from "@/modules/site/SiteFooter";

/** Stylized palm silhouette — original art, drawn for the Vice City vibe. */
function Palm({ className = "", flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 120 220"
      aria-hidden="true"
      className={className}
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <path
        fill="currentColor"
        d="M56 220 C 54 170, 50 130, 58 92 C 59 87, 65 87, 64 92 C 58 130, 62 170, 64 220 Z"
      />
      <g fill="currentColor">
        <path d="M61 92 C 40 70, 18 64, 2 74 C 20 70, 42 80, 60 98 Z" />
        <path d="M61 90 C 48 62, 32 48, 12 46 C 32 52, 48 68, 60 96 Z" />
        <path d="M61 90 C 62 60, 56 40, 44 26 C 58 40, 66 62, 64 94 Z" />
        <path d="M61 90 C 74 62, 90 50, 110 50 C 92 56, 76 70, 64 96 Z" />
        <path d="M61 92 C 82 72, 102 68, 118 78 C 100 74, 80 82, 62 98 Z" />
        <path d="M61 94 C 44 84, 28 84, 14 92 C 30 90, 46 94, 60 100 Z" />
        <path d="M61 94 C 78 86, 94 86, 108 94 C 92 92, 76 96, 62 100 Z" />
      </g>
      <circle cx="57" cy="98" r="4.5" fill="currentColor" />
      <circle cx="66" cy="99" r="4" fill="currentColor" />
    </svg>
  );
}

/** Distant Vice City skyline silhouette — original art. */
function Skyline({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true" className={className}>
      <path
        fill="currentColor"
        d="M0 120 V86 H40 V70 H70 V86 H110 V52 H150 V40 H165 V52 H190 V86 H240 V64 H280 V86 H330 V34 H345 V22 H360 V34 H375 V86 H430 V70 H470 V86 H520 V58 H560 V86 H620 V44 H660 V86 H720 V66 H760 V86 H820 V50 H850 V38 H880 V50 H900 V86 H960 V70 H1000 V86 H1060 V56 H1100 V86 H1160 V36 H1175 V24 H1190 V36 H1205 V86 H1270 V68 H1310 V86 H1370 V60 H1410 V86 H1440 V86 V120 Z"
      />
    </svg>
  );
}

const TICKER = [
  "ROCKSTAR-CONFIRMED",
  "TRAILER-CONFIRMED",
  "LEAK-REPORTED",
  "DISPUTED",
  "100% FREE — NO PAYWALL",
  "ZERO FAKE SPECS",
];

const TEASERS = [
  {
    href: "/vehicles",
    code: "VH",
    title: "Vehicles Dossier",
    blurb: "Every reported car, bike & boat — with honest evidence labels. No fake specs.",
    count: VEHICLES.length,
    unit: "files",
  },
  {
    href: "/locations",
    code: "LC",
    title: "Locations Dossier",
    blurb: "Every reported region & district — disputed leaks labeled as disputed.",
    count: LOCATIONS.length,
    unit: "files",
  },
  {
    href: "/weapons",
    code: "WP",
    title: "Weapons Dossier",
    blurb: "Every gun spotted in trailers — honestly labeled, zero invented stats.",
    count: WEAPONS.length,
    unit: "files",
  },
  {
    href: "/characters",
    code: "CH",
    title: "Characters Dossier",
    blurb: "Lucia, Jason & the Leonida crew — confirmed by Rockstar, sourced honestly.",
    count: CHARACTERS.length,
    unit: "files",
  },
  {
    href: "/library",
    code: "IN",
    title: "Intel Library",
    blurb: "The full case-file archive — every dossier labeled by how we know it. No leaked footage, no trailer rips.",
    count: VEHICLES.length + LOCATIONS.length + WEAPONS.length + CHARACTERS.length,
    unit: "files",
  },
  {
    href: "/game/find-the-location",
    code: "GM",
    title: "Find the Location",
    blurb: "Pinpoint Leonida on the 3D map — 5 rounds, scored on accuracy. Only confirmed locations, no tricks.",
    count: null,
    unit: "",
  },
  {
    href: "/cheats",
    code: "CHT",
    title: "Cheats Intel",
    blurb: "Cheat status per platform — no fake codes, ever. Refreshes at launch.",
    count: null,
    unit: "",
  },
];

export default function Home() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const subscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return;
    const list = JSON.parse(localStorage.getItem("gta6mapx_emails") ?? "[]");
    localStorage.setItem("gta6mapx_emails", JSON.stringify([...list, email]));
    setSubscribed(true);
  };

  const totalEntries = VEHICLES.length + LOCATIONS.length + WEAPONS.length + CHARACTERS.length;

  return (
    <main className="min-h-screen bg-[#07040f] text-[#f3eef7]">
      <SiteHeader />

      {/* ============ HERO — Vice City cinematic ============ */}
      <section className="vice-sky vice-grain vice-vignette vice-scanlines relative overflow-hidden">
        {/* sun */}
        <div aria-hidden="true" className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2">
          <div className="vice-sun h-56 w-56 sm:h-80 sm:w-80 rounded-full" />
        </div>
        {/* palms */}
        <Palm aria-hidden="true" className="vice-palm absolute bottom-24 -left-6 h-64 w-auto text-[#0a0512] sm:h-96" />
        <Palm aria-hidden="true" flip className="vice-palm-slow absolute bottom-24 -right-8 h-72 w-auto text-[#0a0512] sm:h-[28rem]" />
        <Palm aria-hidden="true" className="vice-palm-slow absolute bottom-16 left-[12%] h-40 w-auto text-[#0d0618] opacity-90 hidden sm:block" />
        {/* skyline */}
        <Skyline className="absolute bottom-0 left-0 h-20 w-full text-[#08040f] sm:h-28" />
        {/* water shimmer */}
        <div
          aria-hidden="true"
          className="absolute bottom-0 left-0 h-10 w-full opacity-60"
          style={{ background: "linear-gradient(180deg, rgba(255,122,77,.35), rgba(255,45,120,.12))" }}
        />

        <div className="relative z-10 mx-auto max-w-4xl px-4 pb-40 pt-14 sm:pb-48 sm:pt-20 text-center">
          <span className="inline-block rounded-full border border-white/25 bg-black/40 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-white/85 backdrop-blur mb-6">
            ★ FAN PROJECT — NOT AFFILIATED WITH ROCKSTAR GAMES ★
          </span>
          <p className="font-display text-sm sm:text-base tracking-[0.42em] text-cyan-200/90 mb-3">
            GTA6MAPX // LEONIDA INTEL NETWORK
          </p>
          <h1 className="font-display leading-[0.92] tracking-wide">
            <span className="block text-6xl sm:text-8xl text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.6)]">
              WELCOME TO
            </span>
            <span className="vice-neon-title block text-7xl sm:text-9xl mt-1">LEONIDA</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-sm sm:text-lg leading-relaxed text-white/85 drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
            The GTA 6 map you can <b className="text-cyan-200">actually trust</b> — every location
            labeled <b>Confirmed</b>, <b>Likely</b> or <b>Speculation</b>, with proof.
            Free forever. No paywalls. No app.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/map"
              className="vice-btn-neon rounded-xl px-8 py-3.5 text-base font-bold text-white"
            >
              ▶ &nbsp;ENTER THE MAP
            </Link>
            <Link
              href="/vehicles"
              className="rounded-xl border border-white/30 bg-black/40 px-8 py-3.5 text-base font-semibold text-white backdrop-blur hover:border-cyan-300 hover:text-cyan-200 transition"
            >
              Browse intel
            </Link>
          </div>

          {/* HUD countdown — reusable launch countdown component (full variant) */}
          <div id="launch" className="mx-auto mt-10 max-w-lg scroll-mt-24">
            <p className="font-display text-xs tracking-[0.34em] text-cyan-200/80 mb-3">
              ◈ LAUNCH COUNTDOWN ◈
            </p>
            <Countdown variant="full" />
            <p className="mt-2 text-[11px] tracking-[0.2em] text-white/60">UNTIL GTA 6 LAUNCHES — NOV 19, 2026</p>
          </div>
        </div>
      </section>

      {/* ============ TICKER ============ */}
      <div className="relative border-y border-fuchsia-500/30 bg-[#0d0618] py-2.5 overflow-hidden" aria-hidden="true">
        <div className="vice-ticker-track gap-0">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0 items-center">
              {TICKER.map((t) => (
                <span key={`${copy}-${t}`} className="mx-6 font-display text-sm tracking-[0.24em] text-fuchsia-200/90 whitespace-nowrap">
                  {t} <span className="text-cyan-300 ml-6">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ============ STATS — game stats screen ============ */}
      <section className="bg-[#07040f]">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
          <div className="grid grid-cols-3 gap-3 sm:gap-6 text-center">
            {[
              { v: String(totalEntries), l: "intel files" },
              { v: "0", l: "fake specs" },
              { v: "100%", l: "free, no account" },
            ].map((s) => (
              <div key={s.l} className="vice-card rounded-xl px-2 py-5">
                <div className="font-display text-3xl sm:text-5xl text-white">{s.v}</div>
                <div className="mt-1 text-[11px] sm:text-xs uppercase tracking-[0.2em] text-fuchsia-200/70">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ DOSSIERS ============ */}
      <section className="bg-[#07040f]">
        <div className="mx-auto max-w-5xl px-4 pb-4">
          <p className="font-display text-xs tracking-[0.34em] text-cyan-200/70 mb-2">◈ CASE FILES</p>
          <h2 className="font-display text-3xl sm:text-5xl text-white mb-6">
            PICK YOUR <span className="vice-neon-title">INTEL</span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {TEASERS.map((t) => (
              <Link key={t.href} href={t.href} className="vice-card group rounded-xl p-5 block">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-display text-lg tracking-widest text-fuchsia-300 border border-fuchsia-500/40 rounded-md px-2 py-1 bg-fuchsia-500/10">
                    {t.code}
                  </span>
                  {t.count !== null && (
                    <span className="rounded-full bg-black/50 border border-cyan-400/30 px-2.5 py-0.5 text-xs font-semibold text-cyan-200">
                      {t.count} {t.unit}
                    </span>
                  )}
                </div>
                <h3 className="mt-3 font-display text-xl tracking-wide text-white group-hover:text-fuchsia-200 transition">
                  {t.title}
                </h3>
                <p className="mt-1 text-sm text-white/60 leading-relaxed">{t.blurb}</p>
                <span className="mt-3 inline-block text-sm font-semibold text-cyan-300">
                  Open dossier <span aria-hidden="true">→</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ============ TRANSPARENCY — evidence board ============ */}
      <section className="bg-[#07040f]">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:py-20">
          <div className="vice-card rounded-2xl p-5 sm:p-8 relative overflow-hidden">
            <div
              aria-hidden="true"
              className="absolute -top-20 -right-20 h-64 w-64 rounded-full opacity-30"
              style={{ background: "radial-gradient(circle, rgba(255,45,120,.5), transparent 70%)" }}
            />
            <p className="font-display text-xs tracking-[0.34em] text-cyan-200/70 mb-2">◈ LEAK TRANSPARENCY ENGINE</p>
            <h2 className="font-display text-3xl sm:text-4xl text-white">
              EVERY CLAIM CARRIES <span className="vice-neon-title">RECEIPTS</span>
            </h2>
            <p className="mt-3 text-sm sm:text-base text-white/65 leading-relaxed max-w-2xl">
              “Spotted in Trailer 2 @ 1:47” — see exactly why we believe something exists.
              Every vehicle, weapon and location carries an evidence label. No fake data, ever.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {[
                { l: "ROCKSTAR-CONFIRMED", c: "border-green-400/50 text-green-300 bg-green-500/10" },
                { l: "TRAILER-CONFIRMED", c: "border-cyan-400/50 text-cyan-300 bg-cyan-500/10" },
                { l: "LEAK-REPORTED", c: "border-yellow-400/50 text-yellow-300 bg-yellow-500/10" },
                { l: "DISPUTED", c: "border-red-400/50 text-red-300 bg-red-500/10" },
              ].map((b) => (
                <span key={b.l} className={`rounded-full border px-3 py-1 text-xs font-bold tracking-wider ${b.c}`}>
                  {b.l}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-3">
            {[
              { t: "Free progress tracking", d: "Mark locations found, track % per category. No account, no caps, no paywall surprises." },
              { t: "Deep database", d: "Vehicle, weapon, character and location pages — each with an evidence chain and related entries." },
              { t: "Community-powered", d: "Submit locations, vote to confirm. Top mappers earn badges." },
              { t: "Mobile-first", d: "Runs in your phone browser while you play. No install, no game restarts." },
              { t: "Verified at launch", d: "72-hour verification sprint on Nov 19 — speculative pins get confirmed or removed, timestamped." },
              { t: "Cheats, honestly", d: "No cheat codes confirmed yet — and we say so. Status per platform, verified at launch." },
            ].map((f) => (
              <div key={f.t} className="vice-card rounded-xl p-5">
                <h3 className="font-display text-lg tracking-wide text-white">{f.t}</h3>
                <p className="mt-1 text-sm text-white/60 leading-relaxed">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ JOIN THE CREW ============ */}
      <section className="relative overflow-hidden bg-[#0d0618] border-t border-fuchsia-500/20">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-40"
          style={{ background: "radial-gradient(600px 260px at 50% 0%, rgba(168,85,247,.25), transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-xl px-4 py-14 sm:py-20 text-center">
          <p className="font-display text-xs tracking-[0.34em] text-cyan-200/70 mb-2">◈ TRANSMISSION</p>
          <h2 className="font-display text-3xl sm:text-5xl text-white">
            JOIN THE <span className="vice-neon-title">CREW</span>
          </h2>
          <p className="mt-3 text-sm text-white/60">Launch-list intel: verification updates, new dossiers. No spam.</p>
          <div className="mt-6">
            {subscribed ? (
              <div className="rounded-xl border border-green-400/40 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                ✓ You&apos;re in, crew member. We&apos;ll ping you when the full verified map drops.
              </div>
            ) : (
              <form onSubmit={subscribe} className="flex gap-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  aria-label="Email address"
                  className="flex-1 min-w-0 rounded-lg bg-black/50 border border-fuchsia-500/30 px-4 py-3 text-base sm:text-sm outline-none focus:border-fuchsia-400 placeholder:text-white/40 text-white"
                />
                <button
                  type="submit"
                  className="vice-btn-neon rounded-lg px-5 py-3 text-sm font-bold text-white whitespace-nowrap"
                >
                  Enlist
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
