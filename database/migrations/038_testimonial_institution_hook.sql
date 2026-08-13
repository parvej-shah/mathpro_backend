ALTER TABLE feedbacks
    ADD COLUMN IF NOT EXISTS institution_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS institution_logo_url TEXT,
    ADD COLUMN IF NOT EXISTS hook_text TEXT;
