-- Add VAIG human-operated WhatsApp Business phone to system_config.
-- This number receives booking notifications separate from the bot admin_phone.
INSERT INTO system_config (key, value)
VALUES ('vaig_business_phone', '59899334874')
ON CONFLICT (key) DO NOTHING;
