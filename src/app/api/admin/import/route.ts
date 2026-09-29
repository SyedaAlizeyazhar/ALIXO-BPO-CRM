import { NextRequest, NextResponse } from "next/server";
import { fail, guarded } from "@/lib/auth";
import { parseSheetTimestamp } from "@/lib/dates";
import type { ImportLead } from "@/lib/store-kv";
import { callStore } from "@/lib/store";
import type { Agent } from "@/lib/types";

export const maxDuration = 60;

/* Column names accepted from old sheets (compared lower-case, spaces collapsed). */
const COLUMNS: Record<keyof Omit<ImportLead, "ts" | "agentUsername"> | "timestamp", string[]> = {
  timestamp: ["timestamp", "date", "date/time", "submitted at"],
  agentName: ["agent name", "agent"],
  firstName: ["customer first name", "first name"],
  lastName: ["customer last name", "last name"],
  dob: ["date of birth", "dob"],
  phone: ["customer phone number", "phone number", "phone"],
  showNumber: ["show number"],
  street: ["street address", "street", "address"],
  city: ["city"],
  state: ["state"],
  zipcode: ["zipcode", "zip code", "zip"],
  transferBy: ["transfer by"],
  duration: ["duration"],
  campaign: ["campaign"],
};
const REQUIRED = ["timestamp", "agentName", "phone"] as const;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const digits = (s: string) => s.replace(/\D/g, "");

/* 3/5/1950 → 03/05/1950; anything else is kept exactly as written. */
function fixDob(v: string) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v.trim());
  return m ? `${m[1].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[3]}` : v.trim();
}

/* Accepts one batch of rows (objects keyed by the sheet's header names). */
export const POST = guarded(async (_s, req: NextRequest) => {
  const body = await req.json().catch(() => null);
  const rows = body?.rows as Record<string, string>[] | undefined;
  const firstRow = Number(body?.firstRow) || 2;
  if (!Array.isArray(rows) || !rows.length) return fail("No rows to import.");
  if (rows.length > 500) return fail("Send at most 500 rows per request.");

  // Map this file's headers onto our fields.
  const headers = Object.keys(rows[0]);
  const pick: Partial<Record<keyof typeof COLUMNS, string>> = {};
  for (const [field, names] of Object.entries(COLUMNS) as [keyof typeof COLUMNS, string[]][]) {
    const found = headers.find((h) => names.includes(norm(h)));
    if (found) pick[field] = found;
  }
  const missing = REQUIRED.filter((f) => !pick[f]);
  if (missing.length) return fail(`Missing column(s): ${missing.map((f) => COLUMNS[f][0]).join(", ")}`);

  // Link old leads to agents who have signed up with the same name.
  const { agents } = await callStore<{ agents: Agent[] }>("listAgents");
  const byName = new Map(agents.map((a) => [norm(a.name), a]));

  const leads: ImportLead[] = [];
  const errors: { row: number; message: string }[] = [];
  rows.forEach((raw, i) => {
    const get = (f: keyof typeof COLUMNS) => String((pick[f] && raw[pick[f]!]) ?? "").trim();
    const rowNo = firstRow + i;
    if (Object.values(raw).every((v) => !String(v ?? "").trim())) return; // blank line
    const ts = parseSheetTimestamp(get("timestamp"));
    const phone = digits(get("phone")).slice(-10);
    const agentName = get("agentName");
    if (ts === null) return errors.push({ row: rowNo, message: `Unreadable timestamp "${get("timestamp")}"` });
    if (phone.length !== 10) return errors.push({ row: rowNo, message: `Phone "${get("phone")}" is not 10 digits` });
    if (!agentName) return errors.push({ row: rowNo, message: "Agent name is empty" });
    // A signed-up agent's leads use their CRM name, so "OWAIS" in the sheet and "Owais" count as one.
    const agent = byName.get(norm(agentName));
    leads.push({
      ts, agentName: agent?.name ?? agentName, agentUsername: agent?.username ?? "",
      firstName: get("firstName"), lastName: get("lastName"), dob: fixDob(get("dob")), phone,
      showNumber: digits(get("showNumber")).slice(-10), street: get("street"), city: get("city"),
      state: get("state").toUpperCase(), zipcode: get("zipcode"), transferBy: get("transferBy"),
      duration: get("duration"), campaign: get("campaign"),
    });
  });

  const result = leads.length ? await callStore<{ imported: number; skipped: number }>("importLeads", { leads }) : { imported: 0, skipped: 0 };
  return NextResponse.json({ ...result, errors, columns: pick });
}, { admin: true });
