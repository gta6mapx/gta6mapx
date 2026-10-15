// ─── modules/progress/useFound.ts ─────────────────────────────────────────
// Free "mark as found" tracking. localStorage-first (no account needed);
// guest data lives in the consolidated v2 store (modules/community/guestStore).
// Phase 2 syncs to Supabase when the user signs in (guest→account merge via
// modules/community/merge.ts).
//
// Exported API is unchanged: { found, toggleFound, isFound, count }.

import { useCallback, useEffect, useState } from "react";
import {
  addFound,
  getFoundIds,
  migrateV1toV2,
  onStoreChange,
  removeFound,
} from "@/modules/community/guestStore";

function loadIds(): Set<string> {
  try {
    return getFoundIds();
  } catch {
    return new Set();
  }
}

export function useFound() {
  // ─── One-time v1→v2 migration (idempotent; honest migration-time
  // timestamps), plus multi-tab updates from other tabs of this site. The
  // migration runs inside the state initializer so it completes before the
  // first render; the effect only subscribes to external changes.
  const [found, setFound] = useState<Set<string>>(() => {
    try {
      migrateV1toV2();
    } catch {
      /* migration failure never blocks the map */
    }
    return loadIds();
  });
  useEffect(() => onStoreChange(() => setFound(loadIds())), [setFound]);

  const toggleFound = useCallback((id: string) => {
    setFound((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Store refuses are silent here by design: a quota failure keeps the
        // optimistic state and the GuestDataControls banner explains it.
        removeFound(id);
      } else {
        next.add(id);
        addFound(id);
      }
      return next;
    });
  }, [setFound]);

  const isFound = useCallback((id: string) => found.has(id), [found]);

  return { found, toggleFound, isFound, count: found.size };
}
