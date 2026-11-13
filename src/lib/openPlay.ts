import { query, withTransaction } from "./db";
import { getConfig, getCourts, getRateBands } from "./config";
import { audit } from "./audit";
import { BookingError, freshConfirmationId, validateGuest } from "./bookings";
import { clubParts, diffDays, isValidISO, todayISO, weekdayOfISO } from "./time";
import type { BookingStatus, OpenPlayPublic } from "./types";
import { JOINED_SQL, SELECT_SESSIONS, toPublic, type SessionRow } from "./openPlayQueries";

export { openPlayForDate, upcomingOpenPlay } from "./openPlayQueries";

/** Most players one guest can sign up in a single join. */
export const MAX_PLAYERS_PER_JOIN = 8;

export type OpenPlayJoinInput = { sessionId: number; players: number; guestName: string; guestPhone: string; guestEmail?: string };

/** Reserves spots in a session as an awaiting-payment booking; checkout then works exactly like a court booking. */
export async function createOpenPlayHold(input: OpenPlayJoinInput): Promise<{ id: string; confirmationId: string; holdExpiresAt: string }> {
  const cfg = await getConfig();
  const { name, phone, email } = validateGuest(input);
  const players = input.players;
  if (!Number.isInteger(players) || players < 1 || players > MAX_PLAYERS_PER_JOIN) throw new BookingError(`You can sign up 1 to ${MAX_PLAYERS_PER_JOIN} players at a time`);
  const holdMinutes = Math.max(1, cfg.paymentWindowMinutes || 5);

  return withTransaction(async (c) => {
    // The row lock makes concurrent joins queue up, so two guests can't both take the last spot.
    const s = await c.query<{ date: string; end_hour: number; price_per_player: string; capacity: number; status: string }>(
      "SELECT to_char(date,'YYYY-MM-DD') AS date, end_hour, price_per_player, capacity, status FROM open_play_sessions WHERE id=$1 FOR UPDATE",
      [input.sessionId]
    );
    const session = s.rows[0];
    if (!session || session.status !== "open") throw new BookingError("This Open Play session is no longer available.", "conflict");
    const today = todayISO();
    const d = diffDays(today, session.date);
    if (d < 0 || (d === 0 && clubParts().hour >= session.end_hour)) throw new BookingError("This Open Play session has already ended.", "conflict");
    if (d > cfg.bookingWindowDays) throw new BookingError("That date is outside the booking window");

    const j = await c.query<{ joined: number }>(`SELECT ${JOINED_SQL} AS joined FROM open_play_sessions o WHERE o.id=$1`, [input.sessionId]);
    const left = session.capacity - (j.rows[0]?.joined ?? 0);
    if (left <= 0) throw new BookingError("Sorry, this Open Play session just filled up.", "conflict");
    if (players > left) throw new BookingError(`Only ${left} spot${left === 1 ? "" : "s"} left in this session.`, "conflict");

    const subtotal = Number(session.price_per_player) * players;
    const fee = cfg.bookingFee;
    const total = subtotal + fee;
    const confirmationId = await freshConfirmationId(c);
    const ins = await c.query<{ id: string; hold_expires_at: string }>(
      `INSERT INTO bookings(confirmation_id,guest_name,guest_email,guest_phone,status,subtotal,equipment_total,booking_fee,total,hold_expires_at,open_play_session_id,players)
       VALUES($1,$2,$3,$4,'awaiting_payment',$5,0,$6,$7, now() + ($8 || ' minutes')::interval, $9, $10)
       RETURNING id, hold_expires_at`,
      [confirmationId, name, email, phone, subtotal, fee, total, String(holdMinutes), input.sessionId, players]
    );
    return { id: ins.rows[0].id, confirmationId, holdExpiresAt: new Date(ins.rows[0].hold_expires_at).toISOString() };
  });
}

/* ───────── Admin ───────── */

export type NewSessionInput = { courtId: number; date: string; startHour: number; endHour: number; pricePerPlayer: number; capacity: number; note?: string };

export async function createOpenPlaySession(actor: string, input: NewSessionInput): Promise<number> {
  const { courtId, date, startHour, endHour, pricePerPlayer, capacity } = input;
  if (!isValidISO(date)) throw new BookingError("Invalid date");
  if (date < todayISO()) throw new BookingError("That date has already passed");
  if (!(startHour >= 0 && endHour <= 24 && startHour < endHour)) throw new BookingError("The session must end after it starts");
  if (!(pricePerPlayer >= 0)) throw new BookingError("Enter a price per player");
  if (!(capacity >= 1 && capacity <= 64)) throw new BookingError("Capacity must be between 1 and 64 players");
  const [courts, bands] = await Promise.all([getCourts(), getRateBands()]);
  if (!courts.some((c) => c.id === courtId && c.available)) throw new BookingError("That court is not available");
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  // same rule as the grid's bandsForDate (not imported: availability.ts imports this module)
  const dow = weekdayOfISO(date);
  const dayBands = bands.filter((b) => !b.days?.length || b.days.includes(dow));
  if (hours.some((h) => !dayBands.some((b) => h >= b.start_hour && h < b.end_hour))) throw new BookingError("Part of that time is outside the court's opening hours");

  const id = await withTransaction(async (c) => {
    const taken = await c.query(
      `SELECT 1 FROM booking_slots s JOIN bookings b ON b.id=s.booking_id
        WHERE s.court_id=$1 AND s.date=$2 AND s.hour = ANY($3::int[]) AND b.status IN ('awaiting_payment','pending','confirmed','balance_due')`,
      [courtId, date, hours]
    );
    if (taken.rows.length) throw new BookingError("Some of those hours already have a court booking. Cancel or move it first.");
    const ov = await c.query("SELECT kind FROM slot_overrides WHERE court_id=$1 AND date=$2 AND hour = ANY($3::int[])", [courtId, date, hours]);
    if (ov.rows.length) throw new BookingError("Some of those hours are closed or already have Open Play. Reopen them in the court grid first.");
    const ins = await c.query<{ id: number }>(
      `INSERT INTO open_play_sessions(court_id,date,start_hour,end_hour,price_per_player,capacity,note,status,created_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,'open',$8) RETURNING id`,
      [courtId, date, startHour, endHour, pricePerPlayer, capacity, input.note?.trim() || null, actor]
    );
    const sid = ins.rows[0].id;
    for (const h of hours) {
      await c.query("INSERT INTO slot_overrides(court_id,date,hour,kind,reason,ref_id) VALUES($1,$2,$3,'open_play','Open Play',$4)", [courtId, date, h, sid]);
    }
    return sid;
  });
  await audit(actor, "open_play_created", "open_play", id, input);
  return id;
}

/** Cancels the session, frees its court hours, and returns the live bookings that need cancelling too. */
export async function cancelOpenPlaySession(actor: string, id: number): Promise<string[]> {
  const ids = await withTransaction(async (c) => {
    const r = await c.query("UPDATE open_play_sessions SET status='cancelled' WHERE id=$1 AND status='open' RETURNING id", [id]);
    if (!r.rows.length) throw new BookingError("That session is already cancelled", "state");
    await c.query("DELETE FROM slot_overrides WHERE kind='open_play' AND ref_id=$1", [id]);
    const b = await c.query<{ id: string }>(
      "SELECT id FROM bookings WHERE open_play_session_id=$1 AND status IN ('awaiting_payment','pending','confirmed','balance_due')",
      [id]
    );
    return b.rows.map((x) => x.id);
  });
  await audit(actor, "open_play_cancelled", "open_play", id, { bookings: ids.length });
  return ids;
}

export type AdminSession = OpenPlayPublic & {
  status: "open" | "cancelled";
  roster: { id: string; confirmation_id: string; guest_name: string; guest_phone: string; players: number; status: BookingStatus; total: string; paid: number }[];
};

/** Sessions from `from` onward with who has joined, for Admin → Open Play. */
export async function listOpenPlayAdmin(from: string): Promise<AdminSession[]> {
  const rows = await query<SessionRow>(`${SELECT_SESSIONS} WHERE o.date >= $1 ORDER BY o.date, o.start_hour, c.sort, c.id LIMIT 200`, [from]);
  if (!rows.length) return [];
  const roster = await query<AdminSession["roster"][number] & { open_play_session_id: number; paid: string }>(
    `SELECT b.id, b.confirmation_id, b.guest_name, b.guest_phone, b.players, b.status, b.total, b.open_play_session_id,
            COALESCE((SELECT sum(amount) FROM payments p WHERE p.booking_id=b.id),0) AS paid
       FROM bookings b
      WHERE b.open_play_session_id = ANY($1::int[]) AND b.status IN ('awaiting_payment','pending','confirmed','balance_due')
      ORDER BY b.created_at`,
    [rows.map((r) => r.id)]
  );
  return rows.map((r) => ({
    ...toPublic(r),
    status: r.status,
    roster: roster.filter((x) => x.open_play_session_id === r.id).map((x) => ({ ...x, paid: Number(x.paid) })),
  }));
}
