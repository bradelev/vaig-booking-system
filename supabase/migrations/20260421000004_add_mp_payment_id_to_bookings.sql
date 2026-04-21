ALTER TABLE bookings ADD COLUMN IF NOT EXISTS mp_payment_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_mp_payment_id_idx
  ON bookings (mp_payment_id)
  WHERE mp_payment_id IS NOT NULL;
