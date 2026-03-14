-- =============================================================================
-- VBS-64: Trigger to populate service_audit_log when services are updated
-- VBS-65: Trigger to populate booking_status_log when booking status changes
-- =============================================================================

-- -----------------------------------------------------------------------
-- VBS-64: Service audit log trigger
-- Fires on UPDATE to services table, logs each changed field
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_service_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  editor_id uuid;
BEGIN
  -- Use auth.uid() if available (authenticated context), else sentinel UUID
  editor_id := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);

  IF OLD.name IS DISTINCT FROM NEW.name THEN
    INSERT INTO service_audit_log (service_id, edited_by, field_changed, old_value, new_value)
    VALUES (NEW.id, editor_id, 'name', OLD.name, NEW.name);
  END IF;

  IF OLD.description IS DISTINCT FROM NEW.description THEN
    INSERT INTO service_audit_log (service_id, edited_by, field_changed, old_value, new_value)
    VALUES (NEW.id, editor_id, 'description', OLD.description, NEW.description);
  END IF;

  IF OLD.duration_minutes IS DISTINCT FROM NEW.duration_minutes THEN
    INSERT INTO service_audit_log (service_id, edited_by, field_changed, old_value, new_value)
    VALUES (NEW.id, editor_id, 'duration_minutes', OLD.duration_minutes::text, NEW.duration_minutes::text);
  END IF;

  IF OLD.price IS DISTINCT FROM NEW.price THEN
    INSERT INTO service_audit_log (service_id, edited_by, field_changed, old_value, new_value)
    VALUES (NEW.id, editor_id, 'price', OLD.price::text, NEW.price::text);
  END IF;

  IF OLD.deposit_amount IS DISTINCT FROM NEW.deposit_amount THEN
    INSERT INTO service_audit_log (service_id, edited_by, field_changed, old_value, new_value)
    VALUES (NEW.id, editor_id, 'deposit_amount', OLD.deposit_amount::text, NEW.deposit_amount::text);
  END IF;

  IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
    INSERT INTO service_audit_log (service_id, edited_by, field_changed, old_value, new_value)
    VALUES (NEW.id, editor_id, 'is_active', OLD.is_active::text, NEW.is_active::text);
  END IF;

  IF OLD.default_professional_id IS DISTINCT FROM NEW.default_professional_id THEN
    INSERT INTO service_audit_log (service_id, edited_by, field_changed, old_value, new_value)
    VALUES (NEW.id, editor_id, 'default_professional_id', OLD.default_professional_id::text, NEW.default_professional_id::text);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER services_audit_trigger
  AFTER UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION log_service_changes();

-- -----------------------------------------------------------------------
-- VBS-65: Booking status log trigger
-- Fires on INSERT or UPDATE to bookings when status changes
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_booking_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- On INSERT, always log initial status
  IF TG_OP = 'INSERT' THEN
    INSERT INTO booking_status_log (booking_id, old_status, new_status, changed_by)
    VALUES (NEW.id, NULL, NEW.status, auth.uid());
    RETURN NEW;
  END IF;

  -- On UPDATE, only log if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO booking_status_log (booking_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER bookings_status_log_trigger
  AFTER INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION log_booking_status_change();
