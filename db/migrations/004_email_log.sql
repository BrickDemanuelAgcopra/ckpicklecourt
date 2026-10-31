-- Scheduled emails already sent (day-before reminders, the owner's daily summary), so each goes out once.
CREATE TABLE IF NOT EXISTS email_log (
  kind     text NOT NULL,          -- reminder | daily_summary
  ref      text NOT NULL,          -- booking id, or the date for the summary
  sent_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, ref)
);
