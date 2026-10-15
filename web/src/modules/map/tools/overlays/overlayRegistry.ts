// ─── modules/map/tools/overlays/overlayRegistry.ts ────────────────────
// Framework-agnostic overlay registry (spec §4.1): single source of truth
// for every overlay — state + UI both read from here. Re-registering an id
// UPDATES the existing entry (keeps its stack position), never duplicates.
// No React, no MapLibre: the renderer subscribes and reconciles.

import {
  clampOpacity,
  DEFAULT_OVERLAY_OPACITY,
  type OverlayEntry,
  type OverlayKind,
  type OverlayMeta,
} from "./overlayTypes";

export interface RegisterInput {
  id: string;
  name: string;
  kind: OverlayKind;
  meta: OverlayMeta;
  visible?: boolean;
  opacity?: number;
}

export type RegistryListener = () => void;

export class OverlayRegistry {
  private entries: OverlayEntry[] = [];
  private listeners = new Set<RegistryListener>();

  /** Snapshot in stack order (bottom → top). Entries are copies. */
  getEntries(): OverlayEntry[] {
    return this.entries.map((e) => ({ ...e }));
  }

  getEntry(id: string): OverlayEntry | undefined {
    const found = this.entries.find((e) => e.id === id);
    return found ? { ...found } : undefined;
  }

  /** Insert new, or update in place when the id already exists. */
  register(input: RegisterInput): OverlayEntry {
    const name = input.name.trim();
    const existing = this.entries.find((e) => e.id === input.id);
    if (existing) {
      existing.name = name.length > 0 ? name : existing.name;
      existing.kind = input.kind;
      existing.meta = input.meta;
      if (typeof input.visible === "boolean") existing.visible = input.visible;
      if (typeof input.opacity === "number")
        existing.opacity = clampOpacity(input.opacity);
      this.emit();
      return { ...existing };
    }
    const entry: OverlayEntry = {
      id: input.id,
      name: name.length > 0 ? name : input.id,
      kind: input.kind,
      visible: input.visible ?? true,
      opacity:
        typeof input.opacity === "number"
          ? clampOpacity(input.opacity)
          : DEFAULT_OVERLAY_OPACITY,
      order: this.entries.length,
      meta: input.meta,
    };
    this.entries.push(entry);
    this.reindex();
    this.emit();
    return { ...entry };
  }

  unregister(id: string): boolean {
    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx === -1) return false;
    this.entries.splice(idx, 1);
    this.reindex();
    this.emit();
    return true;
  }

  setVisible(id: string, visible: boolean): boolean {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry) return false;
    entry.visible = visible;
    this.emit();
    return true;
  }

  setOpacity(id: string, opacity: number): boolean {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry) return false;
    entry.opacity = clampOpacity(opacity);
    this.emit();
    return true;
  }

  rename(id: string, name: string): boolean {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry) return false;
    const trimmed = name.trim();
    if (trimmed.length === 0) return false;
    entry.name = trimmed;
    this.emit();
    return true;
  }

  /** Move an entry one step up (+1) or down (-1) in the stack. */
  move(id: string, direction: -1 | 1): boolean {
    const idx = this.entries.findIndex((e) => e.id === id);
    const target = idx + direction;
    if (idx === -1 || target < 0 || target >= this.entries.length) return false;
    const [entry] = this.entries.splice(idx, 1);
    this.entries.splice(target, 0, entry);
    this.reindex();
    this.emit();
    return true;
  }

  subscribe(listener: RegistryListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private reindex(): void {
    this.entries.forEach((e, i) => {
      e.order = i;
    });
  }

  private emit(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        /* one bad listener must not break the registry */
      }
    }
  }
}
