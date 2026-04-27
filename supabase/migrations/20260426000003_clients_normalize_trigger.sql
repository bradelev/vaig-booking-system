-- VPB-13: Auto-recalculate nombre_normalizado when first_name or last_name changes
-- Prevents drift between the two apps editing clients.

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

-- Reusable normalization function (same logic as booking's TS normalizeClientName helper)
CREATE OR REPLACE FUNCTION normalize_client_name(first_name text, last_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(
    lower(
      extensions.unaccent(
        coalesce(first_name, '') || ' ' || coalesce(last_name, '')
      )
    )
  );
$$;

-- Trigger function
CREATE OR REPLACE FUNCTION trg_clients_normalize_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only recalculate if the name actually changed
  IF NEW.first_name IS DISTINCT FROM OLD.first_name
  OR NEW.last_name  IS DISTINCT FROM OLD.last_name
  THEN
    NEW.nombre_normalizado := normalize_client_name(NEW.first_name, NEW.last_name);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER clients_normalize_name
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION trg_clients_normalize_name();

-- Backfill rows where nombre_normalizado may be null or stale
-- (safe to run multiple times — only touches rows where value differs)
UPDATE clients
SET nombre_normalizado = normalize_client_name(first_name, last_name)
WHERE nombre_normalizado IS DISTINCT FROM normalize_client_name(first_name, last_name);
