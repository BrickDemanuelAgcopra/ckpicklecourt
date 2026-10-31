import { query } from "./db";
import { getConfig } from "./config";
import { getBooking } from "./bookings";
import { emailEnabled, sendBookingEmail, sendMail, siteUrl } from "./email";
import { money } from "./format";
import { addDaysISO, clubParts, hourLabel, longDate, todayISO } from "./time";

// Club-time hours at which each job starts going out (it keeps trying each minute until sent).
const SUMMARY_HOUR = 7; // owner's daily summary
const REMINDER_HOUR = 17; // guests playing tomorrow

const LIVE = ["confirmed", "balance_due"];

/** Marks a scheduled email as sent before sending, so two cron ticks can't both send it. */
async function claim(kind: string, ref: string): Promise<boolean> {
  const r = await query("INSERT INTO email_log(kind, ref) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING ref", [kind, ref]);
  return r.length > 0;
}
async function release(kind: string, ref: string) {
  await query("DELETE FROM email_log WHERE kind=$1 AND ref=$2", [kind, ref]);
}

/** Called every minute from the cron route. Cheap when there is nothing to send. */
export async function runScheduledEmails(): Promise<{ reminders: number; summary: boolean }> {
  const out = { reminders: 0, summary: false };
  if (!(await emailEnabled())) return out;
  const hour = clubParts().hour;
  const today = todayISO();

  if (hour >= REMINDER_HOUR) {
    // Skip bookings confirmed after the reminder hour today: their confirmation email just went out.
    const due = await query<{ id: string }>(
      `SELECT b.id FROM bookings b
        WHERE b.status = ANY($1) AND coalesce(b.guest_email,'') <> ''
          AND (SELECT min(date) FROM booking_slots WHERE booking_id=b.id) = $2::date
          AND (b.confirmed_at IS NULL OR b.confirmed_at < ($3::date + make_interval(hours => $4)) AT TIME ZONE 'Asia/Manila')
          AND NOT EXISTS (SELECT 1 FROM email_log l WHERE l.kind='reminder' AND l.ref=b.id::text)`,
      [LIVE, addDaysISO(today, 1), today, REMINDER_HOUR]
    );
    for (const { id } of due) {
      if (!(await claim("reminder", id))) continue;
      const b = await getBooking(id);
      if (b && (await sendBookingEmail("reminder", b))) out.reminders++;
      else await release("reminder", id);
    }
  }

  if (hour >= SUMMARY_HOUR) {
    const cfg = await getConfig();
    if (cfg.adminEmail && (await claim("daily_summary", today))) {
      const { subject, text } = await buildDailySummary(today);
      out.summary = await sendMail(cfg.adminEmail, subject, text);
      if (!out.summary) await release("daily_summary", today);
    }
  }
  return out;
}

export async function buildDailySummary(today: string): Promise<{ subject: string; text: string }> {
  const cfg = await getConfig();
  const sym = cfg.currencySymbol;
  const yesterday = addDaysISO(today, -1);

  const [slots, pending, balances, played, received, next7] = await Promise.all([
    query<{ id: string; court: string; hour: number; guest_name: string; guest_phone: string; total: string; paid: string }>(
      `SELECT b.id, c.name AS court, s.hour, b.guest_name, b.guest_phone, b.total,
              coalesce((SELECT sum(amount) FROM payments p WHERE p.booking_id=b.id),0) AS paid
         FROM booking_slots s JOIN bookings b ON b.id=s.booking_id JOIN courts c ON c.id=s.court_id
        WHERE s.date=$1 AND b.status = ANY($2) ORDER BY c.sort, c.id, s.hour`,
      [today, LIVE]
    ),
    query<{ n: string; v: string }>("SELECT count(*) AS n, coalesce(sum(total),0) AS v FROM bookings WHERE status='pending'"),
    query<{ n: string; v: string }>(
      `SELECT count(*) AS n, coalesce(sum(greatest(total - coalesce((SELECT sum(amount) FROM payments p WHERE p.booking_id=b.id),0),0)),0) AS v
         FROM bookings b WHERE status='balance_due'`
    ),
    query<{ n: string; v: string }>(
      `SELECT count(*) AS n, coalesce(sum(total),0) AS v FROM bookings b
        WHERE status = ANY($2) AND (SELECT min(date) FROM booking_slots WHERE booking_id=b.id) = $1::date`,
      [yesterday, LIVE]
    ),
    query<{ v: string }>("SELECT coalesce(sum(amount),0) AS v FROM payments WHERE (received_at AT TIME ZONE 'Asia/Manila')::date = $1::date", [yesterday]),
    query<{ n: string }>(
      `SELECT count(*) AS n FROM booking_slots s JOIN bookings b ON b.id=s.booking_id
        WHERE b.status = ANY($3) AND s.date BETWEEN $1::date AND $2::date`,
      [today, addDaysISO(today, 6), LIVE]
    ),
  ]);

  // Merge back-to-back hours of the same booking on the same court into one line.
  const lines: string[] = [];
  let todayValue = 0;
  const seen = new Set<string>();
  for (let i = 0; i < slots.length; ) {
    const s = slots[i];
    let end = s.hour + 1;
    let j = i + 1;
    while (j < slots.length && slots[j].id === s.id && slots[j].court === s.court && slots[j].hour === end) end = slots[j++].hour + 1;
    const due = Math.max(Number(s.total) - Number(s.paid), 0);
    lines.push(`  ${s.court}  ${hourLabel(s.hour)} – ${hourLabel(end)}  ${s.guest_name} (${s.guest_phone})  ${due > 0 ? `${money(due, sym)} to collect` : "paid"}`);
    if (!seen.has(s.id)) {
      seen.add(s.id);
      todayValue += Number(s.total);
    }
    i = j;
  }

  const p = pending[0];
  const bal = balances[0];
  const y = played[0];
  const text =
    `Good morning! Here's ${cfg.courtName} for ${longDate(today)}.\n\n` +
    `TODAY: ${slots.length} court-hour${slots.length === 1 ? "" : "s"} booked, ${money(todayValue, sym)}\n` +
    (lines.length ? lines.join("\n") : "  No bookings yet.") +
    `\n\nNEEDS YOUR ATTENTION\n` +
    `  Receipts waiting for review: ${p.n}${Number(p.n) ? ` (${money(p.v, sym)})` : ""}\n` +
    `  Balances to collect: ${money(bal.v, sym)} across ${bal.n} booking${bal.n === "1" ? "" : "s"}\n\n` +
    `YESTERDAY (${longDate(yesterday)})\n` +
    `  ${y.n} booking${y.n === "1" ? "" : "s"} played, ${money(y.v, sym)} revenue\n` +
    `  ${money(received[0].v, sym)} payments received\n\n` +
    `NEXT 7 DAYS: ${next7[0].n} court-hours booked\n\n` +
    `Review bookings: ${siteUrl()}/admin/bookings\nAnalytics: ${siteUrl()}/admin/analytics\n`;
  const subject = `${cfg.courtName} today: ${slots.length} hr${slots.length === 1 ? "" : "s"} booked${Number(p.n) ? `, ${p.n} to review` : ""}`;
  return { subject, text };
}
