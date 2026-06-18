-- Phone becomes a primary identifier for regular users (type=3).
-- Enforce uniqueness of phone among regular users while allowing NULL for legacy
-- email-only accounts (partial unique index). Admins/moderators are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS uq_managerial_auth_phone_regular
    ON managerial_auth (phone)
    WHERE type = 3 AND phone IS NOT NULL;
