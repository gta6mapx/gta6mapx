// ─── modules/community/communityClient.ts ────────────────────────────────────
// WORKER B — the single persistence seam for the community layer.
// UI code calls getRepositories() and never touches localStorage or Supabase
// directly. Today this returns the guest-local implementations.
//
// ★ SWAP POINT: when Supabase is connected, create `supabaseRepos.ts`
// implementing the SAME interfaces from `./repositories` and change the ONE
// line below `return getLocalRepositories();` to
// `return getSupabaseRepositories();`. UI files stay untouched.
// See SUPABASE.md for the exact checklist.

import type { Repositories } from "./repositories";
import { getLocalRepositories } from "./localRepos";

// Identity helpers have a single implementation in ./identity (§1.1 contract);
// re-exported here so communityClient remains the one import point for UI code.
export { getDeviceId, getIdentity } from "./identity";

export function getRepositories(): Repositories {
  // ── SWAP THIS ONE LINE for Supabase ──
  return getLocalRepositories();
}
