import { query } from "./db";
import { getCourts, getRateBands } from "./config";
import { addDaysISO, diffDays, isValidISO, todayISO, weekdayOfISO } from "./time";

// Revenue is attributed to the play date. "Live" bookings are the ones that hold courts and money:
// confirmed (paid in full) and balance_due (deposit paid, remainder owed at the court).
const LIVE = ["confirmed", "balance_due"];

export const RANGES = [
  ["7d", "7 days", 7],
  ["30d", "30 days", 30],
  ["90d", "90 days", 90],
  ["12m", "12 months", 365],
  ["all", "All time", 0],
] as const;
export type RangeKey = (typeof RANGES)[number][0] | "custom";

type BookingRow = {
  id: string;
  status: string;
  guest_name: string;
  guest_phone: string;
  subtotal: string;
  equipment_total: string;
  booking_fee: string;
  total: string;
  partial_percent: number | null;
  source: string;
  paid: string;
  created_at: Date;
  submitted_at: Date | null;
  confirmed_at: Date | null;
  play_date: string | null;
  hours: number;
};

export type Bucket = { key: string; label: string; revenue: number; bookings: number; hours: number };
export type BarRow = { label: string; value: number; sub?: string };

export type Kpis = {
  revenue: number;
  collected: number;
  bookings: number;
  hours: number;
  occupancy: number; // 0..1
  capacity: number;
  avgBooking: number;
  customers: number;
};

export type Analytics = {
  from: string;
  to: string;
  days: number;
  range: RangeKey;
  granularity: "day" | "week" | "month";
  kpis: Kpis;
  prev: Kpis;
  snapshot: { pendingCount: number; pendingValue: number; awaitingCount: number; balanceCount: number; balanceValue: number; next7Hours: number; next7Revenue: number; next7Capacity: number };
  trend: Bucket[];
  mix: { court: number; equipment: number; fees: number };
  payments: { full: number; partial: number };
  heatmap: { hours: number[]; cells: { booked: number; capacity: number }[][] }; // cells[weekday][hourIndex]
  byCourt: (BarRow & { hours: number; occupancy: number })[];
  byBand: (BarRow & { hours: number; occupancy: number; price: number })[];
  byWeekday: BarRow[];
  funnel: { started: number; submitted: number; confirmed: number; expired: number; declined: number; cancelled: number; open: number };
  leadTime: BarRow[];
  duration: BarRow[];
  response: { medianMin: number | null; p90Min: number | null; n: number };
  customers: { unique: number; returning: number; fresh: number; repeatInRange: number };
  topCustomers: { name: string; phone: string; bookings: number; hours: number; spend: number; last: string }[];
  equipment: { name: string; qty: number; revenue: number; bookings: number }[];
  equipmentAttach: number; // share of live bookings with any rental
  methods: { method: string; amount: number; count: number }[];
  sources: { online: number; admin: number };
};

const n = (v: string | number | null | undefined) => Number(v ?? 0);
const phoneKey = (p: string) => p.replace(/\D/g, "").slice(-10);
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];


export function resolveRange(sp: { range?: string; from?: string; to?: string }, earliest: string | null): { range: RangeKey; from: string; to: string } {
  const today = todayISO();
  if (sp.from && sp.to && isValidISO(sp.from) && isValidISO(sp.to) && sp.from <= sp.to) return { range: "custom", from: sp.from, to: sp.to };
  const r = RANGES.find((x) => x[0] === sp.range) ?? RANGES[1];
  if (r[0] === "all") return { range: "all", from: earliest && earliest < today ? earliest : addDaysISO(today, -29), to: today };
  return { range: r[0], from: addDaysISO(today, -(r[2] - 1)), to: today };
}

export async function earliestPlayDate(): Promise<string | null> {
  const r = await query<{ d: string | null }>("SELECT to_char(min(date),'YYYY-MM-DD') AS d FROM booking_slots");
  return r[0]?.d ?? null;
}

/** Bookable hours per weekday, from the rate bands (a band with no days applies every day). */
function openHoursByWeekday(bands: { start_hour: number; end_hour: number; days: number[] }[]): Set<number>[] {
  const out = Array.from({ length: 7 }, () => new Set<number>());
  for (const b of bands)
    for (let w = 0; w < 7; w++) {
      if (b.days.length && !b.days.includes(w)) continue;
      for (let h = b.start_hour; h < b.end_hour; h++) out[w].add(h);
    }
  return out;
}

function bucketKey(iso: string, g: Analytics["granularity"]): string {
  if (g === "day") return iso;
  if (g === "month") return iso.slice(0, 7);
  const w = weekdayOfISO(iso);
  return addDaysISO(iso, -((w + 6) % 7)); // Monday-start weeks
}
function bucketLabel(key: string, g: Analytics["granularity"]): string {
  const [y, m, d] = key.split("-").map(Number);
  if (g === "month") return `${MONTHS[m - 1]} ${String(y).slice(2)}`;
  return `${MONTHS[m - 1]} ${d}`;
}

export async function getAnalytics(range: RangeKey, from: string, to: string): Promise<Analytics> {
  const days = diffDays(from, to) + 1;
  const prevTo = addDaysISO(from, -1);
  const prevFrom = addDaysISO(prevTo, -(days - 1));
  const today = todayISO();

  const BOOKING_COLS = `b.id, b.status, b.guest_name, b.guest_phone, b.subtotal, b.equipment_total, b.booking_fee, b.total, b.partial_percent, b.source,
    coalesce((SELECT sum(amount) FROM payments WHERE booking_id=b.id),0) AS paid,
    b.created_at, b.submitted_at, b.confirmed_at,
    to_char(s.play_date,'YYYY-MM-DD') AS play_date, coalesce(s.hours,0)::int AS hours`;
  const SLOT_AGG = `LEFT JOIN LATERAL (SELECT min(date) AS play_date, count(*) AS hours FROM booking_slots WHERE booking_id=b.id) s ON true`;

  const [courts, bands, live, created, slots, overrides, equipment, firstSeen, snapshot, next7, methods] = await Promise.all([
    getCourts(),
    getRateBands(),
    // live bookings played in this period or the previous one (for deltas)
    query<BookingRow>(`SELECT ${BOOKING_COLS} FROM bookings b ${SLOT_AGG} WHERE b.status = ANY($1) AND s.play_date BETWEEN $2 AND $3`, [LIVE, prevFrom, to]),
    // everything started in the period, for the funnel (released holds have no slots left)
    query<BookingRow>(`SELECT ${BOOKING_COLS} FROM bookings b ${SLOT_AGG} WHERE (b.created_at AT TIME ZONE 'Asia/Manila')::date BETWEEN $1 AND $2`, [from, to]),
    query<{ court_id: number; date: string; hour: number; price: string }>(
      `SELECT s.court_id, to_char(s.date,'YYYY-MM-DD') AS date, s.hour, s.price FROM booking_slots s JOIN bookings b ON b.id=s.booking_id
       WHERE b.status = ANY($1) AND s.date BETWEEN $2 AND $3`,
      [LIVE, prevFrom, to]
    ),
    query<{ court_id: number; date: string; hour: number }>(
      `SELECT court_id, to_char(date,'YYYY-MM-DD') AS date, hour FROM slot_overrides WHERE kind IN ('closed','open_play') AND date BETWEEN $1 AND $2`,
      [prevFrom, to]
    ),
    query<{ name: string; qty: string; revenue: string; bookings: string }>(
      `SELECT e.name, sum(be.qty) AS qty, sum(be.qty*be.unit_price) AS revenue, count(DISTINCT be.booking_id) AS bookings
       FROM booking_equipment be JOIN equipment e ON e.id=be.equipment_id JOIN bookings b ON b.id=be.booking_id
       WHERE b.status = ANY($1) AND (SELECT min(date) FROM booking_slots WHERE booking_id=b.id) BETWEEN $2 AND $3
       GROUP BY e.name ORDER BY revenue DESC`,
      [LIVE, from, to]
    ),
    query<{ phone: string; first: string }>(
      `SELECT right(regexp_replace(b.guest_phone,'\\D','','g'),10) AS phone, to_char(min(s.date),'YYYY-MM-DD') AS first
       FROM bookings b JOIN booking_slots s ON s.booking_id=b.id WHERE b.status = ANY($1) GROUP BY 1`,
      [LIVE]
    ),
    query<{ status: string; c: string; v: string; due: string }>(
      `SELECT status, count(*) AS c, sum(total) AS v,
              sum(greatest(total - coalesce((SELECT sum(amount) FROM payments p WHERE p.booking_id=b.id),0), 0)) AS due
       FROM bookings b WHERE status IN ('pending','awaiting_payment','balance_due') GROUP BY status`
    ),
    query<{ hours: string; revenue: string }>(
      `SELECT count(*) AS hours, coalesce(sum(s.price),0) AS revenue FROM booking_slots s JOIN bookings b ON b.id=s.booking_id
       WHERE b.status = ANY($1) AND s.date BETWEEN $2 AND $3`,
      [LIVE, today, addDaysISO(today, 6)]
    ),
    // money that actually came in during the period, by when it was received
    query<{ method: string; amount: string; c: string }>(
      `SELECT method, sum(amount) AS amount, count(*) AS c FROM payments
       WHERE (received_at AT TIME ZONE 'Asia/Manila')::date BETWEEN $1 AND $2 GROUP BY method ORDER BY 2 DESC`,
      [from, to]
    ),
  ]);

  const activeCourts = courts.filter((c) => c.available);
  const open = openHoursByWeekday(bands);
  const blocked = new Map<string, number>(); // date -> blocked court-hours inside open hours
  for (const o of overrides) {
    if (!open[weekdayOfISO(o.date)].has(o.hour)) continue;
    blocked.set(o.date, (blocked.get(o.date) ?? 0) + 1);
  }
  const capacityOf = (a: string, b: string, courtCount = activeCourts.length) => {
    let cap = 0;
    for (let d = a; d <= b; d = addDaysISO(d, 1)) cap += open[weekdayOfISO(d)].size * courtCount - (courtCount === activeCourts.length ? blocked.get(d) ?? 0 : 0);
    return Math.max(cap, 0);
  };

  const inRange = live.filter((b) => b.play_date! >= from);
  const inPrev = live.filter((b) => b.play_date! < from);

  const kpisOf = (rows: BookingRow[], a: string, b: string): Kpis => {
    const revenue = rows.reduce((s, r) => s + n(r.total), 0);
    const hours = rows.reduce((s, r) => s + r.hours, 0);
    const capacity = capacityOf(a, b);
    return {
      revenue,
      collected: rows.reduce((s, r) => s + n(r.paid), 0),
      bookings: rows.length,
      hours,
      capacity,
      occupancy: capacity ? hours / capacity : 0,
      avgBooking: rows.length ? revenue / rows.length : 0,
      customers: new Set(rows.map((r) => phoneKey(r.guest_phone))).size,
    };
  };

  // Trend, zero-filled so gaps read as quiet days rather than disappearing.
  const granularity: Analytics["granularity"] = days <= 45 ? "day" : days <= 200 ? "week" : "month";
  const buckets = new Map<string, Bucket>();
  for (let d = from; d <= to; d = addDaysISO(d, 1)) {
    const k = bucketKey(d, granularity);
    if (!buckets.has(k)) buckets.set(k, { key: k, label: bucketLabel(k, granularity), revenue: 0, bookings: 0, hours: 0 });
  }
  for (const b of inRange) {
    const x = buckets.get(bucketKey(b.play_date!, granularity));
    if (!x) continue;
    x.revenue += n(b.total);
    x.bookings += 1;
    x.hours += b.hours;
  }

  // Occupancy heatmap: weekday × open hour.
  const allHours = [...new Set(open.flatMap((s) => [...s]))].sort((a, b) => a - b);
  const cells = Array.from({ length: 7 }, () => allHours.map(() => ({ booked: 0, capacity: 0 })));
  for (let d = from; d <= to; d = addDaysISO(d, 1)) {
    const w = weekdayOfISO(d);
    allHours.forEach((h, i) => {
      if (open[w].has(h)) cells[w][i].capacity += activeCourts.length;
    });
  }
  const curSlots = slots.filter((s) => s.date >= from);
  for (const s of curSlots) {
    const i = allHours.indexOf(s.hour);
    if (i >= 0) cells[weekdayOfISO(s.date)][i].booked += 1;
  }

  const byCourt = courts
    .filter((c) => c.available || curSlots.some((s) => s.court_id === c.id))
    .map((c) => {
      const mine = curSlots.filter((s) => s.court_id === c.id);
      const cap = capacityOf(from, to, 1);
      return { label: c.name, value: mine.reduce((t, s) => t + n(s.price), 0), hours: mine.length, occupancy: cap ? mine.length / cap : 0 };
    });

  const byBand = bands.map((band) => {
    const inBand = (s: { date: string; hour: number }) =>
      s.hour >= band.start_hour && s.hour < band.end_hour && (!band.days.length || band.days.includes(weekdayOfISO(s.date)));
    const mine = curSlots.filter(inBand);
    let cap = 0;
    for (let d = from; d <= to; d = addDaysISO(d, 1))
      if (!band.days.length || band.days.includes(weekdayOfISO(d))) cap += (band.end_hour - band.start_hour) * activeCourts.length;
    return { label: band.name, price: band.price, value: mine.reduce((t, s) => t + n(s.price), 0), hours: mine.length, occupancy: cap ? mine.length / cap : 0 };
  });

  const byWeekday = WD.map((label, w) => {
    const rows = inRange.filter((b) => weekdayOfISO(b.play_date!) === w);
    return { label, value: rows.reduce((t, r) => t + n(r.total), 0), sub: `${rows.reduce((t, r) => t + r.hours, 0)} hrs` };
  });
  // Monday-first reads more naturally for a week.
  byWeekday.push(byWeekday.shift()!);

  // the funnel is about the website checkout; staff-entered bookings skip it
  const online = created.filter((b) => b.source !== "admin");
  const funnel = {
    started: online.length,
    submitted: online.filter((b) => b.submitted_at).length,
    confirmed: online.filter((b) => LIVE.includes(b.status)).length,
    expired: online.filter((b) => b.status === "expired").length,
    declined: online.filter((b) => b.status === "declined").length,
    cancelled: online.filter((b) => b.status === "cancelled").length,
    open: online.filter((b) => b.status === "pending" || b.status === "awaiting_payment").length,
  };

  // Lead time: days between booking and playing, in club time.
  const LEAD = [
    ["Same day", 0, 0],
    ["1 day", 1, 1],
    ["2–3 days", 2, 3],
    ["4–7 days", 4, 7],
    ["8–14 days", 8, 14],
    ["15+ days", 15, 1e9],
  ] as const;
  const leadCounts = LEAD.map(() => 0);
  for (const b of inRange) {
    if (b.source === "admin") continue; // staff often enter these after the fact
    const lead = diffDays(todayISO(new Date(b.created_at)), b.play_date!);
    const i = LEAD.findIndex(([, lo, hi]) => lead >= lo && lead <= hi);
    if (i >= 0) leadCounts[i]++;
  }
  const leadTime = LEAD.map(([label], i) => ({ label, value: leadCounts[i] }));

  const durCounts = [0, 0, 0, 0];
  for (const b of inRange) durCounts[Math.min(Math.max(b.hours, 1), 4) - 1]++;
  const duration = ["1 hour", "2 hours", "3 hours", "4+ hours"].map((label, i) => ({ label, value: durCounts[i] }));

  const waits = created
    .filter((b) => b.source !== "admin" && b.submitted_at && b.confirmed_at && b.confirmed_at >= b.submitted_at)
    .map((b) => (b.confirmed_at!.getTime() - b.submitted_at!.getTime()) / 60000)
    .sort((a, b) => a - b);
  const pct = (p: number) => (waits.length ? waits[Math.min(waits.length - 1, Math.floor(p * waits.length))] : null);

  // Customers, keyed by phone.
  const first = new Map(firstSeen.map((r) => [r.phone, r.first]));
  const byCustomer = new Map<string, { name: string; phone: string; bookings: number; hours: number; spend: number; last: string }>();
  for (const b of inRange) {
    const k = phoneKey(b.guest_phone);
    const c = byCustomer.get(k) ?? { name: b.guest_name, phone: b.guest_phone, bookings: 0, hours: 0, spend: 0, last: "" };
    c.bookings++;
    c.hours += b.hours;
    c.spend += n(b.total);
    if (b.play_date! >= c.last) {
      c.last = b.play_date!;
      c.name = b.guest_name;
    }
    byCustomer.set(k, c);
  }
  const keys = [...byCustomer.keys()];
  const returning = keys.filter((k) => (first.get(k) ?? from) < from).length;

  const snap = Object.fromEntries(snapshot.map((r) => [r.status, r]));
  const totalLive = inRange.length;

  return {
    from,
    to,
    days,
    range,
    granularity,
    kpis: kpisOf(inRange, from, to),
    prev: kpisOf(inPrev, prevFrom, prevTo),
    snapshot: {
      pendingCount: n(snap.pending?.c),
      pendingValue: n(snap.pending?.v),
      awaitingCount: n(snap.awaiting_payment?.c),
      balanceCount: n(snap.balance_due?.c),
      balanceValue: n(snap.balance_due?.due),
      next7Hours: n(next7[0]?.hours),
      next7Revenue: n(next7[0]?.revenue),
      next7Capacity: capacityOf(today, addDaysISO(today, 6)),
    },
    trend: [...buckets.values()],
    mix: {
      court: inRange.reduce((s, r) => s + n(r.subtotal), 0),
      equipment: inRange.reduce((s, r) => s + n(r.equipment_total), 0),
      fees: inRange.reduce((s, r) => s + n(r.booking_fee), 0),
    },
    payments: { full: inRange.filter((b) => !b.partial_percent).length, partial: inRange.filter((b) => b.partial_percent).length },
    methods: methods.map((m) => ({ method: m.method, amount: n(m.amount), count: n(m.c) })),
    sources: { online: inRange.filter((b) => b.source !== "admin").length, admin: inRange.filter((b) => b.source === "admin").length },
    heatmap: { hours: allHours, cells },
    byCourt,
    byBand,
    byWeekday,
    funnel,
    leadTime,
    duration,
    response: { medianMin: pct(0.5), p90Min: pct(0.9), n: waits.length },
    customers: { unique: keys.length, returning, fresh: keys.length - returning, repeatInRange: [...byCustomer.values()].filter((c) => c.bookings > 1).length },
    topCustomers: [...byCustomer.values()].sort((a, b) => b.spend - a.spend || b.bookings - a.bookings).slice(0, 10),
    equipment: equipment.map((e) => ({ name: e.name, qty: n(e.qty), revenue: n(e.revenue), bookings: n(e.bookings) })),
    equipmentAttach: totalLive ? inRange.filter((b) => n(b.equipment_total) > 0).length / totalLive : 0,
  };
}
