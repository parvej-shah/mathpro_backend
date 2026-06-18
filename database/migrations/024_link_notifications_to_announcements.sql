-- Link per-user course notifications back to their source announcement.
-- This keeps announcement content in one place while notification rows retain read state.

ALTER TABLE notification
    ADD COLUMN IF NOT EXISTS announcement_id integer;

ALTER TABLE notification
    ADD CONSTRAINT fk_notification_announcement
        FOREIGN KEY (announcement_id)
        REFERENCES announcements(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_notification_course_user_timestamp
    ON notification (course_id, user_id, timestamp DESC);
