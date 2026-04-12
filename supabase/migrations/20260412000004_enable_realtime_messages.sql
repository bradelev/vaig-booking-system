-- VBS-164: Enable Supabase Realtime replication for messages table
-- Required for postgres_changes subscriptions in the backoffice inbox

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
