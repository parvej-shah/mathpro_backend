ALTER TABLE course ADD COLUMN IF NOT EXISTS is_free boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_course_is_free ON course (is_free) WHERE is_free = true;
