-- Rate limit log table

CREATE TABLE rate_limit_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone         text        NOT NULL,
  message_count integer     NOT NULL DEFAULT 0,
  window_start  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rate_limit_log_phone_idx              ON rate_limit_log (phone);
CREATE INDEX rate_limit_log_phone_window_start_idx ON rate_limit_log (phone, window_start);

ALTER TABLE rate_limit_log ENABLE ROW LEVEL SECURITY;
