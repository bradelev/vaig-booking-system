-- =============================================================================
-- RLS Policies for VAIG Booking System
-- All server-side access uses service_role (bypasses RLS automatically).
-- These policies cover authenticated admin access from the backoffice.
-- =============================================================================

-- Helper: check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT (auth.jwt() ->> 'role')::text = 'admin'
     OR (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin'
     OR (auth.jwt() -> 'user_metadata' ->> 'role')::text = 'admin';
$$;

-- -----------------------------------------------------------------------
-- clients: admin can do everything
-- -----------------------------------------------------------------------
CREATE POLICY "admin_all_clients"
  ON clients
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- -----------------------------------------------------------------------
-- professionals: admin can do everything
-- -----------------------------------------------------------------------
CREATE POLICY "admin_all_professionals"
  ON professionals
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- -----------------------------------------------------------------------
-- services: admin can do everything
-- -----------------------------------------------------------------------
CREATE POLICY "admin_all_services"
  ON services
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- -----------------------------------------------------------------------
-- bookings: admin can do everything
-- -----------------------------------------------------------------------
CREATE POLICY "admin_all_bookings"
  ON bookings
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- -----------------------------------------------------------------------
-- conversation_sessions: admin read-only (write via service_role)
-- -----------------------------------------------------------------------
CREATE POLICY "admin_read_conversation_sessions"
  ON conversation_sessions
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- -----------------------------------------------------------------------
-- rate_limit_log: admin read-only
-- -----------------------------------------------------------------------
CREATE POLICY "admin_read_rate_limit_log"
  ON rate_limit_log
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- -----------------------------------------------------------------------
-- payments: admin can do everything
-- -----------------------------------------------------------------------
CREATE POLICY "admin_all_payments"
  ON payments
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- -----------------------------------------------------------------------
-- service_audit_log: admin read-only (write via triggers/service_role)
-- -----------------------------------------------------------------------
CREATE POLICY "admin_read_service_audit_log"
  ON service_audit_log
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- -----------------------------------------------------------------------
-- booking_status_log: admin read-only (write via triggers/service_role)
-- -----------------------------------------------------------------------
CREATE POLICY "admin_read_booking_status_log"
  ON booking_status_log
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- -----------------------------------------------------------------------
-- service_packages: admin can do everything
-- -----------------------------------------------------------------------
CREATE POLICY "admin_all_service_packages"
  ON service_packages
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- -----------------------------------------------------------------------
-- client_packages: admin can do everything
-- -----------------------------------------------------------------------
CREATE POLICY "admin_all_client_packages"
  ON client_packages
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
