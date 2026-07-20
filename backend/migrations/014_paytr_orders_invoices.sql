-- PAYTR orders + invoices + payment columns

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM (
    'pending', 'awaiting_payment', 'paid', 'failed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM (
    'pending', 'issued', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Extend payment_provider with paytr (keep legacy values for historical rows)
DO $$ BEGIN
  ALTER TYPE payment_provider ADD VALUE 'paytr';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN unique_violation THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id),
  user_id UUID NOT NULL REFERENCES users(id),
  merchant_oid VARCHAR(64) NOT NULL UNIQUE,
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'TRY',
  status order_status NOT NULL DEFAULT 'pending',
  idempotency_key VARCHAR(100) UNIQUE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_application_created
  ON orders(application_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id),
  ADD COLUMN IF NOT EXISTS paytr_token TEXT,
  ADD COLUMN IF NOT EXISTS paytr_iframe_url TEXT,
  ADD COLUMN IF NOT EXISTS callback_payload JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  payment_id UUID REFERENCES payments(id),
  application_id UUID NOT NULL REFERENCES applications(id),
  user_id UUID NOT NULL REFERENCES users(id),
  provider VARCHAR(32) NOT NULL DEFAULT 'parasut',
  external_id VARCHAR(100),
  invoice_number VARCHAR(100),
  status invoice_status NOT NULL DEFAULT 'pending',
  pdf_url TEXT,
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'TRY',
  error_message TEXT,
  raw_response JSONB NOT NULL DEFAULT '{}',
  issued_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_order ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_application ON invoices(application_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_provider_external
  ON invoices(provider, external_id)
  WHERE external_id IS NOT NULL AND external_id <> '';
