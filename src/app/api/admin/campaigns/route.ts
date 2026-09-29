import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fail, guarded } from "@/lib/auth";
import { callStore } from "@/lib/store";

const text = (max: number) => z.string().trim().max(max);

const CampaignSchema = z.object({
  id: z.string().max(40).optional(),
  name: text(120).min(2, "Campaign name is required"),
  type: text(40).default("Static"),
  did: text(40).default(""),
  states: text(600).default(""),
  timing: text(80).default(""),
  breakTime: text(80).default(""),
  ageLimit: text(20).refine((v) => v === "" || /^\d{2}-\d{2,3}$/.test(v), "Age limit must look like 50-85").default(""),
  dqNotes: text(300).default(""),
  formLink: text(500).refine((v) => v === "" || /^https?:\/\//.test(v), "Form link must start with http:// or https://").default(""),
  target: z.coerce.number().int().min(0).max(10000).default(0),
  status: z.enum(["Active", "Paused"]).default("Active"),
});

/* Create (no id) or update (with id). */
export const POST = guarded(async (_s, req: NextRequest) => {
  const parsed = CampaignSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid campaign");
  return NextResponse.json(await callStore("saveCampaign", { campaign: parsed.data }));
}, { admin: true });

export const DELETE = guarded(async (_s, req: NextRequest) => {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return fail("Missing campaign id");
  return NextResponse.json(await callStore("deleteCampaign", { id }));
}, { admin: true });
