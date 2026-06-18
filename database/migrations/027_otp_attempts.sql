-- Track failed verification attempts per OTP so a code can be locked after N bad
-- tries (brute-force protection). Existing rows default to 0.
ALTER TABLE otp
    ADD COLUMN IF NOT EXISTS attempts integer DEFAULT 0;
