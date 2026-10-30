import { query } from "./db";
import { getCourts, getRateBands } from "./config";
import { clubParts, todayISO, weekdayOfISO } from "./time";
import type { DayGrid, GridBand, GridCell, RateBand, SlotStatus } from "./types";

/** Hours a band covers, honouring end_hour 24 = midnight. */
export function bandHours(b: RateBand): number[] {
  const out: number[] = [];
  for (let h = b.start_hour; h < b.end_hour; h++) out.push(h);
  return out;
}

export function bandsForDate(bands: RateBand[], iso: string): RateBand[] {
  const dow = weekdayOfISO(iso);
  return bands.filter((b) => !b.days?.length || b.days.includes(dow));
}

export function priceForHour(bands: RateBand[], iso: string, hour: number): number | null {
  for (const b of bandsForDate(bands, iso)) if (hour >= b.start_hour && hour < b.end_hour) return b.price;
  return null;
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export async function getDayGrid(iso: string): Promise<DayGrid> {
  const [courts, allBands] = await Promise.all([getCourts(), getRateBands()]);
  const bands = bandsForDate(allBands, iso);

  const slots = await query<{ court_id: number; hour: number; status: string; guest_name: string }>(
    `SELECT s.court_id, s.hour, b.status, b.guest_name
       FROM booking_slots s JOIN bookings b ON b.id = s.booking_id
      WHERE s.date = $1 AND b.status IN ('awaiting_payment','pending','confirmed','balance_due')`,
    [iso]
  );
  const overrides = await query<{ court_id: number; hour: number; kind: string; ref_id: number | null }>(
    "SELECT court_id, hour, kind, ref_id FROM slot_overrides WHERE date=$1",
    [iso]
  );
  const promos = await query<{ id: number; price: string; hour_from: number; hour_to: number; court_ids: number[] }>(
    "SELECT id, price, hour_from, hour_to, court_ids FROM promos WHERE active AND $1::date BETWEEN date_from AND date_to",
    [iso]
  );

  const today = todayISO();
  const now = clubParts();
  const isPast = (hour: number) => iso < today || (iso === today && hour <= now.hour);

  const slotMap = new Map<string, { status: string; guest_name: string }>();
  for (const s of slots) slotMap.set(`${s.court_id}:${s.hour}`, s);
  const ovMap = new Map<string, { kind: string; ref_id: number | null }>();
  for (const o of overrides) ovMap.set(`${o.court_id}:${o.hour}`, o);

  const cells: GridCell[] = [];
  const gridBands: GridBand[] = bands.map((b) => ({
    id: b.id,
    name: b.name,
    startHour: b.start_hour,
    endHour: b.end_hour,
    price: b.price,
    hours: bandHours(b),
  }));

  for (const b of gridBands) {
    for (const hour of b.hours) {
      for (const c of courts) {
        let price = b.price;
        let status: SlotStatus = "open";
        let label: string | undefined;
        const key = `${c.id}:${hour}`;
        const promo = promos.find((p) => hour >= p.hour_from && hour < p.hour_to && (!p.court_ids.length || p.court_ids.includes(c.id)));
        if (promo) price = Number(promo.price);

        if (!c.available) status = "unavailable";
        else if (isPast(hour)) status = "passed";
        else if (ovMap.has(key)) {
          const o = ovMap.get(key)!;
          status = o.kind === "closed" ? "closed" : o.kind === "open_play" ? "open_play" : "promo";
        } else if (slotMap.has(key)) {
          const s = slotMap.get(key)!;
          if (s.status === "confirmed" || s.status === "balance_due") {
            status = "booked";
            label = initials(s.guest_name);
          } else status = "pending";
        } else if (promo) status = "promo";
        cells.push({ courtId: c.id, hour, status, price, label });
      }
    }
  }
  return { date: iso, courts, bands: gridBands, cells };
}

/** Units of an equipment item still free for every hour in `hours` on `date`. */
export async function equipmentAvailable(date: string, hours: number[], equipmentId: number, inventoryTotal: number): Promise<number> {
  if (!hours.length) return inventoryTotal;
  const rented = await query<{ hour: number; qty: string }>(
    `SELECT hour, COALESCE(SUM(qty),0) AS qty FROM (
       SELECT DISTINCT s.hour, b.id, e.qty
         FROM booking_slots s
         JOIN bookings b ON b.id = s.booking_id
         JOIN booking_equipment e ON e.booking_id = b.id AND e.equipment_id = $3
        WHERE s.date=$1 AND s.hour = ANY($2::int[]) AND b.status IN ('awaiting_payment','pending','confirmed','balance_due')
     ) x GROUP BY hour`,
    [date, hours, equipmentId]
  );
  const walkin = await query<{ hour: number; qty: number }>(
    "SELECT hour, qty FROM equipment_walkin_usage WHERE date=$1 AND equipment_id=$2 AND hour = ANY($3::int[])",
    [date, equipmentId, hours]
  );
  let worst = 0;
  for (const h of hours) {
    const r = Number(rented.find((x) => x.hour === h)?.qty ?? 0) + Number(walkin.find((x) => x.hour === h)?.qty ?? 0);
    worst = Math.max(worst, r);
  }
  return Math.max(0, inventoryTotal - worst);
}
