-- VBS-72: Waitlist table

CREATE TABLE waitlist (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         uuid        NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  service_id        uuid        NOT NULL REFERENCES services (id) ON DELETE CASCADE,
  professional_id   uuid        REFERENCES professionals (id) ON DELETE SET NULL,
  requested_slot    timestamptz NOT NULL,
  notified_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX waitlist_service_id_idx          ON waitlist (service_id);
CREATE INDEX waitlist_requested_slot_idx      ON waitlist (requested_slot);
CREATE INDEX waitlist_notified_at_idx         ON waitlist (notified_at) WHERE notified_at IS NULL;

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_waitlist"
  ON waitlist FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
