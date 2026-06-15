CREATE INDEX IF NOT EXISTS idx_coupon_usage_user_course_transaction
    ON coupon_usage (user_id, course_id, transaction_id);

CREATE INDEX IF NOT EXISTS idx_coupon_usage_user_bundle_transaction
    ON coupon_usage (user_id, bundle_id, transaction_id);
