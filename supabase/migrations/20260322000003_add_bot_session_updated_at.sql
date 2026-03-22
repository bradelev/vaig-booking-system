-- Add updated_at to conversation_sessions for session timeout detection

ALTER TABLE conversation_sessions
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill existing rows so updated_at reflects real activity
UPDATE conversation_sessions SET updated_at = last_message_at WHERE updated_at = now();

-- Trigger to auto-update updated_at on every row update
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_conversation_sessions_updated_at ON conversation_sessions;
CREATE TRIGGER update_conversation_sessions_updated_at
  BEFORE UPDATE ON conversation_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed bot session timeout config (default: 30 minutes)
INSERT INTO system_config (key, value)
VALUES ('bot_session_timeout_minutes', '30')
ON CONFLICT (key) DO NOTHING;
