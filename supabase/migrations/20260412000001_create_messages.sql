-- VBS-155: Message log for all WhatsApp inbound/outbound messages

CREATE TABLE messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_message_id   text        UNIQUE,
  phone           text        NOT NULL,
  client_id       uuid        REFERENCES clients(id) ON DELETE SET NULL,
  direction       text        NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type    text        NOT NULL CHECK (message_type IN ('text', 'interactive', 'template', 'image', 'list')),
  body            text,
  source          text        NOT NULL CHECK (source IN (
    'bot', 'campaign', 'cron_reminder', 'cron_survey', 'cron_payment',
    'cron_next_session', 'admin_manual', 'admin_notification', 'client'
  )),
  status          text        NOT NULL DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  error_message   text,
  admin_read_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Conversation thread queries (inbox)
CREATE INDEX messages_phone_created_idx ON messages (phone, created_at DESC);

-- Delivery status updates by wa_message_id
CREATE INDEX messages_wa_message_id_idx ON messages (wa_message_id) WHERE wa_message_id IS NOT NULL;

-- Client lookup
CREATE INDEX messages_client_id_idx ON messages (client_id) WHERE client_id IS NOT NULL;

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all_messages"
  ON messages
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
