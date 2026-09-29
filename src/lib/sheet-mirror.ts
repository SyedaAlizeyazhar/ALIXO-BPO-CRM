import "server-only";

import { after } from "next/server";

/*
 * One-way copy of CRM data into a Google Sheet (apps-script/Code.gs), like the
 * Elijah site's webhook. The database stays the source of truth: the CRM never
 * reads the sheet, and a sheet outage never blocks a lead or a login.
 */

type Tab = "Leads" | "Agents";
type Payload =
  | { action: "append"; tab: Tab; row: Row }
  | { action: "upsert"; tab: Tab; key: string; row: Row }
  | { action: "replace"; tab: Tab; rows: Row[] };
type Row = Record<string, string | number>;

export type MirrorLead = {
  id: number; ts: number; agentName: string; agentUsername: string; firstName: string; lastName: string; dob: string;
  phone: string; showNumber: string; street: string; city: string; state: string; zipcode: string;
  transferBy: string; duration: string; campaign: string; duplicate: boolean;
};
export type MirrorAgent = { username: string; name: string; status: string; callbackUrl: string; createdAt: string; lastLogin: string };

const et = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleString("en-US", { timeZone: "America/New_York", ...opts });
const etStamp = (iso: string) => (iso ? et(new Date(iso), { dateStyle: "medium", timeStyle: "short" }) : "");

export const leadRow = (l: MirrorLead): Row => ({
  "Lead ID": l.id,
  "Date (ET)": et(new Date(l.ts), { year: "numeric", month: "2-digit", day: "2-digit" }),
  "Time (ET)": et(new Date(l.ts), { hour: "numeric", minute: "2-digit" }),
  Agent: l.agentName,
  "Agent Username": l.agentUsername,
  "First Name": l.firstName,
  "Last Name": l.lastName,
  DOB: l.dob,
  Phone: l.phone,
  "Show Number": l.showNumber,
  Street: l.street,
  City: l.city,
  State: l.state,
  Zipcode: l.zipcode,
  "Transfer By": l.transferBy,
  Duration: l.duration,
  Campaign: l.campaign,
  Duplicate: l.duplicate ? "Yes" : "No",
});

// Password hashes never leave the database.
export const agentRow = (a: MirrorAgent): Row => ({
  Username: a.username,
  Name: a.name,
  Status: a.status,
  "Callback Sheet": a.callbackUrl,
  "Signed Up (ET)": etStamp(a.createdAt),
  "Last Login (ET)": etStamp(a.lastLogin),
});

export const sheetMirrorConfigured = () => !!(process.env.SHEET_WEBHOOK_URL && process.env.SHEET_WEBHOOK_SECRET);

/* Sends now and reports errors — used by the admin "Sync sheet" button. */
export async function sendToSheet(payload: Payload) {
  const url = process.env.SHEET_WEBHOOK_URL;
  const secret = process.env.SHEET_WEBHOOK_SECRET;
  if (!url || !secret) throw new Error("Google Sheet is not connected (SHEET_WEBHOOK_URL / SHEET_WEBHOOK_SECRET).");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ secret, ...payload }),
    redirect: "follow",
    cache: "no-store",
  });
  const text = await res.text();
  let json: { ok?: boolean; error?: string } | null = null;
  try { json = JSON.parse(text); } catch {}
  if (!json) throw new Error(`Google Sheet webhook returned an unexpected response (HTTP ${res.status}). Check that the Apps Script is deployed as a Web app with access "Anyone".`);
  if (json.error || json.ok === false) throw new Error(`Google Sheet: ${json.error ?? "unknown error"}`);
}

/* Fire-and-forget copy after the response is sent; failures are logged, never shown to agents. */
export function mirrorToSheet(payload: Payload) {
  if (!sheetMirrorConfigured()) return;
  after(async () => {
    try {
      await sendToSheet(payload);
    } catch (e) {
      console.error("[sheet-mirror]", payload.action, payload.tab, (e as Error).message);
    }
  });
}
