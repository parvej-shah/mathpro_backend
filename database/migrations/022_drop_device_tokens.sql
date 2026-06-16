-- Drop unused device token storage.
-- The backend currently has no live code that reads or writes device_tokens.
DROP TABLE IF EXISTS device_tokens;
