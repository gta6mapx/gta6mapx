// ─── modules/map/tools/overlays/OverlaysPanel.tsx ─────────────────────
// The Overlays panel: entry rows (visibility, opacity 0–100, rename,
// remove with confirm, reorder), the "Import image overlay" button,
// per-row thumbnails, attribution text, the honest "image files aren't
// stored" note, and the empty state. Desktop rendering is wrapped in
// GlassPanel by OverlaysTools; mobile uses MobileSheet.

"use client";

import { useRef, useState } from "react";
import { isTileVersionMeta, type OverlayEntry } from "./overlayTypes";
import { overlayStrings as s } from "./sliceStrings";
import type { OverlaysApi } from "./useOverlays";

const KIND_LABELS: Record<OverlayEntry["kind"], string> = {
  "tile-version": "Tile version",
  "user-import": "Image import",
  reference: "Reference",
};

export default function OverlaysPanel({ api }: { api: OverlaysApi }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingReselectRef = useRef<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const pickFile = (reselectId: string | null) => {
    pendingReselectRef.current = reselectId;
    fileRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file twice
    if (!file) return;
    const reselectId = pendingReselectRef.current;
    pendingReselectRef.current = null;
    if (reselectId) void api.reselectFile(reselectId, file);
    else void api.importImage(file);
  };

  const startRename = (entry: OverlayEntry) => {
    setEditingId(entry.id);
    setDraftName(entry.name);
    setConfirmingId(null);
  };

  const saveRename = (id: string) => {
    api.renameEntry(id, draftName);
    setEditingId(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={onFileChange}
      />

      <p className="font-mono text-[11px] leading-relaxed text-[#8b94a3]">
        {s.panelHint}
      </p>

      <button
        type="button"
        onClick={() => pickFile(null)}
        className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[#ff50c5]/50 bg-[#ff50c5]/10 px-3 text-sm font-semibold text-white transition-colors hover:bg-[#ff50c5]/20"
      >
        <span aria-hidden="true">＋</span> {s.importImage}
      </button>

      {api.entries.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-black/30 p-4 text-center">
          <p className="text-sm text-white">{s.empty}</p>
          <p className="mt-1 font-mono text-[11px] text-[#8b94a3]">
            {s.emptyBuiltInNote}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {api.entries.map((entry) => {
            const attachment = api.attachments[entry.id];
            const needsFile =
              entry.kind === "user-import" && !attachment?.imageUrl;
            return (
              <li
                key={entry.id}
                className={`rounded-lg border bg-black/30 p-2.5 ${
                  needsFile
                    ? "border-amber-400/30 opacity-80"
                    : "border-white/10"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {attachment?.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={attachment.imageUrl}
                      alt=""
                      aria-hidden="true"
                      className="h-11 w-11 shrink-0 rounded-md border border-white/15 object-cover"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-dashed border-amber-400/40 text-lg text-amber-300/70"
                    >
                      ?
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    {editingId === entry.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveRename(entry.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          aria-label={s.overlayRenameLabel(entry.name)}
                          autoFocus
                          maxLength={60}
                          className="min-h-[44px] w-full min-w-0 rounded-md border border-[#8b5cf6]/50 bg-black/60 px-2 text-sm text-white outline-none"
                        />
                      </div>
                    ) : (
                      <p className="truncate text-sm font-semibold text-white">
                        {entry.name}
                      </p>
                    )}
                    <p className="font-mono text-[10px] uppercase tracking-wider text-[#8b94a3]">
                      {KIND_LABELS[entry.kind]}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-pressed={entry.visible}
                    aria-label={entry.visible ? s.overlayHidden : s.overlayVisible}
                    title={entry.visible ? s.overlayHidden : s.overlayVisible}
                    onClick={() => api.setVisible(entry.id, !entry.visible)}
                    className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border px-2 text-lg transition-colors ${
                      entry.visible
                        ? "border-[#8b5cf6]/50 bg-[#8b5cf6]/10 text-[#8b5cf6]"
                        : "border-white/15 text-[#8b94a3] hover:text-white"
                    }`}
                  >
                    <span aria-hidden="true">{entry.visible ? "◉" : "○"}</span>
                  </button>
                </div>

                {editingId === entry.id ? (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => saveRename(entry.id)}
                      className="flex min-h-[44px] flex-1 items-center justify-center rounded-md border border-[#8b5cf6]/50 bg-[#8b5cf6]/10 px-2 text-sm font-semibold text-white"
                    >
                      {s.overlayRenameSave}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="flex min-h-[44px] flex-1 items-center justify-center rounded-md border border-white/15 px-2 text-sm text-white"
                    >
                      {s.overlayRenameCancel}
                    </button>
                  </div>
                ) : (
                  <div className="mt-1.5 flex min-h-[44px] items-center gap-2">
                    <label
                      htmlFor={`ovl-opacity-${entry.id}`}
                      className="shrink-0 font-mono text-[11px] text-[#8b94a3]"
                    >
                      {s.overlayOpacity}
                    </label>
                    <input
                      id={`ovl-opacity-${entry.id}`}
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={entry.opacity}
                      onChange={(e) =>
                        api.setOpacity(entry.id, Number(e.target.value))
                      }
                      aria-label={`${s.overlayOpacity} — ${entry.name}`}
                      className="h-11 min-w-0 flex-1 accent-[#ff50c5]"
                    />
                    <span className="w-10 shrink-0 text-right font-mono text-[11px] tabular-nums text-white">
                      {entry.opacity}%
                    </span>
                  </div>
                )}

                {needsFile && (
                  <button
                    type="button"
                    onClick={() => pickFile(entry.id)}
                    className="mt-1.5 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md border border-amber-400/50 bg-amber-400/10 px-3 text-sm font-semibold text-amber-200 transition-colors hover:bg-amber-400/20"
                  >
                    {s.overlayReselect}
                  </button>
                )}
                {needsFile && (
                  <p className="mt-1 font-mono text-[11px] leading-relaxed text-amber-200/80">
                    {s.overlayNeedsFile}
                  </p>
                )}

                {isTileVersionMeta(entry.meta) && (
                  <p className="mt-1 font-mono text-[11px] text-[#8b94a3]">
                    {entry.meta.attribution}
                  </p>
                )}
                {entry.kind === "user-import" && !needsFile && (
                  <p className="mt-1 font-mono text-[11px] text-[#8b94a3]">
                    {s.overlayYourImage}
                  </p>
                )}

                {confirmingId === entry.id ? (
                  <div className="mt-2 rounded-md border border-red-400/40 bg-red-500/10 p-2">
                    <p className="text-sm text-white">
                      {s.overlayRemoveConfirm(entry.name)}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        className="flex min-h-[44px] flex-1 items-center justify-center rounded-md border border-white/15 px-2 text-sm text-white"
                      >
                        {s.overlayRenameCancel}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmingId(null);
                          api.removeEntry(entry.id);
                        }}
                        className="flex min-h-[44px] flex-1 items-center justify-center rounded-md border border-red-400/60 bg-red-500/20 px-2 text-sm font-semibold text-white"
                      >
                        {s.overlayRemoveYes}
                      </button>
                    </div>
                  </div>
                ) : (
                  editingId !== entry.id && (
                    <div className="mt-1.5 flex gap-1">
                      <button
                        type="button"
                        onClick={() => startRename(entry)}
                        aria-label={`${s.overlayRename} — ${entry.name}`}
                        title={s.overlayRename}
                        className="flex min-h-[44px] min-w-[44px] flex-1 items-center justify-center rounded-md border border-white/15 px-2 text-xs text-white transition-colors hover:border-[#8b5cf6]/50"
                      >
                        {s.overlayRename}
                      </button>
                      <button
                        type="button"
                        onClick={() => api.moveEntry(entry.id, 1)}
                        disabled={entry.order === api.entries.length - 1}
                        aria-label={`${s.overlayMoveUp} — ${entry.name}`}
                        title={s.overlayMoveUp}
                        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-white/15 px-2 text-white transition-colors hover:border-[#8b5cf6]/50 disabled:opacity-30"
                      >
                        <span aria-hidden="true">▲</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => api.moveEntry(entry.id, -1)}
                        disabled={entry.order === 0}
                        aria-label={`${s.overlayMoveDown} — ${entry.name}`}
                        title={s.overlayMoveDown}
                        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-white/15 px-2 text-white transition-colors hover:border-[#8b5cf6]/50 disabled:opacity-30"
                      >
                        <span aria-hidden="true">▼</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(entry.id)}
                        aria-label={`${s.overlayRemove} — ${entry.name}`}
                        title={s.overlayRemove}
                        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-white/15 px-2 text-white transition-colors hover:border-red-400/60 hover:text-red-300"
                      >
                        <span aria-hidden="true">🗑</span>
                      </button>
                    </div>
                  )
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="rounded-lg border border-white/10 bg-black/30 p-2.5 font-mono text-[11px] leading-relaxed text-[#8b94a3]">
        {s.overlayLocalOnly}
      </p>
      <p className="font-mono text-[11px] leading-relaxed text-[#8b94a3]">
        {s.overlayCompareNote}
      </p>
    </div>
  );
}
