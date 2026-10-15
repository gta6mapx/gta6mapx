// Blocks the admin surface in production — the review queue is local-only.
// (Site is not publicly deployed; this is a hard guard for later.)

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  if (
    req.nextUrl.pathname.startsWith("/admin") &&
    process.env.NODE_ENV === "production"
  ) {
    return new NextResponse("Not found", { status: 404 });
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*"] };
