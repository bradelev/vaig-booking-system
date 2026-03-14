-- Client packages table

CREATE TABLE client_packages (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         uuid        NOT NULL REFERENCES clients (id) ON DELETE RESTRICT,
  package_id        uuid        NOT NULL REFERENCES service_packages (id) ON DELETE RESTRICT,
  sessions_total    integer     NOT NULL,
  sessions_used     integer     NOT NULL DEFAULT 0,
  paid_at           timestamptz,
  payment_reference text,
  expires_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX client_packages_client_id_idx              ON client_packages (client_id);
CREATE INDEX client_packages_package_id_idx             ON client_packages (package_id);
CREATE INDEX client_packages_client_sessions_used_idx   ON client_packages (client_id, sessions_used);

-- Add FK from bookings.client_package_id now that client_packages exists
ALTER TABLE bookings
  ADD CONSTRAINT bookings_client_package_id_fkey
  FOREIGN KEY (client_package_id) REFERENCES client_packages (id) ON DELETE SET NULL;

ALTER TABLE client_packages ENABLE ROW LEVEL SECURITY;
