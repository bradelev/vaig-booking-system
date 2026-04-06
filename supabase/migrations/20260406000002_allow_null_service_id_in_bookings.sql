-- Allow null service_id in bookings to support imports from external systems
-- where the service cannot be matched to a VAIG service
ALTER TABLE bookings ALTER COLUMN service_id DROP NOT NULL;
