-- VPB-14: Duplicate client detection
-- pg_trgm similarity on nombre_normalizado + optional phone match

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- GIN index on nombre_normalizado for fast trigram similarity search
CREATE INDEX IF NOT EXISTS idx_clients_nombre_trgm
  ON clients
  USING GIN (nombre_normalizado extensions.gin_trgm_ops);

-- Function: returns pairs of clients that are likely duplicates
-- Excludes pairs already decided in playbook_dedup_decisions
-- similarity_threshold: 0.0–1.0 (default 0.6, ~Levenshtein ≤ 2 for short names)
CREATE OR REPLACE FUNCTION suggest_duplicate_candidates(
  similarity_threshold float8 DEFAULT 0.6
)
RETURNS TABLE (
  client_a      uuid,
  client_b      uuid,
  name_a        text,
  name_b        text,
  phone_a       text,
  phone_b       text,
  sesiones_a    bigint,
  sesiones_b    bigint,
  trgm_sim      float4
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH client_summary AS (
    SELECT
      c.id,
      c.nombre_normalizado,
      c.phone,
      c.first_name || ' ' || coalesce(c.last_name, '') AS full_name,
      coalesce(m.total_sesiones, 0)::bigint            AS total_sesiones
    FROM clients c
    LEFT JOIN clientes_metricas m ON m.id = c.id
    WHERE c.nombre_normalizado IS NOT NULL
      AND length(c.nombre_normalizado) > 2
  )
  SELECT
    a.id                                    AS client_a,
    b.id                                    AS client_b,
    a.full_name                             AS name_a,
    b.full_name                             AS name_b,
    a.phone                                 AS phone_a,
    b.phone                                 AS phone_b,
    a.total_sesiones                        AS sesiones_a,
    b.total_sesiones                        AS sesiones_b,
    extensions.similarity(a.nombre_normalizado, b.nombre_normalizado) AS trgm_sim
  FROM client_summary a
  JOIN client_summary b
    ON a.id < b.id   -- canonical ordering, no self-pairs
   AND (
         -- high name similarity
         extensions.similarity(a.nombre_normalizado, b.nombre_normalizado) >= similarity_threshold
         -- OR same non-placeholder phone
         OR (
           a.phone IS NOT NULL
           AND b.phone IS NOT NULL
           AND a.phone = b.phone
           AND a.phone NOT LIKE 'historico_%'
           AND a.phone NOT LIKE 'migrated_nophone_%'
         )
       )
  -- Exclude pairs already resolved
  WHERE NOT EXISTS (
    SELECT 1 FROM playbook_dedup_decisions d
    WHERE d.client_a = a.id AND d.client_b = b.id
  )
  ORDER BY trgm_sim DESC, a.nombre_normalizado;
$$;

COMMENT ON FUNCTION suggest_duplicate_candidates IS
  'Returns candidate duplicate client pairs by trigram similarity (default ≥0.6) or same phone. Excludes pairs already decided.';
