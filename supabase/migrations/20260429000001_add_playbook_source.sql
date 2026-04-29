-- VBS cross-repo dep of VPB-30: allow 'playbook' as messages.source
-- This MUST be applied before the vaig-playbook WA send feature is enabled,
-- otherwise inserts with source='playbook' will fail with constraint 23514.
ALTER TABLE messages DROP CONSTRAINT messages_source_check;
ALTER TABLE messages ADD CONSTRAINT messages_source_check
  CHECK (source IN (
    'bot','campaign','cron_reminder','cron_survey','cron_payment',
    'cron_next_session','admin_manual','admin_notification',
    'admin_reminder','playbook','client'
  ));
