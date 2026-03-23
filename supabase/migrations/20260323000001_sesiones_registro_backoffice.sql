-- Sesiones backoffice: drop unique constraint, add booking_id and professional_id columns

-- Drop the unique constraint that prevents legitimate duplicate sessions
DROP INDEX IF EXISTS sh_unique_session_idx;

-- Add booking_id to link sessions created from confirming a booking
ALTER TABLE sesiones_historicas
  ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL;

-- Add professional_id as optional structured reference alongside the TEXT operadora field
ALTER TABLE sesiones_historicas
  ADD COLUMN IF NOT EXISTS professional_id UUID REFERENCES professionals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS sh_booking_id_idx ON sesiones_historicas (booking_id);
CREATE INDEX IF NOT EXISTS sh_professional_id_idx ON sesiones_historicas (professional_id);
