-- Client contact log table

CREATE TABLE contactos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  fecha       DATE NOT NULL,
  canal       TEXT,
  motivo      TEXT,
  resultado   TEXT,
  notas       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX contactos_client_id_idx ON contactos (client_id);
CREATE INDEX contactos_fecha_idx ON contactos (fecha);

ALTER TABLE contactos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all_contactos"
  ON contactos FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
