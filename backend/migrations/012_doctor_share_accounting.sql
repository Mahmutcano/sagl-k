-- Doctor revenue share + accounting settings

ALTER TABLE care_providers
  ADD COLUMN IF NOT EXISTS revenue_share_percent DECIMAL(5,2) NOT NULL DEFAULT 70.00;

COMMENT ON COLUMN care_providers.revenue_share_percent IS 'Doktorun kazanç payı yüzdesi (0-100)';

CREATE TABLE IF NOT EXISTS accounting_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  vat_rate DECIMAL(5,2) NOT NULL DEFAULT 20.00,
  default_doctor_share_percent DECIMAL(5,2) NOT NULL DEFAULT 70.00,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO accounting_settings (id, vat_rate, default_doctor_share_percent)
VALUES (1, 20.00, 70.00)
ON CONFLICT (id) DO NOTHING;
