-- coupon_restrictions was never wired into any application code (superseded by
-- coupon_courses/coupon_bundles/coupon_books join tables). Dropping unused schema.
DROP TABLE IF EXISTS coupon_restrictions;
