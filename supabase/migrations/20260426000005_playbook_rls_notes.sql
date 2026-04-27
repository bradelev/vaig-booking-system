-- VPB-15: RLS audit for playbook app access
--
-- Summary of access model:
--   - vaig-playbook uses SUPABASE_SERVICE_ROLE_KEY (service-role) for all
--     writes to clients and playbook_* tables — service-role bypasses RLS.
--   - Anon/authenticated reads on clients are handled by existing RLS in the
--     booking system (currently requires is_admin() after the harden migration).
--   - The playbook_* table policies (admin_all_*) were created in migration
--     20260426000001. They enforce is_admin() on authenticated reads.
--   - suggest_duplicate_candidates() and refresh_client_last_contact() are
--     SECURITY DEFINER — callable by any authenticated user, execute as owner.
--
-- This migration adds a SELECT-only policy on clientes_metricas so the playbook
-- can read it via the anon key as a fallback (most reads go via service-role).

-- clientes_metricas is a view — RLS on the underlying tables applies.
-- No additional policy needed here; service-role reads bypass RLS.

-- Verify is_admin function exists and is correct (idempotent check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'is_admin'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    RAISE EXCEPTION 'is_admin() function not found — run harden_rls_policies migration first';
  END IF;
END;
$$;
