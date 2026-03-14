-- Professional weekly schedule
-- One row per professional per day-of-week (0=Sun, 1=Mon ... 6=Sat)
CREATE TABLE professional_schedule (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid    NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  day_of_week     int     NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time      time    NOT NULL,
  end_time        time    NOT NULL,
  is_working      boolean NOT NULL DEFAULT true,
  UNIQUE (professional_id, day_of_week)
);

CREATE INDEX professional_schedule_professional_idx ON professional_schedule (professional_id);

ALTER TABLE professional_schedule ENABLE ROW LEVEL SECURITY;

-- System-wide configuration key-value store
CREATE TABLE system_config (
  key         text PRIMARY KEY,
  value       text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Default config values
INSERT INTO system_config (key, value) VALUES
  ('auto_cancel_hours',   '24'),
  ('buffer_minutes',      '0'),
  ('cbu',                 ''),
  ('cbu_alias',           ''),
  ('mp_enabled',          'false'),
  ('business_name',       'VAIG'),
  ('timezone',            'America/Argentina/Buenos_Aires');
