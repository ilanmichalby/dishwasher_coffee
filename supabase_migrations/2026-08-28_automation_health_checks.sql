-- Create table for tracking automation health checks
-- Used by the dashboard to display manual health check results and history

CREATE TABLE IF NOT EXISTS automation_health_checks (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  healthy BOOLEAN NOT NULL,
  fingerbot_online BOOLEAN,
  coffee_scheduled BOOLEAN NOT NULL,
  upcoming_coffee_count INT DEFAULT 0,
  next_coffee TIMESTAMP WITH TIME ZONE,
  device_error TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for fast retrieval of latest check
CREATE INDEX IF NOT EXISTS idx_automation_health_checks_checked_at
  ON automation_health_checks(checked_at DESC);

-- Row-level security
ALTER TABLE automation_health_checks ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "allow_read_automation_health_checks"
  ON automation_health_checks FOR SELECT
  USING (true);

-- Allow insert for authenticated users
CREATE POLICY "allow_insert_automation_health_checks"
  ON automation_health_checks FOR INSERT
  WITH CHECK (true);

-- Keep only last 100 checks (optional cleanup)
-- Could be run periodically via a background job
-- DELETE FROM automation_health_checks WHERE id NOT IN (
--   SELECT id FROM automation_health_checks ORDER BY checked_at DESC LIMIT 100
-- );
