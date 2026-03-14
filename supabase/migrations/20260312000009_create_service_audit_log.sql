-- Service audit log table

CREATE TABLE service_audit_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id    uuid        NOT NULL REFERENCES services (id) ON DELETE CASCADE,
  edited_by     uuid        NOT NULL,
  edited_at     timestamptz NOT NULL DEFAULT now(),
  field_changed text        NOT NULL,
  old_value     text,
  new_value     text
);

CREATE INDEX service_audit_log_service_id_idx ON service_audit_log (service_id);
CREATE INDEX service_audit_log_edited_at_idx  ON service_audit_log (edited_at);

ALTER TABLE service_audit_log ENABLE ROW LEVEL SECURITY;
