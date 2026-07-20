-- Optional patient email: phone remains the primary contact identifier.
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

UPDATE users SET email = NULL WHERE btrim(email) = '';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
  ON users (lower(email))
  WHERE email IS NOT NULL AND btrim(email) <> '';
