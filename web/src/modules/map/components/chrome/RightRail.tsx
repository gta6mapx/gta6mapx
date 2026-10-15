// ─── modules/map/components/chrome/RightRail.tsx ───────────────────────
// Right floating rail (desktop): about on top; settings + community below.
// Button styling shared with LeftRail. All icons are original inline SVGs.
// All code below is original (CHROME TEAM, Sep 2026).

"use client";

import {
  RAIL_SHELL,
  RailDivider,
  RailIconButton,
  RailIconLink,
} from "./LeftRail";

interface RightRailProps {
  onOpenAbout: () => void;
  onOpenSettings: () => void;
}

function InfoIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 9.2v4.3" />
      <circle cx="10" cy="6.6" r="0.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <circle cx="10" cy="10" r="2.6" />
      <path d="M10 2.8v2.2M10 15v2.2M2.8 10h2.2M15 10h2.2M4.9 4.9l1.6 1.6M13.5 13.5l1.6 1.6M15.1 4.9l-1.6 1.6M6.5 13.5l-1.6 1.6" />
    </svg>
  );
}

function CommunityIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <circle cx="7" cy="7" r="3" />
      <path d="M2.5 16.5c.6-2.8 2.4-4.2 4.5-4.2s3.9 1.4 4.5 4.2" />
      <circle cx="14" cy="8" r="2.4" />
      <path d="M13.4 12.5c2 .1 3.4 1.4 4 4" />
    </svg>
  );
}

export default function RightRail({ onOpenAbout, onOpenSettings }: RightRailProps) {
  // RAIL_SHELL is anchored `left-3` / `md:left-5` for the left rail — mirror
  // it so the two rails don't stack on top of each other on the left edge.
  const shell = RAIL_SHELL.replace("left-3", "right-3").replace("md:left-5", "md:right-5");
  return (
    <nav
      aria-label="Map options"
      className={`${shell} h-72 justify-between py-2`}
    >
      <div className="flex flex-col items-center gap-1">
        <RailIconButton label="About GTA6mapx" onClick={onOpenAbout}>
          <InfoIcon />
        </RailIconButton>
      </div>
      <div className="flex flex-col items-center gap-1">
        <RailIconButton label="Map settings" onClick={onOpenSettings}>
          <GearIcon />
        </RailIconButton>
        <RailDivider />
        <RailIconLink href="/community" label="Open community">
          <CommunityIcon />
        </RailIconLink>
      </div>
    </nav>
  );
}
