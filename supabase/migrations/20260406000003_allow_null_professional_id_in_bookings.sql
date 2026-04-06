-- Allow null professional_id in bookings to support imports from external systems
-- where the worker cannot be matched to a VAIG professional
ALTER TABLE bookings ALTER COLUMN professional_id DROP NOT NULL;
