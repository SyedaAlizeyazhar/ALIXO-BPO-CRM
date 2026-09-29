import type { Campaign } from "./config";

export const TZ = "America/New_York";

export const digits = (s: string | undefined | null) => (s ?? "").replace(/\D/g, "");

/* (555) 555-5555 as the user types. */
export function maskPhone(raw: string) {
  const d = digits(raw).slice(0, 10);
  if (d.length <= 3) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export function fmtPhone(d: string | undefined) {
  const x = digits(d).slice(-10);
  return x.length === 10 ? `(${x.slice(0, 3)}) ${x.slice(3, 6)}-${x.slice(6)}` : d || "—";
}

/* 08052024 -> 08/05/2024 */
export function maskDob(raw: string) {
  const d = digits(raw).slice(0, 8);
  let out = d.slice(0, 2);
  if (d.length > 2) out += "/" + d.slice(2, 4);
  if (d.length > 4) out += "/" + d.slice(4, 8);
  return out;
}

/* MM/DD/YYYY that is a real calendar day. */
export function isValidDob(v: string) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v.trim());
  if (!m) return false;
  const [mo, da, yr] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || yr < 1900 || yr > new Date().getFullYear()) return false;
  const d = new Date(yr, mo - 1, da);
  return d.getFullYear() === yr && d.getMonth() === mo - 1 && d.getDate() === da;
}

export function ageFromDob(v: string) {
  if (!isValidDob(v)) return null;
  const [mo, da, yr] = v.split("/").map(Number);
  const now = new Date();
  let age = now.getFullYear() - yr;
  if (now.getMonth() + 1 < mo || (now.getMonth() + 1 === mo && now.getDate() < da)) age--;
  return age;
}

export function fmtTime(ts: string | undefined) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: TZ });
}

export const todayLabelET = () => new Date().toLocaleDateString("en-US", { timeZone: TZ, month: "long", day: "numeric" });
export const monthLabelET = () => new Date().toLocaleDateString("en-US", { timeZone: TZ, month: "long", year: "numeric" });

export const US_STATES = new Set(
  "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" "),
);

/* ---------- Campaign eligibility ---------- */

type StateRule = { mode: "allow" | "deny" | "exceptNYC"; list: string[] };

export function stateRule(c: Campaign): StateRule {
  const t = c.states.toUpperCase();
  if (t.includes("ALL STATES")) return { mode: "exceptNYC", list: [] };
  const list = t.split(":").pop()!.match(/\b[A-Z]{2}\b/g) ?? [];
  return { mode: t.startsWith("BAD") ? "deny" : "allow", list };
}

const NYC = /\b(new york|nyc|manhattan|brooklyn|bronx|queens|staten island)\b/i;

export type Check = { ok: boolean | null; label: string; detail: string };

export function eligibility(c: Campaign, f: { state: string; city: string; dob: string }): Check[] {
  const out: Check[] = [];
  const st = f.state.trim().toUpperCase();
  const rule = stateRule(c);

  if (st.length < 2) out.push({ ok: null, label: "State", detail: "Waiting for state" });
  else if (!US_STATES.has(st)) out.push({ ok: false, label: "State", detail: `${st} is not a US state code` });
  else if (rule.mode === "deny") {
    const bad = rule.list.includes(st);
    out.push({ ok: !bad, label: "State", detail: bad ? `${st} is a bad state for this campaign` : `${st} is allowed` });
  } else if (rule.mode === "allow") {
    const good = rule.list.includes(st);
    out.push({ ok: good, label: "State", detail: good ? `${st} is on the list` : `${st} is not on this campaign's list` });
  } else {
    const nyc = st === "NY" && NYC.test(f.city);
    out.push({ ok: !nyc, label: "State", detail: nyc ? "New York City is excluded" : `${st} is allowed (except NYC)` });
  }

  const [min, max] = c.ageLimit.split("-").map(Number);
  const age = ageFromDob(f.dob);
  if (age === null) out.push({ ok: null, label: "Age", detail: `Needs ${min}–${max}` });
  else {
    const ok = age >= min && age <= max;
    out.push({ ok, label: "Age", detail: `${age} yrs · range ${min}–${max}` });
  }
  return out;
}
