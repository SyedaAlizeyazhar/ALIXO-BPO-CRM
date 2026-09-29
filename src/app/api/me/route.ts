import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, fail, getSession } from "@/lib/auth";
import { callStore } from "@/lib/store";
import type { AgentRecord } from "@/lib/types";

/*
 * The signed-in user for the current area: ?scope=admin → the admin (admin pages), otherwise the
 * agent signed in on this browser (or the admin if no agent is). Callback access is read fresh, and
 * the app polls this every minute, so a disabled agent is signed out within a minute.
 */
export async function GET(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get("scope") === "admin" ? "admin" : "any";
  const session = await getSession(scope);
  if (!session) return fail(scope === "admin" ? "Admins only." : "Please log in again.", 401);
  try {
    if (session.role === "admin") {
      const { settings } = await callStore<{ settings: Record<string, string> }>("getSettings").catch(() => ({ settings: {} as Record<string, string> }));
      return NextResponse.json({ ...session, callbackUrl: settings.defaultCallbackUrl ?? "" });
    }
    const { agent } = await callStore<{ agent: AgentRecord | null }>("getAgent", { username: session.username });
    if (!agent || agent.status !== "Approved") {
      const res = NextResponse.json({ error: "Your account is no longer active." }, { status: 401 });
      clearSessionCookie(res, "agent");
      return res;
    }
    return NextResponse.json({ ...session, name: agent.name, callbackUrl: agent.callbackUrl ?? "" });
  } catch (e) {
    return fail((e as Error).message, 502);
  }
}
