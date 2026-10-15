// ─── modules/map/tools/components/toolbar/Toolbar.tsx ───────────────
// Desktop vertical icon toolbar (spec §6.1). Groups top→bottom: Navigate,
// Draw (flyout), Measure distance, Measure area, divider, Overlays, Display,
// divider, shortcuts. Active tool = neon-pink ring.

"use client";

import { useState } from "react";
import { useTools } from "../../shared/toolRuntime";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";
import ToolButton from "./ToolButton";
import DrawFlyout from "./DrawFlyout";
import ShortcutsDialog from "./ShortcutsDialog";
import { ShareAnnotationsButton } from "../../share/ShareAnnotations";

function Divider() {
  return <div aria-hidden="true" className="mx-1 my-1 h-px bg-white/10" />;
}

export default function Toolbar() {
  const {
    strings,
    activeTool,
    activateTool,
    activePanel,
    togglePanel,
    capabilities,
    isMinimalTier,
    compareActive,
    setCompareActive,
  } = useTools();
  const [helpOpen, setHelpOpen] = useState(false);
  useKeyboardShortcuts(() => setHelpOpen(true));

  const minimal = isMinimalTier();
  const measureReady = capabilities.measure && !minimal;

  return (
    <>
      <nav
        aria-label={strings.toolbarLabel}
        // Left edge of the viewport, stacked below the base-layer switch
        // (which owns left-3 top-3).
        className="pointer-events-auto absolute left-3 top-[64px] z-20 hidden flex-col gap-1 rounded-xl border border-white/10 bg-black/60 p-1.5 backdrop-blur-xl md:flex"
      >
        <ToolButton
          label={strings.toolNavigate}
          shortcut="V"
          active={activeTool === null || activeTool === "select"}
          onClick={() => activateTool(null)}
        >
          <span aria-hidden="true">🖱️</span>
        </ToolButton>
        <DrawFlyout />
        <Divider />
        <ToolButton
          label={strings.toolMeasureDistance}
          shortcut="M"
          active={activeTool === "measure-distance"}
          disabled={!measureReady}
          onClick={() => activateTool("measure-distance")}
        >
          <span aria-hidden="true">📐</span>
        </ToolButton>
        <ToolButton
          label={strings.toolMeasureArea}
          shortcut="A"
          active={activeTool === "measure-area"}
          disabled={!measureReady}
          onClick={() => activateTool("measure-area")}
        >
          <span aria-hidden="true">⬒</span>
        </ToolButton>
        <Divider />
        <ToolButton
          label={strings.toolOverlays}
          shortcut="O"
          active={activePanel === "overlays"}
          disabled={!capabilities.overlays}
          onClick={() => togglePanel("overlays")}
        >
          <span aria-hidden="true">🗺️</span>
        </ToolButton>
        <ToolButton
          label={strings.toolDisplay}
          shortcut="D"
          active={activePanel === "display"}
          disabled={!capabilities.display}
          onClick={() => togglePanel("display")}
        >
          <span aria-hidden="true">🎛️</span>
        </ToolButton>
        <Divider />
        <ToolButton
          label={strings.toolCompare}
          active={compareActive}
          onClick={() => setCompareActive(!compareActive)}
        >
          <span aria-hidden="true">◐</span>
        </ToolButton>
        <ShareAnnotationsButton />
        <Divider />
        <ToolButton
          label={strings.toolShortcuts}
          shortcut="?"
          onClick={() => setHelpOpen(true)}
        >
          <span aria-hidden="true">⌨️</span>
        </ToolButton>
      </nav>
      {helpOpen && <ShortcutsDialog onClose={() => setHelpOpen(false)} />}
    </>
  );
}
