-- VBS-74: Add funnel_stage to conversation_sessions for conversion tracking

ALTER TABLE conversation_sessions ADD COLUMN funnel_stage text;

COMMENT ON COLUMN conversation_sessions.funnel_stage IS
  'Max funnel stage reached: started | service_selected | data_completed | payment_done';
