-- Booking status log table

CREATE TABLE booking_status_log (
  id         uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid           NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
  old_status booking_status,
  new_status booking_status NOT NULL,
  changed_by uuid,
  changed_at timestamptz    NOT NULL DEFAULT now(),
  note       text
);

CREATE INDEX booking_status_log_booking_id_idx ON booking_status_log (booking_id);
CREATE INDEX booking_status_log_changed_at_idx ON booking_status_log (changed_at);

ALTER TABLE booking_status_log ENABLE ROW LEVEL SECURITY;
