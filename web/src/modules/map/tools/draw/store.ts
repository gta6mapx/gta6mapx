// ─── modules/map/tools/draw/store.ts ────────────────────────────────────
// Framework-agnostic drawings store: committed features, selection,
// undo/redo snapshot stacks (depth 50, structuredClone — spec §2.5), and
// debounced localStorage persistence (spec §2.7). No React here — the thin
// `useDrawStore` binding at the bottom is the only React surface.

import { useEffect, useReducer } from "react";
import type {
  DrawFeature,
  DrawStyle,
  DrawingsDoc,
  HistoryEntry,
} from "./types";
import { isValidDrawFeature } from "./geometry";
import { DEFAULT_DRAW_STYLE } from "./palette";

export const DRAWINGS_KEY = "gta6mapx.drawings.v1";
export const MAX_DRAWINGS = 200;
const UNDO_DEPTH = 50;
const SAVE_DEBOUNCE_MS = 500;

export interface DrawStoreSnapshot {
  features: DrawFeature[];
  selectedId: string | null;
  defaultStyle: DrawStyle;
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  atCap: boolean;
}

export interface DrawStore {
  getState(): DrawStoreSnapshot;
  subscribe(fn: () => void): () => void;
  /** Restore persisted drawings (call once on mount). */
  load(hooks: { onCorrupt: () => void; onQuota: () => void }): void;
  /**
   * Committed mutation: pushes an undo snapshot (structuredClone) + label,
   * clears redo, schedules a debounced save. Returns false when the
   * mutation would exceed the 200-drawing cap.
   */
  commit(
    label: string,
    mutate: (features: DrawFeature[]) => DrawFeature[]
  ): boolean;
  undo(): string | null;
  redo(): string | null;
  setSelected(id: string | null): void;
  setDefaultStyle(style: DrawStyle): void;
  /** Apply a partial style edit to the current selection (undoable). */
  restyleSelection(patch: Partial<DrawStyle>): boolean;
  clearAll(): void;
  /** Flush any pending debounced save immediately. */
  flush(): void;
}

function clone(features: DrawFeature[]): DrawFeature[] {
  return structuredClone(features);
}

function isQuotaError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { name?: string }).name === "QuotaExceededError"
  );
}

export function createDrawStore(): DrawStore {
  let features: DrawFeature[] = [];
  let selectedId: string | null = null;
  let defaultStyle: DrawStyle = { ...DEFAULT_DRAW_STYLE };
  let undoStack: HistoryEntry[] = [];
  let redoStack: HistoryEntry[] = [];
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let quotaWarned = false;
  const listeners = new Set<() => void>();
  // Hooks provided per load() call; stashed for the store lifetime.
  let corruptHook: (() => void) | null = null;
  let quotaHook: (() => void) | null = null;

  const emit = () => {
    for (const fn of listeners) fn();
  };

  const snapshot = (): DrawStoreSnapshot => ({
    features,
    selectedId,
    defaultStyle,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undoLabel: undoStack.length > 0 ? undoStack[undoStack.length - 1].label : null,
    redoLabel: redoStack.length > 0 ? redoStack[redoStack.length - 1].label : null,
    atCap: features.length >= MAX_DRAWINGS,
  });

  const persist = () => {
    const doc: DrawingsDoc = {
      version: 1,
      savedAt: new Date().toISOString(),
      features,
    };
    try {
      localStorage.setItem(DRAWINGS_KEY, JSON.stringify(doc));
    } catch (e) {
      if (isQuotaError(e)) {
        if (!quotaWarned) {
          quotaWarned = true;
          quotaHook?.();
        }
        // Keep in-memory state; the flag above enforces the
        // once-per-session warning rule.
      }
      // Other errors (privacy mode etc.): in-memory only, silent.
    }
  };

  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      persist();
    }, SAVE_DEBOUNCE_MS);
  };

  const store: DrawStore = {
    getState: snapshot,

    subscribe(fn: () => void): () => void {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },

    load(hooks: { onCorrupt: () => void; onQuota: () => void }): void {
      corruptHook = hooks.onCorrupt;
      quotaHook = hooks.onQuota;
      let raw: string | null = null;
      try {
        raw = localStorage.getItem(DRAWINGS_KEY);
      } catch {
        raw = null;
      }
      if (!raw) {
        emit();
        return;
      }
      try {
        const doc = JSON.parse(raw) as DrawingsDoc;
        if (
          typeof doc !== "object" ||
          doc === null ||
          doc.version !== 1 ||
          !Array.isArray(doc.features) ||
          !doc.features.every(isValidDrawFeature)
        ) {
          throw new Error("schema mismatch");
        }
        features = clone(doc.features);
      } catch {
        // Quarantine — never silently delete user data (spec §1.3).
        try {
          localStorage.setItem(
            `${DRAWINGS_KEY}.corrupt.${Date.now()}`,
            raw ?? ""
          );
          localStorage.removeItem(DRAWINGS_KEY);
        } catch {
          /* best effort */
        }
        features = [];
        corruptHook?.();
      }
      emit();
    },

    commit(
      label: string,
      mutate: (features: DrawFeature[]) => DrawFeature[]
    ): boolean {
      const next = mutate(clone(features));
      if (!Array.isArray(next)) return false;
      const added = next.length - features.length;
      if (added > 0 && features.length >= MAX_DRAWINGS) return false;
      undoStack.push({
        features: clone(features),
        label,
        at: new Date().toISOString(),
      });
      if (undoStack.length > UNDO_DEPTH) {
        undoStack = undoStack.slice(undoStack.length - UNDO_DEPTH);
      }
      redoStack = [];
      features = next;
      if (selectedId && !features.some((f) => f.id === selectedId)) {
        selectedId = null;
      }
      scheduleSave();
      emit();
      return true;
    },

    undo(): string | null {
      const entry = undoStack.pop();
      if (!entry) return null;
      redoStack.push({
        features: clone(features),
        label: entry.label,
        at: new Date().toISOString(),
      });
      features = clone(entry.features);
      if (selectedId && !features.some((f) => f.id === selectedId)) {
        selectedId = null;
      }
      scheduleSave();
      emit();
      return entry.label;
    },

    redo(): string | null {
      const entry = redoStack.pop();
      if (!entry) return null;
      undoStack.push({
        features: clone(features),
        label: entry.label,
        at: new Date().toISOString(),
      });
      features = clone(entry.features);
      scheduleSave();
      emit();
      return entry.label;
    },

    setSelected(id: string | null): void {
      if (selectedId === id) return;
      selectedId = id;
      emit();
    },

    setDefaultStyle(style: DrawStyle): void {
      defaultStyle = { ...style };
      emit();
    },

    restyleSelection(patch: Partial<DrawStyle>): boolean {
      if (!selectedId) return false;
      return store.commit("restyle drawing", (list) =>
        list.map((f) =>
          f.id === selectedId
            ? {
                ...f,
                style: { ...f.style, ...patch },
                updatedAt: new Date().toISOString(),
              }
            : f
        )
      );
    },

    clearAll(): void {
      store.commit("clear all", () => []);
    },

    flush(): void {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
        persist();
      }
    },
  };

  return store;
}

// ─── Thin React binding ──────────────────────────────────────────────────

export function useDrawStore(store: DrawStore): DrawStoreSnapshot {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => store.subscribe(force), [store]);
  return store.getState();
}
