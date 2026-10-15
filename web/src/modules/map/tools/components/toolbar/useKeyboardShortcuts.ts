// ─── modules/map/tools/components/toolbar/useKeyboardShortcuts.ts ─────
// Canonical keybindings (spec §6.4). Disabled while focus is in a text
// input/textarea/select/contenteditable, and while a modal dialog is open
// (except Esc / ?). Ctrl/Cmd per platform.

"use client";

import { useEffect } from "react";
import {
  useTools,
  emitToolEvent,
  type ToolKind,
} from "../../shared/toolRuntime";

function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || typeof (el as HTMLElement).tagName !== "string") return false;
  const tag = (el as HTMLElement).tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    (el as HTMLElement).isContentEditable
  );
}

export function useKeyboardShortcuts(onOpenHelp: () => void): void {
  const { activateTool, capabilities, togglePanel, getMap } = useTools();

  useEffect(() => {
    const toolForKey: Record<string, ToolKind> = {
      p: "pen",
      l: "line",
      r: "rect",
      c: "circle",
      m: "measure-distance",
      a: "measure-area",
    };
    const needsCapability: Record<string, keyof typeof capabilities> = {
      p: "draw",
      l: "draw",
      r: "draw",
      c: "draw",
      m: "measure",
      a: "measure",
    };

    const onKey = (e: KeyboardEvent) => {
      // Dialogs own their keys (Esc/? still work — handled by the dialog).
      const dialogOpen =
        document.querySelector('[role="dialog"][data-tools-modal="true"]') !==
        null;

      if (e.key === "Escape") return; // ToolsProvider owns Esc

      if (isTypingTarget(e.target)) return;

      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Undo / redo — drawing + measurement edit stack only.
      if (mod && key === "z" && !e.shiftKey) {
        e.preventDefault();
        emitToolEvent("gta6mapx:tools:undo");
        return;
      }
      if ((mod && key === "z" && e.shiftKey) || (mod && key === "y")) {
        e.preventDefault();
        emitToolEvent("gta6mapx:tools:redo");
        return;
      }
      if (mod) return;
      if (dialogOpen) return;

      if (key === "?") {
        onOpenHelp();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        emitToolEvent("gta6mapx:tools:delete-selected");
        return;
      }

      switch (key) {
        case "v":
          activateTool(null);
          break;
        case "g":
          if (capabilities.display)
            emitToolEvent("gta6mapx:tools:toggle-grid");
          break;
        case "h":
          if (capabilities.display)
            emitToolEvent("gta6mapx:tools:toggle-heatmap");
          break;
        case "f":
          if (capabilities.display)
            emitToolEvent("gta6mapx:tools:toggle-fov");
          break;
        case "+":
        case "=":
          getMap()?.zoomIn();
          break;
        case "-":
        case "_":
          getMap()?.zoomOut();
          break;
        case "o":
          if (capabilities.overlays) togglePanel("overlays");
          break;
        case "d":
          if (capabilities.display) togglePanel("display");
          break;
        default: {
          const tool = toolForKey[key];
          if (tool && capabilities[needsCapability[key]]) activateTool(tool);
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activateTool, capabilities, togglePanel, getMap, onOpenHelp]);
}
