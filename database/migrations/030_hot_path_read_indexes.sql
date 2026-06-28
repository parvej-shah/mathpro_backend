-- Hot-path read indexes for student-facing traffic.
-- These are additive and target the most common filter/order patterns found in
-- course detail, dashboard, module navigation, enrollment checks, and public catalog reads.

-- Modules are read per chapter and displayed in serial order.
CREATE INDEX IF NOT EXISTS idx_module_chapter_serial
    ON module (chapter_id, serial);

-- Enrollments are often queried by course first (counts, joins, notification fanout).
CREATE INDEX IF NOT EXISTS idx_takes_course_user
    ON takes (course_id, user_id);

-- Bundles are often expanded to their child courses by bundle_id.
CREATE INDEX IF NOT EXISTS idx_bundle_course_bundle_course
    ON bundle_course (bundle_id, course_id);

-- Resume/dashboard queries look up the latest user progress by timestamp.
CREATE INDEX IF NOT EXISTS idx_progress_user_timestamp_desc
    ON progress (user_id, timestamp DESC);

-- Public course detail counts and analytics read prebookings by course.
CREATE INDEX IF NOT EXISTS idx_prebooking_course
    ON prebooking (course_id);

-- Public catalog reads filter live courses and sort by serial.
CREATE INDEX IF NOT EXISTS idx_course_is_live_serial
    ON course (is_live, serial);
