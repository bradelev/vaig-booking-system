-- VBS-41: Add Google OAuth tokens to professionals table
ALTER TABLE professionals
  ADD COLUMN google_refresh_token text,
  ADD COLUMN google_token_expiry   timestamptz;
