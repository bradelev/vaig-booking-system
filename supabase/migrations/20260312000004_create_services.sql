-- Services table

CREATE TABLE services (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    text        NOT NULL,
  description             text,
  duration_minutes        integer     NOT NULL,
  price                   numeric     NOT NULL,
  deposit_amount          numeric     NOT NULL,
  default_professional_id uuid        REFERENCES professionals (id) ON DELETE SET NULL,
  is_active               boolean     NOT NULL DEFAULT true,
  location_id             uuid,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX services_is_active_idx             ON services (is_active);
CREATE INDEX services_default_professional_id_idx ON services (default_professional_id);
CREATE INDEX services_location_id_idx           ON services (location_id);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;
