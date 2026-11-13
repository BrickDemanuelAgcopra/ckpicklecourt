import { query } from "./db";
import { getConfig } from "./config";
import { clubParts, todayISO } from "./time";
import type { OpenPlayPublic } from "./types";

// Read-only Open Play queries. Kept apart from openPlay.ts so the booking grid can use them
// without an import cycle (openPlay.ts → bookings.ts → availability.ts).

/**
 * Players holding a spot: every live booking on the session, except holds whose payment window
 * already ran out but haven't been swept by the expiry job yet.
 */
export const JOINED_SQL = `COALESCE((SELECT sum(b.players) FROM bookings b
   WHERE b.open_play_session_id = o.id
     AND b.status IN ('awaiting_payment','pending','confirmed','balance_due')
     AND NOT (b.status = 'awaiting_payment' AND b.hold_expires_at < now())), 0)::int`;

export type SessionRow = {
  id: number;
  court_id: number;
  court_name: string;
  date: string;
  start_hour: number;
  end_hour: number;
  price_per_player: string;
  capacity: number;
  note: string | null;
  status: "open" | "cancelled";
  joined: number;
};

export const SELECT_SESSIONS = `SELECT o.id, o.court_id, c.name AS court_name, to_char(o.date,'YYYY-MM-DD') AS date, o.start_hour, o.end_hour,
       o.price_per_player, o.capacity, o.note, o.status, ${JOINED_SQL} AS joined
  FROM open_play_sessions o JOIN courts c ON c.id = o.court_id`;

export function toPublic(r: SessionRow): OpenPlayPublic {
  return {
    id: r.id,
    courtId: r.court_id,
    courtName: r.court_name,
    date: r.date,
    startHour: r.start_hour,
    endHour: r.end_hour,
    pricePerPlayer: Number(r.price_per_player),
    capacity: r.capacity,
    joined: r.joined,
    note: r.note,
  };
}

/** Open sessions on one day, for the booking grid. */
export async function openPlayForDate(date: string): Promise<OpenPlayPublic[]> {
  const rows = await query<SessionRow>(`${SELECT_SESSIONS} WHERE o.date=$1 AND o.status='open' ORDER BY o.start_hour, c.sort, c.id`, [date]);
  return rows.map(toPublic);
}

/** Sessions guests can still join, soonest first, for the homepage banner. */
export async function upcomingOpenPlay(limit = 6): Promise<OpenPlayPublic[]> {
  const cfg = await getConfig();
  const today = todayISO();
  const hour = clubParts().hour;
  const rows = await query<SessionRow>(
    `${SELECT_SESSIONS}
      WHERE o.status='open' AND o.date BETWEEN $1::date AND $1::date + $2::int AND NOT (o.date = $1::date AND o.end_hour <= $3)
      ORDER BY o.date, o.start_hour, c.sort, c.id LIMIT $4`,
    [today, cfg.bookingWindowDays, hour, limit]
  );
  return rows.map(toPublic);
}

