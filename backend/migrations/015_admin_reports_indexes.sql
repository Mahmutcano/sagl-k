-- Admin rapor / ödeme sorguları için index'ler ve yetkiler

CREATE INDEX IF NOT EXISTS idx_notification_logs_template
  ON notification_logs(template_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_logs_status_created
  ON notification_logs(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_status_created
  ON payments(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_order_id
  ON payments(order_id) WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_payment_id
  ON invoices(payment_id) WHERE payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_status_created
  ON invoices(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_refunds_status_created
  ON refunds(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_refunds_payment_id
  ON refunds(payment_id);

CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON orders(status, created_at DESC);

-- mcp rolü varsa rapor tablolarına yetki ver
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mcp') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO mcp;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mcp;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mcp;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO mcp;
  END IF;
END $$;
