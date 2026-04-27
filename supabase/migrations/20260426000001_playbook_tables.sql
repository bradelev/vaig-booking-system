-- VPB-11: Playbook tables for vaig-playbook app
-- Outreach rows, promos, audit log, dedup decisions

-- ─── playbook_outreach ────────────────────────────────────────────────────────
CREATE TABLE playbook_outreach (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  segment             text        NOT NULL,
  message_template_id text        NOT NULL,
  message_text        text        NOT NULL,
  suggested_send_at   date        NOT NULL,
  status              text        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'ready', 'sent', 'ignored', 'superseded')),
  generated_at        timestamptz NOT NULL DEFAULT now(),
  edited_at           timestamptz,
  edited_by           uuid        REFERENCES auth.users(id),
  sent_at             timestamptz,
  notes               text,
  generation_run_id   uuid
);

CREATE INDEX idx_playbook_outreach_client   ON playbook_outreach (client_id);
CREATE INDEX idx_playbook_outreach_status   ON playbook_outreach (status, suggested_send_at);
CREATE INDEX idx_playbook_outreach_run      ON playbook_outreach (generation_run_id) WHERE generation_run_id IS NOT NULL;

ALTER TABLE playbook_outreach ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_playbook_outreach"
  ON playbook_outreach FOR ALL
  TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- ─── playbook_promos ─────────────────────────────────────────────────────────
CREATE TABLE playbook_promos (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text        NOT NULL,
  message_text   text        NOT NULL,
  target_segment text,
  target_filter  jsonb,
  send_date      date        NOT NULL,
  status         text        NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft', 'scheduled', 'sent', 'cancelled')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid        REFERENCES auth.users(id),
  notes          text
);

CREATE INDEX idx_playbook_promos_status ON playbook_promos (status, send_date);

ALTER TABLE playbook_promos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_playbook_promos"
  ON playbook_promos FOR ALL
  TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- ─── playbook_promo_recipients ───────────────────────────────────────────────
CREATE TABLE playbook_promo_recipients (
  promo_id   uuid NOT NULL REFERENCES playbook_promos(id)  ON DELETE CASCADE,
  client_id  uuid NOT NULL REFERENCES clients(id)          ON DELETE CASCADE,
  PRIMARY KEY (promo_id, client_id)
);

CREATE INDEX idx_playbook_promo_recipients_client ON playbook_promo_recipients (client_id);

ALTER TABLE playbook_promo_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_promo_recipients"
  ON playbook_promo_recipients FOR ALL
  TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- ─── playbook_client_edits (audit log) ───────────────────────────────────────
CREATE TABLE playbook_client_edits (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  field      text        NOT NULL,
  old_value  text,
  new_value  text,
  edited_by  uuid        REFERENCES auth.users(id),
  edited_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_playbook_client_edits_client ON playbook_client_edits (client_id, edited_at DESC);

ALTER TABLE playbook_client_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_client_edits"
  ON playbook_client_edits FOR ALL
  TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- ─── playbook_dedup_decisions ─────────────────────────────────────────────────
-- Stores "ignore this pair" decisions so suggest_duplicate_candidates() can skip them
CREATE TABLE playbook_dedup_decisions (
  client_a    uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  client_b    uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  decision    text        NOT NULL CHECK (decision IN ('merged', 'distinct', 'ignored')),
  decided_at  timestamptz NOT NULL DEFAULT now(),
  decided_by  uuid        REFERENCES auth.users(id),
  PRIMARY KEY (client_a, client_b),
  -- enforce canonical ordering so (a,b) and (b,a) can't coexist
  CONSTRAINT dedup_ordered CHECK (client_a < client_b)
);

ALTER TABLE playbook_dedup_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_dedup_decisions"
  ON playbook_dedup_decisions FOR ALL
  TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());
