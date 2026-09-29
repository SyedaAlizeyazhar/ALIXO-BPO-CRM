import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fail, guarded } from "@/lib/auth";
import { agentRow, mirrorToSheet, type MirrorAgent } from "@/lib/sheet-mirror";
import { callStore } from "@/lib/store";

export const GET = guarded(async () => NextResponse.json(await callStore("listAgents")), { admin: true });

const Update = z.object({
  username: z.string().trim().toLowerCase().min(1),
  status: z.enum(["Pending", "Approved", "Rejected", "Disabled"]).optional(),
  callbackUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || v.startsWith("https://"), "Link must start with https://")
    .optional(),
  resetPassword: z.boolean().optional(),
});

const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const tempPassword = () => Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

export const PATCH = guarded(async (_s, req: NextRequest) => {
  const parsed = Update.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid update");
  const { username, status, callbackUrl, resetPassword } = parsed.data;

  const password = resetPassword ? tempPassword() : undefined;
  const { agent } = await callStore<{ agent: MirrorAgent }>("updateAgent", {
    username,
    status,
    callbackUrl,
    passwordHash: password ? await bcrypt.hash(password, 10) : undefined,
  });
  if (status !== undefined || callbackUrl !== undefined) {
    mirrorToSheet({ action: "upsert", tab: "Agents", key: "Username", row: agentRow(agent) });
  }
  // The temporary password is shown to the admin once and never stored in plain text.
  return NextResponse.json({ ok: true, tempPassword: password });
}, { admin: true });
