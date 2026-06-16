-- Drop unused notification infrastructure tables.
-- The system only uses the `notification` table directly (insert + read).
-- These were scaffolded for a provider/template/job system that was never implemented.
DROP TABLE IF EXISTS notification_log;
DROP TABLE IF EXISTS notification_jobs;
DROP TABLE IF EXISTS notification_templates;
DROP TABLE IF EXISTS notification_providers;
DROP TABLE IF EXISTS notification_event_channel_config;
