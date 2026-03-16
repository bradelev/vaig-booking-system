-- VBS-75: Add is_blocked flag to clients

ALTER TABLE clients ADD COLUMN is_blocked boolean NOT NULL DEFAULT false;

CREATE INDEX clients_is_blocked_idx ON clients (is_blocked) WHERE is_blocked = true;
