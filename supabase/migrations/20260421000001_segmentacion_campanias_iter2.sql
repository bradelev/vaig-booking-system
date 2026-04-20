-- Index for efficient cooldown lookups (client's most recent campaign send)
-- Used by filterSegmentationClients to exclude recently-contacted clients
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_client_sent
  ON campaign_recipients (client_id, sent_at DESC NULLS LAST)
  WHERE sent_at IS NOT NULL;

-- Notes column for campaigns (operator notes, not sent to client)
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS notes text;
