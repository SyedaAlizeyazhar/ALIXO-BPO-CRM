import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fail, guarded } from "@/lib/auth";
import { leadRow, mirrorToSheet, type MirrorLead } from "@/lib/sheet-mirror";
import { callStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const READ_ACTIONS = new Set(["getDashboardStats", "checkDuplicate", "getProgress", "getAgentLeads", "getTodayLeads", "getTopAgents"]);
const READ_PARAMS = ["phone", "range", "agent", "start", "end", "all"];

export const GET = guarded(async (session, req: NextRequest) => {
  const q = req.nextUrl.searchParams;
  const action = q.get("action") ?? "";
  if (!READ_ACTIONS.has(action)) return fail("Unknown action");
  const params: Record<string, string> = {};
  for (const k of READ_PARAMS) {
    const v = q.get(k);
    if (v) params[k] = v;
  }
  // "mine" stats on the dashboard always belong to the logged-in agent.
  if (action === "getDashboardStats") params.agent = session.role === "agent" ? session.username : "";
  return NextResponse.json(await callStore(action, params));
});

const digits = (s: string) => s.replace(/\D/g, "");

const Lead = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  dob: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, "Date of birth must be MM/DD/YYYY"),
  phone: z.string().transform(digits).pipe(z.string().length(10, "Phone number needs 10 digits")),
  showNumber: z.string().transform(digits).pipe(z.string().length(10, "Show number needs 10 digits")),
  street: z.string().trim().min(1, "Street is required"),
  city: z.string().trim().min(1, "City is required"),
  state: z.string().trim().toUpperCase().length(2, "State must be a 2-letter code"),
  zipcode: z.string().trim().regex(/^\d{5}$/, "Zipcode must be 5 digits"),
  transferBy: z.string().trim().min(1, "Transfer by is required"),
  duration: z.string().trim().min(1, "Duration is required"),
  campaign: z.string().trim().min(1, "Campaign is required"),
});

export const POST = guarded(async (session, req: NextRequest) => {
  const parsed = Lead.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid lead");
  // The agent is taken from the session, never from the form.
  const { lead, ...result } = await callStore<{ lead: MirrorLead; timestamp: string; duplicate: boolean }>("addLead", {
    ...parsed.data,
    agentName: session.name,
    agentUsername: session.username,
  });
  mirrorToSheet({ action: "append", tab: "Leads", row: leadRow(lead) });
  return NextResponse.json(result);
});
