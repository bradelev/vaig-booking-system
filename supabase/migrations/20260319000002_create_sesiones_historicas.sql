-- Historical sessions table (migrated from spreadsheet)

CREATE TABLE sesiones_historicas (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  fecha                   DATE NOT NULL,
  tipo_servicio           TEXT NOT NULL,
  descripcion             TEXT,
  operadora               TEXT,
  monto_lista             NUMERIC(10,2),
  descuento_pct           NUMERIC(5,2),
  monto_cobrado           NUMERIC(10,2),
  metodo_pago             TEXT,
  banco                   TEXT,
  sesion_n                SMALLINT,
  sesion_total_cuponera   SMALLINT,
  client_package_id       UUID REFERENCES client_packages(id) ON DELETE SET NULL,
  notas                   TEXT,
  fuente                  TEXT NOT NULL DEFAULT 'sheet_historico',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sh_client_id_idx ON sesiones_historicas (client_id);
CREATE INDEX sh_fecha_idx ON sesiones_historicas (fecha);
CREATE INDEX sh_tipo_servicio_idx ON sesiones_historicas (tipo_servicio);

-- Unique constraint for idempotent inserts
CREATE UNIQUE INDEX sh_unique_session_idx
  ON sesiones_historicas (client_id, fecha, tipo_servicio, COALESCE(descripcion, ''));

ALTER TABLE sesiones_historicas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all_sesiones_historicas"
  ON sesiones_historicas FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
