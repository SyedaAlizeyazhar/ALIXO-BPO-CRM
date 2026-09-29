import { NextResponse } from "next/server";
import { clearSessionCookie, guarded } from "@/lib/auth";
import { callStore } from "@/lib/store";
import type { AgentRecord } from "@/lib/types";

/*
 * The logged-in user, with their live callback access read fresh from the database.
 * The app polls this every minute, so a disabled agent is signed out within a minute.
 */
export const GET = guarded(async (session) => {
  if (session.role === "admin") {
    const { settings } = await callStore<{ settings: Record<string, string> }>("getSettings").catch(() => ({ settings: {} as Record<string, string> }));
    return NextResponse.json({ ...session, callbackUrl: settings.defaultCallbackUrl ?? "" });
  }
  const { agent } = await callStore<{ agent: AgentRecord | null }>("getAgent", { username: session.username });
  if (!agent || agent.status !== "Approved") {
    const res = NextResponse.json({ error: "Your account is no longer active." }, { status: 401 });
    clearSessionCookie(res);
    return res;
  }
  return NextResponse.json({ ...session, name: agent.name, callbackUrl: agent.callbackUrl ?? "" });
});
