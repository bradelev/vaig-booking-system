-- Clients table

CREATE TABLE clients (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text        NOT NULL,
  last_name  text        NOT NULL,
  phone      text        NOT NULL UNIQUE,
  email      text,
  notes      text,
  source     text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX clients_email_idx ON clients (email);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
