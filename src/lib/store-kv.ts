import "server-only";

import { Redis } from "@upstash/redis";
import { HttpError } from "./errors";
import { addDays, dayKey, dayKeys, rangeBounds } from "./dates";

/*
 * Upstash Redis (Vercel Storage → Upstash / KV) — the CRM's source of truth.
 *
 * Keys (all prefixed "alixo:"):
 *   lead:seq            INCR counter for lead ids
 *   leads               HASH  id → lead JSON
 *   leads:time          ZSET  id scored by timestamp (ms) — date-range reads
 *   phone:<10 digits>   SET   ids submitted with that phone — dupe checks
 *   count:dupes         INT   leads flagged as duplicate, all-time
 *   count:agent         HASH  agent name → all-time lead count
 *   count:user          HASH  agent username → all-time lead count
 *   agents              HASH  username → agent JSON (with password hash)
 *   settings            HASH  key → value
 *   import:keys         SET   fingerprints of imported rows, so re-uploading a file adds nothing twice
 */

const P = "alixo:";
const K = {
  seq: P + "lead:seq",
  leads: P + "leads",
  time: P + "leads:time",
  phone: (p: string) => `${P}phone:${p}`,
  dupes: P + "count:dupes",
  byAgent: P + "count:agent",
  byUser: P + "count:user",
  agents: P + "agents",
  settings: P + "settings",
  imported: P + "import:keys",
};

let client: Redis | null = null;
function kv() {
  if (client) return client;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Upstash Redis is not configured (KV_REST_API_URL / KV_REST_API_TOKEN).");
  return (client = new Redis({ url, token }));
}

export const kvConfigured = () =>
  !!((process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) && (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN));

type Lead = {
  id: number; ts: number; agentName: string; agentUsername: string; firstName: string; lastName: string; dob: string;
  phone: string; showNumber: string; street: string; city: string; state: string; zipcode: string;
  transferBy: string; duration: string; campaign: string; duplicate: boolean;
};
type Agent = { username: string; name: string; passwordHash: string; status: string; callbackUrl: string; createdAt: string; lastLogin: string };
type WithDay = Lead & { day: string };
export type ImportLead = Omit<Lead, "id" | "duplicate">;

/* Identifies a sheet row across uploads; two different leads never share all of these. */
export const importKey = (l: ImportLead) =>
  [l.ts, l.phone, l.campaign.toLowerCase(), l.agentName.toLowerCase(), l.firstName.toLowerCase(), l.lastName.toLowerCase()].join("|");

/* Upstash may return parsed objects or raw JSON strings depending on how a value was written. */
function parse<T>(v: unknown): T | null {
  if (v == null) return null;
  if (typeof v === "string") {
    try { return JSON.parse(v) as T; } catch { return null; }
  }
  return v as T;
}

const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");
const pubLead = (r: Lead) => ({
  timestamp: new Date(r.ts).toISOString(), agentName: r.agentName, firstName: r.firstName, lastName: r.lastName,
  phone: r.phone, campaign: r.campaign, state: r.state, transferBy: r.transferBy, duration: r.duration, duplicate: r.duplicate,
});
const pubAgent = (a: Agent) => ({ username: a.username, name: a.name, status: a.status, callbackUrl: a.callbackUrl, createdAt: a.createdAt, lastLogin: a.lastLogin });

async function leadsByIds(ids: (string | number)[]): Promise<Lead[]> {
  const out: Lead[] = [];
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500).map(String);
    const vals = await kv().hmget<Record<string, unknown>>(K.leads, ...chunk);
    for (const id of chunk) {
      const lead = parse<Lead>(vals?.[id]);
      if (lead) out.push(lead);
    }
  }
  return out;
}

/* Leads whose Eastern-time day is within [from, to]. A day of padding covers the UTC offset. */
async function leadsBetween(from: string, to: string): Promise<WithDay[]> {
  const min = new Date(addDays(from, -1) + "T00:00:00Z").getTime();
  const max = new Date(addDays(to, 2) + "T00:00:00Z").getTime();
  const ids = await kv().zrange<string[]>(K.time, min, max, { byScore: true });
  return (await leadsByIds(ids))
    .map((l) => ({ ...l, day: dayKey(new Date(l.ts)) }))
    .filter((l) => l.day >= from && l.day <= to);
}

const within = (list: WithDay[], from: string, to: string) => list.filter((l) => l.day >= from && l.day <= to);
const newest = (list: Lead[]) => [...list].sort((a, b) => b.ts - a.ts).map(pubLead);
/* Agent names from old sheets vary in case ("OWAIS" / "Owais"); count them as one person. */
export const nameKey = (n: string) => n.trim().toLowerCase();

export function mergeCounts(pairs: [string, number][]) {
  const m = new Map<string, { agentName: string; count: number; best: number }>();
  for (const [name, n] of pairs) {
    const e = m.get(nameKey(name));
    if (!e) m.set(nameKey(name), { agentName: name, count: n, best: n });
    else {
      e.count += n;
      if (n > e.best) { e.best = n; e.agentName = name; } // show the most-used spelling
    }
  }
  return [...m.values()].map(({ agentName, count }) => ({ agentName, count })).sort((a, b) => b.count - a.count);
}

function countByAgent(list: Lead[]) {
  const m: Record<string, number> = {};
  list.forEach((l) => (m[l.agentName] = (m[l.agentName] ?? 0) + 1));
  return mergeCounts(Object.entries(m));
}
const minDay = (...d: string[]) => d.sort()[0];
const maxDay = (...d: string[]) => d.sort()[d.length - 1];

async function getAgentRecord(username: string) {
  return parse<Agent>(await kv().hget(K.agents, username.toLowerCase()));
}

export async function kvStore(action: string, p: Record<string, unknown>): Promise<unknown> {
  const s = p as Record<string, string>;
  const k = dayKeys();
  const r = kv();

  switch (action) {
    /* ---------- leads ---------- */
    case "addLead": {
      const phone = digits(s.phone).slice(-10);
      const duplicate = (await r.scard(K.phone(phone))) > 0;
      const id = await r.incr(K.seq);
      const lead: Lead = {
        id, ts: Date.now(), agentName: s.agentName, agentUsername: s.agentUsername, firstName: s.firstName, lastName: s.lastName,
        dob: s.dob, phone, showNumber: digits(s.showNumber).slice(-10), street: s.street, city: s.city, state: s.state.toUpperCase(),
        zipcode: s.zipcode, transferBy: s.transferBy, duration: s.duration, campaign: s.campaign, duplicate,
      };
      const tx = r.multi();
      tx.hset(K.leads, { [id]: JSON.stringify(lead) });
      tx.zadd(K.time, { score: lead.ts, member: String(id) });
      tx.sadd(K.phone(phone), String(id));
      tx.hincrby(K.byAgent, lead.agentName, 1);
      tx.hincrby(K.byUser, lead.agentUsername, 1);
      if (duplicate) tx.incr(K.dupes);
      await tx.exec();
      return { ok: true, timestamp: new Date(lead.ts).toISOString(), duplicate, lead };
    }

    case "getDashboardStats": {
      const agent = s.agent || "";
      const from = minDay(k.monthStart, k.weekStart, addDays(k.today, -13));
      const [win, total, dupes, mineTotal] = await Promise.all([
        leadsBetween(from, k.today),
        r.zcard(K.time),
        r.get<number>(K.dupes),
        agent ? r.hget<number>(K.byUser, agent) : Promise.resolve(0),
      ]);
      const mine = win.filter((l) => agent && l.agentUsername === agent);
      const perf: Record<string, number> = {};
      within(win, k.today, k.today).forEach((l) => (perf[l.campaign] = (perf[l.campaign] ?? 0) + 1));
      const daily = Array.from({ length: 14 }, (_, i) => {
        const day = addDays(k.today, i - 13);
        const on = win.filter((l) => l.day === day);
        return { day, total: on.length, dupes: on.filter((l) => l.duplicate).length, mine: on.filter((l) => agent && l.agentUsername === agent).length };
      });
      return {
        totalLeads: total,
        todayLeads: within(win, k.today, k.today).length,
        yesterdayLeads: within(win, k.yesterday, k.yesterday).length,
        weekLeads: within(win, k.weekStart, k.today).length,
        monthLeads: within(win, k.monthStart, k.today).length,
        duplicateLeads: Number(dupes ?? 0),
        mine: {
          today: within(mine, k.today, k.today).length,
          yesterday: within(mine, k.yesterday, k.yesterday).length,
          week: within(mine, k.weekStart, k.today).length,
          month: within(mine, k.monthStart, k.today).length,
          total: Number(mineTotal ?? 0),
        },
        daily,
        recentLeads: newest(await leadsByIds(await r.zrange<string[]>(K.time, 0, 7, { rev: true }))),
        campaignPerformance: perf,
        topAgents: countByAgent(within(win, k.monthStart, k.today)),
      };
    }

    case "checkDuplicate": {
      const phone = digits(s.phone).slice(-10);
      if (phone.length < 10) throw new HttpError("Enter a full 10-digit phone number");
      const matches = newest(await leadsByIds(await r.smembers(K.phone(phone))));
      return { duplicate: matches.length > 0, matches };
    }

    case "getProgress": {
      const [rf, rt] = rangeBounds(s);
      const win = (await leadsBetween(minDay(rf, k.monthStart, k.weekStart), maxDay(rt, k.today)))
        .filter((l) => !s.agent || nameKey(l.agentName) === nameKey(s.agent));
      const total = s.agent
        ? Object.entries((await r.hgetall<Record<string, number>>(K.byAgent)) ?? {})
            .filter(([name]) => nameKey(name) === nameKey(s.agent)).reduce((sum, [, n]) => sum + Number(n), 0)
        : await r.zcard(K.time);
      return {
        totalLeads: total,
        todayLeads: within(win, k.today, k.today).length,
        weekLeads: within(win, k.weekStart, k.today).length,
        monthLeads: within(win, k.monthStart, k.today).length,
        rangeLeads: within(win, rf, rt).length,
      };
    }
    case "getAgentLeads": {
      const [rf, rt] = rangeBounds(s);
      return { agents: countByAgent(await leadsBetween(rf, rt)) };
    }
    case "getTodayLeads":
      return { leads: newest(await leadsBetween(k.today, k.today)) };
    case "getTopAgents": {
      if (s.all) {
        const all = (await r.hgetall<Record<string, number>>(K.byAgent)) ?? {};
        return { agents: mergeCounts(Object.entries(all).map(([name, n]) => [name, Number(n)])) };
      }
      return { agents: countByAgent(await leadsBetween(k.monthStart, k.today)) };
    }

    /* ---------- agents ---------- */
    case "listAgents": {
      const all = (await r.hgetall<Record<string, unknown>>(K.agents)) ?? {};
      return {
        agents: Object.values(all).map((v) => parse<Agent>(v)).filter((a): a is Agent => !!a)
          .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)).map(pubAgent),
      };
    }
    case "getAgent":
      return { agent: await getAgentRecord(s.username) };
    case "createAgent": {
      const agent: Agent = {
        username: s.username.toLowerCase(), name: s.name, passwordHash: s.passwordHash,
        status: "Pending", callbackUrl: "", createdAt: new Date().toISOString(), lastLogin: "",
      };
      // HSETNX: only one sign-up can claim a username, even if two arrive together.
      const created = await r.hsetnx(K.agents, agent.username, JSON.stringify(agent));
      if (!created) throw new HttpError("This username is already taken", 409);
      return { ok: true, agent: pubAgent(agent) };
    }
    case "updateAgent": {
      const a = await getAgentRecord(s.username);
      if (!a) throw new HttpError("Agent not found", 404);
      if (p.status !== undefined) a.status = s.status;
      if (p.callbackUrl !== undefined) a.callbackUrl = s.callbackUrl;
      if (p.passwordHash) a.passwordHash = s.passwordHash;
      if (p.touchLogin) a.lastLogin = new Date().toISOString();
      await r.hset(K.agents, { [a.username]: JSON.stringify(a) });
      return { ok: true, agent: pubAgent(a) };
    }

    /* ---------- settings ---------- */
    case "getSettings": {
      const all = (await r.hgetall<Record<string, unknown>>(K.settings)) ?? {};
      return { settings: Object.fromEntries(Object.entries(all).map(([key, v]) => [key, String(v)])) };
    }
    case "setSettings": {
      const values = Object.fromEntries(Object.entries((p.values ?? {}) as Record<string, string>).map(([key, v]) => [key, String(v)]));
      if (Object.keys(values).length) await r.hset(K.settings, values);
      return kvStore("getSettings", {});
    }

    /* ---------- import of old sheet data ---------- */
    case "importLeads": {
      // Every row becomes a lead — same customer on several campaigns stays several leads.
      // Repeated phones are only labelled "duplicate", never dropped.
      const rows = [...(p.leads as ImportLead[])].sort((a, b) => a.ts - b.ts);
      if (!rows.length) return { imported: 0, skipped: 0 };

      // 1. Skip only rows already imported by an earlier upload of the same file.
      //    (Read-only check; the fingerprints are saved together with the leads below,
      //    so a failed batch can simply be uploaded again.)
      const keys = rows.map(importKey);
      const done = await r.smismember(K.imported, keys);
      const inBatch = new Set<string>();
      const toAdd: (ImportLead & { key: string })[] = [];
      rows.forEach((row, i) => {
        if (Number(done[i]) === 1 || inBatch.has(keys[i])) return;
        inBatch.add(keys[i]);
        toAdd.push({ ...row, key: keys[i] });
      });
      if (!toAdd.length) return { imported: 0, skipped: rows.length };

      // 2. Which phones already have a lead (for the duplicate label)?
      const phones = [...new Set(toAdd.map((row) => row.phone))];
      const known = r.pipeline();
      phones.forEach((ph) => known.scard(K.phone(ph)));
      const counts = (await known.exec()) as number[];
      const hasLead = new Set(phones.filter((_, i) => counts[i] > 0));

      // 3. Write everything in one atomic transaction (all or nothing).
      const lastId = await r.incrby(K.seq, toAdd.length);
      const tx = r.multi();
      let dupes = 0;
      toAdd.forEach(({ key, ...row }, i) => {
        const lead: Lead = { ...row, id: lastId - toAdd.length + 1 + i, duplicate: hasLead.has(row.phone) };
        hasLead.add(row.phone);
        if (lead.duplicate) dupes++;
        tx.sadd(K.imported, key);
        tx.hset(K.leads, { [lead.id]: JSON.stringify(lead) });
        tx.zadd(K.time, { score: lead.ts, member: String(lead.id) });
        tx.sadd(K.phone(lead.phone), String(lead.id));
        tx.hincrby(K.byAgent, lead.agentName, 1);
        if (lead.agentUsername) tx.hincrby(K.byUser, lead.agentUsername, 1);
      });
      if (dupes) tx.incrby(K.dupes, dupes);
      await tx.exec();
      return { imported: toAdd.length, skipped: rows.length - toAdd.length };
    }

    /* ---------- full export for the sheet mirror ---------- */
    case "exportAll": {
      const ids = await r.zrange<string[]>(K.time, 0, -1);
      const all = (await r.hgetall<Record<string, unknown>>(K.agents)) ?? {};
      return {
        leads: await leadsByIds(ids),
        agents: Object.values(all).map((v) => parse<Agent>(v)).filter((a): a is Agent => !!a).map(pubAgent),
      };
    }
    default:
      throw new Error("Unknown action: " + action);
  }
}
