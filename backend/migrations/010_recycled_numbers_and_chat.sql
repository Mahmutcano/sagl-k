-- Geri dönüştürülebilir başvuru numaraları
CREATE TABLE IF NOT EXISTS recycled_application_numbers (
    number TEXT PRIMARY KEY,
    recycled_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hasta–doktor mesajlaşma
CREATE TABLE IF NOT EXISTS application_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    sender_user_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL CHECK (char_length(trim(content)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_application_messages_app_created
    ON application_messages(application_id, created_at);

CREATE INDEX IF NOT EXISTS idx_application_messages_unread
    ON application_messages(application_id, read_at)
    WHERE read_at IS NULL;
