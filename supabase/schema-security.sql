-- Ensure NO table allows unauthenticated access
-- Every table must have RLS enabled + authenticated-only policy

-- Security events table (new)
CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL,  -- 'unauthorized_access', 'failed_login', 'suspicious_activity'
  user_email TEXT,
  ip_address TEXT,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- Admin read-only, no user writes (insert via service role only)
CREATE POLICY "admin read security events"
  ON security_events FOR SELECT TO authenticated
  USING (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));

-- Audit log table (new)
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action TEXT NOT NULL,      -- 'student_created', 'student_deleted', 'report_viewed', etc.
  performed_by TEXT NOT NULL,
  target_id TEXT,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin read audit log"
  ON audit_log FOR SELECT TO authenticated
  USING (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));
