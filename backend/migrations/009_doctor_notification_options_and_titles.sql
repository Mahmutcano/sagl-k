-- Add doctor notification columns to care_providers
ALTER TABLE care_providers ADD COLUMN IF NOT EXISTS sms_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE care_providers ADD COLUMN IF NOT EXISTS email_enabled BOOLEAN NOT NULL DEFAULT true;

-- Create dynamic titles table
CREATE TABLE IF NOT EXISTS titles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed initial default titles
INSERT INTO titles (name) VALUES
    ('Prof. Dr.'),
    ('Doç. Dr.'),
    ('Dr. Öğr. Üyesi'),
    ('Uzm. Dr.'),
    ('Dr.')
ON CONFLICT (name) DO NOTHING;
