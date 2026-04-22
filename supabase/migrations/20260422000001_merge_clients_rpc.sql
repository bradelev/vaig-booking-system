-- Atomic merge_clients function — avoids partial-failure inconsistency
-- when cascading client reassignment across 5 tables.
-- Called via supabase.rpc('merge_clients', { primary_id, secondary_id }).

CREATE OR REPLACE FUNCTION merge_clients(primary_id uuid, secondary_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- sesiones_historicas has a unique constraint on (client_id, fecha, tipo_servicio);
  -- skip conflicts to avoid breaking the merge on duplicate historical sessions.
  UPDATE sesiones_historicas
  SET client_id = primary_id
  WHERE client_id = secondary_id
    AND NOT EXISTS (
      SELECT 1 FROM sesiones_historicas sh2
      WHERE sh2.client_id = primary_id
        AND sh2.fecha = sesiones_historicas.fecha
        AND sh2.tipo_servicio = sesiones_historicas.tipo_servicio
    );

  -- Delete remaining secondary sesiones_historicas that would conflict
  DELETE FROM sesiones_historicas
  WHERE client_id = secondary_id;

  UPDATE client_packages
  SET client_id = primary_id
  WHERE client_id = secondary_id;

  UPDATE bookings
  SET client_id = primary_id
  WHERE client_id = secondary_id;

  UPDATE conversation_sessions
  SET client_id = primary_id
  WHERE client_id = secondary_id;

  DELETE FROM clients WHERE id = secondary_id;
END;
$$;
