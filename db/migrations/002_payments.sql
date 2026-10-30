-- Payment ledger: every peso the club receives, however it arrived (GCash, cash, bank).
-- A booking's paid amount is the sum of its payments; status follows from paid vs total.
CREATE TABLE IF NOT EXISTS payments (
  id           serial PRIMARY KEY,
  booking_id   uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount       numeric(10,2) NOT NULL CHECK (amount > 0),
  method       text NOT NULL CHECK (method IN ('gcash','cash','bank','other')),
  reference    text,
  note         text,
  received_at  timestamptz NOT NULL DEFAULT now(),
  recorded_by  text NOT NULL
);
CREATE INDEX IF NOT EXISTS payments_booking_idx ON payments(booking_id);

-- online = guest booked on the website; admin = entered by staff (phone, Messenger, walk-in)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'online';

-- Backfill what earlier confirmations implied: full total for confirmed, the deposit for balance_due.
INSERT INTO payments (booking_id, amount, method, recorded_by, received_at, note)
SELECT b.id,
       CASE WHEN b.status = 'confirmed' THEN b.total ELSE round(b.total * coalesce(b.partial_percent, 0) / 100.0) END,
       'gcash', coalesce(b.confirmed_by, 'system'), coalesce(b.confirmed_at, b.updated_at), 'Recorded from receipt before payment tracking'
FROM bookings b
WHERE b.status IN ('confirmed', 'balance_due')
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.booking_id = b.id)
  AND (CASE WHEN b.status = 'confirmed' THEN b.total ELSE round(b.total * coalesce(b.partial_percent, 0) / 100.0) END) > 0;
