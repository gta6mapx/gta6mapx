"use client";

// ─── modules/engagement/credits/AboutModal.tsx ──────────────────────────
// Credits / About modal (engagement spec §5).
//
// Sections (§5.1, in order): About the project → Team/roles (generic role
// list only — no invented names) → Data sources (with the REAL GTADB
// CC BY 4.0 attribution, matching the site footer) → fan-project disclaimer
// (verbatim) → contact placeholder (owner supplies the address).
//
// Trigger API for the coordinator: mount <AboutModal /> once (e.g. in the
// root layout) and call openAboutModal() from the header "About" and footer
// "About / Credits" entries. useAboutModal() exposes the same state for
// custom triggers.

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

// ─── Trigger bus ─────────────────────────────────────────────────────────

type AboutListener = (open: boolean) => void;
const listeners = new Set<AboutListener>();

/** Open the About modal from anywhere (header, footer). */
export function openAboutModal(): void {
  listeners.forEach((fn) => {
    try {
      fn(true);
    } catch {
      /* listener error must not break the trigger */
    }
  });
}

/** Close the About modal programmatically. */
export function closeAboutModal(): void {
  listeners.forEach((fn) => {
    try {
      fn(false);
    } catch {
      /* ignore */
    }
  });
}

function subscribeAboutModal(fn: AboutListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useAboutModal(): {
  open: boolean;
  setOpen: (open: boolean) => void;
} {
  const [open, setOpen] = useState(false);
  useEffect(() => subscribeAboutModal(setOpen), []);
  return { open, setOpen };
}

// ─── Copy (single English source; no language selector at launch) ────────

const DISCLAIMER =
  "This is an unofficial fan project. Not affiliated with, endorsed by, or connected to Rockstar Games or Take-Two Interactive. Grand Theft Auto and all related marks are trademarks of Take-Two Interactive.";

function SectionHeading({ children }: { children: string }) {
  return (
    <h3 className="font-display text-base tracking-wide text-[#e8ecf1]">
      {children}
    </h3>
  );
}

function BodyText({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 text-[0.875rem] leading-relaxed text-[#c3cad4]">
      {children}
    </p>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────

export function AboutModal() {
  const { open, setOpen } = useAboutModal();
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const headingId = useId();

  // Remember the trigger so focus returns to it on close.
  useEffect(() => {
    if (open) {
      triggerRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      // Move focus into the dialog on open.
      dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    } else if (triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [open ]);

  // ESC to close + focus trap (Tab cycles inside the dialog).
  useEffect(() => {
    if (!open) return;
    const el = dialogRef.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !el) return;
      const focusables = Array.from(
        el.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((n) => n.getAttribute("aria-hidden") !== "true");
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
      {/* backdrop — click closes */}
      <button
        type="button"
        aria-label="Close about dialog"
        onClick={() => setOpen(false)}
        className="absolute inset-0 cursor-default bg-black/60"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="about-modal glass-panel relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-b-none rounded-t-2xl sm:max-w-[560px] sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-[#1f2632] px-5 py-4">
          <h2
            id={headingId}
            className="font-display text-xl tracking-wide text-[#e8ecf1]"
          >
            About GTA6mapx
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            data-autofocus
            className="btn-ghost flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full px-4 text-[0.8125rem] font-semibold"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="flex flex-col gap-6">
            <section aria-label="About the project">
              <SectionHeading>About the project</SectionHeading>
              <BodyText>
                GTA6mapx.com is a fan-made interactive map and guides hub for
                Grand Theft Auto VI, built before launch so players have
                honest intel from day one.
              </BodyText>
              <BodyText>
                Every entry on this site carries a Leak Transparency Engine
                label — Rockstar-confirmed, Trailer-confirmed, Leak-reported,
                or Disputed — so you always know exactly how we know what we
                show. We publish original summaries only: no leaked files, no
                trailer rips, no reposted artwork.
              </BodyText>
            </section>

            <section aria-label="Team">
              <SectionHeading>Team</SectionHeading>
              <BodyText>
                The project is maintained by its owner and contributors. Roles
                are listed instead of names by design:
              </BodyText>
              <ul className="mt-2 flex flex-col gap-1.5 text-[0.875rem] text-[#c3cad4]">
                {["Map data", "Design", "Research"].map((role) => (
                  <li key={role} className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]"
                    />
                    {role}
                  </li>
                ))}
              </ul>
            </section>

            <section aria-label="Data sources">
              <SectionHeading>Data sources</SectionHeading>
              <ul className="mt-2 flex list-disc flex-col gap-2 pl-5 text-[0.875rem] leading-relaxed text-[#c3cad4]">
                <li>
                  Official Rockstar Games announcements and published
                  materials.
                </li>
                <li>
                  Trailer and promo analysis via public reporting — our
                  summaries are original, and we never host leaked files.
                </li>
                <li>Community mapping contributions.</li>
                <li>
                  Map data ©{" "}
                  <a
                    href="https://map.gtadb.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-white"
                  >
                    gtadb.org
                  </a>{" "}
                  contributors, licensed under{" "}
                  <a
                    href="https://creativecommons.org/licenses/by/4.0/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-white"
                  >
                    CC BY 4.0
                  </a>
                  .
                </li>
              </ul>
            </section>

            <section
              aria-label="Fan project disclaimer"
              className="rounded-[10px] border border-[var(--accent-line)] bg-[var(--accent-soft)] px-4 py-3"
            >
              <p className="text-[0.8125rem] font-semibold leading-relaxed text-[#e8ecf1]">
                {DISCLAIMER}
              </p>
            </section>

            <section aria-label="Contact">
              <SectionHeading>Contact</SectionHeading>
              <BodyText>Contact email: (to be added)</BodyText>
            </section>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
