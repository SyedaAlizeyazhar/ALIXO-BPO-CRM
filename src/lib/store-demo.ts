import "server-only";

import { campaigns as defaultCampaigns, type Campaign } from "./config";
import { addDays, dayKey, dayKeys as keys, rangeBounds } from "./dates";
import { HttpError } from "./errors";
import { importKey, mergeCounts, nameKey, type ImportLead } from "./store-kv";

/*
 * In-memory stand-in for store-kv.ts, used in local dev when Upstash Redis is not configured.
 * Data lives only in this server process and is lost on restart — never used in production.
 */

type Row = Record<string, string>;
type LeadRow = ImportLead & { id: number; duplicate: boolean };
type Store = { seq: number; leads: LeadRow[]; agents: Row[]; settings: Record<string, string>; imported: string[]; campaigns: Campaign[] | null };

const g = globalThis as unknown as { __alixoDemo2?: Store };
const store: Store = (g.__alixoDemo2 ??= { seq: 0, leads: [], agents: [], settings: {}, imported: [], campaigns: null });

const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");
const leads = () => store.leads.map((r) => ({ ...r, day: dayKey(new Date(r.ts)) }));
type L = ReturnType<typeof leads>[number];

function inRange(list: L[], p: Row) {
  const [from, to] = rangeBounds(p);
  return list.filter((r) => r.day >= from && r.day <= to);
}
const countIn = (list: L[], from: string, to: string) => list.filter((r) => r.day >= from && r.day <= to).length;
const pub = (r: LeadRow) => ({
  id: r.id, timestamp: new Date(r.ts).toISOString(), agentName: r.agentName, firstName: r.firstName, lastName: r.lastName,
  phone: r.phone, campaign: r.campaign, state: r.state, transferBy: r.transferBy, duration: r.duration, duplicate: r.duplicate,
});
const newest = (list: LeadRow[]) => [...list].sort((a, b) => b.ts - a.ts).map(pub);
function byAgent(list: L[]) {
  const m: Record<string, number> = {};
  list.forEach((r) => (m[r.agentName] = (m[r.agentName] ?? 0) + 1));
  return mergeCounts(Object.entries(m));
}
const publicAgent = (a: Row) => ({ username: a.username, name: a.name, status: a.status, callbackUrl: a.callbackUrl, createdAt: a.createdAt, lastLogin: a.lastLogin });
const campaignsList = () =>
  (store.campaigns ??= defaultCampaigns.map((c, i) => ({ ...c, id: `c${i + 1}`, createdAt: i })));

export async function demoSheet(action: string, p: Record<string, unknown>): Promise<unknown> {
  const q = p as Row;
  const all = leads();
  const k = keys();
  switch (action) {
    case "addLead": {
      const phone = digits(q.phone).slice(-10);
      const lead: LeadRow = {
        id: ++store.seq, ts: Date.now(), agentName: q.agentName, agentUsername: q.agentUsername, firstName: q.firstName, lastName: q.lastName,
        phone, showNumber: digits(q.showNumber).slice(-10), dob: q.dob, street: q.street, city: q.city, zipcode: q.zipcode, state: q.state.toUpperCase(),
        campaign: q.campaign, transferBy: q.transferBy, duration: q.duration, duplicate: store.leads.some((r) => r.phone === phone),
      };
      store.leads.push(lead);
      return { ok: true, timestamp: new Date(lead.ts).toISOString(), duplicate: lead.duplicate, lead };
    }
    case "getDashboardStats": {
      const me = nameKey(q.agentName || "");
      const isMine = (r: LeadRow) => !!q.agent && (r.agentUsername === q.agent || (!!me && nameKey(r.agentName) === me));
      const mine = all.filter(isMine);
      const perf: Record<string, number> = {};
      all.filter((r) => r.day === k.today).forEach((r) => (perf[r.campaign] = (perf[r.campaign] ?? 0) + 1));
      const daily = Array.from({ length: 14 }, (_, i) => {
        const day = addDays(k.today, i - 13);
        const on = all.filter((r) => r.day === day);
        return { day, total: on.length, dupes: on.filter((r) => r.duplicate).length, mine: on.filter(isMine).length };
      });
      return {
        totalLeads: all.length, todayLeads: countIn(all, k.today, k.today), yesterdayLeads: countIn(all, k.yesterday, k.yesterday),
        weekLeads: countIn(all, k.weekStart, k.today), monthLeads: countIn(all, k.monthStart, k.today),
        duplicateLeads: all.filter((r) => r.duplicate).length,
        mine: { today: countIn(mine, k.today, k.today), yesterday: countIn(mine, k.yesterday, k.yesterday), week: countIn(mine, k.weekStart, k.today), month: countIn(mine, k.monthStart, k.today), total: mine.length },
        daily, recentLeads: newest(all).slice(0, 8), campaignPerformance: perf, topAgents: byAgent(inRange(all, { range: "month" })),
      };
    }
    case "checkDuplicate": {
      const d = digits(q.phone).slice(-10);
      if (d.length < 10) throw new HttpError("Enter a full 10-digit phone number");
      const matches = newest(store.leads.filter((r) => r.phone === d));
      return { duplicate: matches.length > 0, matches };
    }
    case "getProgress": {
      const list = q.agent ? all.filter((r) => nameKey(r.agentName) === nameKey(q.agent)) : all;
      return { totalLeads: list.length, todayLeads: countIn(list, k.today, k.today), weekLeads: countIn(list, k.weekStart, k.today), monthLeads: countIn(list, k.monthStart, k.today), rangeLeads: inRange(list, q).length };
    }
    case "getAgentLeads": return { agents: byAgent(inRange(all, q)) };
    case "getTodayLeads": return { leads: newest(inRange(all, { range: "today" })) };
    case "getTopAgents": return { agents: byAgent(q.all ? all : inRange(all, { range: "month" })) };

    case "searchLeads": {
      const s = String(q.q ?? "").trim().toLowerCase();
      const d = digits(s);
      const hits = !s ? store.leads : store.leads.filter((l) =>
        `${l.firstName} ${l.lastName}`.toLowerCase().includes(s) || l.agentName.toLowerCase().includes(s) ||
        l.campaign.toLowerCase().includes(s) || (d.length >= 3 && l.phone.includes(d)));
      return { leads: newest(hits).slice(0, s ? 100 : 50) };
    }
    case "deleteLead": {
      const i = store.leads.findIndex((l) => String(l.id) === String(q.id));
      if (i < 0) throw new HttpError("Lead not found", 404);
      const [lead] = store.leads.splice(i, 1);
      let promoted: LeadRow | null = null;
      if (!lead.duplicate) {
        const next = store.leads.filter((l) => l.phone === lead.phone).sort((a, b) => a.ts - b.ts)[0];
        if (next?.duplicate) { next.duplicate = false; promoted = next; }
      }
      return { ok: true, lead, promoted };
    }

    case "listCampaigns": return { campaigns: campaignsList() };
    case "saveCampaign": {
      const c = p.campaign as Campaign;
      const list = campaignsList();
      if (list.some((x) => x.id !== c.id && nameKey(x.name) === nameKey(c.name))) throw new HttpError("A campaign with this name already exists", 409);
      const i = list.findIndex((x) => x.id === c.id);
      const saved = { ...c, id: i >= 0 ? c.id : `c${Date.now()}`, createdAt: i >= 0 ? list[i].createdAt : Date.now() };
      if (i >= 0) list[i] = saved; else list.push(saved);
      return { ok: true, campaign: saved };
    }
    case "deleteCampaign": {
      const list = campaignsList();
      const i = list.findIndex((x) => x.id === q.id);
      if (i < 0) throw new HttpError("Campaign not found", 404);
      list.splice(i, 1);
      return { ok: true };
    }

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
      const seen = new Set(store.imported);
      const phones = new Set(store.leads.map((r) => r.phone));
      let imported = 0, skipped = 0;
      for (const row of [...(p.leads as ImportLead[])].sort((a, b) => a.ts - b.ts)) {
        const key = importKey(row);
        if (seen.has(key)) { skipped++; continue; }
        seen.add(key);
        store.imported.push(key);
        store.leads.push({ ...row, id: ++store.seq, duplicate: phones.has(row.phone) });
        phones.add(row.phone);
        imported++;
      }
      return { imported, skipped };
    }
    case "exportAll":
      return { leads: store.leads, agents: store.agents.map(publicAgent) };
    case "getSettings": return { settings: store.settings };
    case "setSettings": {
      Object.assign(store.settings, p.values as Record<string, string>);
      return { ok: true, settings: store.settings };
    }
    default: throw new Error("Unknown action: " + action);
  }
}
