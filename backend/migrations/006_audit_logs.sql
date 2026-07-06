-- Rename admin_audit_logs to audit_logs for general system auditing
ALTER TABLE admin_audit_logs RENAME TO audit_logs;

-- Make user_id nullable (for anonymous actions like verification) and rename it
ALTER TABLE audit_logs RENAME COLUMN admin_user_id TO user_id;
ALTER TABLE audit_logs ALTER COLUMN user_id DROP NOT NULL;

-- Index on created_at for fast date-range filtering (last 1 week)
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
