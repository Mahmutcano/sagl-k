-- Application doctor first-open tracking for audit timeline
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS doctor_opened_at TIMESTAMPTZ;

COMMENT ON COLUMN applications.doctor_opened_at IS 'Doktor başvuruyu ilk açtığı an';
