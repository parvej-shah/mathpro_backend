-- Migration: Drop obsolete legacy identity columns from managerial_auth
-- These fields existed in the old baseline but are no longer used by current code.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'managerial_auth'
          AND column_name = 'cf_handle'
    ) THEN
        ALTER TABLE managerial_auth DROP COLUMN cf_handle;
        RAISE NOTICE 'Dropped managerial_auth.cf_handle';
    ELSE
        RAISE NOTICE 'managerial_auth.cf_handle does not exist, skipping';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'managerial_auth'
          AND column_name = 'is_privileged'
    ) THEN
        ALTER TABLE managerial_auth DROP COLUMN is_privileged;
        RAISE NOTICE 'Dropped managerial_auth.is_privileged';
    ELSE
        RAISE NOTICE 'managerial_auth.is_privileged does not exist, skipping';
    END IF;
END $$;
