/**
 * deviceCaps.ts — device capability detection and the degradation ladder.
 *
 * Owns:
 *  - the WebGL probe (hard gate),
 *  - low-end heuristics (deviceMemory / hardwareConcurrency / iOS UA),
 *  - the capability tier: full | reduced | minimal | none,
 *  - per-tier pixel-ratio and pitch caps,
 *  - the rAF frame-drop monitor (one-way automatic step-down, 60 s cooldown),
 *  - the `?forcemap=none` QA override (stripped from share links by deepLink).
 *
 * The ladder is one-way down automatically, up manually (Retry 3D in the UI).
 * All code here is original.
 */

export type CapabilityTier = "full" | "reduced" | "minimal" | "none";

/**
 * QA hook: `?forcemap=none` forces tier "none" (WebGL-unavailable fallback).
 * Share links must never contain it — buildShareUrl never emits it.
 */
export function qaTierOverride(): CapabilityTier | null {
  if (typeof window === "undefined") return null;
  try {
    return new URLSearchParams(window.location.search).get("forcemap") === "none"
      ? "none"
      : null;
  } catch {
    return null;
  }
}

function probeWebGL(): { ok: boolean; webgl2: boolean } {
  try {
    if (typeof document === "undefined") return { ok: false, webgl2: false };
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 2;
    // Try webgl2 first so we know which context actually rendered.
    let gl: WebGLRenderingContext | null = null;
    let webgl2 = false;
    try {
      const g2 = canvas.getContext("webgl2") as WebGL2RenderingContext | null;
      if (g2) {
        gl = g2 as unknown as WebGLRenderingContext;
        webgl2 = true;
      }
    } catch {
      /* fall through to webgl1 */
    }
    if (!gl) {
      try {
        gl = canvas.getContext("webgl") as WebGLRenderingContext | null;
      } catch {
        gl = null;
      }
    }
    if (!gl) return { ok: false, webgl2: false };
    // Real render test, not just context creation: a dead/corrupt GPU
    // hands back a context whose readPixels comes back all zeros — the
    // "mysterious black map with no error UI". Clear red and verify.
    gl.clearColor(1, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const px = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    if (px[0] < 200) return { ok: false, webgl2: false };
    return { ok: true, webgl2 };
  } catch {
    return { ok: false, webgl2: false };
  }
}

function readDeviceMemoryGB(): number | null {
  try {
    const v = (navigator as Navigator & { deviceMemory?: unknown }).deviceMemory;
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

function readHardwareConcurrency(): number | null {
  try {
    const v = navigator.hardwareConcurrency;
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

function isIPhoneOrOldIPad(ua: string): boolean {
  if (/iPhone|iPod/i.test(ua)) return true;
  // iPadOS 13+ reports as Macintosh; older iPads still report iPad.
  // Absent deviceMemory/hardwareConcurrency on iOS → conservative tier.
  if (/iPad/i.test(ua)) {
    const m = ua.match(/OS (\d+)_/);
    const major = m ? parseInt(m[1], 10) : 0;
    return major > 0 && major < 16;
  }
  return false;
}

/**
 * Compute the capability tier once, before the MapLibre instance is built.
 *  - none:     WebGL unavailable → static fallback (§4.3).
 *  - minimal:  very old devices (deviceMemory ≤ 1 GB) → flat 2D, DPR 1.
 *  - reduced:  low-end phones / older iPads / WebGL1-only → pitch ≤ 30°, no
 *              extrusion, DPR ≤ 1.5.
 *  - full:     everything else → full 58° pitch, extrusion, DPR ≤ 2.
 */
export function detectTier(): CapabilityTier {
  const qa = qaTierOverride();
  if (qa) return qa;

  const { ok, webgl2 } = probeWebGL();
  if (!ok) return "none";

  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  const mem = readDeviceMemoryGB();
  const cores = readHardwareConcurrency();

  if (mem !== null && mem <= 1) return "minimal";
  if (mem !== null && mem <= 2) return "reduced";
  if (cores !== null && cores <= 4) return "reduced";
  if (isIPhoneOrOldIPad(ua)) return "reduced";
  if (!webgl2) return "reduced"; // WebGL1-only GPU → conservative

  return "full";
}

/** Pixel-ratio caps (hard): full 2, reduced 1.5, minimal 1, none 1. */
export function pixelRatioCap(tier: CapabilityTier): number {
  switch (tier) {
    case "full":
      return 2;
    case "reduced":
      return 1.5;
    case "minimal":
    case "none":
      return 1;
  }
}

/** Pitch caps per tier: full 58, reduced 30, minimal 0 (2D), none 0. */
export function tierPitchCap(tier: CapabilityTier): number {
  switch (tier) {
    case "full":
      return 58;
    case "reduced":
      return 30;
    case "minimal":
    case "none":
      return 0;
  }
}

/**
 * Frame-drop monitor: if the average frame time exceeds 50 ms over 120
 * frames, call onStepDown (the orchestrator steps one tier down and toasts
 * "Switched to lighter map mode… — tap to retry 3D"). 60 s cooldown between
 * automatic step-downs so the ladder never oscillates. Returns a stop fn.
 *
 * rAF only fires while the tab is visible — hidden tabs can't false-trigger.
 */
export function watchFrameDrops(onStepDown: () => void): () => void {
  const WINDOW = 120;
  const BUDGET_MS = 50;
  const COOLDOWN_MS = 60000;

  let frames = 0;
  let total = 0;
  let last = 0;
  let raf = 0;
  let lastStepDown = 0;
  let stopped = false;

  const tick = (t: number) => {
    if (stopped) return;
    if (last > 0) {
      total += t - last;
      frames += 1;
    }
    last = t;
    if (frames >= WINDOW) {
      const avg = total / frames;
      frames = 0;
      total = 0;
      const now = Date.now();
      if (avg > BUDGET_MS && now - lastStepDown > COOLDOWN_MS) {
        lastStepDown = now;
        try {
          onStepDown();
        } catch {
          /* monitor must never break the map */
        }
      }
    }
    raf = requestAnimationFrame(tick);
  };

  if (typeof requestAnimationFrame === "function") {
    raf = requestAnimationFrame(tick);
  }

  return () => {
    stopped = true;
    if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(raf);
  };
}
