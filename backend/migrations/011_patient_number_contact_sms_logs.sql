-- Patient number, uniqueness, contact inbox, SMS OTP audit

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS patient_number VARCHAR(32);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_patient_number
  ON users (patient_number)
  WHERE patient_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_national_identifier_unique
  ON users (national_identifier)
  WHERE national_identifier IS NOT NULL AND national_identifier <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_passport_number_unique
  ON users (UPPER(passport_number))
  WHERE passport_number IS NOT NULL AND passport_number <> '';

-- Public contact / complaints / suggestions
CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(40),
  subject VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  category VARCHAR(40) NOT NULL DEFAULT 'general',
  status VARCHAR(20) NOT NULL DEFAULT 'new',
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_created
  ON contact_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_status
  ON contact_messages (status, created_at DESC);

-- Dedicated SMS OTP log (code + identity for admin)
CREATE TABLE IF NOT EXISTS sms_otp_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose VARCHAR(50) NOT NULL,
  phone_e164 VARCHAR(24) NOT NULL,
  phone_country_code VARCHAR(8),
  phone_number VARCHAR(20),
  otp_code VARCHAR(16) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(255),
  user_id UUID REFERENCES users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'sent',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_otp_logs_created
  ON sms_otp_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_otp_logs_phone
  ON sms_otp_logs (phone_number, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_otp_logs_purpose
  ON sms_otp_logs (purpose, created_at DESC);
