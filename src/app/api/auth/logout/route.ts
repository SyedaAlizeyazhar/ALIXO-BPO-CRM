import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

/* ?role=admin signs out the admin only; otherwise the agent only — the other session stays. */
export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res, req.nextUrl.searchParams.get("role") === "admin" ? "admin" : "agent");
  return res;
}
