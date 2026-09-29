import { NextResponse } from "next/server";
import { guarded } from "@/lib/auth";
import { agentRow, leadRow, sendToSheet, sheetMirrorConfigured, type MirrorAgent, type MirrorLead } from "@/lib/sheet-mirror";
import { callStore } from "@/lib/store";

export const maxDuration = 60;

/* Is the sheet copy set up? Shown in the admin portal. */
export const GET = guarded(async () => NextResponse.json({ configured: sheetMirrorConfigured() }), { admin: true });

/* Rewrites the Leads and Agents tabs from the database — the full, exact copy. */
export const POST = guarded(async () => {
  const { leads, agents } = await callStore<{ leads: MirrorLead[]; agents: MirrorAgent[] }>("exportAll");
  await sendToSheet({ action: "replace", tab: "Agents", rows: agents.map(agentRow) });
  await sendToSheet({ action: "replace", tab: "Leads", rows: [...leads].sort((a, b) => a.ts - b.ts).map(leadRow) });
  return NextResponse.json({ ok: true, leads: leads.length, agents: agents.length });
}, { admin: true });
