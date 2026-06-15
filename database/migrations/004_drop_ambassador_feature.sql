-- Migration: remove legacy ambassador feature data model and permissions.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'managerial_auth'
          AND column_name = 'is_ambassador'
    ) THEN
        ALTER TABLE managerial_auth DROP COLUMN is_ambassador;
        RAISE NOTICE 'Dropped managerial_auth.is_ambassador';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'coupon_usage'
          AND column_name = 'ambassador_id'
    ) THEN
        ALTER TABLE coupon_usage DROP COLUMN ambassador_id;
        RAISE NOTICE 'Dropped coupon_usage.ambassador_id';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'coupon_usage'
          AND column_name = 'commission_generated'
    ) THEN
        ALTER TABLE coupon_usage DROP COLUMN commission_generated;
        RAISE NOTICE 'Dropped coupon_usage.commission_generated';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'coupon_clicks'
          AND column_name = 'ambassador_id'
    ) THEN
        ALTER TABLE coupon_clicks DROP COLUMN ambassador_id;
        RAISE NOTICE 'Dropped coupon_clicks.ambassador_id';
    END IF;
END $$;

DROP INDEX IF EXISTS idx_coupon_clicks_ambassador_coupon;
DROP INDEX IF EXISTS idx_coupon_clicks_ambassador_id;
DROP INDEX IF EXISTS idx_coupon_usage_ambassador_id;
DROP INDEX IF EXISTS idx_is_ambassador;

DROP FUNCTION IF EXISTS deactivate_ambassador_coupons() CASCADE;
DROP FUNCTION IF EXISTS get_ambassador_tier(integer) CASCADE;
DROP FUNCTION IF EXISTS update_ambassador_course_commission_timestamp() CASCADE;
DROP FUNCTION IF EXISTS update_ambassador_milestones_timestamp() CASCADE;
DROP FUNCTION IF EXISTS update_ambassador_payments_timestamp() CASCADE;
DROP FUNCTION IF EXISTS update_ambassador_stats() CASCADE;
DROP FUNCTION IF EXISTS update_ambassador_tiers_timestamp() CASCADE;
DROP FUNCTION IF EXISTS update_course_commission_timestamp() CASCADE;

DROP TABLE IF EXISTS ambassador_milestone_progress CASCADE;
DROP TABLE IF EXISTS ambassador_payments CASCADE;
DROP TABLE IF EXISTS ambassador_commissions CASCADE;
DROP TABLE IF EXISTS ambassador_coupons CASCADE;
DROP TABLE IF EXISTS ambassadors CASCADE;
DROP TABLE IF EXISTS ambassador_milestones CASCADE;
DROP TABLE IF EXISTS ambassador_tiers CASCADE;
DROP TABLE IF EXISTS course_commissions CASCADE;

DELETE FROM roles WHERE name = 'ambassador';

UPDATE roles
SET permissions = COALESCE(
    (
        SELECT jsonb_agg(permission)
        FROM jsonb_array_elements_text(COALESCE(roles.permissions, '[]'::jsonb)) AS permission
        WHERE permission NOT LIKE 'ambassador.%'
    ),
    '[]'::jsonb
)
WHERE permissions IS NOT NULL;
