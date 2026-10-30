// All club times are Asia/Manila regardless of the server's zone.
export const CLUB_TZ = process.env.CLUB_TIMEZONE || "Asia/Manila";

type Parts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: CLUB_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  weekday: "short",
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function clubParts(d: Date = new Date()): Parts {
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(d)) p[part.type] = part.value;
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
    weekday: WEEKDAYS.indexOf(p.weekday),
  };
}

export function todayISO(d: Date = new Date()): string {
  const p = clubParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d + days);
  const x = new Date(t);
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}-${String(x.getUTCDate()).padStart(2, "0")}`;
}

export function diffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

export function weekdayOfISO(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isValidISO(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(Date.parse(iso + "T00:00:00Z"));
}

/** "6:00 AM", "12:00 MN", "12:00 PM" — the way the club writes hours. */
export function hourLabel(h: number): string {
  const hh = ((h % 24) + 24) % 24;
  if (hh === 0 || h === 24) return "12:00 MN";
  if (hh === 12) return "12:00 PM";
  return `${hh > 12 ? hh - 12 : hh}:00 ${hh < 12 ? "AM" : "PM"}`;
}
export function hourParts(h: number): { time: string; suffix: string } {
  const hh = ((h % 24) + 24) % 24;
  if (hh === 0 || h === 24) return { time: "12:00", suffix: "MN" };
  if (hh === 12) return { time: "12:00", suffix: "PM" };
  return { time: `${hh > 12 ? hh - 12 : hh}:00`, suffix: hh < 12 ? "AM" : "PM" };
}
export function rangeLabel(start: number, end: number): string {
  return `${hourLabel(start)} – ${hourLabel(end)}`;
}

export function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d))
  );
}
export function shortDay(iso: string): { dow: string; day: number } {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return { dow: WEEKDAYS[dt.getUTCDay()].toUpperCase(), day: d };
}
export function monthRangeLabel(fromISO: string, toISO: string): string {
  const M = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const [fy, fm] = fromISO.split("-").map(Number);
  const [ty, tm] = toISO.split("-").map(Number);
  if (fy === ty && fm === tm) return `${monthName(fm)} ${fy}`;
  return `${M[fm - 1]} – ${M[tm - 1]} ${ty}`;
}
function monthName(m: number) {
  return ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"][m - 1];
}
