-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Seed system_config with the two values needed by pg_cron.
-- Update them via Supabase Dashboard → Table Editor → system_config,
-- or with SQL:
--   UPDATE system_config SET value = 'https://vaig-booking-system.vercel.app' WHERE key = 'vercel_url';
--   UPDATE system_config SET value = '<CRON_SECRET>'                          WHERE key = 'cron_secret';
INSERT INTO system_config (key, value)
VALUES
  ('vercel_url',   'https://vaig-booking-system.vercel.app'),
  ('cron_secret',  '')
ON CONFLICT (key) DO NOTHING;

-- Helper function: call an internal API endpoint via pg_net.
-- Reads vercel_url and cron_secret from the system_config table.
CREATE OR REPLACE FUNCTION call_internal_api(endpoint text)
RETURNS void AS $$
DECLARE
  v_url    text;
  v_secret text;
BEGIN
  SELECT value INTO v_url    FROM system_config WHERE key = 'vercel_url';
  SELECT value INTO v_secret FROM system_config WHERE key = 'cron_secret';

  PERFORM net.http_get(
    url     := v_url || endpoint,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret
    )
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
