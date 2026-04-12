-- VBS-156: Add human handoff state to conversation_sessions

ALTER TABLE conversation_sessions
  ADD COLUMN IF NOT EXISTS handoff_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS handoff_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_inbound_at timestamptz;

CREATE INDEX conversation_sessions_handoff_idx
  ON conversation_sessions (handoff_active) WHERE handoff_active = true;
