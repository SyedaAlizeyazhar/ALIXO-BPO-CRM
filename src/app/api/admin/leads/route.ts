import { NextRequest, NextResponse } from "next/server";
import { fail, guarded } from "@/lib/auth";
import { leadRow, mirrorToSheet, type MirrorLead } from "@/lib/sheet-mirror";
import { callStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/* Search leads by phone, customer, agent or campaign (empty = latest 50). */
export const GET = guarded(async (_s, req: NextRequest) => {
  return NextResponse.json(await callStore("searchLeads", { q: req.nextUrl.searchParams.get("q") ?? "" }));
}, { admin: true });

/* Deletes one lead; the sheet copy loses the same row. */
export const DELETE = guarded(async (_s, req: NextRequest) => {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return fail("Missing lead id");
  const { lead, promoted } = await callStore<{ lead: MirrorLead; promoted: MirrorLead | null }>("deleteLead", { id });
  mirrorToSheet({ action: "delete", tab: "Leads", key: "Lead ID", value: String(lead.id) });
  if (promoted) mirrorToSheet({ action: "upsert", tab: "Leads", key: "Lead ID", row: leadRow(promoted) });
  return NextResponse.json({ ok: true });
}, { admin: true });
