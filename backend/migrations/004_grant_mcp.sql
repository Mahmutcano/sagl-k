-- Ensure application DB user can read/write all tables (local dev when tables owned by another role).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mcp') THEN
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mcp;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mcp;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO mcp;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO mcp;
  END IF;
END $$;
