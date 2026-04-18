-- =============================================================================
-- VBS-176: Harden RLS policies
-- 1. Drop all permissive authenticated_all_* policies (were OR'd with admin
--    policies, effectively making them no-ops as guards).
-- 2. Fix is_admin() to remove user_metadata branch (user-writable, allows
--    self-promotion to admin).
-- 3. Add admin-gated policies for tables that had only permissive ones.
-- 4. Add admin-gated policies for tables with no policies at all
--    (professional_schedule, system_config).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Fix is_admin() — remove user_metadata branch
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin',
    false
  );
$$;

-- -----------------------------------------------------------------------------
-- 2. Drop permissive policies from 20260314000001_backoffice_rls_policies.sql
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "authenticated_all_clients" ON clients;
DROP POLICY IF EXISTS "authenticated_all_professionals" ON professionals;
DROP POLICY IF EXISTS "authenticated_all_services" ON services;
DROP POLICY IF EXISTS "authenticated_all_bookings" ON bookings;
DROP POLICY IF EXISTS "authenticated_all_payments" ON payments;

-- -----------------------------------------------------------------------------
-- 3. Drop and replace permissive policies added in later migrations
-- -----------------------------------------------------------------------------

-- waitlist: was named "admin_all_waitlist" but used USING (true) — misleading
DROP POLICY IF EXISTS "admin_all_waitlist" ON waitlist;
CREATE POLICY "admin_all_waitlist"
  ON waitlist FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- sesiones_historicas
DROP POLICY IF EXISTS "authenticated_all_sesiones_historicas" ON sesiones_historicas;
CREATE POLICY "admin_all_sesiones_historicas"
  ON sesiones_historicas FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- membresias
DROP POLICY IF EXISTS "authenticated_all_membresias" ON membresias;
CREATE POLICY "admin_all_membresias"
  ON membresias FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- contactos
DROP POLICY IF EXISTS "authenticated_all_contactos" ON contactos;
CREATE POLICY "admin_all_contactos"
  ON contactos FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- professional_schedule_overrides
DROP POLICY IF EXISTS "authenticated_all_schedule_overrides" ON professional_schedule_overrides;
CREATE POLICY "admin_all_schedule_overrides"
  ON professional_schedule_overrides FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- messages
DROP POLICY IF EXISTS "authenticated_all_messages" ON messages;
CREATE POLICY "admin_all_messages"
  ON messages FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- campaigns: replace per-operation permissive policies with single admin policy
-- service_role policy kept as-is (used by cron processor, bypasses RLS by design)
DROP POLICY IF EXISTS "authenticated can read campaigns" ON campaigns;
DROP POLICY IF EXISTS "authenticated can insert campaigns" ON campaigns;
DROP POLICY IF EXISTS "authenticated can update campaigns" ON campaigns;
DROP POLICY IF EXISTS "authenticated can delete campaigns" ON campaigns;
CREATE POLICY "admin_all_campaigns"
  ON campaigns FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- campaign_recipients: same as campaigns
DROP POLICY IF EXISTS "authenticated can read campaign_recipients" ON campaign_recipients;
DROP POLICY IF EXISTS "authenticated can insert campaign_recipients" ON campaign_recipients;
DROP POLICY IF EXISTS "authenticated can update campaign_recipients" ON campaign_recipients;
DROP POLICY IF EXISTS "authenticated can delete campaign_recipients" ON campaign_recipients;
CREATE POLICY "admin_all_campaign_recipients"
  ON campaign_recipients FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- -----------------------------------------------------------------------------
-- 4. Add admin policies to tables with NO policies (RLS enabled but unguarded)
-- -----------------------------------------------------------------------------

-- system_config: had RLS enabled but zero policies — fully open to authenticated
CREATE POLICY "admin_all_system_config"
  ON system_config FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- professional_schedule: same situation
CREATE POLICY "admin_all_professional_schedule"
  ON professional_schedule FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());
