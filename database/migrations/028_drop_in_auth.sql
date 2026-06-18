-- Remove the legacy, dead student-auth table. The canonical student identity is
-- managerial_auth (type=3); the Frontend authenticates via /admin/auth/*.
-- The /in/auth routes/controller/service that used this table are removed in the
-- same change. No other code references in_auth.
DROP TABLE IF EXISTS in_auth;
