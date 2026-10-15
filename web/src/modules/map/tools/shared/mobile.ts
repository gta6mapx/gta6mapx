// ─── modules/map/tools/shared/mobile.ts ───────────────────────────────
// Mobile breakpoint helper matching Tailwind's md: (768px). Slices use this
// to render bottom-sheet variants of their panels.

"use client";

import { useEffect, useState } from "react";

const MD_QUERY = "(max-width: 767px)";

export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState<boolean>(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(MD_QUERY).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(MD_QUERY);
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return mobile;
}
