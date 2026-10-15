// ─── modules/map/components/chrome/LeftRail.tsx ────────────────────────
// Left floating tool rail (desktop): marker list, library/game links, go-to,
// zoom, measure, draw shape-picker, undo/redo (real disabled state via the
// gta6mapx:draw-stack event DrawTools dispatches), and clear-all drawings
// (reuses the draw slice's own confirm dialog via gta6mapx:draw:request-clear-all).
// All icons are original inline SVGs. All code below is original
// (CHROME TEAM, Sep 2026).

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  emitToolEvent,
  useTools,
  type DrawToolKind,
} from "../../tools/shared/toolRuntime";
import { drawStrings } from "../../tools/draw/sliceStrings";

// ─── Shared rail primitives (also used by RightRail) ─────────────────────

const RAIL_BUTTON_BASE =
  "flex h-11 w-11 items-center justify-center rounded-xl border transition-colors disabled:cursor-not-allowed disabled:opacity-35";
const RAIL_BUTTON_IDLE =
  "border-transparent text-[#c6cdd8] hover:border-[#ff50c5]/50 hover:bg-[#ff50c5]/10 hover:text-white hover:shadow-[0_0_14px_rgba(255,80,197,0.35)]";
const RAIL_BUTTON_ACTIVE =
  "border-[#ff50c5]/70 bg-[#ff50c5]/15 text-[#ff50c5] shadow-[0_0_14px_rgba(255,80,197,0.45)]";

interface RailIconButtonProps {
  label: string;
  active?: boolean;
  disabled?: boolean;
  pressed?: boolean;
  onClick: () => void;
  onFocus?: () => void;
  children: ReactNode;
}

export function RailIconButton({
  label,
  active = false,
  disabled = false,
  pressed,
  onClick,
  onFocus,
  children,
}: RailIconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed ?? (active || undefined)}
      disabled={disabled}
      onClick={onClick}
      onFocus={onFocus}
      className={`${RAIL_BUTTON_BASE} ${active ? RAIL_BUTTON_ACTIVE : RAIL_BUTTON_IDLE}`}
    >
      {children}
    </button>
  );
}

interface RailIconLinkProps {
  href: string;
  label: string;
  children: ReactNode;
}

export function RailIconLink({ href, label, children }: RailIconLinkProps) {
  return (
    <a
      href={href}
      aria-label={label}
      title={label}
      className={`${RAIL_BUTTON_BASE} ${RAIL_BUTTON_IDLE}`}
    >
      {children}
    </a>
  );
}

export function RailDivider() {
  return <span className="my-0.5 h-px w-8 bg-white/10" aria-hidden="true" />;
}

export const RAIL_SHELL =
  "pointer-events-auto absolute top-1/2 left-3 z-30 hidden w-14 -translate-y-1/2 flex-col items-center gap-1 rounded-2xl border border-white/10 bg-black/60 p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.55)] backdrop-blur-md md:flex md:fixed md:left-5";

/** Real undo/redo availability, pushed by DrawTools via CustomEvent. */
export function useDrawStackState(): { canUndo: boolean; canRedo: boolean } {
  const [stack, setStack] = useState({ canUndo: false, canRedo: false });
  useEffect(() => {
    const onStack = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { canUndo?: unknown; canRedo?: unknown }
        | undefined;
      if (!detail) return;
      setStack({
        canUndo: detail.canUndo === true,
        canRedo: detail.canRedo === true,
      });
    };
    window.addEventListener("gta6mapx:draw-stack", onStack);
    return () => window.removeEventListener("gta6mapx:draw-stack", onStack);
  }, []);
  return stack;
}

// ─── Original icons ──────────────────────────────────────────────────────

function iconProps(extra?: string) {
  return {
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    className: `h-5 w-5 ${extra ?? ""}`,
  } as const;
}

function PinIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M10 18.2S4.6 12.9 4.6 8.7a5.4 5.4 0 0 1 10.8 0c0 4.2-5.4 9.5-5.4 9.5Z" />
      <circle cx="10" cy="8.7" r="1.9" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

function LibraryIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M4 16.5V6a2 2 0 0 1 2-2h11.5v11.5H6a2 2 0 0 0-2 2Zm0 0a2 2 0 0 0 2 2h11.5" />
      <path d="M7.5 7.5h7" />
    </svg>
  );
}

function GamepadIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M6.5 7.5h7a4.75 4.75 0 0 1 4.7 5.4c-.3 2.4-2.3 4.1-4.7 4.1-1.3 0-2.4-.5-3.2-1.4L10 15.2l-.3-.4-.3.4c-.8.9-1.9 1.4-3.2 1.4-2.4 0-4.4-1.7-4.7-4.1a4.75 4.75 0 0 1 4.7-5.4Z" />
      <path d="M7.5 10.5v3M6 12h3" />
      <circle cx="13.2" cy="11.2" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="14.8" cy="13" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="9" cy="9" r="5.5" />
      <path d="M13.2 13.2 17 17" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M10 4v12M4 10h12" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M4 10h12" />
    </svg>
  );
}

function RulerIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M3.8 15.4 15.4 3.8l.8.8L4.6 16.2l-.8-.8Z" />
      <path d="M7.5 11.1l1.2 1.2M9.8 8.8l1.2 1.2M12.1 6.5l1.2 1.2" />
    </svg>
  );
}

function PenIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M3.5 16.5 4.4 13 14.6 2.8a1.9 1.9 0 0 1 2.7 2.7L7 15.6l-3.5.9Z" />
      <path d="M12.8 4.6l2.7 2.7" />
    </svg>
  );
}

function LineIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M4.5 15.5 15.5 4.5" />
      <circle cx="4.5" cy="15.5" r="1.3" />
      <circle cx="15.5" cy="4.5" r="1.3" />
    </svg>
  );
}

function RectIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="3.5" y="5.5" width="13" height="9" rx="1.5" />
    </svg>
  );
}

function CircleIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="10" cy="10" r="6.5" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M7.5 5.5 3.5 9.5l4 4" />
      <path d="M3.5 9.5H12a5 5 0 0 1 0 10h-2.5" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M12.5 5.5l4 4-4 4" />
      <path d="M16.5 9.5H8a5 5 0 0 0 0 10h2.5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M3.5 5.5h13M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5.8 5.5l.8 12a1 1 0 0 0 1 .9h4.8a1 1 0 0 0 1-.9l.8-12" />
      <path d="M8.3 9v5.5M11.7 9v5.5" />
    </svg>
  );
}

// ─── Draw shape-picker (slim reimplementation of DrawFlyout for the rail) ─
// Same tool kinds, shortcut keys and string labels as the toolbar flyout,
// restyled to open right of the 56 px rail. Original markup/icons.

const DRAW_SHAPES: Array<{
  kind: DrawToolKind;
  key: string;
  Icon: () => React.ReactElement;
}> = [
  { kind: "pen", key: "P", Icon: PenIcon },
  { kind: "line", key: "L", Icon: LineIcon },
  { kind: "rect", key: "R", Icon: RectIcon },
  { kind: "circle", key: "C", Icon: CircleIcon },
];

function DrawPicker() {
  const { strings, activeTool, activateTool, capabilities, isMinimalTier } =
    useTools();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const ready = capabilities.draw && !isMinimalTier();
  const activeDraw: DrawToolKind | null =
    activeTool === "pen" ||
    activeTool === "line" ||
    activeTool === "rect" ||
    activeTool === "circle"
      ? activeTool
      : null;

  const nameFor = (kind: DrawToolKind): string =>
    kind === "pen"
      ? strings.toolPen
      : kind === "line"
        ? strings.toolLine
        : kind === "rect"
          ? strings.toolRect
          : strings.toolCircle;

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDocDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDocDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={() => ready && setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <RailIconButton
        label={ready ? strings.toolDraw : strings.toolNotReady}
        active={activeDraw !== null}
        pressed={activeDraw !== null}
        disabled={!ready}
        onClick={() => {
          if (!ready) return;
          if (activeDraw) activateTool(null);
          else activateTool("pen");
        }}
        onFocus={() => ready && setOpen(true)}
      >
        <PenIcon />
      </RailIconButton>
      {open && ready && (
        <div
          role="menu"
          aria-label={strings.toolDraw}
          className="absolute top-0 left-full z-30 ml-2 flex flex-col gap-1 rounded-xl border border-white/10 bg-black/70 p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.55)] backdrop-blur-md"
        >
          {DRAW_SHAPES.map(({ kind, key, Icon }) => {
            const active = activeDraw === kind;
            return (
              <button
                key={kind}
                type="button"
                role="menuitem"
                title={strings.shortcutWith(nameFor(kind), key)}
                aria-label={strings.shortcutWith(nameFor(kind), key)}
                onClick={() => {
                  activateTool(kind);
                  setOpen(false);
                }}
                className={`flex h-11 min-w-11 items-center gap-2 rounded-lg border px-2 text-left text-sm transition-colors ${
                  active
                    ? "border-[#ff50c5]/70 bg-[#ff50c5]/15 text-white"
                    : "border-white/10 bg-black/60 text-[#c6cdd8] hover:border-[#ff50c5]/50 hover:text-white"
                }`}
              >
                <Icon />
                <span className="pr-1 font-medium">{nameFor(kind)}</span>
                <kbd className="ml-auto font-mono text-[10px] text-[#8b94a3]">
                  {key}
                </kbd>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── LeftRail ────────────────────────────────────────────────────────────

interface LeftRailProps {
  markerDrawerOpen: boolean;
  onToggleMarkerDrawer: () => void;
  onOpenGoTo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export default function LeftRail({
  markerDrawerOpen,
  onToggleMarkerDrawer,
  onOpenGoTo,
  onZoomIn,
  onZoomOut,
}: LeftRailProps) {
  const { strings, activeTool, activateTool, capabilities, isMinimalTier } =
    useTools();
  const { canUndo, canRedo } = useDrawStackState();

  const measuring =
    activeTool === "measure-distance" || activeTool === "measure-area";
  const measureReady = capabilities.measure && !isMinimalTier();

  const requestClearAll = () => {
    window.dispatchEvent(new CustomEvent("gta6mapx:draw:request-clear-all"));
  };

  return (
    <nav aria-label="Map tools" className={RAIL_SHELL}>
      <RailIconButton
        label={markerDrawerOpen ? "Close marker list" : "Open marker list"}
        active={markerDrawerOpen}
        pressed={markerDrawerOpen}
        onClick={onToggleMarkerDrawer}
      >
        {markerDrawerOpen ? <CloseIcon /> : <PinIcon />}
      </RailIconButton>
      <RailDivider />
      <RailIconLink href="/library" label="Open library">
        <LibraryIcon />
      </RailIconLink>
      <RailIconLink href="/game/find-the-location" label="Play Find the Location">
        <GamepadIcon />
      </RailIconLink>
      <RailIconButton label="Go to position" onClick={onOpenGoTo}>
        <SearchIcon />
      </RailIconButton>
      <RailDivider />
      <RailIconButton label="Zoom in" onClick={onZoomIn}>
        <PlusIcon />
      </RailIconButton>
      <RailIconButton label="Zoom out" onClick={onZoomOut}>
        <MinusIcon />
      </RailIconButton>
      <RailDivider />
      <RailIconButton
        label={measureReady ? strings.toolMeasureDistance : strings.toolNotReady}
        active={measuring}
        pressed={measuring}
        disabled={!measureReady}
        onClick={() => {
          if (measureReady) activateTool("measure-distance");
        }}
      >
        <RulerIcon />
      </RailIconButton>
      <DrawPicker />
      <RailIconButton
        label={drawStrings.undo}
        disabled={!canUndo}
        onClick={() => emitToolEvent("gta6mapx:tools:undo")}
      >
        <UndoIcon />
      </RailIconButton>
      <RailIconButton
        label={drawStrings.redo}
        disabled={!canRedo}
        onClick={() => emitToolEvent("gta6mapx:tools:redo")}
      >
        <RedoIcon />
      </RailIconButton>
      <RailDivider />
      <RailIconButton label="Delete all drawings" onClick={requestClearAll}>
        <TrashIcon />
      </RailIconButton>
    </nav>
  );
}
