INSERT INTO system_config (key, value) VALUES
  ('session_retention_days', '30'),
  ('message_retention_days', '90')
ON CONFLICT DO NOTHING;
