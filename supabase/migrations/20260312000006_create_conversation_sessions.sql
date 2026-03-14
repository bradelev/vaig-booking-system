-- Conversation sessions table (WhatsApp chatbot state)

CREATE TABLE conversation_sessions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone           text        NOT NULL,
  state           text        NOT NULL,
  context_json    jsonb,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX conversation_sessions_phone_idx           ON conversation_sessions (phone);
CREATE INDEX conversation_sessions_last_message_at_idx ON conversation_sessions (last_message_at);

ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;
