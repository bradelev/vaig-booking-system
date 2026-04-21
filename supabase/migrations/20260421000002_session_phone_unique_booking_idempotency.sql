-- VBS-201: Fix session race condition, add clients.phone index, booking idempotency.

-- 1. conversation_sessions: promote the existing regular index to a UNIQUE constraint.
--    Remove duplicate sessions first (keep the most recent by id for each phone).
DELETE FROM conversation_sessions
WHERE id NOT IN (
  SELECT DISTINCT ON (phone) id
  FROM conversation_sessions
  ORDER BY phone, id DESC
);

DROP INDEX IF EXISTS conversation_sessions_phone_idx;

ALTER TABLE conversation_sessions
  ADD CONSTRAINT conversation_sessions_phone_key UNIQUE (phone);

-- 2. clients.phone: the column is already UNIQUE (which creates an implicit index),
--    but add an explicit named index so the planner can use it for phone-equality
--    lookups without relying on the constraint name.
CREATE INDEX IF NOT EXISTS clients_phone_idx ON clients (phone);

-- 3. bookings: add trigger_message_id for webhook idempotency.
--    On Meta retry, the same wa_message_id arrives again — the UNIQUE constraint
--    makes the duplicate INSERT fail with 23505, which the bot ignores silently.
ALTER TABLE bookings
  ADD COLUMN trigger_message_id text;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_trigger_message_id_idx
  ON bookings (trigger_message_id)
  WHERE trigger_message_id IS NOT NULL;
