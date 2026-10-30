-- Chateau Katriannah Pickleball Club — initial schema
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS courts (
  id          serial PRIMARY KEY,
  name        text NOT NULL,
  kind        text NOT NULL DEFAULT 'outdoor',   -- outdoor | indoor
  available   boolean NOT NULL DEFAULT true,
  sort        int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rate_bands (
  id          serial PRIMARY KEY,
  name        text NOT NULL,
  start_hour  int NOT NULL CHECK (start_hour BETWEEN 0 AND 23),
  end_hour    int NOT NULL CHECK (end_hour BETWEEN 1 AND 24),   -- 24 = midnight
  price       numeric(10,2) NOT NULL,
  days        int[] NOT NULL DEFAULT '{}',                       -- 0=Sun..6=Sat, empty = every day
  sort        int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS equipment (
  id              serial PRIMARY KEY,
  slug            text UNIQUE NOT NULL,
  name            text NOT NULL,
  unit            text NOT NULL DEFAULT 'unit',
  price           numeric(10,2) NOT NULL DEFAULT 0,
  inventory_total int NOT NULL DEFAULT 0,
  active          boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS equipment_walkin_usage (
  date          date NOT NULL,
  equipment_id  int NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  hour          int NOT NULL,
  qty           int NOT NULL DEFAULT 0,
  PRIMARY KEY (date, equipment_id, hour)
);

CREATE TABLE IF NOT EXISTS bookings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  confirmation_id   text UNIQUE NOT NULL,
  guest_name        text NOT NULL,
  guest_email       text,
  guest_phone       text NOT NULL,
  status            text NOT NULL CHECK (status IN
                      ('awaiting_payment','pending','confirmed','balance_due','declined','cancelled','expired')),
  subtotal          numeric(10,2) NOT NULL DEFAULT 0,
  equipment_total   numeric(10,2) NOT NULL DEFAULT 0,
  booking_fee       numeric(10,2) NOT NULL DEFAULT 0,
  total             numeric(10,2) NOT NULL DEFAULT 0,
  partial_payment   boolean NOT NULL DEFAULT false,
  partial_percent   int,
  receipt_path      text,
  admin_note        text,
  hold_expires_at   timestamptz,
  submitted_at      timestamptz,
  confirmed_at      timestamptz,
  confirmed_by      text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings(status);
CREATE INDEX IF NOT EXISTS bookings_guest_name_idx ON bookings(guest_name);

CREATE TABLE IF NOT EXISTS booking_slots (
  id          serial PRIMARY KEY,
  booking_id  uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  court_id    int NOT NULL REFERENCES courts(id),
  date        date NOT NULL,
  hour        int NOT NULL CHECK (hour BETWEEN 0 AND 23),
  price       numeric(10,2) NOT NULL,
  UNIQUE (court_id, date, hour)            -- the double-booking lock
);
CREATE INDEX IF NOT EXISTS booking_slots_date_idx ON booking_slots(date);

CREATE TABLE IF NOT EXISTS booking_equipment (
  booking_id    uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  equipment_id  int NOT NULL REFERENCES equipment(id),
  qty           int NOT NULL,
  unit_price    numeric(10,2) NOT NULL,
  PRIMARY KEY (booking_id, equipment_id)
);

CREATE TABLE IF NOT EXISTS slot_overrides (
  id        serial PRIMARY KEY,
  court_id  int NOT NULL REFERENCES courts(id),
  date      date NOT NULL,
  hour      int NOT NULL,
  kind      text NOT NULL CHECK (kind IN ('closed','open_play','promo')),
  reason    text,
  ref_id    int,
  UNIQUE (court_id, date, hour)
);

CREATE TABLE IF NOT EXISTS promos (
  id         serial PRIMARY KEY,
  name       text NOT NULL,
  price      numeric(10,2) NOT NULL,
  date_from  date NOT NULL,
  date_to    date NOT NULL,
  hour_from  int NOT NULL,
  hour_to    int NOT NULL,
  court_ids  int[] NOT NULL DEFAULT '{}',
  active     boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS open_play_sessions (
  id               serial PRIMARY KEY,
  court_id         int NOT NULL REFERENCES courts(id),
  date             date NOT NULL,
  start_hour       int NOT NULL,
  end_hour         int NOT NULL,
  price_per_player numeric(10,2) NOT NULL,
  capacity         int NOT NULL DEFAULT 8,
  note             text,
  status           text NOT NULL DEFAULT 'open'
);

CREATE TABLE IF NOT EXISTS admin_users (
  id            serial PRIMARY KEY,
  email         text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role          text NOT NULL DEFAULT 'admin',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id           bigserial PRIMARY KEY,
  actor        text NOT NULL,
  action_type  text NOT NULL,
  entity_type  text NOT NULL,
  entity_id    text,
  payload      jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log(created_at DESC);

CREATE TABLE IF NOT EXISTS error_logs (
  id          bigserial PRIMARY KEY,
  kind        text NOT NULL,
  message     text,
  stack       text,
  url         text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  name        text PRIMARY KEY,
  applied_at  timestamptz NOT NULL DEFAULT now()
);
