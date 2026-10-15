// ─── /admin/community — LOCAL ADMIN ONLY ────────────────────────────────
// Guest-local moderation queue preview for community submissions.
// Not linked from public nav. robots=noindex. DEV-ONLY: visible only when
// localStorage gta6mapx_admin_v1 === "1"; production queue ships behind
// auth + reviewer roles with Supabase.

import type { Metadata } from "next";
import ModerationQueue from "@/modules/community/ModerationQueue";

export const metadata: Metadata = {
  title: "Admin — Community moderation queue",
  robots: { index: false, follow: false },
};

export default function AdminCommunityPage() {
  return (
    <main className="min-h-screen bg-[#0a0e14] text-[#e8ecf1]">
      <ModerationQueue />
    </main>
  );
}
