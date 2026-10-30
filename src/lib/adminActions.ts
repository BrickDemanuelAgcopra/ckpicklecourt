import { query } from "./db";
import { audit } from "./audit";
import { BookingError, getBooking, hydrate } from "./bookings";
import { sendBookingEmail } from "./email";
import type { BookingDetail, BookingRow } from "./types";

export async function listBookings(view: "review" | "upcoming" | "all" | "abandoned", q?: string): Promise<BookingDetail[]> {
  let where = "";
  const params: unknown[] = [];
  if (view === "review") where = "WHERE b.status='pending'";
  else if (view === "upcoming") where = "WHERE b.status IN ('confirmed','balance_due') AND EXISTS (SELECT 1 FROM booking_slots s WHERE s.booking_id=b.id AND s.date >= current_date)";
  else if (view === "abandoned") where = "WHERE b.status IN ('awaiting_payment','expired')";
  else where = "WHERE b.status <> 'awaiting_payment'";
  if (q?.trim()) {
    params.push(`%${q.trim()}%`);
    where += ` AND (b.guest_name ILIKE $${params.length} OR b.confirmation_id ILIKE $${params.length} OR b.guest_phone ILIKE $${params.length})`;
  }
  const rows = await query<BookingRow>(`SELECT b.* FROM bookings b ${where} ORDER BY b.created_at DESC LIMIT 200`, params);
  return Promise.all(rows.map(hydrate));
}

export async function setBookingStatus(actor: string, id: string, action: "confirm" | "confirm_partial" | "settle" | "decline" | "cancel", note?: string) {
  const b = await getBooking(id);
  if (!b) throw new BookingError("Booking not found", "not_found");
  const allowed: Record<string, string[]> = {
    confirm: ["pending", "balance_due", "declined"],
    confirm_partial: ["pending"],
    settle: ["balance_due"],
    decline: ["pending", "confirmed", "balance_due"],
    cancel: ["pending", "confirmed", "balance_due", "awaiting_payment"],
  };
  if (!allowed[action].includes(b.status)) throw new BookingError(`Cannot ${action.replace("_", " ")} a booking that is ${b.status}`, "state");
  const next = action === "confirm" || action === "settle" ? "confirmed" : action === "confirm_partial" ? "balance_due" : action === "decline" ? "declined" : "cancelled";
  await query(
    `UPDATE bookings SET status=$2, admin_note=COALESCE($3, admin_note), updated_at=now(),
       confirmed_at = CASE WHEN $2 IN ('confirmed','balance_due') THEN now() ELSE confirmed_at END,
       confirmed_by = CASE WHEN $2 IN ('confirmed','balance_due') THEN $4 ELSE confirmed_by END,
       partial_payment = CASE WHEN $2='balance_due' THEN true WHEN $2='confirmed' THEN partial_payment ELSE partial_payment END
     WHERE id=$1`,
    [id, next, note || null, actor]
  );
  if (next === "declined" || next === "cancelled") await query("DELETE FROM booking_slots WHERE booking_id=$1", [id]);
  const ev = action === "confirm" ? "booking_confirmed" : action === "confirm_partial" ? "booking_confirmed_partial" : action === "settle" ? "balance_settled" : action === "decline" ? "booking_declined" : "booking_cancelled";
  await audit(actor, ev, "booking", id, { confirmationId: b.confirmation_id, from: b.status, to: next, note });
  const fresh = (await getBooking(id))!;
  if (action === "confirm" || action === "confirm_partial") sendBookingEmail("confirmed", fresh).catch(() => {});
  if (action === "decline") sendBookingEmail("declined", fresh).catch(() => {});
  return fresh;
}

export async function removeBookingHour(actor: string, id: string, courtId: number, hour: number) {
  const b = await getBooking(id);
  if (!b) throw new BookingError("Booking not found", "not_found");
  const slot = b.slots.find((s) => s.court_id === courtId && s.hour === hour);
  if (!slot) throw new BookingError("Hour not in this booking");
  if (b.slots.length === 1) throw new BookingError("A booking must keep at least one hour; cancel it instead.");
  await query("DELETE FROM booking_slots WHERE booking_id=$1 AND court_id=$2 AND hour=$3", [id, courtId, hour]);
  await query("UPDATE bookings SET subtotal = subtotal - $2, total = total - $2, updated_at=now() WHERE id=$1", [id, slot.price]);
  await audit(actor, "booking_hour_removed", "booking", id, { courtId, hour });
}

export async function deleteDirtyBookings(actor: string): Promise<number> {
  const rows = await query<{ id: string }>("DELETE FROM bookings WHERE status IN ('expired','awaiting_payment') AND created_at < now() - interval '1 day' RETURNING id");
  await audit(actor, "dirty_bookings_deleted", "booking", null, { count: rows.length });
  return rows.length;
}

export async function setSlotOverride(actor: string, courtId: number, date: string, hour: number, kind: "closed" | null, reason?: string) {
  if (kind) {
    const taken = await query("SELECT 1 FROM booking_slots s JOIN bookings b ON b.id=s.booking_id WHERE s.court_id=$1 AND s.date=$2 AND s.hour=$3 AND b.status IN ('awaiting_payment','pending','confirmed','balance_due')", [courtId, date, hour]);
    if (taken.length) throw new BookingError("That hour already has a booking; cancel it first.");
    await query("INSERT INTO slot_overrides(court_id,date,hour,kind,reason) VALUES($1,$2,$3,$4,$5) ON CONFLICT (court_id,date,hour) DO UPDATE SET kind=EXCLUDED.kind, reason=EXCLUDED.reason", [courtId, date, hour, kind, reason || null]);
    await audit(actor, "slot_closed", "slot", `${courtId}:${date}:${hour}`, { reason });
  } else {
    await query("DELETE FROM slot_overrides WHERE court_id=$1 AND date=$2 AND hour=$3", [courtId, date, hour]);
    await audit(actor, "slot_reopened", "slot", `${courtId}:${date}:${hour}`);
  }
}
