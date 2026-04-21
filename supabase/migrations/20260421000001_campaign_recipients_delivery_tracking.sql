-- VBS-198: Track per-recipient delivery status and link to WhatsApp message id.
-- Allows webhook reconciliation of campaign sent_count / failed_count after delivery.
ALTER TABLE campaign_recipients
  ADD COLUMN wa_message_id text,
  ADD COLUMN status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  ADD COLUMN error_code integer,
  ADD COLUMN delivered_at timestamptz,
  ADD COLUMN read_at timestamptz;

-- Partial index: only rows that have been sent will ever need lookup by wa_message_id.
CREATE INDEX campaign_recipients_wa_message_id_idx
  ON campaign_recipients(wa_message_id)
  WHERE wa_message_id IS NOT NULL;
