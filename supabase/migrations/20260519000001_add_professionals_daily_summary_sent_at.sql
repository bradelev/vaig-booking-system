ALTER TABLE professionals ADD COLUMN daily_summary_sent_at date;

COMMENT ON COLUMN professionals.daily_summary_sent_at IS 'Last date a daily booking summary was sent to this professional via the reminder cron. Used for idempotency — prevents duplicate summaries if the cron runs more than once in a day.';
