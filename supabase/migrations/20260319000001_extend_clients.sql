-- Extend clients table with CRM fields

ALTER TABLE clients
  ADD COLUMN referido_por        UUID REFERENCES clients(id),
  ADD COLUMN es_historico        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN nombre_normalizado  TEXT,
  ADD COLUMN instagram           TEXT,
  ADD COLUMN activa_membresia    BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX clients_nombre_normalizado_idx ON clients (nombre_normalizado);
CREATE INDEX clients_es_historico_idx ON clients (es_historico) WHERE es_historico = true;
