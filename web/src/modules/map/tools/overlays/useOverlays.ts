// ─── modules/map/tools/overlays/useOverlays.ts ────────────────────────
// React binding: registry ↔ component state + persistence + placement
// flow + "needs file" states. Client-only: localStorage access is
// useEffect-guarded with shape validation (spec §1.3 conventions).
//
// Persisted key: gta6mapx.overlays.v1 = control-point pairs, opacity,
// visibility, file hashes, names, order. The image FILE is never persisted
// (object URLs only) — on reload an import shows "needs file" until the
// user re-selects it; hash match → instant re-georeference.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OverlayRegistry, type RegisterInput } from "./overlayRegistry";
import type { OverlayAttachment } from "./overlayRenderer";
import type { SharedOverlayItem } from "../share/shareCodec";
import {
  isTileVersionMeta,
  isUserImportMeta,
  type ControlPointPair,
  type OverlayEntry,
  type UserImportMeta,
} from "./overlayTypes";
import { overlayStrings } from "./sliceStrings";
import {
  addPlacementImagePoint,
  addPlacementMapPoint,
  createPlacementState,
  defaultEntryName,
  imageCornersToLngLat,
  isPlacementComplete,
  loadAndDownscaleImage,
  placementControlPoints,
  placementStep,
  revokeImageUrl,
  sha256Hex,
  validateImageFile,
  type PlacementState,
  type PlacementStep,
  type Vec2,
} from "./userImageOverlay";

const STORAGE_KEY = "gta6mapx.overlays.v1";
export const MAX_OVERLAYS = 25;

// ─── persisted shape ────────────────────────────────────────────────────

interface PersistedUserImport {
  kind: "user-import";
  controlPoints: [ControlPointPair, ControlPointPair, ControlPointPair];
  fileHash: string;
  fileName: string;
  width: number;
  height: number;
}

interface PersistedTileVersion {
  kind: "tile-version";
  tileUrlTemplate: string;
  attribution: string;
}

interface PersistedEntry {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  meta: PersistedUserImport | PersistedTileVersion | null;
}

interface PersistedDoc {
  version: 1;
  savedAt: string;
  entries: PersistedEntry[];
}

function isVec2(v: unknown): v is Vec2 {
  return (
    Array.isArray(v) &&
    v.length === 2 &&
    v.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

function isControlPointPair(v: unknown): v is ControlPointPair {
  if (typeof v !== "object" || v === null) return false;
  const o = v as { map?: unknown; img?: unknown };
  return isVec2(o.map) && isVec2(o.img);
}

function toRegisterInput(pe: unknown): RegisterInput | null {
  if (typeof pe !== "object" || pe === null) return null;
  const o = pe as Record<string, unknown>;
  if (typeof o.id !== "string" || o.id.length === 0) return null;
  if (typeof o.name !== "string") return null;
  const meta = o.meta as PersistedEntry["meta"] | null;
  let kind: RegisterInput["kind"] = "user-import";
  let outMeta: RegisterInput["meta"] = null;
  if (meta && typeof meta === "object") {
    if (meta.kind === "user-import") {
      if (
        !Array.isArray(meta.controlPoints) ||
        meta.controlPoints.length !== 3 ||
        !meta.controlPoints.every(isControlPointPair) ||
        typeof meta.fileHash !== "string" ||
        typeof meta.fileName !== "string" ||
        typeof meta.width !== "number" ||
        typeof meta.height !== "number"
      ) {
        return null;
      }
      outMeta = {
        controlPoints: meta.controlPoints as [
          ControlPointPair,
          ControlPointPair,
          ControlPointPair,
        ],
        fileHash: meta.fileHash,
        fileName: meta.fileName,
        width: meta.width,
        height: meta.height,
      };
    } else if (meta.kind === "tile-version") {
      if (
        typeof meta.tileUrlTemplate !== "string" ||
        typeof meta.attribution !== "string"
      ) {
        return null;
      }
      kind = "tile-version";
      outMeta = {
        tileUrlTemplate: meta.tileUrlTemplate,
        attribution: meta.attribution,
      };
    }
  }
  return {
    id: o.id,
    name: o.name,
    kind,
    meta: outMeta,
    visible: o.visible === false ? false : true,
    opacity: typeof o.opacity === "number" ? o.opacity : undefined,
  };
}

function toPersistedEntry(entry: OverlayEntry): PersistedEntry {
  let meta: PersistedEntry["meta"] = null;
  if (isUserImportMeta(entry.meta)) {
    meta = {
      kind: "user-import",
      controlPoints: entry.meta.controlPoints,
      fileHash: entry.meta.fileHash,
      fileName: entry.meta.fileName,
      width: entry.meta.width,
      height: entry.meta.height,
    };
  } else if (isTileVersionMeta(entry.meta)) {
    meta = {
      kind: "tile-version",
      tileUrlTemplate: entry.meta.tileUrlTemplate,
      attribution: entry.meta.attribution,
    };
  }
  return {
    id: entry.id,
    name: entry.name,
    visible: entry.visible,
    opacity: entry.opacity,
    meta,
  };
}

// ─── hook ───────────────────────────────────────────────────────────────

export interface OverlaysApi {
  entries: OverlayEntry[];
  attachments: Record<string, OverlayAttachment>;
  /** Active placement session, or null when not placing. */
  placement: PlacementState | null;
  /** Current step 1–6, or null when not placing. */
  placementStep: PlacementStep | null;
  importImage: (file: File) => Promise<void>;
  reselectFile: (entryId: string, file: File) => Promise<void>;
  setVisible: (id: string, visible: boolean) => void;
  setOpacity: (id: string, opacity: number) => void;
  renameEntry: (id: string, name: string) => void;
  removeEntry: (id: string) => void;
  moveEntry: (id: string, direction: -1 | 1) => void;
  addMapPoint: (point: Vec2) => void;
  addImagePoint: (point: Vec2) => void;
  cancelPlacement: () => void;
  /**
   * Restore shared overlay placements (see shareCodec). Returns counts for
   * the loaded toast. User imports land as "needs file" entries.
   */
  applySharedOverlays: (
    items: SharedOverlayItem[]
  ) => { added: number; updated: number };
}

export function useOverlays(toast: (msg: string) => void): OverlaysApi {
  const registryRef = useRef<OverlayRegistry | null>(null);
  const getRegistry = () => {
    if (registryRef.current == null) {
      registryRef.current = new OverlayRegistry();
    }
    return registryRef.current;
  };

  const [entries, setEntries] = useState<OverlayEntry[]>([]);
  const [attachments, setAttachments] = useState<
    Record<string, OverlayAttachment>
  >({});
  const [placement, setPlacement] = useState<PlacementState | null>(null);
  // Ref mirror so placement completion can finalize in event handlers
  // (no setState inside effects).
  const placementRef = useRef<PlacementState | null>(null);
  const setPlacementState = (next: PlacementState | null) => {
    placementRef.current = next;
    setPlacement(next);
  };
  const loadedRef = useRef(false);
  const quotaWarnedRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);

  // Mirror registry → state.
  useEffect(() => {
    const registry = getRegistry();
    const sync = () => setEntries(registry.getEntries());
    sync();
    return registry.subscribe(sync);
     
  }, []);

  // Load persisted registry (client-only, validated).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const doc = JSON.parse(raw) as Partial<PersistedDoc>;
        if (doc && doc.version === 1 && Array.isArray(doc.entries)) {
          const registry = getRegistry();
          for (const pe of doc.entries.slice(0, MAX_OVERLAYS)) {
            const input = toRegisterInput(pe);
            if (input) registry.register(input);
          }
        }
      }
    } catch {
      toast(overlayStrings.overlaysCorrupt);
    }
    loadedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist (debounced) — never during an in-flight placement.
  useEffect(() => {
    if (!loadedRef.current) return;
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      try {
        const doc: PersistedDoc = {
          version: 1,
          savedAt: new Date().toISOString(),
          entries: getRegistry().getEntries().map(toPersistedEntry),
        };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
      } catch (err) {
        if (
          err instanceof DOMException &&
          err.name === "QuotaExceededError" &&
          !quotaWarnedRef.current
        ) {
          quotaWarnedRef.current = true;
          toast("Overlay settings couldn't be saved on this device (storage full).");
        }
      }
    }, 500);
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [entries, toast]);

  // Revoke all object URLs on unmount.
  useEffect(() => {
    return () => {
      setAttachments((prev) => {
        for (const att of Object.values(prev)) {
          if (att.imageUrl) revokeImageUrl(att.imageUrl);
        }
        return prev;
      });
    };
  }, []);

  const finalizePlacement = useCallback(
    (p: PlacementState) => {
      const pairs = placementControlPoints(p);
      if (!pairs) return;
      const registry = getRegistry();
      let coords: [Vec2, Vec2, Vec2, Vec2];
      try {
        coords = imageCornersToLngLat(pairs, p.imageWidth, p.imageHeight);
      } catch {
        revokeImageUrl(p.imageUrl);
        toast(overlayStrings.overlayDegenerate);
        return;
      }
      const meta: UserImportMeta = {
        controlPoints: pairs,
        fileHash: p.fileHash,
        fileName: p.fileName,
        width: p.imageWidth,
        height: p.imageHeight,
      };
      const id = p.targetEntryId ?? `user-import-${p.fileHash.slice(0, 8)}`;
      const existing = p.targetEntryId
        ? registry.getEntry(p.targetEntryId)
        : undefined;
      const entry = registry.register({
        id,
        name: existing?.name ?? defaultEntryName(p.fileName),
        kind: "user-import",
        meta,
        visible: existing?.visible,
        opacity: existing?.opacity,
      });
      setAttachments((prev) => {
        const old = prev[id];
        if (old?.imageUrl && old.imageUrl !== p.imageUrl) {
          revokeImageUrl(old.imageUrl);
        }
        return {
          ...prev,
          [id]: {
            imageUrl: p.imageUrl,
            imageCoordinates: coords.map(
              (c) => [c[0], c[1]] as [number, number]
            ),
          },
        };
      });
      toast(
        p.targetEntryId
          ? overlayStrings.overlayRestored
          : overlayStrings.overlayAdded(entry.name)
      );
    },
    [toast]
     
  );

  const startPlacement = useCallback(
    (
      file: File,
      image: { objectUrl: string; width: number; height: number },
      fileHash: string,
      targetEntryId: string | null
    ) => {
      const prev = placementRef.current;
      if (prev) revokeImageUrl(prev.imageUrl);
      setPlacementState(
        createPlacementState({
          imageUrl: image.objectUrl,
          imageWidth: image.width,
          imageHeight: image.height,
          fileHash,
          fileName: file.name,
          targetEntryId,
        })
      );
    },
    []
  );

  const importImage = useCallback(
    async (file: File) => {
      const registry = getRegistry();
      const problem = validateImageFile(file);
      if (problem === "too-big") {
        toast(overlayStrings.overlayTooBig);
        return;
      }
      if (problem === "bad-type") {
        toast(overlayStrings.overlayBadType);
        return;
      }
      if (registry.getEntries().length >= MAX_OVERLAYS) {
        toast(overlayStrings.overlayLimit(MAX_OVERLAYS));
        return;
      }
      let image;
      try {
        image = await loadAndDownscaleImage(file);
      } catch {
        toast(overlayStrings.overlayDecodeFailed);
        return;
      }
      let fileHash: string;
      try {
        fileHash = await sha256Hex(await file.arrayBuffer());
      } catch {
        revokeImageUrl(image.objectUrl);
        toast(overlayStrings.overlayDecodeFailed);
        return;
      }
      if (image.downscaled) toast(overlayStrings.overlayDownscaled);
      startPlacement(file, image, fileHash, null);
    },
    [startPlacement, toast]
  );

  const reselectFile = useCallback(
    async (entryId: string, file: File) => {
      const registry = getRegistry();
      const entry = registry.getEntry(entryId);
      if (!entry || entry.kind !== "user-import" || !isUserImportMeta(entry.meta)) {
        return;
      }
      const problem = validateImageFile(file);
      if (problem === "too-big") {
        toast(overlayStrings.overlayTooBig);
        return;
      }
      if (problem === "bad-type") {
        toast(overlayStrings.overlayBadType);
        return;
      }
      let image;
      try {
        image = await loadAndDownscaleImage(file);
      } catch {
        toast(overlayStrings.overlayDecodeFailed);
        return;
      }
      let fileHash: string;
      try {
        fileHash = await sha256Hex(await file.arrayBuffer());
      } catch {
        revokeImageUrl(image.objectUrl);
        toast(overlayStrings.overlayDecodeFailed);
        return;
      }
      const meta = entry.meta;
      if (fileHash === meta.fileHash) {
        // Same file → instant re-georeference with the saved control points.
        let coords: [Vec2, Vec2, Vec2, Vec2];
        try {
          coords = imageCornersToLngLat(
            meta.controlPoints,
            image.width,
            image.height
          );
        } catch {
          revokeImageUrl(image.objectUrl);
          toast(overlayStrings.overlayDegenerate);
          return;
        }
        setAttachments((prev) => {
          const old = prev[entryId];
          if (old?.imageUrl) revokeImageUrl(old.imageUrl);
          return {
            ...prev,
            [entryId]: {
              imageUrl: image.objectUrl,
              imageCoordinates: coords.map(
                (c) => [c[0], c[1]] as [number, number]
              ),
            },
          };
        });
        if (image.downscaled) toast(overlayStrings.overlayDownscaled);
        toast(overlayStrings.overlayRestored);
      } else {
        // Different file → re-place the 3 points (spec §4.2c).
        toast(overlayStrings.overlayHashMismatch);
        startPlacement(file, image, fileHash, entryId);
      }
    },
    [startPlacement, toast]
  );

  const setVisible = useCallback((id: string, visible: boolean) => {
    getRegistry().setVisible(id, visible);
     
  }, []);

  const setOpacity = useCallback((id: string, opacity: number) => {
    getRegistry().setOpacity(id, opacity);
     
  }, []);

  /**
   * Share-annotations restore. Tile-version entries only apply when the id
   * already exists locally (built-ins are identical on every client, so an
   * unknown id is never invented here). User imports register as
   * "needs file" entries — placement + file hash travel, the file itself
   * doesn't; re-selecting the same file restores instantly via hash match.
   */
  const applySharedOverlays = useCallback(
    (items: SharedOverlayItem[]): { added: number; updated: number } => {
      const registry = getRegistry();
      let added = 0;
      let updated = 0;
      for (const it of items.slice(0, MAX_OVERLAYS)) {
        if (it.k === "tile-version") {
          if (registry.getEntry(it.id)) {
            registry.setVisible(it.id, it.vis);
            registry.setOpacity(it.id, it.op);
            updated += 1;
          }
          continue;
        }
        const id = `shared-import-${(it.fh || it.fn || "x").slice(0, 8)}`;
        const existed = registry.getEntry(id) !== undefined;
        registry.register({
          id,
          name: it.name || "Shared image overlay",
          kind: "user-import",
          meta: {
            controlPoints: it.cp,
            fileHash: it.fh,
            fileName: it.fn,
            width: it.w,
            height: it.h,
          },
          visible: it.vis,
          opacity: it.op,
        });
        if (existed) updated += 1;
        else added += 1;
      }
      return { added, updated };
    },
    []
  );

  const renameEntry = useCallback((id: string, name: string) => {
    getRegistry().rename(id, name);
     
  }, []);

  const removeEntry = useCallback(
    (id: string) => {
      const registry = getRegistry();
      const entry = registry.getEntry(id);
      if (registry.unregister(id)) {
        setAttachments((prev) => {
          const old = prev[id];
          if (old?.imageUrl) revokeImageUrl(old.imageUrl);
          const next = { ...prev };
          delete next[id];
          return next;
        });
        // A removed entry can't be the placement target — cancel instead of
        // orphaning the session.
        const prevPlacement = placementRef.current;
        if (prevPlacement?.targetEntryId === id) {
          revokeImageUrl(prevPlacement.imageUrl);
          setPlacementState(null);
        }
        if (entry) toast(overlayStrings.overlayRemoved(entry.name));
      }
    },
     
    [toast]
  );

  const moveEntry = useCallback((id: string, direction: -1 | 1) => {
    getRegistry().move(id, direction);
     
  }, []);

  const addMapPoint = useCallback((point: Vec2) => {
    const prev = placementRef.current;
    if (prev) setPlacementState(addPlacementMapPoint(prev, point));
     
  }, []);

  const addImagePoint = useCallback(
    (point: Vec2) => {
      const prev = placementRef.current;
      if (!prev) return;
      const next = addPlacementImagePoint(prev, point);
      if (!next) return;
      if (isPlacementComplete(next)) {
        // All 6 points collected — finalize here (event-handler context),
        // never inside an effect.
        finalizePlacement(next);
        setPlacementState(null);
      } else {
        setPlacementState(next);
      }
    },
     
    [finalizePlacement]
  );

  const cancelPlacement = useCallback(() => {
    const prev = placementRef.current;
    if (prev) {
      revokeImageUrl(prev.imageUrl);
      setPlacementState(null);
    }
    toast(overlayStrings.overlayPlacementCancelled);
  }, [toast]);

  const api = useMemo<OverlaysApi>(
    () => ({
      entries,
      attachments,
      placement,
      placementStep: placement ? placementStep(placement) : null,
      importImage,
      reselectFile,
      setVisible,
      setOpacity,
      renameEntry,
      removeEntry,
      moveEntry,
      addMapPoint,
      addImagePoint,
      cancelPlacement,
      applySharedOverlays,
    }),
    [
      entries,
      attachments,
      placement,
      importImage,
      reselectFile,
      setVisible,
      setOpacity,
      renameEntry,
      removeEntry,
      moveEntry,
      addMapPoint,
      addImagePoint,
      cancelPlacement,
      applySharedOverlays,
    ]
  );

  return api;
}
