-- Speed up chapter listing for course detail/dashboard/module-navigation reads.
-- Hot query shape:
--   SELECT * FROM chapter WHERE course_id = $1 ORDER BY serial
CREATE INDEX IF NOT EXISTS idx_chapter_course_serial
    ON chapter (course_id, serial);
