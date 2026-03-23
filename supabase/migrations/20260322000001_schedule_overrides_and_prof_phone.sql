-- VBS-111: Schedule overrides for variable weekly hours + professional phone

-- 1a. Schedule overrides table
CREATE TABLE professional_schedule_overrides (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid        NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  override_date   date        NOT NULL,
  start_time      time,
  end_time        time,
  is_working      boolean     NOT NULL DEFAULT true,
  reason          text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (professional_id, override_date),
  CHECK (is_working = false OR (start_time IS NOT NULL AND end_time IS NOT NULL))
);

CREATE INDEX schedule_overrides_prof_date_idx
  ON professional_schedule_overrides (professional_id, override_date);

ALTER TABLE professional_schedule_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all_schedule_overrides"
  ON professional_schedule_overrides FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 1b. Add phone to professionals
ALTER TABLE professionals ADD COLUMN phone text;
