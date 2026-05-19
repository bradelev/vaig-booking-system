-- Reschedule reminder pg_cron job from 00:00 UTC to 12:00 UTC (= 9 AM Montevideo/UYT).
-- VBS-232 briefly registered this cron in vercel.json (free plan allows only one Vercel
-- cron); this migration restores pg_cron as the sole scheduler and fixes the time.
DO $$
BEGIN
  PERFORM cron.unschedule('reminder');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'reminder',
  '0 12 * * *',
  $$SELECT call_internal_api('/api/internal/reminder')$$
);
