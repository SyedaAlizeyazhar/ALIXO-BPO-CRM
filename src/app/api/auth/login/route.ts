import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { fail, setSessionCookie } from "@/lib/auth";
import { callStore, StoreNotConfigured } from "@/lib/store";
import type { AgentRecord } from "@/lib/types";

const STATUS_MSG: Record<string, string> = {
  Pending: "Your account is waiting for admin approval.",
  Rejected: "Your sign-up request was not approved. Contact your admin.",
  Disabled: "Your account has been disabled. Contact your admin.",
};

/* Agent login. The admin signs in on the hidden admin page instead. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const username = String(body.username ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!username || !password) return fail("Enter your username and password.");

  try {
    const { agent } = await callStore<{ agent: AgentRecord | null }>("getAgent", { username });
    if (!agent || !(await bcrypt.compare(password, agent.passwordHash))) return fail("Wrong username or password.", 401);
    if (agent.status !== "Approved") return fail(STATUS_MSG[agent.status] ?? "Your account is not active.", 403);

    await callStore("updateAgent", { username, touchLogin: true }).catch(() => {});
    const res = NextResponse.json({ ok: true, role: "agent" });
    await setSessionCookie(res, { username, name: agent.name, role: "agent" });
    return res;
  } catch (e) {
    return fail((e as Error).message, e instanceof StoreNotConfigured ? 503 : 502);
  }
}
