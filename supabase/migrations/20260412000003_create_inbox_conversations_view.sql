-- VBS-158: Inbox conversations view for the backoffice inbox
-- Joins conversation_sessions with clients and last message for each phone

CREATE OR REPLACE VIEW inbox_conversations AS
SELECT
  cs.phone,
  cs.handoff_active,
  cs.handoff_at,
  cs.last_inbound_at,
  cs.state AS bot_state,
  c.id AS client_id,
  c.first_name,
  c.last_name,
  last_msg.body AS last_message_body,
  last_msg.direction AS last_message_direction,
  last_msg.created_at AS last_message_at,
  (SELECT count(*)::int FROM messages m
   WHERE m.phone = cs.phone AND m.direction = 'inbound' AND m.admin_read_at IS NULL) AS unread_count
FROM conversation_sessions cs
LEFT JOIN clients c ON c.phone = cs.phone
LEFT JOIN LATERAL (
  SELECT body, direction, created_at FROM messages WHERE phone = cs.phone ORDER BY created_at DESC LIMIT 1
) last_msg ON true
ORDER BY COALESCE(last_msg.created_at, cs.last_message_at) DESC;
