-- VBS-71: Track rescheduling chain

ALTER TABLE bookings ADD COLUMN rescheduled_from uuid REFERENCES bookings (id) ON DELETE SET NULL;
