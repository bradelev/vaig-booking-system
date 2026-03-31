-- Add koobing_appointment_id to bookings for deduplication during import
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS koobing_appointment_id integer;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_koobing_appointment_id_unique
  ON bookings (koobing_appointment_id)
  WHERE koobing_appointment_id IS NOT NULL;
