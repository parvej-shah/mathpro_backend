-- Migration: remove legacy course_access table and related database objects.

DROP TRIGGER IF EXISTS trg_enforce_course_access_user_type ON course_access;
DROP FUNCTION IF EXISTS enforce_course_access_user_type() CASCADE;

DROP INDEX IF EXISTS idx_course_access_course_id;
DROP INDEX IF EXISTS idx_course_access_user_course;
DROP INDEX IF EXISTS idx_course_access_user_id;

DROP TABLE IF EXISTS course_access CASCADE;
