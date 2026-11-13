-- Open Play: players join a session per head instead of renting a whole court.
-- A join is an ordinary booking (same checkout, receipt review, payments and emails)
-- that points at a session and holds no court hours of its own.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS open_play_session_id int REFERENCES open_play_sessions(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS players int CHECK (players IS NULL OR players > 0);
CREATE INDEX IF NOT EXISTS bookings_open_play_idx ON bookings(open_play_session_id) WHERE open_play_session_id IS NOT NULL;

ALTER TABLE open_play_sessions ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE open_play_sessions ADD COLUMN IF NOT EXISTS created_by text;
CREATE INDEX IF NOT EXISTS open_play_sessions_date_idx ON open_play_sessions(date);
