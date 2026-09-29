import "server-only";

import { HttpError } from "./errors";
import { addDays, dayKey, dayKeys as keys, rangeBounds } from "./dates";
import { importKey, mergeCounts, nameKey, type ImportLead } from "./store-kv";

/*
 * In-memory stand-in for store-kv.ts, used in local dev when Upstash Redis is not configured.
 * Data lives only in this server process and is lost on restart — never used in production.
 */

type Row = Record<string, string>;
type LeadRow = {
  ts: number; agentName: string; agentUsername: string; firstName: string; lastName: string; phone: string;
  showNumber: string; dob: string; street: string; city: string; zipcode: string; state: string; campaign: string; transferBy: string; duration: string; duplicate: string;
};
type Store = { leads: LeadRow[]; agents: Row[]; settings: Record<string, string>; imported?: string[] };

const g = globalThis as unknown as { __alixoDemo?: Store };
const store: Store = (g.__alixoDemo ??= { leads: [], agents: [], settings: {} });

const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");

const leads = () => store.leads.map((r) => ({ ...r, day: dayKey(new Date(r.ts)) }));
type L = ReturnType<typeof leads>[number];

function inRange(list: L[], p: Row) {
  const [from, to] = rangeBounds(p);
  return list.filter((r) => r.day >= from && r.day <= to);
}
const countIn = (list: L[], from: string, to: string) => list.filter((r) => r.day >= from && r.day <= to).length;
const pub = (r: L) => ({
  timestamp: new Date(r.ts).toISOString(), agentName: r.agentName, firstName: r.firstName, lastName: r.lastName,
  phone: r.phone, campaign: r.campaign, state: r.state, transferBy: r.transferBy, duration: r.duration, duplicate: r.duplicate === "Yes",
});
const newest = (list: L[]) => [...list].sort((a, b) => b.ts - a.ts).map(pub);
function byAgent(list: L[]) {
  const m: Record<string, number> = {};
  list.forEach((r) => (m[r.agentName] = (m[r.agentName] ?? 0) + 1));
  return mergeCounts(Object.entries(m));
}
const publicAgent = (a: Row) => ({ username: a.username, name: a.name, status: a.status, callbackUrl: a.callbackUrl, createdAt: a.createdAt, lastLogin: a.lastLogin });
/* Same lead shape store-kv.ts hands to the sheet mirror. */
const fullLead = (r: LeadRow, id: number) => ({ ...r, id, duplicate: r.duplicate === "Yes" });

export async function demoSheet(action: string, p: Record<string, unknown>): Promise<unknown> {
  const q = p as Row;
  const all = leads();
  const k = keys();
  switch (action) {
    case "addLead": {
      const dup = store.leads.some((r) => r.phone.slice(-10) === digits(q.phone).slice(-10));
      const ts = Date.now();
      store.leads.push({
        ts, agentName: q.agentName, agentUsername: q.agentUsername, firstName: q.firstName, lastName: q.lastName,
        phone: digits(q.phone), showNumber: digits(q.showNumber), dob: q.dob, street: q.street, city: q.city, zipcode: q.zipcode, state: q.state, campaign: q.campaign,
        transferBy: q.transferBy, duration: q.duration, duplicate: dup ? "Yes" : "No",
      });
      return { ok: true, timestamp: new Date(ts).toISOString(), duplicate: dup, lead: fullLead(store.leads[store.leads.length - 1], store.leads.length) };
    }
    case "getDashboardStats": {
      const mine = all.filter((r) => q.agent && r.agentUsername === q.agent);
      const perf: Record<string, number> = {};
      all.filter((r) => r.day === k.today).forEach((r) => (perf[r.campaign] = (perf[r.campaign] ?? 0) + 1));
      const daily = Array.from({ length: 14 }, (_, i) => {
        const day = addDays(k.today, i - 13);
        const on = all.filter((r) => r.day === day);
        return { day, total: on.length, dupes: on.filter((r) => r.duplicate === "Yes").length, mine: on.filter((r) => q.agent && r.agentUsername === q.agent).length };
      });
      return {
        totalLeads: all.length, todayLeads: countIn(all, k.today, k.today), yesterdayLeads: countIn(all, k.yesterday, k.yesterday),
        weekLeads: countIn(all, k.weekStart, k.today), monthLeads: countIn(all, k.monthStart, k.today),
        duplicateLeads: all.filter((r) => r.duplicate === "Yes").length,
        mine: { today: countIn(mine, k.today, k.today), yesterday: countIn(mine, k.yesterday, k.yesterday), week: countIn(mine, k.weekStart, k.today), month: countIn(mine, k.monthStart, k.today), total: mine.length },
        daily, recentLeads: newest(all).slice(0, 8), campaignPerformance: perf, topAgents: byAgent(inRange(all, { range: "month" })),
      };
    }
    case "checkDuplicate": {
      const d = digits(q.phone).slice(-10);
      if (d.length < 10) throw new HttpError("Enter a full 10-digit phone number");
      const matches = newest(all.filter((r) => r.phone.slice(-10) === d));
      return { duplicate: matches.length > 0, matches };
    }
    case "getProgress": {
      const list = q.agent ? all.filter((r) => nameKey(r.agentName) === nameKey(q.agent)) : all;
      return { totalLeads: list.length, todayLeads: countIn(list, k.today, k.today), weekLeads: countIn(list, k.weekStart, k.today), monthLeads: countIn(list, k.monthStart, k.today), rangeLeads: inRange(list, q).length };
    }
    case "getAgentLeads": return { agents: byAgent(inRange(all, q)) };
    case "getTodayLeads": return { leads: newest(inRange(all, { range: "today" })) };
    case "getTopAgents": return { agents: byAgent(q.all ? all : inRange(all, { range: "month" })) };

    case "listAgents": return { agents: store.agents.map(publicAgent) };
    case "getAgent": return { agent: store.agents.find((a) => a.username === String(q.username).toLowerCase()) ?? null };
    case "createAgent": {
      if (store.agents.some((a) => a.username === q.username)) throw new HttpError("This username is already taken", 409);
      const agent = { username: q.username, name: q.name, passwordHash: q.passwordHash, status: "Pending", callbackUrl: "", createdAt: new Date().toISOString(), lastLogin: "" };
      store.agents.push(agent);
      return { ok: true, agent: publicAgent(agent) };
    }
    case "updateAgent": {
      const a = store.agents.find((x) => x.username === String(q.username).toLowerCase());
      if (!a) throw new HttpError("Agent not found", 404);
      if (p.status !== undefined) a.status = q.status;
      if (p.callbackUrl !== undefined) a.callbackUrl = q.callbackUrl;
      if (p.passwordHash) a.passwordHash = q.passwordHash;
      if (p.touchLogin) a.lastLogin = new Date().toISOString();
      return { ok: true, agent: publicAgent(a) };
    }
    case "importLeads": {
      const seen = new Set((store.imported ??= []));
      const phones = new Set(store.leads.map((r) => r.phone));
      let imported = 0, skipped = 0;
      for (const row of [...(p.leads as ImportLead[])].sort((a, b) => a.ts - b.ts)) {
        const key = importKey(row);
        if (seen.has(key)) { skipped++; continue; }
        seen.add(key);
        store.imported.push(key);
        store.leads.push({ ...row, duplicate: phones.has(row.phone) ? "Yes" : "No" });
        phones.add(row.phone);
        imported++;
      }
      return { imported, skipped };
    }
    case "exportAll":
      return { leads: store.leads.map((r, i) => fullLead(r, i + 1)), agents: store.agents.map(publicAgent) };
    case "getSettings": return { settings: store.settings };
    case "setSettings": {
      Object.assign(store.settings, p.values as Record<string, string>);
      return { ok: true, settings: store.settings };
    }
    default: throw new Error("Unknown action: " + action);
  }
}
