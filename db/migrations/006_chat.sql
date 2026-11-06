-- Website chat: guests write from the homepage, staff answer by replying in Telegram.
CREATE TABLE IF NOT EXISTS chat_threads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),   -- also the guest's access key (kept in their browser)
  guest_name  text NOT NULL,
  contact     text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id          bigserial PRIMARY KEY,
  thread_id   uuid NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  sender      text NOT NULL CHECK (sender IN ('guest','staff')),
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_messages_thread_idx ON chat_messages(thread_id, id);

-- Which Telegram message belongs to which thread, so a staff reply finds its way back.
CREATE TABLE IF NOT EXISTS chat_tg_messages (
  chat_id     text NOT NULL,
  message_id  bigint NOT NULL,
  thread_id   uuid NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  PRIMARY KEY (chat_id, message_id)
);
