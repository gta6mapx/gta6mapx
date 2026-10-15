"use client";

import { useRef, useState } from "react";
import { exportData, importData, loadStore, resetAll } from "./guestStore";

/**
 * GuestDataControls — portability + safety panel for guest-local data.
 * Export (JSON download) · Import (≤2 MB, schema-validated, reject-with-reason)
 * · Reset (typed "RESET", export-first nudge). Every button works now; quota
 * refusals surface as a visible banner — never silent data loss.
 */
export default function GuestDataControls() {
  const [banner, setBanner] = useState<string | null>(null);
  const [bannerTone, setBannerTone] = useState<"error" | "ok">("error");
  const [importError, setImportError] = useState<string | null>(null);
  const [resetText, setResetText] = useState("");
  const [resetArmed, setResetArmed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const recordCount = (() => {
    try {
      const s = loadStore();
      return Object.keys(s.found).length + Object.keys(s.favorites).length;
    } catch {
      return 0;
    }
  })();

  function showBanner(message: string, tone: "error" | "ok") {
    setBanner(message);
    setBannerTone(tone);
  }

  function handleExport() {
    try {
      const payload = exportData();
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gta6mapx-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showBanner("Your data was exported.", "ok");
    } catch {
      showBanner("Export failed: storage unavailable.", "error");
    }
  }

  function handleImportFile(file: File | undefined) {
    setImportError(null);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const result = importData(text);
      if (result.ok) {
        showBanner(`Imported ${result.imported} record${result.imported === 1 ? "" : "s"}.`, "ok");
      } else {
        const reasons: Record<string, string> = {
          "empty-file": "The file is empty.",
          "file-too-large": "File too large — imports are limited to 2 MB.",
          "invalid-json": "Not valid JSON.",
          "invalid-schema": "Not a GTA6mapx data file (schema check failed). Nothing was changed.",
          "too-many-records": "Too many records — imports are limited to 20,000 records.",
          quota: "Storage is full — import refused. Nothing was changed. Try exporting, then Reset.",
        };
        setImportError(reasons[result.reason] ?? `Import failed: ${result.reason}. Nothing was changed.`);
      }
    };
    reader.onerror = () => setImportError("Could not read that file. Nothing was changed.");
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleReset() {
    setImportError(null);
    if (!resetArmed) {
      setResetArmed(true);
      return;
    }
    const result = resetAll(resetText);
    if (!result.ok) {
      showBanner(
        result.reason === "confirmation-phrase-required"
          ? 'Type RESET (all caps) to confirm.'
          : `Reset failed: ${result.reason}.`,
        "error",
      );
      return;
    }
    // Export-first nudge: the user already has the payload — download it now.
    const blob = new Blob([result.exportPayload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gta6mapx-data-before-reset-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setResetArmed(false);
    setResetText("");
    showBanner("All progress and favorites were reset. A backup was downloaded first.", "ok");
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
      <h2 className="text-sm font-semibold tracking-wide text-white">Your data</h2>
      <p className="mt-1 text-xs leading-relaxed text-white/60">
        Everything is stored only in this browser — nothing is uploaded. {recordCount}{" "}
        record{recordCount === 1 ? "" : "s"} saved locally.
      </p>

      {banner && (
        <div
          role={bannerTone === "error" ? "alert" : "status"}
          className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
            bannerTone === "error"
              ? "border-red-400/40 bg-red-500/10 text-red-200"
              : "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          {banner}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleExport}
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-white/10"
        >
          Export JSON
        </button>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-white/10"
        >
          Import JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Import JSON file"
          onChange={(e) => handleImportFile(e.target.files?.[0])}
        />

        {!resetArmed ? (
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200 transition-colors hover:bg-red-500/20"
          >
            Reset all data…
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={resetText}
              onChange={(e) => setResetText(e.target.value)}
              placeholder='Type RESET to confirm'
              aria-label="Type RESET to confirm reset"
              className="w-44 rounded-lg border border-red-400/40 bg-black/60 px-3 py-2 text-xs text-white placeholder:text-white/40 focus:border-red-300/60 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-red-400/60 bg-red-600/30 px-3 py-2 text-xs font-semibold text-red-100 transition-colors hover:bg-red-600/50"
            >
              Confirm reset
            </button>
            <button
              type="button"
              onClick={() => {
                setResetArmed(false);
                setResetText("");
              }}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/70 transition-colors hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {importError && (
        <p role="alert" className="mt-2 text-xs text-red-300">
          {importError}
        </p>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-white/45">
        Import limits: 2 MB file, 20,000 records — invalid files are rejected and
        nothing is changed. Reset always downloads a backup first, so you can undo
        it by importing the backup.
      </p>
    </div>
  );
}
