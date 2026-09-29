import { NextRequest, NextResponse } from "next/server";
import { adminPasswordOk, fail, setSessionCookie } from "@/lib/auth";

/* Admin login from the hidden admin page: password only (ADMIN_PASSWORD). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!process.env.ADMIN_PASSWORD) return fail("ADMIN_PASSWORD is not set on the server.", 503);
  if (!adminPasswordOk(String(body.password ?? ""))) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return fail("Wrong password.", 401);
  }
  const res = NextResponse.json({ ok: true });
  await setSessionCookie(res, { username: "admin", name: process.env.ADMIN_NAME || "Admin", role: "admin" });
  return res;
}
