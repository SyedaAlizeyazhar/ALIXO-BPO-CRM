import { HttpError } from "./errors";

/* Calendar-day keys (YYYY-MM-DD) in US Eastern time, which the floor works in. */

const TZ = "America/New_York";

export const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });

export function addDays(key: string, n: number) {
  const d = new Date(key + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function dayKeys() {
  const today = dayKey(new Date());
  const dow = ((new Date(today + "T12:00:00Z").getUTCDay() + 6) % 7) + 1; // 1 = Monday
  const monthStart = today.slice(0, 8) + "01";
  const lastMonthEnd = addDays(monthStart, -1);
  return {
    today,
    yesterday: addDays(today, -1),
    weekStart: addDays(today, -(dow - 1)),
    monthStart,
    lastMonthStart: lastMonthEnd.slice(0, 8) + "01",
    lastMonthEnd,
  };
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/* [from, to] inclusive for a Progress range. */
export function rangeBounds(p: { range?: string; start?: string; end?: string }): [string, string] {
  const k = dayKeys();
  switch (p.range) {
    case "yesterday": return [k.yesterday, k.yesterday];
    case "week": return [k.weekStart, k.today];
    case "month": return [k.monthStart, k.today];
    case "lastmonth": return [k.lastMonthStart, k.lastMonthEnd];
    case "custom":
      if (!p.start || !p.end || !ISO_DAY.test(p.start) || !ISO_DAY.test(p.end)) throw new HttpError("Custom range needs a start and end date");
      return [p.start, p.end];
    default: return [k.today, k.today];
  }
}
