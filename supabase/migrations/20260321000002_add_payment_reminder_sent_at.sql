-- VBS-84: Add payment_reminder_sent_at to bookings to track reminder sends and avoid duplicates
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_reminder_sent_at timestamptz;
