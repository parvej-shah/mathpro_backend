-- Migration: Drop obsolete login_type column from managerial_auth
-- Auth is now email-only; managerial_auth.login mirrors email.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'managerial_auth'
          AND column_name = 'login_type'
    ) THEN
        ALTER TABLE managerial_auth DROP COLUMN login_type;
        RAISE NOTICE 'Dropped managerial_auth.login_type';
    ELSE
        RAISE NOTICE 'managerial_auth.login_type does not exist, skipping';
    END IF;
END $$;
