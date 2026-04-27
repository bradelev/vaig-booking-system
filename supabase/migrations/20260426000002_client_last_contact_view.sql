-- VPB-12: Materialized view for anti-saturation cooldown
-- Aggregates last outbound contact per client from all sources:
--   1. messages (outbound WA: bot, campaigns, crons, admin)
--   2. playbook_outreach (sent by playbook)
--   3. playbook_promo_recipients + playbook_promos (sent promos)

CREATE MATERIALIZED VIEW client_last_contact AS
SELECT
  client_id,
  MAX(last_at)                                                              AS last_contact_at,
  jsonb_agg(
    jsonb_build_object('source', source, 'at', last_at)
    ORDER BY last_at DESC
  ) FILTER (WHERE last_at IS NOT NULL)                                      AS recent_contacts
FROM (
  -- WhatsApp outbound from booking (bot, campaigns, crons, admin)
  SELECT client_id, MAX(created_at) AS last_at, 'wa_' || source AS source
  FROM   messages
  WHERE  direction = 'outbound'
    AND  client_id IS NOT NULL
  GROUP  BY client_id, source

  UNION ALL

  -- Outreach rows marked as sent by playbook
  SELECT client_id, MAX(sent_at) AS last_at, 'playbook_outreach' AS source
  FROM   playbook_outreach
  WHERE  status = 'sent'
    AND  sent_at IS NOT NULL
  GROUP  BY client_id

  UNION ALL

  -- Sent promos (use send_date as proxy for sent_at)
  SELECT pr.client_id,
         MAX(p.send_date::timestamptz) AS last_at,
         'playbook_promo' AS source
  FROM   playbook_promo_recipients pr
  JOIN   playbook_promos p ON p.id = pr.promo_id
  WHERE  p.status = 'sent'
  GROUP  BY pr.client_id
) sub
GROUP BY client_id;

-- Unique index required for REFRESH CONCURRENTLY
CREATE UNIQUE INDEX idx_client_last_contact_client ON client_last_contact (client_id);

-- Refresh function — called manually from playbook or via pg_cron
CREATE OR REPLACE FUNCTION refresh_client_last_contact()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY client_last_contact;
$$;

COMMENT ON MATERIALIZED VIEW client_last_contact IS
  'Cached last outbound contact per client. Refresh with refresh_client_last_contact() or on playbook load.';
