-- Seed messaging toggle keys into system_config.
-- Default: "off" (safe — no messages sent to real clients until explicitly enabled).
INSERT INTO system_config (key, value, updated_at) VALUES
  ('messaging_reminder',           'off', now()),
  ('messaging_survey',             'off', now()),
  ('messaging_payment_reminder',   'off', now()),
  ('messaging_next_session',       'off', now()),
  ('messaging_cancel_notification','off', now()),
  ('messaging_pack_notification',  'off', now()),
  ('messaging_waitlist',           'off', now())
ON CONFLICT (key) DO NOTHING;
