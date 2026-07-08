-- Phase 3 Schema Extensions

-- 1. Add doctor consultation fee
ALTER TABLE care_providers ADD COLUMN consultation_fee DECIMAL(12,2) NOT NULL DEFAULT 1000.00;

-- 2. Create doctor professions many-to-many link table
CREATE TABLE IF NOT EXISTS care_provider_professions (
  care_provider_id UUID NOT NULL REFERENCES care_providers(id) ON DELETE CASCADE,
  profession_id UUID NOT NULL REFERENCES professions(id) ON DELETE CASCADE,
  PRIMARY KEY (care_provider_id, profession_id)
);

-- Copy existing single relationships to join table
INSERT INTO care_provider_professions (care_provider_id, profession_id)
SELECT id, profession_id FROM care_providers WHERE profession_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Add report viewed timestamp
ALTER TABLE applications ADD COLUMN report_viewed_at TIMESTAMPTZ;

-- 4. Update seed data for doctor consultation fees
UPDATE care_providers SET consultation_fee = 1250.00 WHERE full_name = 'Ayşe Yılmaz';
