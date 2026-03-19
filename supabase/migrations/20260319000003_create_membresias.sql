-- Memberships table

CREATE TABLE membresias (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan                TEXT NOT NULL,
  servicios_incluidos TEXT[],
  precio_mensual      NUMERIC(10,2),
  fecha_inicio        DATE NOT NULL,
  fecha_fin           DATE NOT NULL,
  estado              TEXT NOT NULL DEFAULT 'activa',
  renovada_de         UUID REFERENCES membresias(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX membresias_client_id_idx ON membresias (client_id);
CREATE INDEX membresias_estado_idx ON membresias (estado);

ALTER TABLE membresias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all_membresias"
  ON membresias FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
