-- VBS-87: RNPD consent flow — add consent_accepted_at to clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS consent_accepted_at timestamptz;

-- Seed default privacy policy URL (configurable via backoffice)
INSERT INTO system_config (key, value, updated_at) VALUES
  (
    'privacy_policy_url',
    'https://vaig.com.uy/privacidad',
    now()
  )
ON CONFLICT (key) DO NOTHING;
