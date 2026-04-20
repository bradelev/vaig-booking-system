-- VBS-194: Add 'admin_reminder' to messages.source CHECK constraint.
-- The TS type MessageSource already includes it (src/lib/whatsapp/log.ts),
-- but the DB constraint rejected inserts from the recordatorios admin flow
-- added in VBS-172, causing silent log failures that masked delivery issues
-- (phantom "sent" status in the UI with no row in messages and no WA delivery).

ALTER TABLE messages DROP CONSTRAINT messages_source_check;

ALTER TABLE messages ADD CONSTRAINT messages_source_check
  CHECK (source IN (
    'bot',
    'campaign',
    'cron_reminder',
    'cron_survey',
    'cron_payment',
    'cron_next_session',
    'admin_manual',
    'admin_notification',
    'admin_reminder',
    'client'
  ));
