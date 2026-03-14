-- updated_at trigger function (shared)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Bookings table

CREATE TABLE bookings (
  id                    uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             uuid               NOT NULL REFERENCES clients (id) ON DELETE RESTRICT,
  service_id            uuid               NOT NULL REFERENCES services (id) ON DELETE RESTRICT,
  professional_id       uuid               NOT NULL REFERENCES professionals (id) ON DELETE RESTRICT,
  scheduled_at          timestamptz        NOT NULL,
  status                booking_status     NOT NULL DEFAULT 'pending',
  deposit_paid_at       timestamptz,
  gcal_event_id         text,
  confirmation_sent_at  timestamptz,
  client_confirmed_at   timestamptz,
  survey_sent_at        timestamptz,
  survey_response       jsonb,
  notes                 text,
  cancellation_reason   cancellation_reason,
  cancellation_note     text,
  cancelled_by          cancelled_by_type,
  client_package_id     uuid,
  created_at            timestamptz        NOT NULL DEFAULT now(),
  updated_at            timestamptz        NOT NULL DEFAULT now()
);

CREATE INDEX bookings_status_idx                      ON bookings (status);
CREATE INDEX bookings_scheduled_at_idx                ON bookings (scheduled_at);
CREATE INDEX bookings_professional_id_idx             ON bookings (professional_id);
CREATE INDEX bookings_client_id_idx                   ON bookings (client_id);
CREATE INDEX bookings_professional_scheduled_at_idx   ON bookings (professional_id, scheduled_at);

CREATE TRIGGER bookings_set_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
