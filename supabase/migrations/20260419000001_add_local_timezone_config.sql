-- Seed local_timezone system_config key (default: America/Montevideo / UYT)
INSERT INTO system_config (key, value)
VALUES ('local_timezone', 'America/Montevideo')
ON CONFLICT (key) DO NOTHING;
