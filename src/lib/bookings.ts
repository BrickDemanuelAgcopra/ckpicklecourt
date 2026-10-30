import { randomInt } from "node:crypto";
import { query, withTransaction } from "./db";
import { getConfig, getEquipment, getRateBands, getCourts } from "./config";
import { bandsForDate, equipmentAvailable, priceForHour } from "./availability";
import { audit } from "./audit";
import { clubParts, diffDays, isValidISO, todayISO } from "./time";
import type { BookingDetail, BookingEquipmentRow, BookingRow, BookingSlotRow, PaymentRow } from "./types";

export type NewBookingInput = {
  date: string;
  slots: { courtId: number; hour: number }[];
  equipment: { equipmentId: number; qty: number }[];
  guestName: string;
  guestPhone: string;
  guestEmail?: string;
};

export class BookingError extends Error {
  constructor(message: string, public code: string = "invalid") {
    super(message);
  }
}

function makeConfirmationId(): string {
  // CK-7KD3Q9 style: short, unambiguous, easy to read over Messenger
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += alphabet[randomInt(alphabet.length)];
  return `CK-${s}`;
}

/** `admin` relaxes the guest rules for staff entering phone/walk-in bookings: past dates and hours allowed, no booking fee. */
export async function createHold(input: NewBookingInput, opts: { admin?: boolean } = {}): Promise<{ id: string; confirmationId: string; holdExpiresAt: string }> {
  const cfg = await getConfig();
  const [bands, courts, equipmentList] = await Promise.all([getRateBands(), getCourts(), getEquipment()]);

  if (!isValidISO(input.date)) throw new BookingError("Invalid date");
  const today = todayISO();
  const d = diffDays(today, input.date);
  if (opts.admin ? d < -60 || d > 366 : d < 0 || d > cfg.bookingWindowDays) throw new BookingError("That date is outside the booking window");
  if (!input.slots.length) throw new BookingError("Select at least one hour");
  if (input.slots.length > 12) throw new BookingError("Too many hours in one booking");
  const name = input.guestName.trim();
  const phone = input.guestPhone.trim();
  if (name.length < 2) throw new BookingError("Please enter your full name");
  if (!/^[0-9+\-\s()]{7,20}$/.test(phone)) throw new BookingError("Please enter a valid contact number");
  const email = input.guestEmail?.trim() || null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new BookingError("Please enter a valid email address");

  const now = clubParts();
  const dayBands = bandsForDate(bands, input.date);
  let subtotal = 0;
  const priced: { courtId: number; hour: number; price: number }[] = [];
  const seen = new Set<string>();
  for (const s of input.slots) {
    const key = `${s.courtId}:${s.hour}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const court = courts.find((c) => c.id === s.courtId && c.available);
    if (!court) throw new BookingError("That court is not available");
    const price = priceForHour(dayBands, input.date, s.hour);
    if (price == null) throw new BookingError("That hour is outside booking hours");
    if (!opts.admin && input.date === today && s.hour <= now.hour) throw new BookingError("That hour has already passed");
    priced.push({ courtId: s.courtId, hour: s.hour, price });
    subtotal += price;
  }

  // promos override band price
  const promos = await query<{ price: string; hour_from: number; hour_to: number; court_ids: number[] }>(
    "SELECT price, hour_from, hour_to, court_ids FROM promos WHERE active AND $1::date BETWEEN date_from AND date_to",
    [input.date]
  );
  if (promos.length) {
    subtotal = 0;
    for (const p of priced) {
      const promo = promos.find((x) => p.hour >= x.hour_from && p.hour < x.hour_to && (!x.court_ids.length || x.court_ids.includes(p.courtId)));
      if (promo) p.price = Number(promo.price);
      subtotal += p.price;
    }
  }

  const hours = [...new Set(priced.map((p) => p.hour))];
  let equipmentTotal = 0;
  const eq: { equipmentId: number; qty: number; unitPrice: number }[] = [];
  for (const e of input.equipment ?? []) {
    if (!e.qty) continue;
    const item = equipmentList.find((x) => x.id === e.equipmentId);
    if (!item) throw new BookingError("Unknown equipment item");
    const free = await equipmentAvailable(input.date, hours, item.id, item.inventory_total);
    if (e.qty > free) throw new BookingError(`Only ${free} ${item.unit}${free === 1 ? "" : "s"} available for your selected time`);
    eq.push({ equipmentId: item.id, qty: e.qty, unitPrice: item.price });
    equipmentTotal += item.price * e.qty;
  }

  const fee = opts.admin ? 0 : cfg.bookingFeePerHour ? cfg.bookingFee * priced.length : cfg.bookingFee;
  const total = subtotal + equipmentTotal + fee;
  const holdMinutes = Math.max(1, cfg.paymentWindowMinutes || 5);

  return withTransaction(async (c) => {
    // closed / open play overrides
    const ov = await c.query(
      "SELECT court_id, hour FROM slot_overrides WHERE date=$1 AND (court_id, hour) IN (SELECT unnest($2::int[]), unnest($3::int[]))",
      [input.date, priced.map((p) => p.courtId), priced.map((p) => p.hour)]
    );
    if (ov.rows.length) throw new BookingError("One of the hours you picked is closed. Please choose again.", "conflict");

    let confirmationId = makeConfirmationId();
    for (let i = 0; i < 5; i++) {
      const dup = await c.query("SELECT 1 FROM bookings WHERE confirmation_id=$1", [confirmationId]);
      if (!dup.rows.length) break;
      confirmationId = makeConfirmationId();
    }
    const ins = await c.query<{ id: string; hold_expires_at: string }>(
      `INSERT INTO bookings(confirmation_id,guest_name,guest_email,guest_phone,status,subtotal,equipment_total,booking_fee,total,hold_expires_at)
       VALUES($1,$2,$3,$4,'awaiting_payment',$5,$6,$7,$8, now() + ($9 || ' minutes')::interval)
       RETURNING id, hold_expires_at`,
      [confirmationId, name, email, phone, subtotal, equipmentTotal, fee, total, String(holdMinutes)]
    );
    const id = ins.rows[0].id;
    for (const p of priced) {
      const r = await c.query(
        "INSERT INTO booking_slots(booking_id,court_id,date,hour,price) VALUES($1,$2,$3,$4,$5) ON CONFLICT (court_id,date,hour) DO NOTHING RETURNING id",
        [id, p.courtId, input.date, p.hour, p.price]
      );
      if (!r.rows.length) throw new BookingError("Someone just took one of those hours. Please pick again.", "conflict");
    }
    for (const e of eq) {
      await c.query("INSERT INTO booking_equipment(booking_id,equipment_id,qty,unit_price) VALUES($1,$2,$3,$4)", [id, e.equipmentId, e.qty, e.unitPrice]);
    }
    return { id, confirmationId, holdExpiresAt: new Date(ins.rows[0].hold_expires_at).toISOString() };
  });
}

export async function getBooking(id: string): Promise<BookingDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await query<BookingRow>("SELECT * FROM bookings WHERE id=$1", [id]);
  if (!rows.length) return null;
  return hydrate(rows[0]);
}

export async function getBookingByConfirmation(cid: string): Promise<BookingDetail | null> {
  const rows = await query<BookingRow>("SELECT * FROM bookings WHERE upper(confirmation_id)=upper($1)", [cid.trim()]);
  if (!rows.length) return null;
  return hydrate(rows[0]);
}

export async function findBookingsByName(name: string): Promise<BookingDetail[]> {
  const rows = await query<BookingRow>(
    "SELECT * FROM bookings WHERE guest_name=$1 AND status <> 'awaiting_payment' ORDER BY created_at DESC LIMIT 5",
    [name.trim()]
  );
  return Promise.all(rows.map(hydrate));
}

export async function hydrate(b: BookingRow): Promise<BookingDetail> {
  const slots = await query<BookingSlotRow>(
    "SELECT s.court_id, c.name AS court_name, to_char(s.date,'YYYY-MM-DD') AS date, s.hour, s.price FROM booking_slots s JOIN courts c ON c.id=s.court_id WHERE s.booking_id=$1 ORDER BY s.date, s.court_id, s.hour",
    [b.id]
  );
  const equipment = await query<BookingEquipmentRow>(
    "SELECT e.equipment_id, q.name, q.unit, e.qty, e.unit_price FROM booking_equipment e JOIN equipment q ON q.id=e.equipment_id WHERE e.booking_id=$1",
    [b.id]
  );
  const payments = await query<PaymentRow>(
    "SELECT id, amount, method, reference, note, received_at, recorded_by FROM payments WHERE booking_id=$1 ORDER BY received_at, id",
    [b.id]
  );
  return { ...b, slots, equipment, payments, paid: payments.reduce((s, p) => s + Number(p.amount), 0) };
}

export async function submitReceipt(id: string, receiptPath: string, partial: boolean): Promise<BookingDetail> {
  const cfg = await getConfig();
  const b = await getBooking(id);
  if (!b) throw new BookingError("Booking not found", "not_found");
  if (b.status !== "awaiting_payment") throw new BookingError("This booking is no longer awaiting payment", "state");
  if (b.hold_expires_at && new Date(b.hold_expires_at).getTime() < Date.now()) {
    await expireBooking(id);
    throw new BookingError("Your reservation expired before the receipt was uploaded. Please book again.", "expired");
  }
  const usePartial = partial && cfg.partialPaymentEnabled;
  await query(
    `UPDATE bookings SET status='pending', receipt_path=$2, partial_payment=$3, partial_percent=$4, submitted_at=now(), updated_at=now(), hold_expires_at=NULL WHERE id=$1`,
    [id, receiptPath, usePartial, usePartial ? cfg.partialPaymentPercent : null]
  );
  await audit(b.guest_name, "booking_submitted", "booking", id, { confirmationId: b.confirmation_id, total: b.total });
  return (await getBooking(id))!;
}

export async function cancelByGuest(id: string): Promise<void> {
  const b = await getBooking(id);
  if (!b) return;
  if (b.status !== "awaiting_payment") throw new BookingError("Only unpaid holds can be cancelled here", "state");
  await query("UPDATE bookings SET status='cancelled', updated_at=now() WHERE id=$1", [id]);
  await query("DELETE FROM booking_slots WHERE booking_id=$1", [id]);
  await audit(b.guest_name, "booking_cancelled", "booking", id, { by: "guest" });
}

export async function expireBooking(id: string): Promise<void> {
  await query("UPDATE bookings SET status='expired', updated_at=now() WHERE id=$1 AND status='awaiting_payment'", [id]);
  await query("DELETE FROM booking_slots WHERE booking_id=$1", [id]);
}

/** Releases every overdue hold. Called by the cron route and opportunistically on reads. */
export async function expireOverdueHolds(): Promise<number> {
  const rows = await query<{ id: string; guest_name: string }>(
    "UPDATE bookings SET status='expired', updated_at=now() WHERE status='awaiting_payment' AND hold_expires_at < now() RETURNING id, guest_name"
  );
  if (rows.length) {
    await query("DELETE FROM booking_slots WHERE booking_id = ANY($1::uuid[])", [rows.map((r) => r.id)]);
    for (const r of rows) await audit("system", "booking_expired", "booking", r.id);
  }
  return rows.length;
}
