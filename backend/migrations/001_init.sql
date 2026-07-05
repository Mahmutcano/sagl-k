-- Medical Consultation Platform — initial schema
-- Standard snake_case table names

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE user_role AS ENUM ('patient', 'doctor', 'nurse', 'admin');
CREATE TYPE application_status AS ENUM (
  'payment_pending',      -- 0
  'payment_completed',    -- 1
  'approved',             -- 2
  'rejected',             -- 3
  'in_progress',          -- 4
  'info_required',        -- 5
  'concluded',            -- 6
  'cancelled',            -- 7
  'refund_pending',       -- 8
  'refunded',             -- 9
  'doctor_approval_pending',-- 10
  'medical_secretary'     -- 11
);
CREATE TYPE notification_channel AS ENUM ('sms', 'email');
CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'failed', 'delivered');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded', 'partial_refund');
CREATE TYPE payment_provider AS ENUM ('param', 'bizim_hesap', 'free');

-- Hospitals / institutions
CREATE TABLE hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  target_institution SMALLINT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  national_identifier VARCHAR(20),
  passport_number VARCHAR(50),
  email VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  phone_country_code VARCHAR(5) DEFAULT '+90',
  password_hash TEXT NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100),
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE,
  gender SMALLINT,
  nationality VARCHAR(3) DEFAULT 'TR',
  role user_role NOT NULL DEFAULT 'patient',
  is_email_verified BOOLEAN NOT NULL DEFAULT false,
  is_phone_verified BOOLEAN NOT NULL DEFAULT false,
  is_developer BOOLEAN NOT NULL DEFAULT false,
  hospital_id UUID REFERENCES hospitals(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email),
  UNIQUE(phone_number, phone_country_code)
);

CREATE INDEX idx_users_national_id ON users(national_identifier);
CREATE INDEX idx_users_role ON users(role);

-- Professions (branches)
CREATE TABLE professions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  target_institution SMALLINT NOT NULL DEFAULT 1,
  hospital_id UUID REFERENCES hospitals(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(code, target_institution)
);

-- Doctors / care providers
CREATE TABLE care_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  hospital_id UUID REFERENCES hospitals(id),
  profession_id UUID REFERENCES professions(id),
  identity_number VARCHAR(20),
  title VARCHAR(100),
  full_name VARCHAR(255) NOT NULL,
  profession_code VARCHAR(50),
  target_institution SMALLINT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_care_providers_profession ON care_providers(profession_code, target_institution);

-- Agreements
CREATE TABLE agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_type SMALLINT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content_url TEXT,
  content_html TEXT,
  nationality VARCHAR(3) DEFAULT 'TR',
  is_required BOOLEAN NOT NULL DEFAULT true,
  version INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agreement_id UUID NOT NULL REFERENCES agreements(id),
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- OTP / verification tokens
CREATE TABLE verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  phone_number VARCHAR(20),
  email VARCHAR(255),
  token VARCHAR(10) NOT NULL,
  purpose VARCHAR(50) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_verification_tokens_phone ON verification_tokens(phone_number, purpose);

-- Applications
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id),
  hospital_id UUID REFERENCES hospitals(id),
  target_institution SMALLINT NOT NULL DEFAULT 1,
  status application_status NOT NULL DEFAULT 'payment_pending',
  status_code SMALLINT NOT NULL DEFAULT 0,
  ecommerce_number VARCHAR(50),
  external_order_number VARCHAR(100),
  profession_code VARCHAR(50),
  profession_name VARCHAR(255),
  care_provider_id UUID REFERENCES care_providers(id),
  doctor_user_id UUID REFERENCES users(id),
  doctor_rejection_reason TEXT,
  doctor_rejected_at TIMESTAMPTZ,
  is_for_relative BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_applications_owner ON applications(owner_user_id);
CREATE INDEX idx_applications_status ON applications(status_code);
CREATE INDEX idx_applications_ecommerce ON applications(ecommerce_number);

-- Represented person (when applying for relative)
CREATE TABLE application_represented_persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  national_identifier VARCHAR(20),
  birth_date DATE,
  gender SMALLINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Survey + başvuru raporu (JSON; base64 PDF yok)
CREATE TABLE application_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
  survey_name VARCHAR(255) NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  report_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Doctor draft report (JSON only)
CREATE TABLE application_temporal_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  author_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_temporal_reports_app ON application_temporal_reports(application_id, updated_at DESC);

-- Final doktor raporu (JSON; base64 PDF yok)
CREATE TABLE application_final_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
  report_json JSONB NOT NULL DEFAULT '{}',
  author_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Attachments
CREATE TABLE application_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100),
  storage_path TEXT NOT NULL,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Status history / audit trail
CREATE TABLE application_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  old_status_code SMALLINT,
  new_status_code SMALLINT NOT NULL,
  note TEXT,
  actor_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_app_status_history ON application_status_history(application_id, created_at DESC);

-- Notes
CREATE TABLE application_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payments / invoices
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id),
  user_id UUID NOT NULL REFERENCES users(id),
  provider payment_provider NOT NULL,
  provider_transaction_id VARCHAR(255),
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'TRY',
  status payment_status NOT NULL DEFAULT 'pending',
  idempotency_key VARCHAR(100) UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_application ON payments(application_id);

-- Refunds
CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id),
  application_id UUID NOT NULL REFERENCES applications(id),
  amount DECIMAL(12,2) NOT NULL,
  reason TEXT,
  provider_refund_id VARCHAR(255),
  status payment_status NOT NULL DEFAULT 'pending',
  processed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- Notification logs (SMS / Email tracking for admin)
CREATE TABLE notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel notification_channel NOT NULL,
  recipient VARCHAR(255) NOT NULL,
  subject VARCHAR(255),
  body_preview TEXT,
  template_key VARCHAR(100),
  status notification_status NOT NULL DEFAULT 'pending',
  provider_response JSONB,
  user_id UUID REFERENCES users(id),
  application_id UUID REFERENCES applications(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX idx_notification_logs_channel ON notification_logs(channel, created_at DESC);
CREATE INDEX idx_notification_logs_recipient ON notification_logs(recipient);

-- Admin audit log
CREATE TABLE admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  payload JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed: yalnızca Erciyes (harici marka / üçüncü taraf kurum verisi yok)
INSERT INTO hospitals (code, name, target_institution, settings) VALUES
  ('erciyes', 'Erciyes Üniversitesi Tıp Fakültesi', 1, '{"inpatient_warning":true}');

-- Admin: TC 10000000146 / şifre Admin123!
-- Doktor: TC 20000000114 / şifre Doctor123!
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
);

INSERT INTO professions (code, name, target_institution) VALUES
  ('cardiology', 'Kardiyoloji', 1),
  ('oncology', 'Onkoloji', 1),
  ('neurology', 'Nöroloji', 1);

INSERT INTO care_providers (full_name, title, profession_code, target_institution) VALUES
  ('Ayşe Yılmaz', 'Prof. Dr.', 'cardiology', 1),
  ('Mehmet Demir', 'Doç. Dr.', 'cardiology', 1),
  ('Zeynep Kaya', 'Prof. Dr.', 'oncology', 1),
  ('Ali Çelik', 'Uzm. Dr.', 'neurology', 1);
