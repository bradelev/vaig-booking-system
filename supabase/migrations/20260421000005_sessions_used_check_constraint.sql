-- Ensure no existing violations before adding constraint
UPDATE client_packages SET sessions_used = sessions_total
  WHERE sessions_used > sessions_total;

ALTER TABLE client_packages
  ADD CONSTRAINT sessions_used_valid
  CHECK (sessions_used >= 0 AND sessions_used <= sessions_total);
