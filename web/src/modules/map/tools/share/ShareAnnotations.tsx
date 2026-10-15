// ─── modules/map/tools/share/ShareAnnotations.tsx ──────────────────────
// "Share annotations" — serialize drawings + measurements + overlay
// placement into a compact "#a=<payload>" fragment on /map, copy it, and
// restore it when /map loads with one.
//
//  - The image FILE is never shared (bytes stay on the sender's device);
//    user-import overlays carry placement + file hash only, and the UI says
//    so every time ("The image itself isn't shared, only its placement").
//  - Coordinates are rounded to 4 decimals at encode time, and the loaded
//    toast keeps the existing approximate-positions language.
//  - Invalid payloads are ignored with a single honest toast; the map never
//    blanks.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTools } from "../shared/toolRuntime";
import ToolButton from "../components/toolbar/ToolButton";
import {
  buildShareDoc,
  decodeSharePayload,
  encodeSharePayload,
  isShareDocEmpty,
  MAX_SHARED_ITEMS,
} from "./shareCodec";
import { getShareHandlers } from "./shareBridge";

interface ShareCounts {
  drawings: number;
  measurements: number;
  overlays: number;
}

function snapshotCounts(): ShareCounts {
  const h = getShareHandlers();
  return {
    drawings: h.draw?.snapshot().length ?? 0,
    measurements: h.measure?.snapshot().length ?? 0,
    overlays: h.overlays?.snapshot().length ?? 0,
  };
}

type ShareFn = (
  data: { title?: string; text?: string; url?: string }
) => Promise<void>;

/** Shared by the desktop popover and the mobile sheet row. */
export function useShareAnnotations() {
  const { toast, strings } = useTools();

  const copyLink = useCallback(async (): Promise<boolean> => {
    const h = getShareHandlers();
    const drawings = h.draw?.snapshot() ?? [];
    const measurements = h.measure?.snapshot() ?? [];
    const overlays = h.overlays?.snapshot() ?? [];
    const { doc, truncated } = buildShareDoc(drawings, measurements, overlays);
    if (isShareDocEmpty(doc)) {
      toast(strings.shareNothingToShare);
      return false;
    }
    const url = `${window.location.origin}/map#a=${encodeSharePayload(doc)}`;
    // Web Share API first (native sheet on mobile), clipboard fallback —
    // same pattern as GameMap's shareView.
    const nav = navigator as Navigator & { share?: ShareFn };
    let shared = false;
    if (typeof nav.share === "function") {
      try {
        await nav.share({
          title: "GTA 6 map annotations — gta6mapx",
          text: "My annotations on the GTA 6 interactive map",
          url,
        });
        shared = true;
      } catch {
        /* user cancelled or share failed — fall through to clipboard */
      }
    }
    if (!shared) {
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        toast(strings.shareCopyBlocked);
        return false;
      }
    }
    const parts: string[] = [strings.shareCopied];
    if (truncated > 0) parts.push(strings.shareTruncated(MAX_SHARED_ITEMS));
    if (doc.o.length > 0) parts.push(strings.shareImageNote);
    toast(parts.join(" "));
    return true;
  }, [toast, strings]);

  return { snapshotCounts, copyLink };
}

/** Desktop toolbar button + popover (counts, image note, copy). */
export function ShareAnnotationsButton() {
  const { strings } = useTools();
  const { copyLink } = useShareAnnotations();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<ShareCounts>({
    drawings: 0,
    measurements: 0,
    overlays: 0,
  });

  const toggle = () => {
    setCounts(snapshotCounts());
    setOpen((o) => !o);
  };

  return (
    <div className="relative">
      <ToolButton
        label={strings.shareAnnotations}
        active={open}
        onClick={toggle}
      >
        <span aria-hidden="true">🔗</span>
      </ToolButton>
      {open && (
        <div
          role="dialog"
          aria-label={strings.shareTitle}
          className="absolute left-[calc(100%+10px)] top-0 z-30 w-64 rounded-xl border border-white/10 bg-black/85 p-3 backdrop-blur-xl"
        >
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">{strings.shareTitle}</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={strings.close}
              className="rounded-md px-1.5 py-0.5 text-[#8b94a3] hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>
          <p className="mb-2 font-mono text-[11px] text-[#8b94a3]">
            {strings.shareCounts(counts.drawings, counts.measurements, counts.overlays)}
          </p>
          <p className="mb-3 text-[11px] leading-snug text-[#8b94a3]">
            {strings.shareImageNote}{" "}
            <span className="text-[#6b7482]">
              Positions are shared approximately.
            </span>
          </p>
          <button
            type="button"
            onClick={() => {
              void copyLink().then((ok) => {
                if (ok) setOpen(false);
              });
            }}
            className="w-full rounded-lg bg-[#ff50c5]/90 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#ff50c5]"
          >
            {strings.shareCopyLink}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Mount-once: reads "#a=" from the URL fragment, validates, and restores
 * the annotations through the slice handlers. Runs after the slice children
 * (sibling effect order), with a short retry window in case a slice mounts
 * late. The fragment is stripped immediately so it never re-applies.
 */
export function SharedAnnotationsLoader() {
  const { toast, strings } = useTools();
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current) return;
    const match = /^#a=([A-Za-z0-9\-_]+)$/.exec(window.location.hash);
    if (!match) return;
    doneRef.current = true;
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search
    );
    const doc = decodeSharePayload(match[1]);
    if (!doc || isShareDocEmpty(doc)) {
      toast(strings.shareLoadFailed);
      return;
    }
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      const h = getShareHandlers();
      if (!h.draw || !h.measure || !h.overlays) {
        if (attempts >= 20) window.clearInterval(timer);
        return;
      }
      window.clearInterval(timer);
      try {
        const nDraw = h.draw.restore(doc.d);
        const nMeasure = h.measure.restore(doc.m);
        const ov = h.overlays.restore(doc.o);
        const total = nDraw + nMeasure + ov.added + ov.updated;
        if (total === 0) return; // slices already toasted specifically
        toast(strings.shareLoaded(total));
      } catch {
        toast(strings.shareLoadFailed);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [toast, strings]);

  return null;
}
