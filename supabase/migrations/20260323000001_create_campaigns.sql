-- Create campaign_status enum
CREATE TYPE campaign_status AS ENUM ('draft', 'scheduled', 'sending', 'completed', 'failed');

-- Create campaigns table
CREATE TABLE campaigns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  body            text NOT NULL DEFAULT '',
  image_url       text,
  status          campaign_status NOT NULL DEFAULT 'draft',
  scheduled_at    timestamptz,
  target_all      boolean NOT NULL DEFAULT true,
  total_recipients integer NOT NULL DEFAULT 0,
  sent_count      integer NOT NULL DEFAULT 0,
  failed_count    integer NOT NULL DEFAULT 0,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Create campaign_recipients table
CREATE TABLE campaign_recipients (
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  client_id   uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  sent_at     timestamptz,
  error       text,
  PRIMARY KEY (campaign_id, client_id)
);

-- Index for cron query
CREATE INDEX idx_campaigns_status_scheduled ON campaigns(status, scheduled_at);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_campaigns_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_campaigns_updated_at();

-- RLS
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read campaigns"
  ON campaigns FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated can insert campaigns"
  ON campaigns FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated can update campaigns"
  ON campaigns FOR UPDATE TO authenticated USING (true);

CREATE POLICY "authenticated can delete campaigns"
  ON campaigns FOR DELETE TO authenticated USING (true);

CREATE POLICY "service_role full access campaigns"
  ON campaigns FOR ALL TO service_role USING (true);

CREATE POLICY "authenticated can read campaign_recipients"
  ON campaign_recipients FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated can insert campaign_recipients"
  ON campaign_recipients FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated can update campaign_recipients"
  ON campaign_recipients FOR UPDATE TO authenticated USING (true);

CREATE POLICY "authenticated can delete campaign_recipients"
  ON campaign_recipients FOR DELETE TO authenticated USING (true);

CREATE POLICY "service_role full access campaign_recipients"
  ON campaign_recipients FOR ALL TO service_role USING (true);
