// ─── modules/community/identity.ts ─────────────────────────────────────────
// Identity contract (community-spec §1.1, §2.1): stable random device id +
// getIdentity(). Guest-local, zero network. After Supabase sign-in this same
// function is the hook point for the account identity.
//
// The device id is pure randomness (crypto.randomUUID, Math.random fallback) —
// never a fingerprint. It survives "reset all" (only the progress store is reset).

export interface Identity {
  mode: "device" | "account";
  deviceId: string;
  userId?: string;
}

const DEVICE_KEY = "gta6mapx_device_v1";
const DEVICE_PREFIX = "gta6mapx-dev-";

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — caller proceeds without persistence */
  }
}

function randomUuidHex(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through to Math.random fallback */
  }
  // Math.random fallback: uuidv4-format hex, generated in one call chain.
  const hex = (): string => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
  const a = hex();
  const b = hex();
  const c = hex();
  const d = hex();
  return (
    `${a.slice(0, 8)}-${b.slice(0, 4)}-4${b.slice(5, 8)}` +
    `-${((parseInt(c.slice(0, 2), 16) & 0x3f) | 0x80).toString(16)}${c.slice(2, 4)}-${c.slice(4, 8)}${d}`
  );
}

/** Generated once per browser profile, persisted in localStorage, random — not a fingerprint. */
export function getDeviceId(): string {
  const existing = storageGet(DEVICE_KEY);
  if (existing && existing.startsWith(DEVICE_PREFIX) && existing.length === DEVICE_PREFIX.length + 36) {
    return existing;
  }
  const id = `${DEVICE_PREFIX}${randomUuidHex()}`;
  storageSet(DEVICE_KEY, id);
  return id;
}

/**
 * Returns the current identity. Now: always device mode.
 *
 * SUPABASE: return the account identity after sign-in —
 *   { mode: "account", userId: <profiles.id>, deviceId: getDeviceId() }
 * while keeping deviceId for audit metadata and the guest→account merge.
 */
export function getIdentity(): Identity {
  return { mode: "device", deviceId: getDeviceId() };
}
