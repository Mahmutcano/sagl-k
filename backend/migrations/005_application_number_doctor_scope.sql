-- Human-readable application number (separate from payment/ecommerce ref).
CREATE SEQUENCE IF NOT EXISTS application_number_seq START 1;

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS application_number VARCHAR(20);

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM applications
  WHERE application_number IS NULL
)
UPDATE applications a
SET application_number = 'BSV-' || LPAD(n.rn::text, 6, '0')
FROM numbered n
WHERE a.id = n.id;

SELECT setval(
  'application_number_seq',
  GREATEST(
    COALESCE(
      (SELECT MAX(CAST(SUBSTRING(application_number FROM 5) AS BIGINT)) FROM applications),
      0
    ),
    1
  )
);

ALTER TABLE applications
  ALTER COLUMN application_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_number ON applications(application_number);
CREATE INDEX IF NOT EXISTS idx_applications_doctor ON applications(doctor_user_id);

-- Link seed doctor user to care provider profile for assignment.
UPDATE care_providers
SET user_id = (SELECT id FROM users WHERE national_identifier = '20000000114' LIMIT 1)
WHERE full_name = 'Ayşe Yılmaz' AND user_id IS NULL;
