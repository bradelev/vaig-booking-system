-- Add source column to bookings and clients for tracking import origin
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS source text;
