import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fail } from "@/lib/auth";
import { HttpError } from "@/lib/errors";
import { agentRow, mirrorToSheet, type MirrorAgent } from "@/lib/sheet-mirror";
import { callStore, StoreNotConfigured } from "@/lib/store";

const Signup = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(60),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,30}$/, "Username: 3–30 letters, numbers, dot, dash or underscore"),
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
});

export async function POST(req: NextRequest) {
  const parsed = Signup.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid details");
  const { name, username, password } = parsed.data;

  try {
    const { agent } = await callStore<{ agent: MirrorAgent }>("createAgent", { name, username, passwordHash: await bcrypt.hash(password, 10) });
    mirrorToSheet({ action: "upsert", tab: "Agents", key: "Username", row: agentRow(agent) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail((e as Error).message, e instanceof HttpError ? e.status : e instanceof StoreNotConfigured ? 503 : 502);
  }
}
