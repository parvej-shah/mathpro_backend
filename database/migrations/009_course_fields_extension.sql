-- Migration 009: Course structure redesign.
-- Adds flat fields: slug, total_seats, tags, course_outline.
-- Schedule dates (prebooking/enrollment/course start) live inside chips.enrollment_details
-- (unix seconds) instead of flat columns, so no date columns are added here.
-- Removes study_plan_chips (you_get is sufficient). Fresh server: no data backfill needed.
ALTER TABLE course ADD COLUMN IF NOT EXISTS slug           VARCHAR(255);
ALTER TABLE course ADD COLUMN IF NOT EXISTS total_seats    INTEGER;
ALTER TABLE course ADD COLUMN IF NOT EXISTS tags           JSON;
ALTER TABLE course ADD COLUMN IF NOT EXISTS course_outline VARCHAR(1000);  -- Google Drive / any URL

ALTER TABLE course DROP COLUMN IF EXISTS study_plan_chips;

-- Schedule dates moved into chips.enrollment_details; drop any flat date columns
-- (these may exist if an earlier draft of this migration was applied).
ALTER TABLE course DROP COLUMN IF EXISTS prebooking_end_date;
ALTER TABLE course DROP COLUMN IF EXISTS enrollment_end_date;
ALTER TABLE course DROP COLUMN IF EXISTS course_start_date;

-- Pretty route id, distinct from the legacy external `url`. Unique when present.
CREATE UNIQUE INDEX IF NOT EXISTS uq_course_slug ON course(slug) WHERE slug IS NOT NULL;
