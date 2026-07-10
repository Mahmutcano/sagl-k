-- Demo admin / doctor users (idempotent — safe to re-run on staging)
-- Admin: TC 10000000146 / Admin123!
-- Doctor: TC 20000000114 / Doctor123!

INSERT INTO hospitals (code, name, target_institution, settings)
VALUES ('erciyes', 'Erciyes Üniversitesi Tıp Fakültesi', 1, '{}')
ON CONFLICT (code) DO NOTHING;

INSERT INTO users (
  email, phone_number, password_hash, first_name, last_name,
  national_identifier, role, is_phone_verified, is_email_verified
) VALUES
(
  'admin@medical.local',
  '5000000000',
  '$2a$10$bZuFxlzWDIDde0veuTK/4.InHAVM5HZUsuvTRlIQW.7igsPWfszES',
  'Sistem',
  'Admin',
  '10000000146',
  'admin',
  true,
  true
),
(
  'doctor@medical.local',
  '5000000001',
  '$2a$10$JM4fSpWotFPrhYDNBi02heViYxZO2AOA7kAMUtSMz2a6DmoBwKZxK',
  'Ayşe',
  'Yılmaz',
  '20000000114',
  'doctor',
  true,
  true
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO professions (code, name, target_institution)
SELECT v.code, v.name, v.target_institution
FROM (
  VALUES
    ('cardiology', 'Kardiyoloji', 1),
    ('oncology', 'Onkoloji', 1),
    ('neurology', 'Nöroloji', 1)
) AS v(code, name, target_institution)
WHERE NOT EXISTS (
  SELECT 1 FROM professions p
  WHERE p.code = v.code
    AND p.target_institution = v.target_institution
    AND p.hospital_id IS NULL
);

INSERT INTO care_providers (full_name, title, profession_code, target_institution)
SELECT v.full_name, v.title, v.profession_code, v.target_institution
FROM (
  VALUES
    ('Ayşe Yılmaz', 'Prof. Dr.', 'cardiology', 1),
    ('Mehmet Demir', 'Doç. Dr.', 'cardiology', 1),
    ('Zeynep Kaya', 'Prof. Dr.', 'oncology', 1),
    ('Ali Çelik', 'Uzm. Dr.', 'neurology', 1)
) AS v(full_name, title, profession_code, target_institution)
WHERE NOT EXISTS (
  SELECT 1 FROM care_providers cp
  WHERE cp.full_name = v.full_name AND cp.target_institution = v.target_institution
);

UPDATE care_providers
SET user_id = (SELECT id FROM users WHERE national_identifier = '20000000114' LIMIT 1)
WHERE full_name = 'Ayşe Yılmaz' AND user_id IS NULL;
