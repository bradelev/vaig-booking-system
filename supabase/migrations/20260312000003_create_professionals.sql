-- Professionals table

CREATE TABLE professionals (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text        NOT NULL,
  google_calendar_id  text,
  is_active           boolean     NOT NULL DEFAULT true,
  specialties         text[],
  location_id         uuid,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX professionals_is_active_idx  ON professionals (is_active);
CREATE INDEX professionals_location_id_idx ON professionals (location_id);

ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;
