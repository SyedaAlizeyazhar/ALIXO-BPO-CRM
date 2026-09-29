import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fail, guarded } from "@/lib/auth";
import { PALETTES } from "@/lib/config";
import { callStore } from "@/lib/store";

const httpsOrEmpty = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || v.startsWith("https://"), "Link must start with https://");

const Settings = z.object({
  defaultCallbackUrl: httpsOrEmpty.optional(),
  defaultPalette: z.enum(PALETTES.map((p) => p.id) as [string, ...string[]]).optional(),
  defaultMode: z.enum(["light", "dark"]).optional(),
});

export const GET = guarded(async () => NextResponse.json(await callStore("getSettings")), { admin: true });

export const PUT = guarded(async (_s, req: NextRequest) => {
  const parsed = Settings.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid settings");
  return NextResponse.json(await callStore("setSettings", { values: parsed.data }));
}, { admin: true });
