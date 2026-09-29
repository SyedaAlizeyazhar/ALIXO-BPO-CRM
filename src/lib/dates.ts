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

/* UTC ms for a wall-clock time in Eastern time (handles daylight saving). */
export function easternToUtc(y: number, mo: number, d: number, h = 0, mi = 0, s = 0) {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asEastern = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return guess - (asEastern - guess);
}

/*
 * Timestamps exported from Google Sheets: "9/28/2026 19:15:32", "9/28/2026 7:15 PM",
 * "2026-09-28 19:15:32" (read as Eastern time) or full ISO strings with a zone.
 */
export function parseSheetTimestamp(raw: string): number | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:?\d{2})$/.test(v)) {
    const t = Date.parse(v);
    return isNaN(t) ? null : t;
  }
  const time = "(?:[ T]+(\\d{1,2}):(\\d{2})(?::(\\d{2}))?(?:\\.\\d+)?\\s*([AaPp][Mm])?)?";
  let m = new RegExp(`^(\\d{1,2})/(\\d{1,2})/(\\d{2,4})${time}$`).exec(v);
  let y: number, mo: number, d: number;
  if (m) {
    [mo, d, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (y < 100) y += 2000;
  } else {
    m = new RegExp(`^(\\d{4})-(\\d{1,2})-(\\d{1,2})${time}$`).exec(v);
    if (!m) return null;
    [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  }
  let h = Number(m[4] ?? 0);
  const mi = Number(m[5] ?? 0), s = Number(m[6] ?? 0), ampm = m[7]?.toLowerCase();
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
  return easternToUtc(y, mo, d, h, mi, s);
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
