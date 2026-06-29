CREATE INDEX IF NOT EXISTS idx_managerial_auth_active_category
    ON managerial_auth (
        COALESCE((profile->>'isActive')::boolean, true),
        (profile->>'category'),
        id
    );
