-- Seed admin_phone and rate limiting defaults into system_config
INSERT INTO system_config (key, value) VALUES
  ('admin_phone', '59891374904'),
  ('rate_limit_window_minutes', '60'),
  ('rate_limit_max_messages', '30')
ON CONFLICT (key) DO NOTHING;
