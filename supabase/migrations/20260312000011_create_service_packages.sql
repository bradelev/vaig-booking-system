-- Service packages table

CREATE TABLE service_packages (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id    uuid        NOT NULL REFERENCES services (id) ON DELETE RESTRICT,
  name          text        NOT NULL,
  session_count integer     NOT NULL,
  price         numeric     NOT NULL,
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX service_packages_service_id_idx ON service_packages (service_id);
CREATE INDEX service_packages_is_active_idx  ON service_packages (is_active);

ALTER TABLE service_packages ENABLE ROW LEVEL SECURITY;
