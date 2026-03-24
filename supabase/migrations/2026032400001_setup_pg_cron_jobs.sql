-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Helper function: call an internal API endpoint via pg_net
-- Reads app.vercel_url and app.cron_secret from database GUC params.
-- Configure them once with:
--   ALTER DATABASE postgres SET app.vercel_url = 'https://vaig-booking-system.vercel.app';
--   ALTER DATABASE postgres SET app.cron_secret = '<CRON_SECRET>';
CREATE OR REPLACE FUNCTION call_internal_api(endpoint text)
RETURNS void AS $$
BEGIN
  PERFORM net.http_post(
    url     := current_setting('app.vercel_url') || endpoint,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.cron_secret'),
      'Content-Type',  'application/json'
    ),
    body    := '{}'::jsonb
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Keepalive: every 3 days at 08:00 UTC
SELECT cron.schedule(
  'keepalive',
  '0 8 */3 * *',
  $$SELECT call_internal_api('/api/internal/keepalive')$$
);

-- Auto-cancel: daily at 08:00 UTC
SELECT cron.schedule(
  'auto-cancel',
  '0 8 * * *',
  $$SELECT call_internal_api('/api/internal/auto-cancel')$$
);

-- Reminder: daily at 00:00 UTC (21:00 ART)
SELECT cron.schedule(
  'reminder',
  '0 0 * * *',
  $$SELECT call_internal_api('/api/internal/reminder')$$
);

-- Survey: daily at 22:00 UTC
SELECT cron.schedule(
  'survey',
  '0 22 * * *',
  $$SELECT call_internal_api('/api/internal/survey')$$
);

-- Next session suggestion: Mondays at 10:00 UTC
SELECT cron.schedule(
  'next-session',
  '0 10 * * 1',
  $$SELECT call_internal_api('/api/internal/next-session')$$
);

-- Payment reminder: daily at 14:00 UTC (11:00 ART)
SELECT cron.schedule(
  'payment-reminder',
  '0 14 * * *',
  $$SELECT call_internal_api('/api/internal/payment-reminder')$$
);

-- Campaigns polling: every minute — endpoint checks scheduled_at <= now()
SELECT cron.schedule(
  'campaigns-check',
  '* * * * *',
  $$SELECT call_internal_api('/api/internal/campaigns')$$
);
