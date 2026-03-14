-- Payments table

CREATE TABLE payments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   uuid        NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
  amount       numeric     NOT NULL,
  method       text        NOT NULL,
  reference    text,
  confirmed_at timestamptz,
  confirmed_by text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX payments_booking_id_idx ON payments (booking_id);
CREATE INDEX payments_reference_idx  ON payments (reference);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
