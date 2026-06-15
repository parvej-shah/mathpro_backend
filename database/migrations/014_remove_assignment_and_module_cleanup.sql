-- Migration 014: Remove the Assignment feature + chapter/module field cleanup +
-- Live-Class toggle fields on module.
--
-- Quiz stays (MCQ auto-marked). Assignment is removed entirely — it is the only
-- human-graded, file-upload feature, and submission/assignment_files exist only to serve
-- it. Confirmed no production data → drop directly, no backup. Fresh server: no backfill.

-- 1. Assignment feature teardown. Drop children before parents:
--    assignment_files has FKs to BOTH assignment and submission.
DROP TABLE IF EXISTS assignment_files;
DROP TABLE IF EXISTS submission;
DROP TABLE IF EXISTS assignment;

-- Drop the partial index that depends on will_evaluated before dropping the column.
DROP INDEX IF EXISTS idx_module_chapter_will_evaluated;
ALTER TABLE module DROP COLUMN IF EXISTS will_evaluated;
ALTER TABLE module DROP COLUMN IF EXISTS assignment_question_doc_url;
ALTER TABLE module DROP COLUMN IF EXISTS assignment_question_doc_type;
-- Keep quiz_time_limit / quiz_attempt_limit — quiz still uses them.

-- 1b. CODE feature teardown. The CODE module type (online compiler via Judge0/RapidAPI +
--     Codeforces) is removed entirely. Drop its backing tables (both cascade from module).
DROP TABLE IF EXISTS compilation;
DROP TABLE IF EXISTS editorial_view;

-- 2. Chapter phase removal (no longer used).
ALTER TABLE chapter DROP COLUMN IF EXISTS phase;

-- 3. Module instructor link removal (modules no longer carry an instructor).
ALTER TABLE module DROP CONSTRAINT IF EXISTS fk_module_instructor;
ALTER TABLE module DROP COLUMN IF EXISTS instructor_id;

-- 4. Live-Class toggle fields on module. A normal VIDEO module gains an optional live
--    overlay — no type switching. `is_live boolean` already exists and acts as the toggle.
--    Zoom fields mirror the existing `live` table convention (meeting_id + meeting_pass).
--    The post-class recording reuses the module's normal VIDEO data (videoUrl/videoHost) —
--    no recording column needed; on ENDED the module renders as a regular video.
ALTER TABLE module ADD COLUMN IF NOT EXISTS live_status       VARCHAR(20);   -- NULL = not live; SCHEDULED|LIVE|ENDED
ALTER TABLE module ADD COLUMN IF NOT EXISTS live_meeting_id   VARCHAR(100);
ALTER TABLE module ADD COLUMN IF NOT EXISTS live_meeting_pass VARCHAR(100);
ALTER TABLE module ADD COLUMN IF NOT EXISTS live_scheduled_at INTEGER;       -- epoch seconds (matches `live` table style)
