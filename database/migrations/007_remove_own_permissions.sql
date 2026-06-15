-- Migration 007: Remove .own scoped permissions from all roles
--
-- The .own permission scope (e.g. course.manage.own) was defined but never
-- enforced at the data layer and has been removed from the codebase.
-- This migration strips any residual .own permission strings from role
-- permissions arrays stored as JSONB.
--
-- Safe to run multiple times (idempotent).

UPDATE roles
SET permissions = (
    SELECT jsonb_agg(perm)
    FROM jsonb_array_elements_text(permissions) AS perm
    WHERE perm NOT LIKE '%.own'
)
WHERE permissions @> '[]'::jsonb   -- only touch rows that have an array
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(permissions) AS perm
    WHERE perm LIKE '%.own'
  );
