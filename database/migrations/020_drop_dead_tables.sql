-- Drop tables that have zero code references and are not part of the current product.
-- Ordered to respect FK dependencies (children before parents).

-- Assignment ecosystem (no routes, no queries)
DROP TABLE IF EXISTS assignment_files;
DROP TABLE IF EXISTS submission;
DROP TABLE IF EXISTS assignment;

-- in_pr ecosystem (generic nested-content prototype, never shipped)
DROP TABLE IF EXISTS in_pr;

-- Clone scaffolding (never implemented)
DROP TABLE IF EXISTS chapter_clone;
DROP TABLE IF EXISTS module_clone;

-- Competitive programming leftovers (not part of this LMS)
DROP TABLE IF EXISTS editorial_view;
DROP TABLE IF EXISTS compilation;

-- Marketing / comms tables with no live code
DROP TABLE IF EXISTS public_notifications;
DROP TABLE IF EXISTS sms_recipients;
DROP TABLE IF EXISTS sms_history;
