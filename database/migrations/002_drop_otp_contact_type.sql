-- Migration: Drop obsolete contact_type column from otp
-- OTP delivery is now email-only.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'otp'
          AND column_name = 'contact_type'
    ) THEN
        ALTER TABLE otp DROP COLUMN contact_type;
        RAISE NOTICE 'Dropped otp.contact_type';
    ELSE
        RAISE NOTICE 'otp.contact_type does not exist, skipping';
    END IF;
END $$;
